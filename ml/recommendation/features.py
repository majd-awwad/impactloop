"""Approved, deterministic LightFM feature and interaction matrices."""
from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal, Mapping, TypeAlias

import numpy as np
from scipy import sparse

FEATURE_SCHEMA_VERSION = "slice-3-approved-features-v1"
RUNTIME_FEATURE_SCHEMA_VERSION = "runtime-approved-features-v2"

REPO_ROOT = Path(__file__).resolve().parents[2]
V3_CONTRACT_PATH = REPO_ROOT / "contracts/recommendation/recommendation-feature-token-contract-v3.json"
LOCAL_AGGREGATION_CONTRACT_PATH = Path(__file__).with_name("aggregation-contract-v1.json")

CanonicalVocabularyInput: TypeAlias = Mapping[str, Mapping[str, list[str]]]
FeatureSide: TypeAlias = Literal["user", "item"]
FeatureDomain: TypeAlias = Literal["material", "project"]
ReadinessStatus: TypeAlias = Literal["READY", "NOT_READY"]


class FeatureContractError(ValueError):
    """Deterministic fail-closed error for canonical v3 matrix inputs."""

    def __init__(self, code: str, details: Any = None):
        self.code = code
        self.details = details
        super().__init__(f"{code}: {details!r}" if details is not None else code)


@dataclass(frozen=True)
class FeatureOccurrence:
    token: str
    group_id: str
    side: FeatureSide
    domain: FeatureDomain
    weight: float = 1.0


@dataclass(frozen=True)
class FeatureRowResult:
    entity_id: str
    status: ReadinessStatus
    features: tuple[tuple[str, float], ...]
    occurrence_count: int
    unique_token_count: int
    missing_required_group_ids: tuple[str, ...]

    @property
    def tokens(self) -> tuple[str, ...]:
        return tuple(token for token, _ in self.features)


@dataclass(frozen=True)
class MatrixConstructionContext:
    contract: Mapping[str, Any]
    aggregation_contract: Mapping[str, Any]
    vocabulary: Mapping[str, Mapping[str, tuple[str, ...]]]
    vocabulary_membership: Mapping[tuple[str, str], frozenset[str]]
    namespace_by_id: Mapping[str, Mapping[str, Any]]
    group_by_id: Mapping[str, Mapping[str, Any]]

    @property
    def aggregation_mode(self) -> str:
        return str(self.aggregation_contract["selectedMode"])


@dataclass(frozen=True)
class FeatureMatrixResult:
    matrix: sparse.csr_matrix
    entity_ids: tuple[str, ...]
    entity_index: Mapping[str, int]
    feature_names: tuple[str, ...]
    feature_index: Mapping[str, int]
    readiness_by_entity: Mapping[str, FeatureRowResult]
    excluded_entity_ids: tuple[str, ...]


@dataclass(frozen=True)
class InteractionMatrixResult:
    interactions: sparse.coo_matrix
    weights: sparse.coo_matrix


_VOCABULARY_NAMESPACES: Mapping[str, tuple[str, ...]] = {
    "user": ("interest",),
    "material": ("material-family", "material-form"),
    "project": ("component", "project-topic"),
}


def load_v3_feature_contract(path: Path = V3_CONTRACT_PATH) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_local_aggregation_contract(
    path: Path = LOCAL_AGGREGATION_CONTRACT_PATH,
) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _namespace_id(token: str) -> str:
    return token.split(":", 1)[0]


def _assert_token_grammar(namespace: Mapping[str, Any], token: str) -> None:
    if re.fullmatch(str(namespace["tokenPattern"]), token) is None:
        raise FeatureContractError("MALFORMED_CANONICAL_TOKEN", token)


