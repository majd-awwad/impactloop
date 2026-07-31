"""Train deterministic local material/project LightFM portable artifacts from LM-04."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import random
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Mapping

import numpy as np

from .export_portable_model import FROZEN
from .features import (
    FeatureMatrixResult,
    build_material_feature_matrix,
    build_material_interaction_matrix,
    build_project_feature_matrix,
    build_project_interaction_matrix,
    build_user_feature_matrix,
    compile_matrix_construction_context,
    load_local_aggregation_contract,
    load_v3_feature_contract,
)
from .train_lightfm import _fit

SCHEMA_VERSION = "impactloop-lightfm-portable-v2"
MODEL_VERSION = "lm-06-local-lightfm-v1"
DOMAINS = ("material", "project")
HASH_HEX_LENGTH = 64

Domain = Literal["material", "project"]


class LocalTrainingError(ValueError):
    """Bounded, actionable local training failure."""


def canonical_json(value: Any) -> str:
    """Match LM-04/TypeScript canonical JSON for the v2 hashable value set."""
    return json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def sha256_canonical(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def semantic_content_hash(artifact: Mapping[str, Any]) -> str:
    semantic = {
        key: value
        for key, value in artifact.items()
        if key not in {"semanticContentHash", "createdAt"}
    }
    return sha256_canonical(semantic)


def _decimal(value: Any) -> str:
    number = float(value)
    if not math.isfinite(number):
        raise LocalTrainingError("NONFINITE_MODEL_COMPONENT")
    if number == 0:
        return "0"
    return format(number, ".17g")


def _require_record(value: Any, code: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise LocalTrainingError(code)
    return value


def _require_rows(snapshot: Mapping[str, Any], name: str) -> list[dict[str, Any]]:
    value = snapshot.get(name)
    if not isinstance(value, list) or not all(isinstance(row, dict) for row in value):
        raise LocalTrainingError(f"SNAPSHOT_{name.upper()}_INVALID")
    return value


def _split_token(token: Any) -> tuple[str, str]:
    if not isinstance(token, str) or ":" not in token:
        raise LocalTrainingError("SNAPSHOT_FEATURE_TOKEN_INVALID")
    namespace, value = token.split(":", 1)
    if not namespace or not value:
        raise LocalTrainingError("SNAPSHOT_FEATURE_TOKEN_INVALID")
    return namespace, value


def _tokens(row: Mapping[str, Any]) -> list[str]:
    value = row.get("featureTokens")
    if not isinstance(value, list) or not value or not all(isinstance(token, str) for token in value):
        raise LocalTrainingError("SNAPSHOT_FEATURE_TOKENS_INVALID")
    return list(value)


def _canonical_vocabulary(snapshot: Mapping[str, Any]) -> dict[str, dict[str, list[str]]]:
    vocabulary: dict[str, dict[str, set[str]]] = {
        "user": {"interest": set()},
        "material": {"material-family": set(), "material-form": set()},
        "project": {"project-topic": set(), "component": set()},
    }
    for row in _require_rows(snapshot, "users"):
        for token in _tokens(row):
            namespace, _ = _split_token(token)
            if namespace != "interest":
                raise LocalTrainingError("SNAPSHOT_USER_FEATURE_NAMESPACE_INVALID")
            vocabulary["user"]["interest"].add(token)
    for row in _require_rows(snapshot, "materialItems"):
        for token in _tokens(row):
            namespace, _ = _split_token(token)
            if namespace in vocabulary["material"]:
                vocabulary["material"][namespace].add(token)
    for row in _require_rows(snapshot, "projectItems"):
        for token in _tokens(row):
            namespace, _ = _split_token(token)
            if namespace in vocabulary["project"]:
                vocabulary["project"][namespace].add(token)
    return {
        domain: {namespace: sorted(tokens) for namespace, tokens in namespaces.items()}
        for domain, namespaces in vocabulary.items()
    }


def _decode_users(snapshot: Mapping[str, Any]) -> list[dict[str, Any]]:
    return [
        {"userId": row.get("userKey"), "interestKeys": _tokens(row)}
        for row in _require_rows(snapshot, "users")
    ]


_MATERIAL_CONDITION = {
    "new": "NEW",
    "like-new": "LIKE_NEW",
    "good": "GOOD",
    "used": "USED",
    "needs-repair": "NEEDS_REPAIR",
}


def _literal_boolean(value: str) -> bool:
    if value == "true":
        return True
    if value == "false":
        return False
    raise LocalTrainingError("SNAPSHOT_BOOLEAN_FEATURE_INVALID")


def _decode_materials(snapshot: Mapping[str, Any]) -> list[dict[str, Any]]:
    materials: list[dict[str, Any]] = []
    for row in _require_rows(snapshot, "materialItems"):
        decoded: dict[str, Any] = {"materialId": row.get("materialKey"), "concepts": []}
        seen_closed: set[str] = set()
        for token in _tokens(row):
            namespace, value = _split_token(token)
            if namespace == "material-family":
                decoded["concepts"].append(
                    {"canonicalKey": token, "conceptType": "MATERIAL_FAMILY", "status": "ACTIVE"}
                )
            elif namespace == "material-form":
                decoded["concepts"].append(
                    {"canonicalKey": token, "conceptType": "MATERIAL_FORM", "status": "ACTIVE"}
                )
            elif namespace == "material-condition":
                if namespace in seen_closed or value not in _MATERIAL_CONDITION:
                    raise LocalTrainingError("SNAPSHOT_MATERIAL_CONDITION_INVALID")
                seen_closed.add(namespace)
                decoded["condition"] = _MATERIAL_CONDITION[value]
            elif namespace in {
                "material-is-free",
                "material-pickup-allowed",
                "material-delivery-allowed",
            }:
                if namespace in seen_closed:
                    raise LocalTrainingError("SNAPSHOT_MATERIAL_BOOLEAN_DUPLICATE")
                seen_closed.add(namespace)
                field = {
                    "material-is-free": "isFree",
                    "material-pickup-allowed": "pickupAllowed",
                    "material-delivery-allowed": "deliveryAllowed",
                }[namespace]
                decoded[field] = _literal_boolean(value)
            else:
                raise LocalTrainingError("SNAPSHOT_MATERIAL_FEATURE_NAMESPACE_INVALID")
        materials.append(decoded)
    return materials


_PROJECT_DIFFICULTY = {
    "beginner": "BEGINNER",
    "intermediate": "INTERMEDIATE",
    "advanced": "ADVANCED",
}


def _decode_projects(snapshot: Mapping[str, Any]) -> list[dict[str, Any]]:
    projects: list[dict[str, Any]] = []
    for row in _require_rows(snapshot, "projectItems"):
        decoded: dict[str, Any] = {
            "projectId": row.get("projectKey"),
            "topicConcepts": [],
            "componentConcepts": [],
        }
        difficulty_seen = False
        for token in _tokens(row):
            namespace, value = _split_token(token)
            if namespace == "project-topic":
                decoded["topicConcepts"].append(
                    {"canonicalKey": token, "conceptType": "PROJECT_TOPIC", "status": "ACTIVE"}
                )
            elif namespace == "component":
                decoded["componentConcepts"].append(
                    {
                        "canonicalKey": token,
                        "conceptType": "COMPONENT",
                        "status": "ACTIVE",
                        "isRequired": True,
                    }
                )
            elif namespace == "project-difficulty":
                if difficulty_seen or value not in _PROJECT_DIFFICULTY:
                    raise LocalTrainingError("SNAPSHOT_PROJECT_DIFFICULTY_INVALID")
                difficulty_seen = True
                decoded["difficulty"] = _PROJECT_DIFFICULTY[value]
            else:
                raise LocalTrainingError("SNAPSHOT_PROJECT_FEATURE_NAMESPACE_INVALID")
        projects.append(decoded)
    return projects


def _decode_interactions(
    snapshot: Mapping[str, Any], domain: Domain
) -> list[dict[str, Any]]:
    source_name = "materialInteractions" if domain == "material" else "projectInteractions"
    key_name = "materialKey" if domain == "material" else "projectKey"
    rows: list[dict[str, Any]] = []
    for row in _require_rows(snapshot, source_name):
        if row.get("domain") != domain:
            raise LocalTrainingError("SNAPSHOT_INTERACTION_DOMAIN_MISMATCH")
        rows.append(
            {"userId": row.get("userKey"), "itemId": row.get(key_name), "weight": 1.0}
        )
    return rows


def _mapping(feature_names: tuple[str, ...]) -> list[dict[str, Any]]:
    return [{"token": token, "index": index} for index, token in enumerate(feature_names)]


def _item_mapping(matrix: FeatureMatrixResult) -> list[dict[str, Any]]:
    return [
        {"itemKey": item_key, "index": index}
        for index, item_key in enumerate(matrix.entity_ids)
    ]


def _components(model: Any) -> dict[str, Any]:
    return {
        "userFeatureEmbeddings": [
            [_decimal(value) for value in row] for row in model.user_embeddings
        ],
        "itemFeatureEmbeddings": [
            [_decimal(value) for value in row] for row in model.item_embeddings
        ],
        "userFeatureBiases": [_decimal(value) for value in model.user_biases],
        "itemFeatureBiases": [_decimal(value) for value in model.item_biases],
    }


def _training_configuration(seed: int, domain: Domain) -> dict[str, Any]:
    config = FROZEN[domain]
    expected_components = 16 if domain == "material" else 32
    if config != {
        "no_components": expected_components,
        "epochs": 10,
        "learning_rate": 0.03,
        "user_alpha": 1e-6,
        "item_alpha": 1e-6,
    }:
        raise LocalTrainingError("FROZEN_LIGHTFM_CONFIGURATION_CHANGED")
    return {
        "randomSeed": seed,
        "loss": "warp",
        "epochs": 10,
        "noComponents": expected_components,
        "learningRate": "0.03",
        "userAlpha": "0.000001",
        "itemAlpha": "0.000001",
        "numThreads": 1,
        "interactionWeighting": "unit-per-snapshot-event",
        "duplicateInteractionAggregation": "sum",
    }


def _artifact(
    *,
    domain: Domain,
    snapshot: Mapping[str, Any],
    contract: Mapping[str, Any],
    aggregation: Mapping[str, Any],
    seed: int,
    user_matrix: FeatureMatrixResult,
    item_matrix: FeatureMatrixResult,
    model: Any,
    created_at: str,
) -> dict[str, Any]:
    feature_mapping = {
        "user": _mapping(user_matrix.feature_names),
        "item": _mapping(item_matrix.feature_names),
    }
    item_mapping = _item_mapping(item_matrix)
    dimensions = {
        "embeddingDimension": int(model.no_components),
        "userFeatureCount": len(user_matrix.feature_names),
        "itemFeatureCount": len(item_matrix.feature_names),
        "itemCount": len(item_matrix.entity_ids),
    }
    artifact = {
        "schemaVersion": SCHEMA_VERSION,
        "domain": domain,
        "modelVersion": MODEL_VERSION,
        "featureContractId": contract["contractId"],
        "featureContractVersion": contract["contractVersion"],
        "aggregationMode": aggregation["selectedMode"],
        "taxonomyFingerprint": contract["taxonomyCompatibility"][
            "taxonomyVocabularyFingerprint"
        ],
        "datasetContentHash": snapshot["hashes"]["semanticContent"]["value"],
        "featureMapping": feature_mapping,
        "featureMappingHash": sha256_canonical(feature_mapping),
        "itemMapping": item_mapping,
        "itemMappingHash": sha256_canonical(item_mapping),
        "trainingConfiguration": _training_configuration(seed, domain),
        "modelDimensions": dimensions,
        "modelComponents": _components(model),
        "createdAt": created_at,
    }
    artifact["semanticContentHash"] = semantic_content_hash(artifact)
    return artifact


def train_snapshot(
    snapshot: Mapping[str, Any],
    output_dir: Path,
    *,
    seed: int = 11,
    created_at: str | None = None,
) -> dict[str, dict[str, Any]]:
    if not isinstance(seed, int) or isinstance(seed, bool) or seed < 0 or seed > 0xFFFFFFFF:
        raise LocalTrainingError("RANDOM_SEED_INVALID")
    hashes = _require_record(snapshot.get("hashes"), "SNAPSHOT_HASHES_INVALID")
    semantic = _require_record(hashes.get("semanticContent"), "SNAPSHOT_HASHES_INVALID")
    dataset_hash = semantic.get("value")
    if (
        not isinstance(dataset_hash, str)
        or len(dataset_hash) != HASH_HEX_LENGTH
        or any(character not in "0123456789abcdef" for character in dataset_hash)
    ):
        raise LocalTrainingError("SNAPSHOT_SEMANTIC_HASH_INVALID")

    random.seed(seed)
    np.random.seed(seed)
    contract = load_v3_feature_contract()
    aggregation = load_local_aggregation_contract()
    context = compile_matrix_construction_context(
        contract, _canonical_vocabulary(snapshot), aggregation
    )

    users = _decode_users(snapshot)
    materials = _decode_materials(snapshot)
    projects = _decode_projects(snapshot)
    material_users = build_user_feature_matrix(context, users)
    project_users = build_user_feature_matrix(context, users)
    material_items = build_material_feature_matrix(context, materials)
    project_items = build_project_feature_matrix(context, projects)
    material_interactions = build_material_interaction_matrix(
        context,
        _decode_interactions(snapshot, "material"),
        material_users,
        material_items,
    )
    project_interactions = build_project_interaction_matrix(
        context,
        _decode_interactions(snapshot, "project"),
        project_users,
        project_items,
    )

    for domain, users_matrix, items_matrix, interactions in (
        ("material", material_users, material_items, material_interactions),
        ("project", project_users, project_items, project_interactions),
    ):
        if len(items_matrix.entity_ids) < 2:
            raise LocalTrainingError(f"{domain.upper()}_REQUIRES_AT_LEAST_TWO_ITEMS")
        if interactions.interactions.nnz == 0:
            raise LocalTrainingError(f"{domain.upper()}_INTERACTIONS_EMPTY")

    timestamp = created_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    material_model, _ = _fit(
        seed,
        FROZEN["material"],
        material_interactions.interactions,
        material_interactions.weights,
        material_users.matrix,
        material_items.matrix,
    )
    project_model, _ = _fit(
        seed,
        FROZEN["project"],
        project_interactions.interactions,
        project_interactions.weights,
        project_users.matrix,
        project_items.matrix,
    )
    artifacts = {
        "material": _artifact(
            domain="material",
            snapshot=snapshot,
            contract=contract,
            aggregation=aggregation,
            seed=seed,
            user_matrix=material_users,
            item_matrix=material_items,
            model=material_model,
            created_at=timestamp,
        ),
        "project": _artifact(
            domain="project",
            snapshot=snapshot,
            contract=contract,
            aggregation=aggregation,
            seed=seed,
            user_matrix=project_users,
            item_matrix=project_items,
            model=project_model,
            created_at=timestamp,
        ),
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    for domain in DOMAINS:
        destination = output_dir / f"{domain}-lightfm-v2.json"
        destination.write_text(
            json.dumps(
                artifacts[domain],
                ensure_ascii=False,
                allow_nan=False,
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
    return artifacts


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--snapshot", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--seed", type=int, default=11)
    args = parser.parse_args()
    try:
        snapshot = json.loads(args.snapshot.read_text(encoding="utf-8"))
        artifacts = train_snapshot(snapshot, args.output_dir, seed=args.seed)
        print(
            json.dumps(
                {
                    "status": "PASS",
                    "domains": {
                        domain: {
                            "items": artifacts[domain]["modelDimensions"]["itemCount"],
                            "userFeatures": artifacts[domain]["modelDimensions"][
                                "userFeatureCount"
                            ],
                            "itemFeatures": artifacts[domain]["modelDimensions"][
                                "itemFeatureCount"
                            ],
                            "semanticContentHash": artifacts[domain]["semanticContentHash"],
                        }
                        for domain in DOMAINS
                    },
                },
                separators=(",", ":"),
            )
        )
        return 0
    except Exception as error:  # CLI boundary intentionally bounds all failures.
        message = str(error).replace("\n", " ")[:500]
        print(f"Local LightFM training failed: {message}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
