"""Slice 0 compatibility smoke test; this file never touches the catalog."""

from __future__ import annotations

import json
import platform
import random
import sys
import time

import lightfm
import numpy as np
import pandas
import pytest
import scipy
import sklearn
import yaml
from lightfm import LightFM
from lightfm.data import Dataset
from lightfm.evaluation import precision_at_k


USERS = [f"u{i}" for i in range(4)]
ITEMS = [f"i{i}" for i in range(4)]
EVENTS = [
    ("u0", "i0"), ("u0", "i1"),
    ("u1", "i1"), ("u1", "i2"),
    ("u2", "i2"), ("u2", "i3"),
    ("u3", "i3"), ("u3", "i0"),
]


def run_once() -> dict[str, object]:
    random.seed(12345)
    rng = np.random.default_rng(12345)
    np.random.seed(12345)

    dataset = Dataset()
    dataset.fit(USERS, ITEMS)
    interactions, _ = dataset.build_interactions(EVENTS)
    model = LightFM(loss="warp", no_components=2, random_state=1)

    started = time.perf_counter()
    model.fit(interactions, epochs=1, num_threads=1, verbose=False)
    fit_seconds = time.perf_counter() - started

    item_indices = np.arange(len(ITEMS), dtype=np.int32)
    predictions = model.predict(0, item_indices, num_threads=1)
    precision = float(
        precision_at_k(model, interactions, k=1, num_threads=1).mean()
    )

    return {
        "shape": list(interactions.shape),
        "nnz": int(interactions.nnz),
        "fit_seconds": fit_seconds,
        "predictions": predictions.tolist(),
        "precision_at_1": precision,
        "rng_probe": rng.integers(0, 1_000_000, size=3).tolist(),
    }


def smoke_report() -> dict[str, object]:
    first = run_once()
    second = run_once()
    return {
        "python": sys.version,
        "platform": platform.platform(),
        "machine": platform.machine(),
        "packages": {
            "lightfm": lightfm.__version__,
            "numpy": np.__version__,
            "scipy": scipy.__version__,
            "pandas": pandas.__version__,
            "scikit_learn": sklearn.__version__,
            "pyyaml": yaml.__version__,
            "pytest": pytest.__version__,
        },
        "model": {
            "loss": "warp",
            "no_components": 2,
            "epochs": 1,
            "random_state": 1,
            "num_threads": 1,
        },
        "first": first,
        "second": second,
        "predictions_equal": first["predictions"] == second["predictions"],
        "metric_equal": first["precision_at_1"] == second["precision_at_1"],
        "rng_equal": first["rng_probe"] == second["rng_probe"],
    }


def test_lightfm_import_fit_predict_evaluate_and_reproducibility() -> None:
    report = smoke_report()
    assert report["first"]["shape"] == [4, 4]
    assert report["first"]["nnz"] == 8
    assert report["predictions_equal"] is True
    assert report["metric_equal"] is True
    assert report["rng_equal"] is True
    assert 0.0 <= report["first"]["precision_at_1"] <= 1.0


if __name__ == "__main__":
    print(json.dumps(smoke_report(), indent=2))