def compile_matrix_construction_context(
    contract: Mapping[str, Any],
    vocabulary: CanonicalVocabularyInput,
    aggregation_contract: Mapping[str, Any],
) -> MatrixConstructionContext:
    namespace_by_id = {row["id"]: row for row in contract["namespaces"]}
    group_by_id = {row["id"]: row for row in contract["featureGroups"]}
    expected_domains = set(_VOCABULARY_NAMESPACES)
    if set(vocabulary) != expected_domains:
        raise FeatureContractError(
            "VOCABULARY_DOMAIN_MISMATCH",
            {"expected": sorted(expected_domains), "actual": sorted(vocabulary)},
        )

    compiled_vocabulary: dict[str, dict[str, tuple[str, ...]]] = {}
    membership: dict[tuple[str, str], frozenset[str]] = {}
    for domain, expected_namespaces in _VOCABULARY_NAMESPACES.items():
        supplied = vocabulary[domain]
        if set(supplied) != set(expected_namespaces):
            raise FeatureContractError(
                "VOCABULARY_NAMESPACE_MISMATCH",
                {
                    "domain": domain,
                    "expected": sorted(expected_namespaces),
                    "actual": sorted(supplied),
                },
            )
        compiled_vocabulary[domain] = {}
        for namespace_id in expected_namespaces:
            namespace = namespace_by_id.get(namespace_id)
            if namespace is None or namespace["valueSource"]["kind"] != "taxonomy":
                raise FeatureContractError("VOCABULARY_NAMESPACE_UNSUPPORTED", namespace_id)
            tokens = supplied[namespace_id]
            if not isinstance(tokens, list) or not all(isinstance(token, str) for token in tokens):
                raise FeatureContractError("VOCABULARY_TOKEN_LIST_INVALID", namespace_id)
            ordered = tuple(sorted(set(tokens)))
            for token in ordered:
                if _namespace_id(token) != namespace_id:
                    raise FeatureContractError(
                        "VOCABULARY_TOKEN_NAMESPACE_MISMATCH",
                        {"domain": domain, "namespace": namespace_id, "token": token},
                    )
                _assert_token_grammar(namespace, token)
            compiled_vocabulary[domain][namespace_id] = ordered
            membership[(domain, namespace_id)] = frozenset(ordered)

    candidate_modes = tuple(contract["aggregation"]["candidateModes"])
    if tuple(aggregation_contract.get("candidateModes", ())) != candidate_modes:
        raise FeatureContractError("AGGREGATION_CANDIDATES_MISMATCH")
    selected = aggregation_contract.get("selectedMode")
    if selected not in candidate_modes:
        raise FeatureContractError("AGGREGATION_MODE_INVALID", selected)
    if selected != "weighted-sum":
        raise FeatureContractError("AGGREGATION_MODE_NOT_RUNTIME_COMPATIBLE", selected)

    return MatrixConstructionContext(
        contract=contract,
        aggregation_contract=aggregation_contract,
        vocabulary=compiled_vocabulary,
        vocabulary_membership=membership,
        namespace_by_id=namespace_by_id,
        group_by_id=group_by_id,
    )


def _vocabulary_domain(side: FeatureSide, domain: FeatureDomain) -> str:
    return "user" if side == "user" else domain


def _validate_occurrence(
    context: MatrixConstructionContext,
    occurrence: FeatureOccurrence,
) -> Mapping[str, Any]:
    if not isinstance(occurrence.token, str) or not occurrence.token:
        raise FeatureContractError("MALFORMED_CANONICAL_TOKEN", occurrence.token)
    namespace_id = _namespace_id(occurrence.token)
    namespace = context.namespace_by_id.get(namespace_id)
    if namespace is None:
        raise FeatureContractError("UNKNOWN_NAMESPACE", occurrence.token)
    _assert_token_grammar(namespace, occurrence.token)

    group = context.group_by_id.get(occurrence.group_id)
    if group is None or not group.get("portableRuntimeEligible"):
        raise FeatureContractError("UNKNOWN_OR_NONPORTABLE_GROUP", occurrence.group_id)
    if (
        group["namespaceId"] != namespace_id
        or group["side"] != occurrence.side
        or occurrence.domain not in group["domains"]
    ):
        raise FeatureContractError("FEATURE_CONTEXT_MISMATCH", occurrence)

    value_source = namespace["valueSource"]
    if value_source["kind"] == "taxonomy":
        vocab_domain = _vocabulary_domain(occurrence.side, occurrence.domain)
        accepted = context.vocabulary_membership.get((vocab_domain, namespace_id))
        if accepted is None or occurrence.token not in accepted:
            raise FeatureContractError("UNKNOWN_CANONICAL_IDENTITY", occurrence.token)
    else:
        accepted = {
            f"{namespace_id}:{value['tokenValue']}" for value in value_source["values"]
        }
        if occurrence.token not in accepted:
            raise FeatureContractError("UNKNOWN_CLOSED_VALUE", occurrence.token)
    return group


