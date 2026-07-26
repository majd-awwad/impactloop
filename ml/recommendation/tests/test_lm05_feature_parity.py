from __future__ import annotations

import copy
import json
from pathlib import Path

import numpy as np
import pytest

from ml.recommendation.features import (
    FeatureContractError,
    FeatureOccurrence,
    build_material_feature_matrix,
    build_material_interaction_matrix,
    build_project_feature_matrix,
    build_project_interaction_matrix,
    build_user_feature_matrix,
    compile_matrix_construction_context,
    consolidate_feature_row,
    load_local_aggregation_contract,
    load_v3_feature_contract,
)

FIXTURE_PATH = Path(__file__).with_name("fixtures") / "lm05_feature_parity_v1.json"


@pytest.fixture(scope="module")
def fixture() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def context(fixture):
    return compile_matrix_construction_context(
        load_v3_feature_contract(),
        fixture["canonicalVocabulary"],
        load_local_aggregation_contract(),
    )


def _assert_expected(result, expected):
    assert list(result.tokens) == expected["tokens"]
    assert result.occurrence_count == expected["occurrenceCount"]
    assert result.unique_token_count == expected["uniqueTokenCount"]
    assert result.status == expected["readiness"]
    assert list(result.missing_required_group_ids) == expected["missingRequiredGroupIds"]


def test_context_compiles_minimal_vocabulary_in_ascii_order(context):
    assert context.aggregation_mode == "weighted-sum"
    assert context.vocabulary["user"]["interest"] == (
        "interest:arduino",
        "interest:electronics",
        "interest:robotics",
    )
    assert context.vocabulary["project"]["component"] == (
        "component:dc-gear-motors",
        "component:jumper-wires",
    )


def test_context_rejects_malformed_and_misplaced_vocabulary(fixture):
    malformed = copy.deepcopy(fixture["canonicalVocabulary"])
    malformed["material"]["material-family"] = ["material-family:Bad_Value"]
    with pytest.raises(FeatureContractError, match="MALFORMED_CANONICAL_TOKEN"):
        compile_matrix_construction_context(
            load_v3_feature_contract(), malformed, load_local_aggregation_contract()
        )

    misplaced = copy.deepcopy(fixture["canonicalVocabulary"])
    misplaced["material"]["component"] = misplaced["project"]["component"]
    with pytest.raises(FeatureContractError, match="VOCABULARY_NAMESPACE_MISMATCH"):
        compile_matrix_construction_context(
            load_v3_feature_contract(), misplaced, load_local_aggregation_contract()
        )


def test_exact_user_material_and_project_rows(context, fixture):
    users = build_user_feature_matrix(context, fixture["users"])
    materials = build_material_feature_matrix(context, fixture["materials"])
    projects = build_project_feature_matrix(context, fixture["projects"])
    for row in fixture["users"]:
        _assert_expected(users.readiness_by_entity[row["userId"]], row["expected"])
    for row in fixture["materials"]:
        _assert_expected(materials.readiness_by_entity[row["materialId"]], row["expected"])
    for row in fixture["projects"]:
        _assert_expected(projects.readiness_by_entity[row["projectId"]], row["expected"])
    assert not any("identity:" in name for result in (users, materials, projects) for name in result.feature_names)
    assert all(np.array_equal(result.matrix.data, np.ones_like(result.matrix.data)) for result in (users, materials, projects))


@pytest.mark.parametrize(
    ("condition", "expected"),
    [
        ("NEW", "material-condition:new"),
        ("LIKE_NEW", "material-condition:like-new"),
        ("GOOD", "material-condition:good"),
        ("USED", "material-condition:used"),
        ("NEEDS_REPAIR", "material-condition:needs-repair"),
    ],
)
def test_material_enum_and_literal_boolean_parity(context, condition, expected):
    material = {
        "materialId": "m-enum",
        "concepts": [{"canonicalKey": "material-family:electronics", "conceptType": "MATERIAL_FAMILY"}],
        "condition": condition,
        "isFree": True,
        "pickupAllowed": False,
        "deliveryAllowed": True,
    }
    result = build_material_feature_matrix(context, [material])
    tokens = result.readiness_by_entity["m-enum"].tokens
    assert expected in tokens
    assert "material-is-free:true" in tokens
    assert "material-pickup-allowed:false" in tokens
    assert "material-delivery-allowed:true" in tokens
    material["isFree"] = 1
    with pytest.raises(FeatureContractError, match="BOOLEAN_SOURCE_VALUE_INVALID"):
        build_material_feature_matrix(context, [material])


