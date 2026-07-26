from __future__ import annotations

import hashlib
import math
from pathlib import Path

import ml.recommendation.train_local_lightfm as local_training


def _key(namespace: str, value: str) -> str:
    return hashlib.sha256(f"impactloop-{namespace}:{value}".encode()).hexdigest()


def _snapshot() -> dict:
    interests = (
        "interest:arduino",
        "interest:robotics",
    )
    material_families = (
        "material-family:electronics",
        "material-family:mechanical",
    )
    project_topics = (
        "project-topic:robotics",
        "project-topic:electronics",
    )
    users = sorted(
        [
            {
                "userKey": _key("user", f"u-{index}"),
                "featureTokens": [interests[index - 1]],
            }
            for index in range(1, 3)
        ],
        key=lambda row: row["userKey"],
    )
    materials = sorted(
        [
            {
                "materialKey": _key("material", f"m-{index}"),
                "eligibilityState": "AVAILABLE",
                "featureTokens": sorted(
                    [
                        material_families[index - 1],
                        f"material-condition:{'good' if index % 2 else 'like-new'}",
                        f"material-is-free:{'false' if index % 2 else 'true'}",
                        f"material-pickup-allowed:{'true' if index % 2 else 'false'}",
                        f"material-delivery-allowed:{'false' if index % 2 else 'true'}",
                    ]
                ),
            }
            for index in range(1, 3)
        ],
        key=lambda row: row["materialKey"],
    )
    projects = sorted(
        [
            {
                "projectKey": _key("project", f"p-{index}"),
                "eligibilityState": "PUBLISHED",
                "featureTokens": sorted(
                    [
                        project_topics[index - 1],
                        f"project-difficulty:{'beginner' if index % 2 else 'advanced'}",
                    ]
                ),
            }
            for index in range(1, 3)
        ],
        key=lambda row: row["projectKey"],
    )
    return {
        "hashes": {
            "semanticContent": {"algorithm": "sha256", "value": "d" * 64}
        },
        "users": users,
        "materialItems": materials,
        "projectItems": projects,
        "materialInteractions": [
            {
                "domain": "material",
                "userKey": user["userKey"],
                "materialKey": materials[(index + offset) % len(materials)]["materialKey"],
            }
            for index, user in enumerate(users)
            for offset in (0,)
        ],
        "projectInteractions": [
            {
                "domain": "project",
                "userKey": user["userKey"],
                "projectKey": projects[(index + offset) % len(projects)]["projectKey"],
            }
            for index, user in enumerate(users)
            for offset in (0,)
        ],
    }


def test_local_training_uses_all_lm05_paths_and_is_semantically_reproducible(
    tmp_path: Path, monkeypatch
):
    original_fit = local_training._fit

    def one_epoch_fit(seed, config, interactions, weights, user_features, item_features):
        accelerated = {**config, "epochs": 1}
        return original_fit(
            seed, accelerated, interactions, weights, user_features, item_features
        )

    monkeypatch.setattr(local_training, "_fit", one_epoch_fit)
    calls: dict[str, int] = {}
    names = (
        "build_user_feature_matrix",
        "build_material_feature_matrix",
        "build_project_feature_matrix",
        "build_material_interaction_matrix",
        "build_project_interaction_matrix",
    )
    for name in names:
        original = getattr(local_training, name)

        def wrapper(*args, _name=name, _original=original, **kwargs):
            calls[_name] = calls.get(_name, 0) + 1
            return _original(*args, **kwargs)

        monkeypatch.setattr(local_training, name, wrapper)

    first = local_training.train_snapshot(
        _snapshot(),
        tmp_path / "first",
        seed=11,
        created_at="2026-07-26T12:00:00.000Z",
    )
    second = local_training.train_snapshot(
        _snapshot(),
        tmp_path / "second",
        seed=11,
        created_at="2026-07-26T12:01:00.000Z",
    )

    assert calls == {
        "build_user_feature_matrix": 4,
        "build_material_feature_matrix": 2,
        "build_project_feature_matrix": 2,
        "build_material_interaction_matrix": 2,
        "build_project_interaction_matrix": 2,
    }
    for domain in ("material", "project"):
        artifact = first[domain]
        assert artifact["aggregationMode"] == "weighted-sum"
        assert artifact["datasetContentHash"] == "d" * 64
        assert artifact["featureMappingHash"] == local_training.sha256_canonical(
            artifact["featureMapping"]
        )
        assert artifact["itemMappingHash"] == local_training.sha256_canonical(
            artifact["itemMapping"]
        )
        assert artifact["semanticContentHash"] == second[domain]["semanticContentHash"]
        assert artifact["createdAt"] != second[domain]["createdAt"]
        dimension = artifact["modelDimensions"]["embeddingDimension"]
        assert dimension == (16 if domain == "material" else 32)
        components = artifact["modelComponents"]
        assert all(
            len(row) == dimension
            for row in components["userFeatureEmbeddings"]
            + components["itemFeatureEmbeddings"]
        )
        assert all(
            math.isfinite(float(value))
            for row in components["userFeatureEmbeddings"]
            + components["itemFeatureEmbeddings"]
            for value in row
        )
    assert first["material"]["itemMapping"] != first["project"]["itemMapping"]
    assert (tmp_path / "first" / "material-lightfm-v2.json").is_file()
    assert (tmp_path / "first" / "project-lightfm-v2.json").is_file()