def consolidate_feature_row(
    context: MatrixConstructionContext,
    *,
    entity_id: str,
    side: FeatureSide,
    domain: FeatureDomain,
    occurrences: list[FeatureOccurrence],
) -> FeatureRowResult:
    if not isinstance(entity_id, str) or not entity_id:
        raise FeatureContractError("ENTITY_ID_INVALID", entity_id)
    occurrence_count = len(occurrences)
    unique_token_count = len({occurrence.token for occurrence in occurrences})
    by_token: dict[str, FeatureOccurrence] = {}
    group_tokens: dict[str, set[str]] = {}

    for occurrence in occurrences:
        if occurrence.side != side or occurrence.domain != domain:
            raise FeatureContractError("FEATURE_ROW_CONTEXT_MISMATCH", occurrence)
        group = _validate_occurrence(context, occurrence)
        prior = by_token.get(occurrence.token)
        if prior is not None and prior.weight != occurrence.weight:
            raise FeatureContractError(
                "DUPLICATE_WEIGHT_CONFLICT",
                {
                    "entityId": entity_id,
                    "token": occurrence.token,
                    "weights": [prior.weight, occurrence.weight],
                    "occurrenceCount": occurrence_count,
                    "uniqueTokenCount": unique_token_count,
                },
            )
        expected_weight = float(group["baseWeight"])
        if (
            not math.isfinite(occurrence.weight)
            or occurrence.weight <= 0
            or occurrence.weight != expected_weight
        ):
            raise FeatureContractError("INVALID_FEATURE_WEIGHT", occurrence)
        if prior is not None:
            continue
        by_token[occurrence.token] = occurrence
        group_tokens.setdefault(occurrence.group_id, set()).add(occurrence.token)

    applicable = [
        group
        for group in context.group_by_id.values()
        if group.get("portableRuntimeEligible")
        and group["side"] == side
        and domain in group["domains"]
    ]
    missing: list[str] = []
    for group in applicable:
        count = len(group_tokens.get(group["id"], set()))
        maximum = group["cardinality"]["maximum"]
        if maximum is not None and count > maximum:
            raise FeatureContractError(
                "FEATURE_GROUP_CARDINALITY_EXCEEDED",
                {"groupId": group["id"], "count": count},
            )
        minimum = group["cardinality"]["minimum"]
        if group["requiredForScoring"] and minimum is not None and count < minimum:
            missing.append(group["id"])

    ordered = tuple(
        (token, float(by_token[token].weight)) for token in sorted(by_token)
    )
    return FeatureRowResult(
        entity_id=entity_id,
        status="NOT_READY" if missing else "READY",
        features=ordered,
        occurrence_count=occurrence_count,
        unique_token_count=unique_token_count,
        missing_required_group_ids=tuple(sorted(missing)),
    )


def _closed_token(
    context: MatrixConstructionContext,
    namespace_id: str,
    source_value: str | bool,
) -> str:
    namespace = context.namespace_by_id[namespace_id]
    for value in namespace["valueSource"]["values"]:
        if type(value["sourceValue"]) is type(source_value) and value["sourceValue"] == source_value:
            return f"{namespace_id}:{value['tokenValue']}"
    raise FeatureContractError(
        "UNKNOWN_CLOSED_SOURCE_VALUE",
        {"namespace": namespace_id, "sourceValue": source_value},
    )


def _build_feature_matrix(rows: list[FeatureRowResult]) -> FeatureMatrixResult:
    readiness: dict[str, FeatureRowResult] = {}
    for row in rows:
        if row.entity_id in readiness:
            raise FeatureContractError("DUPLICATE_ENTITY_ID", row.entity_id)
        readiness[row.entity_id] = row
    ready = sorted((row for row in rows if row.status == "READY"), key=lambda row: row.entity_id)
    entity_ids = tuple(row.entity_id for row in ready)
    feature_names = tuple(sorted({token for row in ready for token in row.tokens}))
    entity_index = {entity_id: index for index, entity_id in enumerate(entity_ids)}
    feature_index = {token: index for index, token in enumerate(feature_names)}
    matrix_rows: list[int] = []
    matrix_columns: list[int] = []
    values: list[float] = []
    for row_index, row in enumerate(ready):
        for token, weight in row.features:
            matrix_rows.append(row_index)
            matrix_columns.append(feature_index[token])
            values.append(weight)
    matrix = sparse.csr_matrix(
        (values, (matrix_rows, matrix_columns)),
        shape=(len(entity_ids), len(feature_names)),
        dtype=np.float32,
    )
    matrix.sum_duplicates()
    matrix.sort_indices()
    if not np.isfinite(matrix.data).all():
        raise FeatureContractError("NONFINITE_FEATURE_MATRIX")
    return FeatureMatrixResult(
        matrix=matrix,
        entity_ids=entity_ids,
        entity_index=entity_index,
        feature_names=feature_names,
        feature_index=feature_index,
        readiness_by_entity=readiness,
        excluded_entity_ids=tuple(sorted(row.entity_id for row in rows if row.status != "READY")),
    )


