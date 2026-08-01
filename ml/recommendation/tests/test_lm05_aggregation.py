from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from ml.recommendation.aggregation import (
    AGGREGATION_EXPERIMENT_REPEATS,
    AGGREGATION_EXPERIMENT_SEED,
    AGGREGATION_MODES,
    aggregate_feature_parameters,
    evaluate_aggregation_candidates,
    rp061_reference_representation,
)

FIXTURE_PATH = Path(__file__).with_name("fixtures") / "lm05_feature_parity_v1.json"
CONTRACT_PATH = Path(__file__).resolve().parents[1] / "aggregation-contract-v1.json"


def test_exact_candidate_formulas_and_zero_behavior():
    values = np.asarray([[1.0, 2.0], [3.0, 4.0]], dtype=np.float64)
    np.testing.assert_allclose(aggregate_feature_parameters("weighted-sum", values), [4.0, 6.0])
    np.testing.assert_allclose(aggregate_feature_parameters("weighted-mean", values), [2.0, 3.0])
    np.testing.assert_allclose(aggregate_feature_parameters("l1", values), [0.4, 0.6])
    norm = np.sqrt(52.0)
    np.testing.assert_allclose(aggregate_feature_parameters("l2", values), [4.0 / norm, 6.0 / norm])
    empty = np.empty((0, 2), dtype=np.float64)
    cancel = np.asarray([[1.0, -1.0], [-1.0, 1.0]])
    for mode in AGGREGATION_MODES:
        np.testing.assert_array_equal(aggregate_feature_parameters(mode, empty), np.zeros(2))
        np.testing.assert_array_equal(aggregate_feature_parameters(mode, cancel), np.zeros(2))


def test_weighted_sum_matches_fixture_and_rp061_reference():
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    probe = fixture["aggregationProbe"]
    user = np.asarray([[row["bias"], *row["embedding"]] for row in probe["userFeatures"]])
    item = np.asarray([[row["bias"], *row["embedding"]] for row in probe["itemFeatures"]])
    user_weights = np.asarray([row["weight"] for row in probe["userFeatures"]])
    item_weights = np.asarray([row["weight"] for row in probe["itemFeatures"]])
    user_result = aggregate_feature_parameters("weighted-sum", user, user_weights)
    item_result = rp061_reference_representation(item, item_weights)
    np.testing.assert_allclose(user_result, probe["expectedUserRepresentation"], rtol=0, atol=1e-12)
    np.testing.assert_allclose(item_result, probe["expectedItemRepresentation"], rtol=0, atol=1e-12)
    score = user_result[0] + item_result[0] + float(np.dot(user_result[1:], item_result[1:]))
    assert abs(score - probe["expectedScore"]) <= 1e-12
    score_bound = abs(user_result[0]) + abs(item_result[0]) + np.linalg.norm(user_result[1:]) * np.linalg.norm(item_result[1:])
    assert abs(score) <= score_bound + 1e-12


def test_feature_count_growth_is_linear_finite_and_triangle_bounded():
    base = np.asarray([[0.25, 1.0, -0.5, 0.25]])
    base_norm = np.linalg.norm(base[0])
    for count in (1, 2, 4, 6):
        values = np.repeat(base, count, axis=0)
        result = aggregate_feature_parameters("weighted-sum", values)
        assert np.isfinite(result).all()
        assert abs(np.linalg.norm(result) - count * base_norm) <= 1e-12
        assert np.linalg.norm(result) <= sum(np.linalg.norm(row) for row in values) + 1e-12


def test_controlled_experiment_selects_only_runtime_reproducible_mode():
    evidence, selected = evaluate_aggregation_candidates()
    assert AGGREGATION_EXPERIMENT_SEED == 1705
    assert AGGREGATION_EXPERIMENT_REPEATS == 20
    assert selected == "weighted-sum"
    assert evidence["weighted-sum"].passed
    assert evidence["weighted-sum"].selected
    for mode in ("weighted-mean", "l1", "l2"):
        assert not evidence[mode].passed
        assert not evidence[mode].runtime_compatible
        assert "RP061_REPRESENTATION_MISMATCH" in evidence[mode].disqualification_reasons
    assert all(value.finite and value.deterministic and value.zero_safe for value in evidence.values())
    assert all(value.optional_empty_stable and value.feature_count_bounded for value in evidence.values())
    assert all(value.domain_consistent for value in evidence.values())


def test_local_contract_matches_recomputed_selection_and_stays_inactive():
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    _, selected = evaluate_aggregation_candidates(seed=contract["selectionSeed"])
    assert contract["candidateModes"] == list(AGGREGATION_MODES)
    assert contract["selectedMode"] == selected == "weighted-sum"
    assert contract["runtimeActivation"] == "INACTIVE"
    assert contract["portableActivationAllowed"] is False
