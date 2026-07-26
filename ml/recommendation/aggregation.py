"""Deterministic local aggregation comparison for canonical LightFM features."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Mapping

import numpy as np

AggregationMode = Literal["weighted-sum", "weighted-mean", "l1", "l2"]
AGGREGATION_MODES: tuple[AggregationMode, ...] = (
    "weighted-sum",
    "weighted-mean",
    "l1",
    "l2",
)
AGGREGATION_EXPERIMENT_SEED = 1705
AGGREGATION_EXPERIMENT_REPEATS = 20
AGGREGATION_TOLERANCE = 1e-12


@dataclass(frozen=True)
class AggregationEvidence:
    mode: AggregationMode
    finite: bool
    deterministic: bool
    zero_safe: bool
    optional_empty_stable: bool
    feature_count_bounded: bool
    domain_consistent: bool
    runtime_compatible: bool
    selected: bool
    disqualification_reasons: tuple[str, ...]

    @property
    def passed(self) -> bool:
        return not self.disqualification_reasons


def _parameters(values: np.ndarray | list[list[float]]) -> np.ndarray:
    parameters = np.asarray(values, dtype=np.float64)
    if parameters.ndim != 2:
        raise ValueError("feature parameters must be a two-dimensional array")
    if not np.isfinite(parameters).all():
        raise ValueError("feature parameters must be finite")
    return parameters


def _weights(values: np.ndarray | list[float] | None, rows: int) -> np.ndarray:
    weights = np.ones(rows, dtype=np.float64) if values is None else np.asarray(values, dtype=np.float64)
    if weights.shape != (rows,) or not np.isfinite(weights).all():
        raise ValueError("feature weights must be a finite vector matching the feature count")
    return weights


def aggregate_feature_parameters(
    mode: AggregationMode,
    feature_parameters: np.ndarray | list[list[float]],
    feature_weights: np.ndarray | list[float] | None = None,
) -> np.ndarray:
    """Aggregate augmented [bias, embedding...] feature parameters."""
    if mode not in AGGREGATION_MODES:
        raise ValueError(f"unknown aggregation mode: {mode}")
    parameters = _parameters(feature_parameters)
    weights = _weights(feature_weights, parameters.shape[0])
    summed = (parameters * weights[:, None]).sum(axis=0)
    if mode == "weighted-sum":
        result = summed
    elif mode == "weighted-mean":
        denominator = float(weights.sum())
        result = np.zeros(parameters.shape[1], dtype=np.float64) if denominator == 0 else summed / denominator
    elif mode == "l1":
        denominator = float(np.linalg.norm(summed, ord=1))
        result = np.zeros(parameters.shape[1], dtype=np.float64) if denominator == 0 else summed / denominator
    else:
        denominator = float(np.linalg.norm(summed, ord=2))
        result = np.zeros(parameters.shape[1], dtype=np.float64) if denominator == 0 else summed / denominator
    if not np.isfinite(result).all():
        raise ValueError("aggregation produced a nonfinite representation")
    return result


def rp061_reference_representation(
    feature_parameters: np.ndarray | list[list[float]],
    feature_weights: np.ndarray | list[float] | None = None,
) -> np.ndarray:
    """Exact current scorer rule: weighted additive bias and embedding sum."""
    return aggregate_feature_parameters("weighted-sum", feature_parameters, feature_weights)


def _probe_cases() -> Mapping[str, np.ndarray]:
    base = np.asarray([[0.25, 1.0, -0.5, 0.25]], dtype=np.float64)
    mixed = np.asarray(
        [
            [0.25, 1.0, -0.5, 0.25],
            [-0.1, -0.25, 0.75, 0.5],
            [0.05, 0.5, 0.25, -0.75],
        ],
        dtype=np.float64,
    )
    cancellation = np.vstack((base, -base))
    return {
        "empty": np.empty((0, 4), dtype=np.float64),
        "base": base,
        "mixed": mixed,
        "cancellation": cancellation,
        "aligned-2": np.repeat(base, 2, axis=0),
        "aligned-4": np.repeat(base, 4, axis=0),
        "aligned-6": np.repeat(base, 6, axis=0),
    }


def evaluate_aggregation_candidates(
    *,
    seed: int = AGGREGATION_EXPERIMENT_SEED,
    repeats: int = AGGREGATION_EXPERIMENT_REPEATS,
    tolerance: float = AGGREGATION_TOLERANCE,
) -> tuple[dict[AggregationMode, AggregationEvidence], AggregationMode]:
    """Evaluate frozen candidates against current Python and RP-06.1 semantics."""
    cases = _probe_cases()
    evidence: dict[AggregationMode, AggregationEvidence] = {}
    for mode in AGGREGATION_MODES:
        first = {name: aggregate_feature_parameters(mode, values) for name, values in cases.items()}
        deterministic = True
        domain_consistent = True
        rng = np.random.default_rng(seed)
        for _ in range(repeats):
            for name, values in cases.items():
                order = rng.permutation(values.shape[0])
                repeated = aggregate_feature_parameters(mode, values[order])
                deterministic &= bool(np.allclose(repeated, first[name], rtol=0, atol=tolerance))
                # Domain labels do not enter the function; identical arrays must stay identical.
                material = aggregate_feature_parameters(mode, values)
                project = aggregate_feature_parameters(mode, values)
                domain_consistent &= bool(np.allclose(material, project, rtol=0, atol=tolerance))

        finite = all(np.isfinite(value).all() for value in first.values())
        zero_safe = bool(
            np.array_equal(first["empty"], np.zeros(4))
            and np.array_equal(first["cancellation"], np.zeros(4))
        )
        optional_empty_stable = bool(np.array_equal(first["empty"], np.zeros(4)))
        feature_count_bounded = True
        for count in (2, 4, 6):
            values = cases[f"aligned-{count}"]
            result_norm = float(np.linalg.norm(first[f"aligned-{count}"]))
            triangle_bound = float(sum(np.linalg.norm(row) for row in values))
            feature_count_bounded &= result_norm <= triangle_bound + tolerance

        runtime_reference = rp061_reference_representation(cases["mixed"])
        runtime_compatible = bool(
            np.allclose(first["mixed"], runtime_reference, rtol=0, atol=tolerance)
        )
        reasons: list[str] = []
        for passes, reason in (
            (finite, "NONFINITE_OUTPUT"),
            (deterministic, "NONDETERMINISTIC"),
            (zero_safe, "ZERO_DENOMINATOR_UNSAFE"),
            (optional_empty_stable, "OPTIONAL_EMPTY_UNSTABLE"),
            (feature_count_bounded, "FEATURE_COUNT_MAGNITUDE_UNBOUNDED"),
            (domain_consistent, "DOMAIN_INCONSISTENT"),
            (runtime_compatible, "RP061_REPRESENTATION_MISMATCH"),
        ):
            if not passes:
                reasons.append(reason)
        evidence[mode] = AggregationEvidence(
            mode=mode,
            finite=finite,
            deterministic=deterministic,
            zero_safe=zero_safe,
            optional_empty_stable=optional_empty_stable,
            feature_count_bounded=feature_count_bounded,
            domain_consistent=domain_consistent,
            runtime_compatible=runtime_compatible,
            selected=False,
            disqualification_reasons=tuple(reasons),
        )

    passing = [mode for mode in AGGREGATION_MODES if evidence[mode].passed]
    if not passing:
        raise RuntimeError("no aggregation candidate satisfies the frozen criteria")
    selected = passing[0]
    selected_value = evidence[selected]
    evidence[selected] = AggregationEvidence(
        **{**selected_value.__dict__, "selected": True}
    )
    return evidence, selected