def _taxonomy_occurrence(
    token: str,
    group_id: str,
    side: FeatureSide,
    domain: FeatureDomain,
    weight: Any = 1.0,
) -> FeatureOccurrence:
    if not isinstance(weight, (int, float)) or isinstance(weight, bool):
        raise FeatureContractError("INVALID_FEATURE_WEIGHT", weight)
    return FeatureOccurrence(token, group_id, side, domain, float(weight))


def build_user_feature_matrix(
    context: MatrixConstructionContext,
    users: list[dict[str, Any]],
) -> FeatureMatrixResult:
    rows: list[FeatureRowResult] = []
    for user in users:
        interests = user.get("interestKeys", [])
        if not isinstance(interests, list) or not all(isinstance(token, str) for token in interests):
            raise FeatureContractError("USER_INTERESTS_INVALID", user.get("userId"))
        occurrences = [
            FeatureOccurrence(token, "user.declared-interest", "user", "material", 1.0)
            for token in interests
        ]
        rows.append(
            consolidate_feature_row(
                context,
                entity_id=user.get("userId"),
                side="user",
                domain="material",
                occurrences=occurrences,
            )
        )
    return _build_feature_matrix(rows)


def build_material_feature_matrix(
    context: MatrixConstructionContext,
    materials: list[dict[str, Any]],
) -> FeatureMatrixResult:
    rows: list[FeatureRowResult] = []
    for material in materials:
        occurrences: list[FeatureOccurrence] = []
        for concept in material.get("concepts", []):
            if concept.get("status", "ACTIVE") != "ACTIVE":
                continue
            concept_type = concept.get("conceptType")
            group_id = {
                "MATERIAL_FAMILY": "material.family",
                "MATERIAL_FORM": "material.form",
            }.get(concept_type)
            if group_id is None:
                raise FeatureContractError("MATERIAL_CONCEPT_TYPE_INVALID", concept_type)
            occurrences.append(
                _taxonomy_occurrence(
                    concept.get("canonicalKey"),
                    group_id,
                    "item",
                    "material",
                    concept.get("weight", 1.0),
                )
            )
        for group_id, namespace_id, source_field in (
            ("material.condition", "material-condition", "condition"),
            ("material.is-free", "material-is-free", "isFree"),
            ("material.pickup-allowed", "material-pickup-allowed", "pickupAllowed"),
            ("material.delivery-allowed", "material-delivery-allowed", "deliveryAllowed"),
        ):
            value = material.get(source_field)
            if value is None:
                continue
            if namespace_id != "material-condition" and type(value) is not bool:
                raise FeatureContractError("BOOLEAN_SOURCE_VALUE_INVALID", {namespace_id: value})
            occurrences.append(
                FeatureOccurrence(
                    _closed_token(context, namespace_id, value),
                    group_id,
                    "item",
                    "material",
                    1.0,
                )
            )
        rows.append(
            consolidate_feature_row(
                context,
                entity_id=material.get("materialId"),
                side="item",
                domain="material",
                occurrences=occurrences,
            )
        )
    return _build_feature_matrix(rows)


