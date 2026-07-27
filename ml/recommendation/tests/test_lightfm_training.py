from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pyarrow.parquet as pq

from ml.recommendation.catalog_snapshot import load_snapshot
from ml.recommendation.evaluation_splits import assert_no_mask_leak, build_masks
from ml.recommendation.features import approved_item_tokens, feature_matrices, mappings
from ml.recommendation.model_io import load_bundle
from ml.recommendation.recommend import rank_lightfm
from ml.recommendation.train_lightfm import GENERATED, GRID, TUNING_SEEDS, _bootstrap

ROOT = Path(__file__).resolve().parents[3]
RESULTS = GENERATED / "models/test-metrics.json"


def _data(seed=11, domain="material"):
    folder = GENERATED / f"seed-{seed}"
    personas = pq.read_table(folder / "personas.parquet").to_pylist()
    rows = pq.read_table(folder / f"{domain}-interactions.parquet").to_pylist()
    catalog = load_snapshot(GENERATED / "catalog-snapshot")
    return personas, rows, catalog[f"{domain}s"]


def test_material_type_and_hidden_intent_are_absent_from_features():
    _, _, items = _data()
    tokens = [name for item in items for name, _ in approved_item_tokens(item, "material")]
    assert not any("material_type" in name or "hidden" in name or "intent" in name for name in tokens)


def test_project_features_are_approved_controlled_values():
    _, _, items = _data(domain="project")
    tokens = [name for item in items for name, _ in approved_item_tokens(item, "project")]
    assert any(name.startswith("difficulty:") for name in tokens)
    assert any(name.startswith("component:") for name in tokens)
    assert not any("title" in name or "description" in name for name in tokens)


def test_mappings_are_stably_sorted():
    personas, _, items = _data(); first = mappings(personas, items, "material")
    second = mappings(list(reversed(personas)), list(reversed(items)), "material")
    assert first["mapping_hash"] == second["mapping_hash"]
    assert first["users"] == sorted(first["users"]) and first["items"] == sorted(first["items"])


def test_pure_and_warm_feature_contracts_differ():
    personas, _, items = _data(); maps = mappings(personas, items, "material")
    _, _, pure = feature_matrices(personas, items, "material", maps, True, metadata=False)
    _, _, warm = feature_matrices(personas, items, "material", maps, True, metadata=True)
    assert all(name.startswith("user_identity:") for name in pure["user_features"])
    assert any(name.startswith("interest:") for name in warm["user_features"])
    assert any(name.startswith("category:") for name in warm["item_features"])


def test_cold_rows_contain_no_identity_entry():
    personas, _, items = _data(); maps = mappings(personas, items, "material")
    user, item = maps["users"][0], maps["items"][0]
    uf, itf, schema = feature_matrices(personas, items, "material", maps, True, {user}, {item}, True)
    assert uf[maps["user_index"][user], schema["user_features"].index(f"user_identity:{user}")] == 0
    assert itf[maps["item_index"][item], schema["item_features"].index(f"item_identity:{item}")] == 0


def test_slice2_masks_still_remove_training_rows_and_preserve_later():
    personas, rows, items = _data(); complete = {x["material_key"] for x in items}
    mask = build_masks(rows, complete, 11, "material"); assert_no_mask_leak(mask)
    assert sum(r["split"] != "train" for r in mask["training_view"]) == sum(r["split"] != "train" for r in rows)


def test_seed47_is_not_a_tuning_seed_and_search_is_bounded():
    assert TUNING_SEEDS == (11, 29) and 47 not in TUNING_SEEDS and len(GRID) <= 24
    output = json.loads(RESULTS.read_text())
    assert output["tuning_seeds"] == [11, 29] and output["seed47_evaluated_after_freeze"] is True


def test_selection_metric_is_validation_ndcg10_only():
    output = json.loads(RESULTS.read_text())
    for domain in ("material", "project"):
        for family in ("pure", "hybrid"):
            trials = output["search"][domain][family]
            assert all("validation_ndcg10" in trial and "test" not in json.dumps(trial).lower() for trial in trials)


def test_primary_and_diagnostic_metrics_are_separate():
    output = json.loads(RESULTS.read_text())
    value = output["results"]["11"]["material"]["hybrid"]
    assert "metrics" in value and set(value["diagnostic_exposure_metrics"]) == {"all_exposed", "policy_selected", "randomized_exploration"}


def test_paired_bootstrap_is_deterministic():
    assert _bootstrap([-.2, 0, .1, .3], 11) == _bootstrap([-.2, 0, .1, .3], 11)


def test_true_cold_support_is_explicit():
    output = json.loads(RESULTS.read_text())
    pure = output["results"]["11"]["material"]["pure"]["cold_start"]
    hybrid = output["results"]["11"]["material"]["hybrid"]["cold_start"]
    assert pure["representation"] == "UNAVAILABLE_FOR_TRUE_COLD_START"
    assert hybrid["representation"] == "METADATA_ONLY_REPRESENTATION"


def test_serialization_reload_prediction_and_topk_parity():
    paths = sorted((GENERATED / "models").glob("seed-*/*.pkl")); assert len(paths) == 12
    for path in paths:
        bundle = load_bundle(path); probe = bundle["probe"]
        assert rank_lightfm(bundle["model"], probe["user"], probe["candidates"], bundle["mappings"], bundle["user_features"], bundle["item_features"]) == probe["ranking"]


def test_all_generated_models_are_git_ignored():
    for path in (GENERATED / "models").glob("seed-*/*.pkl"):
        assert subprocess.run(["git", "check-ignore", str(path)], cwd=ROOT).returncode == 0


def test_scenarios_have_all_five_rankers_and_controlled_labels():
    rows = json.loads((GENERATED / "models/recommendation-examples.json").read_text()); assert len(rows) == 14
    expected = {"global_popularity", "interest_category_popularity", "pure", "hybrid", "hybrid_cold"}
    assert all(set(row["models"]) == expected for row in rows)
    assert all("NO_RETRAIN" in row["recent_behavior_summary"] for row in rows)


def test_automatic_result_is_never_feature_flag_instruction():
    output = json.loads(RESULTS.read_text())
    assert output["automatic_result"] in {"HARD_GATE_FAILED", "NOT_COMPETITIVE", "ELIGIBLE_FOR_MANUAL_INTEGRATION_REVIEW"}


def test_training_source_has_no_database_or_production_integration():
    source = (ROOT / "ml/recommendation/train_lightfm.py").read_text().lower()
    assert "postgres" not in source and "database_url" not in source and "feature_flag" not in source
    assert "num_threads=1" in source
