"""Slice 0B LightFM matrix viability and native-crash guard checks.

This module uses synthetic structural matrices only. It never connects to the
ImpactLoop database or reads the catalog.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import pickle
import platform
import random
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable

import numpy as np
from lightfm import LightFM
from lightfm.data import Dataset
from lightfm.evaluation import precision_at_k
from scipy import sparse


ROOT = Path(__file__).resolve().parents[2]
FIXED_SEED = 1
DEFAULT_TIMEOUT_SECONDS = 300


@dataclass(frozen=True)
class ViabilityConfig:
    name: str
    domain: str
    users: int
    items: int
    positive_pairs: int
    components: int
    epochs: int
    feature_mode: str = "identity"


CONFIGS: dict[str, ViabilityConfig] = {
    "material_300x160_3000_small": ViabilityConfig(
        "material_300x160_3000_small", "materials", 300, 160, 3000, 8, 5
    ),
    "material_300x160_5000_default": ViabilityConfig(
        "material_300x160_5000_default", "materials", 300, 160, 5000, 16, 10
    ),
    "material_300x160_7500_upper": ViabilityConfig(
        "material_300x160_7500_upper", "materials", 300, 160, 7500, 32, 10
    ),
    "material_300x160_5000_warm_features": ViabilityConfig(
        "material_300x160_5000_warm_features",
        "materials",
        300,
        160,
        5000,
        16,
        10,
        "warm",
    ),
    "material_300x160_5000_metadata_only": ViabilityConfig(
        "material_300x160_5000_metadata_only",
        "materials",
        300,
        160,
        5000,
        16,
        10,
        "metadata_only",
    ),
    "project_300x29_1500_small": ViabilityConfig(
        "project_300x29_1500_small", "projects", 300, 29, 1500, 8, 5
    ),
    "project_300x29_2500_default": ViabilityConfig(
        "project_300x29_2500_default", "projects", 300, 29, 2500, 16, 10
    ),
    "project_300x29_4000_upper": ViabilityConfig(
        "project_300x29_4000_upper", "projects", 300, 29, 4000, 32, 10
    ),
    "project_300x29_2500_warm_features": ViabilityConfig(
        "project_300x29_2500_warm_features",
        "projects",
        300,
        29,
        2500,
        16,
        10,
        "warm",
    ),
    "project_300x29_2500_metadata_only": ViabilityConfig(
        "project_300x29_2500_metadata_only",
        "projects",
        300,
        29,
        2500,
        16,
        10,
        "metadata_only",
    ),
}


class MatrixPreflightError(ValueError):
    """Raised when a sparse input is unsafe or unusable for native LightFM."""


def _finite(values: np.ndarray, name: str) -> None:
    if not np.isfinite(values).all():
        raise MatrixPreflightError(f"{name} contains NaN or infinite values")


def preflight_sparse_matrix(
    matrix: sparse.spmatrix,
    *,
    expected_shape: tuple[int, int],
    name: str,
    sample_weight: sparse.spmatrix | None = None,
    feature_matrix: sparse.spmatrix | None = None,
    feature_rows: int | None = None,
    k: int | None = None,
) -> sparse.csr_matrix:
    """Validate and canonicalize a matrix before entering LightFM native code."""

    if not sparse.issparse(matrix):
        raise MatrixPreflightError(f"{name} is not sparse")

    canonical = matrix.tocsr(copy=True)
    canonical.sum_duplicates()
    canonical.sort_indices()

    if canonical.shape != expected_shape:
        raise MatrixPreflightError(
            f"{name} shape {canonical.shape} != expected {expected_shape}"
        )
    canonical.check_format(full_check=True)
    if (canonical.indices < 0).any() or (canonical.indptr < 0).any():
        raise MatrixPreflightError(f"{name} contains negative sparse indices")
    if canonical.indices.size and canonical.indices.max() >= expected_shape[1]:
        raise MatrixPreflightError(f"{name} contains out-of-range item indices")
    _finite(canonical.data, name)
    if canonical.data.size and (canonical.data <= 0).any():
        raise MatrixPreflightError(f"{name} contains non-positive interaction weights")
    if not canonical.has_canonical_format or not canonical.has_sorted_indices:
        raise MatrixPreflightError(f"{name} is not canonical sorted CSR")

    row_counts = np.diff(canonical.indptr)
    if (row_counts <= 0).any():
        raise MatrixPreflightError(f"{name} contains a training user with no positives")
    if (row_counts >= expected_shape[1]).any():
        raise MatrixPreflightError(
            f"{name} contains a user with no eligible non-positive item"
        )
    if k is not None and k > expected_shape[1]:
        raise MatrixPreflightError(f"K={k} exceeds eligible population {expected_shape[1]}")

    if sample_weight is not None:
        weights = sample_weight.tocsr(copy=True)
        weights.sum_duplicates()
        weights.sort_indices()
        if weights.shape != canonical.shape:
            raise MatrixPreflightError(
                f"sample weights shape {weights.shape} != {canonical.shape}"
            )
        weights.check_format(full_check=True)
        _finite(weights.data, "sample weights")
        if weights.data.size and (weights.data <= 0).any():
            raise MatrixPreflightError("sample weights contain non-positive values")

    if feature_matrix is not None:
        features = feature_matrix.tocsr(copy=True)
        features.sum_duplicates()
        features.sort_indices()
        if feature_rows is None or features.shape[0] != feature_rows:
            raise MatrixPreflightError(
                f"feature rows {features.shape[0]} != expected {feature_rows}"
            )
        features.check_format(full_check=True)
        _finite(features.data, "feature matrix")
        if features.data.size and (features.data <= 0).any():
            raise MatrixPreflightError("feature matrix contains non-positive values")
        if (np.diff(features.indptr) <= 0).any():
            raise MatrixPreflightError("feature matrix contains an empty entity row")

    return canonical


def _synthetic_pairs(users: int, items: int, count: int, seed: int) -> list[tuple[int, int]]:
    if count < users or count >= users * items:
        raise ValueError("positive pair count must leave every user a non-positive item")

    rng = random.Random(seed)
    pairs = {(user, user % items) for user in range(users)}
    while len(pairs) < count:
        pairs.add((rng.randrange(users), rng.randrange(items)))
    return sorted(pairs)


def _feature_names(domain: str) -> tuple[list[str], list[str]]:
    user_features = (
        [f"interest_{index:02d}" for index in range(13)]
        + [f"location_{index:02d}" for index in range(5)]
        + ["free_paid_free", "free_paid_paid", "free_paid_mixed"]
        + ["delivery_yes", "delivery_no", "delivery_mixed"]
        + ["activity_low", "activity_medium", "activity_high"]
        + ["persona_stable", "persona_shifting", "persona_exploratory"]
    )
    if domain == "materials":
        item_features = (
            [f"category_{index:02d}" for index in range(8)]
            + [f"material_type_{index:02d}" for index in range(8)]
            + [f"tag_{index:02d}" for index in range(16)]
            + [f"concept_{index:02d}" for index in range(12)]
            + ["condition_new", "condition_used", "condition_repair"]
            + ["free", "paid", "delivery", "pickup", "location_local"]
        )
    else:
        item_features = (
            [f"topic_{index:02d}" for index in range(8)]
            + [f"tag_{index:02d}" for index in range(16)]
            + [f"difficulty_{value}" for value in ("beginner", "intermediate", "advanced")]
            + [f"component_{index:02d}" for index in range(16)]
        )
    return sorted(user_features), sorted(item_features)


def _feature_rows(
    entity_ids: list[str], names: list[str], *, salt: int
) -> list[tuple[str, list[str]]]:
    rows: list[tuple[str, list[str]]] = []
    for index, entity_id in enumerate(entity_ids):
        first = names[(index + salt) % len(names)]
        second = names[(index * 3 + salt + 1) % len(names)]
        rows.append((entity_id, sorted({first, second})))
    return rows


def build_dataset(config: ViabilityConfig) -> dict[str, Any]:
    users = [f"u{index:04d}" for index in range(config.users)]
    items = [f"i{index:04d}" for index in range(config.items)]
    pairs = _synthetic_pairs(config.users, config.items, config.positive_pairs, FIXED_SEED)
    dataset_kwargs: dict[str, Any] = {}
    user_feature_names, item_feature_names = _feature_names(config.domain)

    if config.feature_mode == "metadata_only":
        dataset_kwargs = {"user_identity_features": False, "item_identity_features": False}

    dataset = Dataset(**dataset_kwargs)
    dataset.fit(
        users,
        items,
        user_features=user_feature_names if config.feature_mode != "identity" else None,
        item_features=item_feature_names if config.feature_mode != "identity" else None,
    )
    interactions, weights = dataset.build_interactions(
        (users[user], items[item], 1.0) for user, item in pairs
    )

    user_features = None
    item_features = None
    if config.feature_mode != "identity":
        user_features = dataset.build_user_features(
            _feature_rows(users, user_feature_names, salt=2), normalize=True
        )
        item_features = dataset.build_item_features(
            _feature_rows(items, item_feature_names, salt=5), normalize=True
        )

    preflight_sparse_matrix(
        interactions,
        expected_shape=(config.users, config.items),
        name="interactions",
        sample_weight=weights,
        feature_matrix=user_features,
        feature_rows=config.users if user_features is not None else None,
        k=10,
    )
    if item_features is not None:
        preflight_sparse_matrix(
            interactions,
            expected_shape=(config.users, config.items),
            name="interactions_for_item_features",
            feature_matrix=item_features,
            feature_rows=config.items,
            k=10,
        )

    return {
        "dataset": dataset,
        "users": users,
        "items": items,
        "pairs": pairs,
        "interactions": interactions.tocsr(),
        # LightFM's public fit API requires sample_weight to remain COO.
        # Preflight canonicalizes a copy for validation without changing the
        # type passed into the native training path.
        "weights": weights,
        "user_features": user_features,
        "item_features": item_features,
        "user_feature_names": user_feature_names,
        "item_feature_names": item_feature_names,
    }


def _peak_working_set() -> int | None:
    if os.name != "nt":
        return None
    import ctypes
    from ctypes import wintypes

    class Counters(ctypes.Structure):
        _fields_ = [
            ("cb", wintypes.DWORD),
            ("PageFaultCount", wintypes.DWORD),
            ("PeakWorkingSetSize", ctypes.c_size_t),
            ("WorkingSetSize", ctypes.c_size_t),
            ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPagedPoolUsage", ctypes.c_size_t),
            ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
            ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
            ("PagefileUsage", ctypes.c_size_t),
            ("PeakPagefileUsage", ctypes.c_size_t),
        ]

    counters = Counters()
    counters.cb = ctypes.sizeof(Counters)
    ok = ctypes.windll.psapi.GetProcessMemoryInfo(
        ctypes.windll.kernel32.GetCurrentProcess(),
        ctypes.byref(counters),
        counters.cb,
    )
    return int(counters.PeakWorkingSetSize) if ok else None


def run_child(config: ViabilityConfig) -> dict[str, Any]:
    random.seed(FIXED_SEED)
    np.random.seed(FIXED_SEED)
    dataset_info = build_dataset(config)
    dataset = dataset_info["dataset"]
    interactions = dataset_info["interactions"]
    user_features = dataset_info["user_features"]
    item_features = dataset_info["item_features"]

    model = LightFM(
        loss="warp",
        no_components=config.components,
        random_state=FIXED_SEED,
    )
    peak = _peak_working_set()
    started = time.perf_counter()
    model.fit(
        interactions,
        sample_weight=dataset_info["weights"],
        user_features=user_features,
        item_features=item_features,
        epochs=config.epochs,
        num_threads=1,
        verbose=False,
    )
    fit_seconds = time.perf_counter() - started
    peak = max(peak or 0, _peak_working_set() or 0) or None

    representative_users = np.array(
        sorted({0, config.users // 2, config.users - 1}), dtype=np.int32
    )
    all_items = np.arange(config.items, dtype=np.int32)
    rep_user_ids = np.repeat(representative_users, config.items)
    rep_item_ids = np.tile(all_items, len(representative_users))
    predict_started = time.perf_counter()
    representative_predictions = model.predict(
        rep_user_ids,
        rep_item_ids,
        user_features=user_features,
        item_features=item_features,
        num_threads=1,
    )

    all_user_predictions: list[np.ndarray] = []
    for start in range(0, config.users, 32):
        batch_users = np.arange(start, min(start + 32, config.users), dtype=np.int32)
        all_user_predictions.append(
            model.predict(
                np.repeat(batch_users, config.items),
                np.tile(all_items, len(batch_users)),
                user_features=user_features,
                item_features=item_features,
                num_threads=1,
            )
        )
    prediction_seconds = time.perf_counter() - predict_started
    peak = max(peak or 0, _peak_working_set() or 0) or None

    eval_started = time.perf_counter()
    precision = float(
        precision_at_k(
            model,
            interactions,
            k=1,
            user_features=user_features,
            item_features=item_features,
            num_threads=1,
        ).mean()
    )
    evaluation_seconds = time.perf_counter() - eval_started

    serialize_started = time.perf_counter()
    serialized = pickle.dumps(model, protocol=5)
    loaded = pickle.loads(serialized)
    reloaded_predictions = loaded.predict(
        rep_user_ids,
        rep_item_ids,
        user_features=user_features,
        item_features=item_features,
        num_threads=1,
    )
    serialization_seconds = time.perf_counter() - serialize_started
    peak = max(peak or 0, _peak_working_set() or 0) or None

    return {
        "configuration": asdict(config),
        "matrix": {
            "shape": list(interactions.shape),
            "nnz": int(interactions.nnz),
            "density": float(interactions.nnz / (config.users * config.items)),
        },
        "features": {
            "user_shape": list(user_features.shape) if user_features is not None else None,
            "item_shape": list(item_features.shape) if item_features is not None else None,
            "user_feature_count": len(dataset_info["user_feature_names"]),
            "item_feature_count": len(dataset_info["item_feature_names"]),
            "identity_enabled": config.feature_mode in ("identity", "warm"),
            "user_identity_feature_columns": sorted(
                set(dataset_info["users"]) & set(dataset._user_feature_mapping)
            ),
            "item_identity_feature_columns": sorted(
                set(dataset_info["items"]) & set(dataset._item_feature_mapping)
            ),
        },
        "model": {
            "loss": "warp",
            "no_components": config.components,
            "epochs": config.epochs,
            "random_state": FIXED_SEED,
            "num_threads": 1,
        },
        "timing_seconds": {
            "fit": fit_seconds,
            "prediction_all_users": prediction_seconds,
            "evaluation": evaluation_seconds,
            "serialization_reload": serialization_seconds,
        },
        "precision_at_1": precision,
        "representative_prediction_count": int(representative_predictions.size),
        "all_user_prediction_count": int(sum(array.size for array in all_user_predictions)),
        "reload_prediction_parity": bool(
            np.array_equal(representative_predictions, reloaded_predictions)
        ),
        "model_bytes": len(serialized),
        "peak_working_set_bytes": peak,
        "status": "PASS",
    }


def invalid_matrix_checks() -> list[dict[str, str]]:
    checks: list[dict[str, str]] = []
    cases = {
        "all_items_positive": sparse.csr_matrix(np.ones((1, 3), dtype=np.float32)),
        "nan_weight": sparse.csr_matrix(np.array([[np.nan, 0.0]], dtype=np.float32)),
        "negative_weight": sparse.csr_matrix(np.array([[-1.0, 0.0]], dtype=np.float32)),
    }
    for name, matrix in cases.items():
        try:
            preflight_sparse_matrix(matrix, expected_shape=matrix.shape, name=name, k=3)
        except MatrixPreflightError as error:
            checks.append({"case": name, "status": "REJECTED", "reason": str(error)})
        else:
            checks.append({"case": name, "status": "UNEXPECTEDLY_ACCEPTED", "reason": ""})
    return checks


def _child_command(name: str) -> list[str]:
    return [sys.executable, "-m", "ml.recommendation.viability", "--child", "--config", name]


def run_isolated(name: str, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> dict[str, Any]:
    config = CONFIGS[name]
    command = _child_command(name)
    environment = os.environ.copy()
    environment["PYTHONHASHSEED"] = "0"
    completed = subprocess.run(
        command,
        cwd=ROOT,
        capture_output=True,
        text=True,
        env=environment,
        timeout=timeout,
    )
    native_access_violation = completed.returncode in (-1073741819, 3221225477)
    result: dict[str, Any] = {
        "configuration": asdict(config),
        "command": " ".join(command),
        "exit_code": completed.returncode,
        "native_access_violation": native_access_violation,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
    }
    if completed.returncode == 0:
        try:
            child_result = json.loads(completed.stdout)
            result["child_result"] = child_result
        except json.JSONDecodeError as error:
            result["parse_error"] = str(error)
    return result


def suite_names() -> list[str]:
    return list(CONFIGS)


def controller(names: Iterable[str], repeats: dict[str, int]) -> int:
    print(json.dumps({"invalid_matrix_checks": invalid_matrix_checks()}, indent=2))
    overall_exit = 0
    for name in names:
        for repeat in range(1, repeats.get(name, 1) + 1):
            try:
                result = run_isolated(name)
            except subprocess.TimeoutExpired as error:
                result = {
                    "configuration": asdict(CONFIGS[name]),
                    "command": " ".join(_child_command(name)),
                    "exit_code": None,
                    "native_access_violation": False,
                    "timeout": True,
                    "stdout": error.stdout or "",
                    "stderr": error.stderr or "",
                }
            result["repeat"] = repeat
            result["repeat_total"] = repeats.get(name, 1)
            print(json.dumps(result, sort_keys=True))
            if result.get("exit_code") != 0:
                overall_exit = 1
    return overall_exit


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--child", action="store_true")
    parser.add_argument("--config", choices=sorted(CONFIGS))
    parser.add_argument("--suite", choices=["all", "default", "features"], default="all")
    args = parser.parse_args()

    if args.child:
        if args.config is None:
            parser.error("--child requires --config")
        print(json.dumps(run_child(CONFIGS[args.config]), sort_keys=True))
        return 0

    if args.suite == "default":
        names = [
            "material_300x160_3000_small",
            "material_300x160_5000_default",
            "material_300x160_7500_upper",
            "project_300x29_1500_small",
            "project_300x29_2500_default",
            "project_300x29_4000_upper",
        ]
    elif args.suite == "features":
        names = [
            "material_300x160_5000_warm_features",
            "material_300x160_5000_metadata_only",
            "project_300x29_2500_warm_features",
            "project_300x29_2500_metadata_only",
        ]
    else:
        names = suite_names()

    repeats = {
        "material_300x160_5000_default": 5,
        "project_300x29_2500_default": 5,
    }
    return controller(names, repeats)


if __name__ == "__main__":
    raise SystemExit(main())