def build_project_feature_matrix(
    context: MatrixConstructionContext,
    projects: list[dict[str, Any]],
) -> FeatureMatrixResult:
    rows: list[FeatureRowResult] = []
    for project in projects:
        occurrences: list[FeatureOccurrence] = []
        for concept in project.get("topicConcepts", []):
            if concept.get("status", "ACTIVE") != "ACTIVE":
                continue
            if concept.get("conceptType") != "PROJECT_TOPIC":
                raise FeatureContractError("PROJECT_TOPIC_TYPE_INVALID", concept.get("conceptType"))
            occurrences.append(
                _taxonomy_occurrence(
                    concept.get("canonicalKey"),
                    "project.topic",
                    "item",
                    "project",
                    concept.get("weight", 1.0),
                )
            )
        for concept in project.get("componentConcepts", []):
            if concept.get("status", "ACTIVE") != "ACTIVE" or not concept.get("isRequired", False):
                continue
            if concept.get("conceptType") != "COMPONENT":
                raise FeatureContractError("PROJECT_COMPONENT_TYPE_INVALID", concept.get("conceptType"))
            occurrences.append(
                _taxonomy_occurrence(
                    concept.get("canonicalKey"),
                    "project.required-component",
                    "item",
                    "project",
                    concept.get("weight", 1.0),
                )
            )
        difficulty = project.get("difficulty")
        if difficulty is not None:
            occurrences.append(
                FeatureOccurrence(
                    _closed_token(context, "project-difficulty", difficulty),
                    "project.difficulty",
                    "item",
                    "project",
                    1.0,
                )
            )
        rows.append(
            consolidate_feature_row(
                context,
                entity_id=project.get("projectId"),
                side="item",
                domain="project",
                occurrences=occurrences,
            )
        )
    return _build_feature_matrix(rows)


def _build_interaction_matrix(
    rows: list[dict[str, Any]],
    users: FeatureMatrixResult,
    items: FeatureMatrixResult,
) -> InteractionMatrixResult:
    matrix_rows: list[int] = []
    matrix_columns: list[int] = []
    values: list[float] = []
    for row in rows:
        user_id = row.get("userId")
        item_id = row.get("itemId")
        if user_id not in users.entity_index or item_id not in items.entity_index:
            raise FeatureContractError(
                "INTERACTION_ENTITY_NOT_READY_OR_UNKNOWN",
                {"userId": user_id, "itemId": item_id},
            )
        try:
            weight = float(row.get("weight"))
        except (TypeError, ValueError) as error:
            raise FeatureContractError("INTERACTION_WEIGHT_INVALID", row.get("weight")) from error
        if not math.isfinite(weight):
            raise FeatureContractError("NONFINITE_INTERACTION_WEIGHT", weight)
        matrix_rows.append(users.entity_index[user_id])
        matrix_columns.append(items.entity_index[item_id])
        values.append(weight)
    shape = (len(users.entity_ids), len(items.entity_ids))
    weights_csr = sparse.coo_matrix(
        (values, (matrix_rows, matrix_columns)), shape=shape, dtype=np.float32
    ).tocsr()
    weights_csr.sum_duplicates()
    weights_csr.sort_indices()
    if not np.isfinite(weights_csr.data).all():
        raise FeatureContractError("NONFINITE_INTERACTION_MATRIX")
    binary_csr = weights_csr.copy()
    binary_csr.data[:] = 1.0
    return InteractionMatrixResult(binary_csr.tocoo(), weights_csr.tocoo())


def build_material_interaction_matrix(
    context: MatrixConstructionContext,
    rows: list[dict[str, Any]],
    users: FeatureMatrixResult,
    materials: FeatureMatrixResult,
) -> InteractionMatrixResult:
    if context.aggregation_mode != "weighted-sum":
        raise FeatureContractError("AGGREGATION_MODE_NOT_RUNTIME_COMPATIBLE")
    return _build_interaction_matrix(rows, users, materials)


def build_project_interaction_matrix(
    context: MatrixConstructionContext,
    rows: list[dict[str, Any]],
    users: FeatureMatrixResult,
    projects: FeatureMatrixResult,
) -> InteractionMatrixResult:
    if context.aggregation_mode != "weighted-sum":
        raise FeatureContractError("AGGREGATION_MODE_NOT_RUNTIME_COMPATIBLE")
    return _build_interaction_matrix(rows, users, projects)


def mappings(personas: list[dict[str, Any]], items: list[dict[str, Any]], domain: str) -> dict[str, Any]:
    key = f"{domain}_key"
    users = sorted(p["sim_user_key"] for p in personas)
    item_keys = sorted(row[key] for row in items)
    result = {"users": users, "items": item_keys,
              "user_index": {v: i for i, v in enumerate(users)},
              "item_index": {v: i for i, v in enumerate(item_keys)}}
    result["mapping_hash"] = hashlib.sha256(("\n".join(users) + "\n--\n" + "\n".join(item_keys)).encode()).hexdigest()
    return result


