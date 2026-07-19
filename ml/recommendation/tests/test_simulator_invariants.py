from __future__ import annotations

import importlib.util
from collections import Counter, defaultdict
from pathlib import Path

import pytest

from ml.recommendation.generate_dataset import _load_config, generate, validate_artifacts
from ml.recommendation.schemas import SYNTHETIC_ORIGIN
from ml.recommendation.simulator import logical_hash

ROOT = Path(__file__).resolve().parents[3]


@pytest.fixture(scope="module")
def variants():
    return {seed: generate(seed, write=False)["data"] for seed in (11, 29, 47)}


def test_exact_personas_synthetic_and_variants_differ(variants) -> None:
    hashes = set()
    for seed, data in variants.items():
        assert len(data["personas"]) == 300
        assert {p["sim_user_key"] for p in data["personas"]} == {
            f"sim_user_{i:04d}" for i in range(1, 301)
        }
        assert all(row["origin"] == SYNTHETIC_ORIGIN for rows in data.values() for row in rows)
        hashes.add(logical_hash(data))
    assert len(hashes) == 3


def test_same_seed_deterministic_and_seed47_is_ood(variants) -> None:
    assert logical_hash(variants[11]) == logical_hash(generate(11, write=False)["data"])
    cfg = _load_config()
    assert cfg["variants"][47]["marker"] == "OOD_ROBUSTNESS_ONLY"
    assert len(variants[47]["project_interactions"]) > len(variants[47]["material_interactions"])


def test_sessions_exposure_order_identity_and_eligibility(variants) -> None:
    for data in variants.values():
        impressions = {r["impression_key"]: r for r in data["impressions"]}
        sessions = defaultdict(list)
        for imp in impressions.values():
            sessions[(imp["sim_user_key"], imp["session_key"])].append(imp)
        per_user = Counter(user for user, _ in sessions)
        assert all(5 <= count <= 12 for count in per_user.values())
        assert all(6 <= len(slate) <= 10 for slate in sessions.values())
        assert all(len({r["entity_key"] for r in slate}) == len(slate) for slate in sessions.values())
        for action in data["actions"]:
            imp = impressions[action["impression_key"]]
            assert action["timestamp_utc"] > imp["timestamp_utc"]
            assert (action["sim_user_key"], action["entity_key"], action["domain"]) == (
                imp["sim_user_key"], imp["entity_key"], imp["domain"]
            )


def test_exploration_drift_reversals_outcomes_and_view_cap(variants) -> None:
    for data in variants.values():
        impressions = data["impressions"]
        share = sum(r["source"] == "RANDOM_EXPLORATION" for r in impressions) / len(impressions)
        assert .10 <= share <= .21
        stable = {p["sim_user_key"] for p in data["personas"] if p["cohort"] == "stable"}
        assert not stable & {e["sim_user_key"] for e in data["hidden_state"]}
        abrupt = {p["sim_user_key"] for p in data["personas"] if p["cohort"] == "abrupt_task"}
        assert abrupt <= {e["sim_user_key"] for e in data["hidden_state"]}
        types = Counter(a["action_type"] for a in data["actions"])
        material_types = Counter(a["action_type"] for a in data["actions"] if a["domain"] == "material")
        assert material_types["view"] > material_types["like"] > types["reservation_created"]
        assert types["unlike"] and types["unsave"] and types["unfollow"]
        assert any(a["action_type"] == "reservation_completed" for a in data["actions"])
        assert any(a["action_type"] == "reservation_cancelled" for a in data["actions"])
        assert any(a["action_type"] == "build_completed" for a in data["actions"])
        assert any(a["action_type"] == "build_abandoned" for a in data["actions"])
        views = Counter((a["sim_user_key"], a["entity_key"], a["day"]) for a in data["actions"] if a["action_type"] == "view")
        assert max(views.values(), default=0) <= 3


def test_temporal_splits_chains_and_raw_resolved_reconcile(variants) -> None:
    for data in variants.values():
        operation_splits = defaultdict(set)
        for action in data["actions"]:
            operation_splits[action["operation_key"]].add(action["split"])
            expected = "train" if action["day"] <= 21 else "validation" if action["day"] <= 25 else "test"
            assert action["split"] == expected
        assert all(len(splits) == 1 for splits in operation_splits.values())
        resolved = data["material_interactions"] + data["project_interactions"]
        assert {r["operation_key"] for r in resolved} <= set(operation_splits)
        assert {r["split"] for r in resolved} == {"train", "validation", "test"}
        assert len({r["operation_key"] for r in resolved}) == len(resolved)


def test_pipeline_has_no_postgres_or_lightfm_and_artifacts_validate() -> None:
    for module in ("catalog_snapshot.py", "privacy.py", "schemas.py", "simulator.py", "generate_dataset.py"):
        source = (ROOT / "ml/recommendation" / module).read_text().lower()
        assert "lightfm" not in source
        assert "psycopg" not in source
    assert importlib.util.find_spec("lightfm") is not None  # environment only; pipeline does not import it
    for seed in (11, 29, 47):
        validate_artifacts(seed)