@pytest.mark.parametrize(
    ("difficulty", "expected"),
    [
        ("BEGINNER", "project-difficulty:beginner"),
        ("INTERMEDIATE", "project-difficulty:intermediate"),
        ("ADVANCED", "project-difficulty:advanced"),
    ],
)
def test_project_difficulty_parity(context, difficulty, expected):
    project = {
        "projectId": "p-enum",
        "topicConcepts": [{"canonicalKey": "project-topic:robotics", "conceptType": "PROJECT_TOPIC"}],
        "componentConcepts": [],
        "difficulty": difficulty,
    }
    result = build_project_feature_matrix(context, [project])
    assert expected in result.readiness_by_entity["p-enum"].tokens


def test_component_must_have_exactly_one_prefix(context):
    project = {
        "projectId": "p-bad",
        "topicConcepts": [{"canonicalKey": "project-topic:robotics", "conceptType": "PROJECT_TOPIC"}],
        "componentConcepts": [
            {
                "canonicalKey": "component:component:dc-gear-motors",
                "conceptType": "COMPONENT",
                "isRequired": True,
            }
        ],
        "difficulty": "BEGINNER",
    }
    with pytest.raises(FeatureContractError, match="MALFORMED_CANONICAL_TOKEN"):
        build_project_feature_matrix(context, [project])


def _case_occurrences(case):
    return [
        FeatureOccurrence(token, group, case["side"], case["domain"], float(weight))
        for token, group, weight in case["features"]
    ]


def test_shared_validation_cases_cover_readiness_membership_and_duplicates(context, fixture):
    for case in fixture["validationCases"]:
        expected = case["expected"]
        if expected["readiness"] == "REJECTED":
            with pytest.raises(FeatureContractError) as raised:
                consolidate_feature_row(
                    context,
                    entity_id=case["name"],
                    side=case["side"],
                    domain=case["domain"],
                    occurrences=_case_occurrences(case),
                )
            assert raised.value.code == expected["errorCode"]
            continue
        result = consolidate_feature_row(
            context,
            entity_id=case["name"],
            side=case["side"],
            domain=case["domain"],
            occurrences=_case_occurrences(case),
        )
        assert result.status == expected["readiness"]
        assert result.occurrence_count == expected["occurrenceCount"]
        assert result.unique_token_count == expected["uniqueTokenCount"]
        assert list(result.missing_required_group_ids) == expected["missingRequiredGroupIds"]


def test_critical_missing_entities_are_explicitly_excluded(context):
    users = build_user_feature_matrix(context, [{"userId": "u-empty", "interestKeys": []}])
    assert users.entity_ids == ()
    assert users.excluded_entity_ids == ("u-empty",)
    assert users.readiness_by_entity["u-empty"].status == "NOT_READY"
    assert users.readiness_by_entity["u-empty"].missing_required_group_ids == ("user.declared-interest",)


@pytest.mark.parametrize(
    ("missing_field", "missing_group"),
    [
        ("condition", "material.condition"),
        ("isFree", "material.is-free"),
        ("pickupAllowed", "material.pickup-allowed"),
        ("deliveryAllowed", "material.delivery-allowed"),
    ],
)
def test_missing_material_closed_fields_are_explicitly_not_ready(
    context, missing_field, missing_group
):
    material = {
        "materialId": f"m-missing-{missing_field}",
        "concepts": [
            {
                "canonicalKey": "material-family:electronics",
                "conceptType": "MATERIAL_FAMILY",
            }
        ],
        "condition": "GOOD",
        "isFree": False,
        "pickupAllowed": False,
        "deliveryAllowed": False,
    }
    material.pop(missing_field)
    result = build_material_feature_matrix(context, [material])
    row = result.readiness_by_entity[material["materialId"]]
    assert row.status == "NOT_READY"
    assert row.missing_required_group_ids == (missing_group,)
    assert row.occurrence_count == 4
    assert row.unique_token_count == 4
    assert result.entity_ids == ()
    assert result.excluded_entity_ids == (material["materialId"],)


def test_none_and_multiple_missing_material_closed_fields_are_truthful(context):
    material = {
        "materialId": "m-missing-many",
        "concepts": [
            {
                "canonicalKey": "material-family:electronics",
                "conceptType": "MATERIAL_FAMILY",
            }
        ],
        "condition": None,
        "isFree": False,
        "pickupAllowed": None,
        "deliveryAllowed": None,
    }
    result = build_material_feature_matrix(context, [material])
    row = result.readiness_by_entity["m-missing-many"]
    assert row.status == "NOT_READY"
    assert row.missing_required_group_ids == (
        "material.condition",
        "material.delivery-allowed",
        "material.pickup-allowed",
    )
    assert row.tokens == (
        "material-family:electronics",
        "material-is-free:false",
    )
    assert row.occurrence_count == 2
    assert row.unique_token_count == 2
    assert result.excluded_entity_ids == ("m-missing-many",)