def approved_user_tokens(persona: dict[str, Any]) -> list[tuple[str, float]]:
    tokens = [(f"interest:{persona['primary_interest']}", 1.0),
              (f"activity:{persona['activity_band']}", 1.0),
              (f"free_pref:{min(3, int(persona['free_preference'] * 4))}", 1.0),
              (f"delivery_pref:{min(3, int(persona['delivery_preference'] * 4))}", 1.0),
              (f"project_tendency:{min(3, int(persona['project_driven_tendency'] * 4))}", 1.0)]
    if persona.get("secondary_interest"):
        tokens.append((f"interest:{persona['secondary_interest']}", .5))
    return tokens


def runtime_user_tokens(persona: dict[str, Any]) -> list[tuple[str, float]]:
    values = [persona["primary_interest"]]
    if persona.get("secondary_interest"):
        values.append(persona["secondary_interest"])
    return [(f"interest:{value}", 1.0) for value in sorted(set(values))]


def approved_item_tokens(item: dict[str, Any], domain: str) -> list[tuple[str, float]]:
    tokens = [(f"category:{item['category_key']}", 1.0)]
    tokens += [(f"concept:{value}", 1.0) for value in item["concept_keys"]]
    if domain == "material":
        tokens += [(f"condition:{item['condition']}", 1.0), (f"free:{int(item['is_free'])}", 1.0),
                   (f"pickup:{int(item['pickup_allowed'])}", 1.0), (f"delivery:{int(item['delivery_allowed'])}", 1.0)]
    else:
        tokens += [(f"difficulty:{item['difficulty']}", 1.0)]
        tokens += [(f"component:{value}", 1.0) for value in item["component_concept_keys"]]
    return tokens


def feature_matrices(personas: list[dict[str, Any]], items: list[dict[str, Any]], domain: str,
                     maps: dict[str, Any], identities: bool,
                     cold_users: set[str] | None = None, cold_items: set[str] | None = None,
                     metadata: bool = True, runtime_contract: bool = False):
    cold_users, cold_items = cold_users or set(), cold_items or set()
    persona_by = {p["sim_user_key"]: p for p in personas}; key = f"{domain}_key"; item_by = {r[key]: r for r in items}
    user_tokens = runtime_user_tokens if runtime_contract else approved_user_tokens
    user_meta = sorted({t for p in personas for t, _ in user_tokens(p)}) if metadata else []
    item_meta = sorted({t for item in items for t, _ in approved_item_tokens(item, domain)}) if metadata else []
    user_names = ([f"user_identity:{u}" for u in maps["users"]] if identities else []) + user_meta
    item_names = ([f"item_identity:{i}" for i in maps["items"]] if identities else []) + item_meta
    ui, ii = {v: i for i, v in enumerate(user_names)}, {v: i for i, v in enumerate(item_names)}
    ur: list[int] = []; uc: list[int] = []; uv: list[float] = []
    for row, user in enumerate(maps["users"]):
        values = user_tokens(persona_by[user]) if metadata else []
        if identities and user not in cold_users: values = [(f"user_identity:{user}", 1.0), *values]
        for token, value in values: ur.append(row); uc.append(ui[token]); uv.append(value)
    ir: list[int] = []; ic: list[int] = []; iv: list[float] = []
    for row, item in enumerate(maps["items"]):
        values = approved_item_tokens(item_by[item], domain) if metadata else []
        if identities and item not in cold_items: values = [(f"item_identity:{item}", 1.0), *values]
        for token, value in values: ir.append(row); ic.append(ii[token]); iv.append(value)
    user_matrix = sparse.csr_matrix((uv, (ur, uc)), shape=(len(maps["users"]), len(user_names)), dtype=np.float32)
    item_matrix = sparse.csr_matrix((iv, (ir, ic)), shape=(len(maps["items"]), len(item_names)), dtype=np.float32)
    return user_matrix, item_matrix, {"user_features": user_names, "item_features": item_names}


def interaction_matrix(rows: list[dict[str, Any]], maps: dict[str, Any]):
    train = [r for r in rows if r["split"] == "train"]
    r = [maps["user_index"][x["sim_user_key"]] for x in train]
    c = [maps["item_index"][x["entity_key"]] for x in train]
    values = [float(x["weight"]) for x in train]
    shape = (len(maps["users"]), len(maps["items"]))
    weights_csr = sparse.coo_matrix((values, (r, c)), shape=shape).tocsr()
    binary_csr = weights_csr.copy(); binary_csr.data[:] = 1.0
    # LightFM requires sample weights in COO form with exactly the same logical
    # coordinates as interactions.
    return binary_csr.tocoo(), weights_csr.tocoo()
