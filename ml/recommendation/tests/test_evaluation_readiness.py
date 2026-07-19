from __future__ import annotations

import hashlib
import json
from pathlib import Path

from ml.recommendation.baselines import popularity, rank_global
from ml.recommendation.candidate_universe import CandidateUniverse
from ml.recommendation.catalog_snapshot import load_snapshot
from ml.recommendation.evaluate import GENERATED, metrics
from ml.recommendation.evaluation_splits import assert_no_mask_leak, build_masks
from ml.recommendation.feature_audit import audit_features
from ml.recommendation.privacy import scan_records

ROOT = Path(__file__).resolve().parents[3]


def _catalog():
    return load_snapshot(GENERATED / "catalog-snapshot")


def test_controlled_labels_are_reviewed_and_private():
    catalog = _catalog()
    allowed = {"category_label", "material_type_label", "concept_labels", "component_concept_labels"}
    assert not scan_records(catalog["materials"] + catalog["projects"])
    assert all(key.endswith("_label") or key.endswith("_labels") for key in allowed)
    assert all("title" not in row and "description" not in row for row in catalog["materials"] + catalog["projects"])


def test_material_type_classification_is_deterministic():
    first = audit_features(_catalog()); second = audit_features(_catalog())
    assert first == second
    assert first["material_type"]["classification"] == "EXCLUDE_HIGH_CARDINALITY_FEATURE"


def test_masking_preserves_later_rows_and_has_no_training_leak():
    rows = [
        {"sim_user_key": "u1", "entity_key": "i1", "split": "train", "weight": 1},
        {"sim_user_key": "u1", "entity_key": "i1", "split": "test", "weight": 1},
        {"sim_user_key": "u2", "entity_key": "i1", "split": "validation", "weight": 1},
    ]
    mask = build_masks(rows, {"i1"}, 11, "material"); assert_no_mask_leak(mask)
    assert [r for r in mask["training_view"] if r["split"] != "train"] == rows[1:]
    assert mask == build_masks(rows, {"i1"}, 11, "material")


def test_candidate_universe_is_time_aware_and_excludes_seen():
    catalog = {"materials": [
        {"material_key": "old", "publication_timestamp": "2026-01-01T00:00:00Z"},
        {"material_key": "future", "publication_timestamp": "2027-01-01T00:00:00Z"}], "projects": []}
    service = CandidateUniverse(catalog, [])
    assert service.candidates("u", "material", "2026-06-01T00:00:00Z", set()) == ["old"]
    assert service.candidates("u", "material", "2026-06-01T00:00:00Z", {"old"}) == []


def test_primary_and_diagnostic_universes_stay_separate():
    catalog = {"materials": [{"material_key": x, "publication_timestamp": "2026-01-01T00:00:00Z"} for x in ("a", "b")], "projects": []}
    impressions = [{"sim_user_key": "u", "domain": "material", "entity_key": "a", "timestamp_utc": "2026-02-01T00:00:00Z", "source": "RANDOM_EXPLORATION"}]
    service = CandidateUniverse(catalog, impressions)
    assert service.candidates("u", "material", "2026-03-01T00:00:00Z", set()) == ["a", "b"]
    assert service.candidates("u", "material", "2026-03-01T00:00:00Z", set(), "DIAGNOSTIC") == ["a"]


def test_popularity_is_training_only_and_candidates_are_shared():
    rows = [{"entity_key": "a", "split": "train", "weight": 1}, {"entity_key": "b", "split": "test", "weight": 99}]
    scores = popularity(rows)
    assert scores["a"] == 1 and scores["b"] == 0
    candidates = ["a", "b"]
    assert set(rank_global(candidates, scores)) == set(candidates)


def test_metrics_match_hand_calculation_and_small_candidate_denominator():
    result = metrics(["a", "b"], {"a"})
    assert result["precision@5"] == .5
    assert result["recall@5"] == result["ndcg@5"] == result["mrr"] == 1


def test_generated_evaluation_outputs_are_ignored_and_no_lightfm_import():
    ignore = (ROOT / ".gitignore").read_text()
    assert "ml/recommendation/generated/" in ignore
    slice2 = ("catalog_snapshot.py", "feature_audit.py", "evaluation_splits.py",
              "candidate_universe.py", "baselines.py", "evaluate.py", "scenario_evaluation.py")
    sources = "\n".join((ROOT / "ml/recommendation" / path).read_text() for path in slice2)
    assert "import lightfm" not in sources.lower() and "from lightfm" not in sources.lower()


def test_original_simulator_artifact_hashes_remain_slice1_values():
    expected = {11: "99523dc1037e076b7472358581d7388cec3eb68b777555f8000e6d79879f4eb4", 29: "71307d2e807d2af01833871c43e34e144b06f62dd4674ff825d85585bc035dc5", 47: "86c564cd0aba4b49cd2d4a60e280f2a55f052aff96c0cfd84eeb62c589c8c697"}
    for seed, value in expected.items():
        assert json.loads((GENERATED / f"seed-{seed}/dataset-summary.json").read_text())["logical_hash"] == value


def test_scenario_output_contains_labels_not_entity_keys():
    rows = json.loads((GENERATED / "evaluation/scenario-results.json").read_text())
    assert len(rows) == 14
    assert all(not any(len(label) == 64 and all(c in "0123456789abcdef" for c in label) for label in row["baseline_top_10_labels"]) for row in rows)


def test_snapshot_hash_is_stable_and_credentials_absent():
    summary = json.loads((GENERATED / "catalog-snapshot/catalog-summary.json").read_text())
    assert summary["database_write_count"] == 0
    assert summary["content_hash"] == "94c3165783ba4fca06d959f9b9d566434793c03f79858c089ab9cbe26dcd4186"
    raw = (GENERATED / "catalog-snapshot/catalog-summary.json").read_text().lower()
    assert "postgresql://" not in raw and "password" not in raw
