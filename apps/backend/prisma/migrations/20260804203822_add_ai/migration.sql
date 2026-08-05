-- PAY-01B: make identifier renames safe on fresh databases.
-- Root cause: this migration was generated against a DB that already had
-- truncated/project-learning identifiers. On an empty database several
-- source indexes/constraints do not exist yet (project-learning objects are
-- created later in 20260805120000_project_learning_foundation), and some
-- recommendation/FK source names never matched the earlier CREATE statements.
--
-- Behavior:
--   * Rename when the source exists and the destination does not.
--   * No-op when the source is missing (fresh chain) or the destination
--     already exists (partially applied developer DBs).
-- Intended final project-learning index definitions remain owned by
-- 20260805120000_project_learning_foundation.

CREATE OR REPLACE FUNCTION "_pay01b_safe_rename_constraint"(
  p_table regclass,
  p_from text,
  p_to text
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF to_regclass(p_table::text) IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = p_table
      AND conname = p_to
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = p_table
      AND conname = p_from
  ) THEN
    EXECUTE format(
      'ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
      p_table,
      p_from,
      p_to
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION "_pay01b_safe_rename_index"(
  p_from text,
  p_to text
) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF to_regclass(format('%I', p_to)) IS NOT NULL THEN
    RETURN;
  END IF;

  IF to_regclass(format('%I', p_from)) IS NOT NULL THEN
    EXECUTE format('ALTER INDEX %I RENAME TO %I', p_from, p_to);
  END IF;
END;
$$;

SELECT _pay01b_safe_rename_constraint(
  'learning_project_admin_ai_reviews'::regclass,
  'learning_project_admin_ai_reviews_generated_by_admin_user_id_fk',
  'learning_project_admin_ai_reviews_generated_by_admin_user__fkey'
);

-- Also accept the historically created "_fkey" source name if present.
SELECT _pay01b_safe_rename_constraint(
  'learning_project_admin_ai_reviews'::regclass,
  'learning_project_admin_ai_reviews_generated_by_admin_user_id_fkey',
  'learning_project_admin_ai_reviews_generated_by_admin_user__fkey'
);

SELECT _pay01b_safe_rename_index(
  'learner_material_requests_normalized_requested_item_name_lea_id',
  'learner_material_requests_normalized_requested_item_name_le_idx'
);

SELECT _pay01b_safe_rename_index(
  'learner_material_requests_normalized_requested_item_name_lea_idx',
  'learner_material_requests_normalized_requested_item_name_le_idx'
);

SELECT _pay01b_safe_rename_index(
  'project_build_learning_answer_attempts_assignment_id_attempt_nu',
  'project_build_learning_answer_attempts_assignment_id_attemp_key'
);

SELECT _pay01b_safe_rename_index(
  'project_build_learning_answer_attempts_assignment_id_submitted_',
  'project_build_learning_answer_attempts_assignment_id_submit_idx'
);

SELECT _pay01b_safe_rename_index(
  'project_build_learning_question_assignments_session_id_question',
  'project_build_learning_question_assignments_session_id_ques_key'
);

SELECT _pay01b_safe_rename_index(
  'project_build_learning_question_assignments_session_id_stage_or',
  'project_build_learning_question_assignments_session_id_stag_key'
);

SELECT _pay01b_safe_rename_index(
  'project_build_learning_question_assignments_session_id_status_i',
  'project_build_learning_question_assignments_session_id_stat_idx'
);

SELECT _pay01b_safe_rename_index(
  'project_learning_questions_pack_id_stage_order_scope_key_pack_d',
  'project_learning_questions_pack_id_stage_order_scope_key_pa_key'
);

SELECT _pay01b_safe_rename_index(
  'recommendation_actions_entity_type_entity_id_action_type_action',
  'recommendation_actions_entity_type_entity_id_action_type_ac_idx'
);

SELECT _pay01b_safe_rename_index(
  'recommendation_actions_entity_type_entity_id_action_type_action_at_idx',
  'recommendation_actions_entity_type_entity_id_action_type_ac_idx'
);

SELECT _pay01b_safe_rename_index(
  'recommendation_candidate_traces_entity_type_entity_id_created_a',
  'recommendation_candidate_traces_entity_type_entity_id_creat_idx'
);

SELECT _pay01b_safe_rename_index(
  'recommendation_candidate_traces_entity_type_entity_id_created_at_idx',
  'recommendation_candidate_traces_entity_type_entity_id_creat_idx'
);

SELECT _pay01b_safe_rename_index(
  'recommendation_impressions_learner_entity_surface_shown_at_idx',
  'recommendation_impressions_learner_id_entity_type_entity_id_idx'
);

SELECT _pay01b_safe_rename_index(
  'recommendation_impressions_request_item_position_key',
  'recommendation_impressions_request_id_entity_type_entity_id_key'
);

DROP FUNCTION "_pay01b_safe_rename_constraint"(regclass, text, text);
DROP FUNCTION "_pay01b_safe_rename_index"(text, text);
