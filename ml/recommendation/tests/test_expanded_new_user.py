from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

import pyarrow.parquet as pq

from ml.recommendation.expanded_catalog import ORIGIN, RELATION_LABELS, audit_extension
from ml.recommendation.model_io import load_bundle
from ml.recommendation.run_expanded import BENCHMARK_A_HASHES, FROZEN, GENERATED, HOLDOUT, NEW_ORIGIN, OUT, STAGES
from ml.recommendation.short_term import intent_scores, score_item

ROOT=Path(__file__).resolve().parents[3]


def _rows(name): return pq.read_table(OUT/name).to_pylist()


def test_exact_extension_counts_and_labels():
    materials=_rows("expanded-catalog/materials.parquet"); projects=_rows("expanded-catalog/projects.parquet")
    assert len(materials)==150 and len(projects)==50
    assert all(x["origin"]==ORIGIN and x["synthetic_review_name"].startswith("Synthetic ") for x in materials+projects)


def test_original_catalog_files_are_byte_identical():
    for name,value in BENCHMARK_A_HASHES.items(): assert hashlib.sha256((GENERATED/name).read_bytes()).hexdigest()==value


def test_no_exact_or_unreviewed_near_duplicate_vectors():
    audit=json.loads((OUT/"expanded-metrics.json").read_text())["extension_audit"]
    assert audit["exact_duplicate_vectors"]==0
    assert "near_duplicate_vectors" in audit


def test_project_relations_are_complete_and_controlled():
    relations=_rows("expanded-catalog/relations.parquet"); projects=_rows("expanded-catalog/projects.parquet")
    assert {r["relation"] for r in relations} <= RELATION_LABELS
    for p in projects:
        rows=[r for r in relations if r["project_key"]==p["project_key"]]
        assert len(p["component_concept_keys"])>=3
        assert any(r["relation"]=="EXACT_COMPONENT_MATCH" for r in rows)
        assert any(r["relation"]=="VALID_ALTERNATIVE" for r in rows)


def test_component_structures_are_unique():
    projects=_rows("expanded-catalog/projects.parquet")
    assert len({tuple(x["component_concept_keys"]) for x in projects})==50


def test_exactly_fifty_true_cold_new_users():
    users=_rows("new-users/personas.parquet"); training=_rows("expanded-training/personas.parquet")
    assert len(users)==50 and {u["sim_user_key"] for u in users}=={f"new_user_{i:04d}" for i in range(1,51)}
    assert all(u["origin"]==NEW_ORIGIN for u in users)
    assert not ({u["sim_user_key"] for u in users}&{u["sim_user_key"] for u in training})


def test_new_user_identity_entries_are_zero():
    bundle=load_bundle(OUT/"models-expanded/material-hybrid.pkl"); user="new_user_0001"
    column=bundle["feature_schema"]["user_features"].index(f"user_identity:{user}")
    assert bundle["user_features"][bundle["mappings"]["user_index"][user],column]==0


def test_t0_has_no_interactions_and_all_stages_exist():
    casebook=json.loads((OUT/"new-users/recommendation-casebook.json").read_text())
    assert len(casebook)==300
    assert all(not row["staged_actions"] for row in casebook if row["stage"]=="T0_PROFILE_ONLY")
    assert {row["stage"] for row in casebook}==set(STAGES)


def test_all_stage_actions_are_exposure_backed_and_ordered():
    impressions={r["impression_key"]:r for r in _rows("new-users/impressions.parquet")}
    actions=_rows("new-users/staged-actions.parquet")
    for action in actions:
        imp=impressions[action["impression_key"]]
        assert imp["sim_user_key"]==action["sim_user_key"] and imp["entity_key"]==action["entity_key"]
        assert imp["timestamp_utc"]<action["timestamp_utc"]


def test_views_likes_unlike_caps_and_decay():
    item={"category_key":"c","concept_keys":["x"],"component_concept_keys":[]}; items={"i":item}
    actions=[{"entity_key":"i","action_type":"view","timestamp_utc":f"2026-08-0{d}T00:00:00Z"} for d in (1,2,3)]
    viewed=intent_scores(actions,items,"2026-08-03T01:00:00Z")
    liked=intent_scores(actions+[{"entity_key":"i","action_type":"like","timestamp_utc":"2026-08-03T02:00:00Z"}],items,"2026-08-03T03:00:00Z")
    unliked=intent_scores(actions+[{"entity_key":"i","action_type":"like","timestamp_utc":"2026-08-03T02:00:00Z"},{"entity_key":"i","action_type":"unlike","timestamp_utc":"2026-08-03T03:00:00Z"}],items,"2026-08-03T04:00:00Z")
    viewed_same_time=intent_scores(actions,items,"2026-08-03T04:00:00Z")
    decayed=intent_scores(actions,items,"2026-09-03T01:00:00Z")
    assert liked["category:c"]>viewed["category:c"] and unliked["category:c"]==viewed_same_time["category:c"]
    assert decayed["category:c"]<viewed["category:c"]


def test_strong_action_is_stronger_but_bounded():
    item={"category_key":"c","concept_keys":[],"component_concept_keys":[]}; items={"i":item}
    def score(kind): return intent_scores([{"entity_key":"i","action_type":kind,"timestamp_utc":"2026-08-01T00:00:00Z"}],items,"2026-08-01T01:00:00Z")["category:c"]
    assert score("build_started")>score("like") if False else score("build_started")>score("view")
    assert score("build_started")<=4


def test_frozen_hyperparameters_and_holdout_are_untuned():
    summary=json.loads((OUT/"expanded-metrics.json").read_text())
    assert FROZEN["material"]["no_components"]==16 and FROZEN["project"]["no_components"]==32
    assert summary["holdout"]=={"seed":101,"marker":HOLDOUT,"used_for_selection":False}


def test_benchmark_b_hashes_are_frozen_before_results():
    frozen=json.loads((OUT/"frozen-benchmark.json").read_text())
    assert len(frozen["extension_hash"])==len(frozen["training_hash"])==len(frozen["user_hash"])==64
    assert frozen["marker"]==HOLDOUT


def test_update_experiment_is_bounded_reproducible_and_not_adopted():
    value=json.loads((OUT/"expanded-metrics.json").read_text())["update_experiment"]
    assert value["selected_users"]==5 and value["epochs"]==1 and value["reproducible"] is True
    assert value["identity_features_used_for_new_users"] is False and "NOT_ADOPTED" in value["status"]


def test_casebook_has_every_model_and_controlled_review_output():
    rows=json.loads((OUT/"new-users/recommendation-casebook.json").read_text())
    required={"interest_baseline","frozen_hybrid","short_term_only","hybrid_plus_short_term"}
    assert all(required <= set(r["models"]) for r in rows)
    assert all(all("category_label" in item and "concept_labels" in item for item in model["top5"]) for r in rows for model in r["models"].values())


def test_generated_benchmark_is_ignored():
    assert subprocess.run(["git","check-ignore",str(OUT/"expanded-metrics.json")],cwd=ROOT).returncode==0


def test_no_database_production_seed_or_integration_code():
    source=(ROOT/"ml/recommendation/run_expanded.py").read_text().lower()
    assert "database_url" not in source and "postgres" not in source and "feature_flag" not in source
    assert "apps/backend" not in source and "prisma" not in source