def test_false_material_booleans_remain_valid(context):
    material = {
        "materialId": "m-false-booleans",
        "concepts": [
            {
                "canonicalKey": "material-family:electronics",
                "conceptType": "MATERIAL_FAMILY",
            }
        ],
        "condition": "GOOD",
        "isFree": False,
        "pickupAllowed": False,
        "deliveryAllowed": False,
    }
    result = build_material_feature_matrix(context, [material])
    row = result.readiness_by_entity["m-false-booleans"]
    assert row.status == "READY"
    assert row.missing_required_group_ids == ()
    assert row.occurrence_count == row.unique_token_count == 5
    assert {
        "material-is-free:false",
        "material-pickup-allowed:false",
        "material-delivery-allowed:false",
    }.issubset(row.tokens)


def test_present_invalid_material_closed_values_still_reject(context):
    base = {
        "materialId": "m-invalid-closed",
        "concepts": [
            {
                "canonicalKey": "material-family:electronics",
                "conceptType": "MATERIAL_FAMILY",
            }
        ],
        "condition": "GOOD",
        "isFree": False,
        "pickupAllowed": False,
        "deliveryAllowed": False,
    }
    invalid_enum = {**base, "condition": "BROKEN"}
    with pytest.raises(FeatureContractError, match="UNKNOWN_CLOSED_SOURCE_VALUE"):
        build_material_feature_matrix(context, [invalid_enum])
    for field, value in (
        ("isFree", 0),
        ("pickupAllowed", "false"),
        ("deliveryAllowed", 1),
    ):
        invalid_boolean = {**base, field: value}
        with pytest.raises(FeatureContractError, match="BOOLEAN_SOURCE_VALUE_INVALID"):
            build_material_feature_matrix(context, [invalid_boolean])


def test_missing_project_difficulty_is_not_ready_but_invalid_still_rejects(context):
    project = {
        "projectId": "p-missing-difficulty",
        "topicConcepts": [
            {
                "canonicalKey": "project-topic:robotics",
                "conceptType": "PROJECT_TOPIC",
            }
        ],
        "componentConcepts": [],
        "difficulty": None,
    }
    result = build_project_feature_matrix(context, [project])
    row = result.readiness_by_entity["p-missing-difficulty"]
    assert row.status == "NOT_READY"
    assert row.missing_required_group_ids == ("project.difficulty",)
    assert row.tokens == ("project-topic:robotics",)
    assert row.occurrence_count == 1
    assert row.unique_token_count == 1
    assert result.entity_ids == ()
    assert result.excluded_entity_ids == ("p-missing-difficulty",)

    invalid = {**project, "projectId": "p-invalid-difficulty", "difficulty": "EXPERT"}
    with pytest.raises(FeatureContractError, match="UNKNOWN_CLOSED_SOURCE_VALUE"):
        build_project_feature_matrix(context, [invalid])


def test_mappings_are_stable_for_reordered_input(context, fixture):
    forward = build_material_feature_matrix(context, fixture["materials"])
    reverse = build_material_feature_matrix(context, list(reversed(fixture["materials"])))
    assert forward.entity_ids == reverse.entity_ids
    assert forward.feature_names == reverse.feature_names
    assert forward.entity_index == reverse.entity_index
    assert forward.feature_index == reverse.feature_index
    np.testing.assert_array_equal(forward.matrix.toarray(), reverse.matrix.toarray())


def test_all_five_matrices_are_independent_finite_and_exact(context, fixture):
    users = build_user_feature_matrix(context, fixture["users"])
    materials = build_material_feature_matrix(context, fixture["materials"])
    projects = build_project_feature_matrix(context, fixture["projects"])
    material_interactions = build_material_interaction_matrix(
        context, fixture["materialInteractions"], users, materials
    )
    project_interactions = build_project_interaction_matrix(
        context, fixture["projectInteractions"], users, projects
    )
    for matrix in (users.matrix, materials.matrix, projects.matrix):
        assert np.isfinite(matrix.data).all()
    np.testing.assert_array_equal(material_interactions.interactions.toarray(), [[1, 0], [0, 1]])
    np.testing.assert_array_equal(material_interactions.weights.toarray(), [[2.0, 0], [0, 1.0]])
    np.testing.assert_array_equal(project_interactions.interactions.toarray(), [[1, 0], [0, 1]])
    np.testing.assert_array_equal(project_interactions.weights.toarray(), [[1.5, 0], [0, 1.0]])

    invalid = copy.deepcopy(fixture["materialInteractions"])
    invalid[0]["weight"] = float("nan")
    with pytest.raises(FeatureContractError, match="NONFINITE_INTERACTION_WEIGHT"):
        build_material_interaction_matrix(context, invalid, users, materials)
    invalid = copy.deepcopy(fixture["materialInteractions"])
    invalid[0]["itemId"] = "m-unknown"
    with pytest.raises(FeatureContractError, match="INTERACTION_ENTITY_NOT_READY_OR_UNKNOWN"):
        build_material_interaction_matrix(context, invalid, users, materials)
