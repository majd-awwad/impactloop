-- Align long PostgreSQL index/constraint names with Prisma's truncated identifiers.
-- Each rename is conditional so this is safe on databases that already applied
-- the earlier drift migration or already have the final names.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'learner_material_requests_normalized_requested_item_name_lea_id'
  ) THEN
    ALTER INDEX "learner_material_requests_normalized_requested_item_name_lea_id"
      RENAME TO "learner_material_requests_normalized_requested_item_name_le_idx";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_project_admin_ai_reviews_generated_by_admin_user_id_fk'
  ) THEN
    ALTER TABLE "learning_project_admin_ai_reviews"
      RENAME CONSTRAINT "learning_project_admin_ai_reviews_generated_by_admin_user_id_fk"
      TO "learning_project_admin_ai_reviews_generated_by_admin_user__fkey";
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_project_admin_ai_reviews_generated_by_admin_user_id_fkey'
      AND conname <> 'learning_project_admin_ai_reviews_generated_by_admin_user__fkey'
  ) THEN
    ALTER TABLE "learning_project_admin_ai_reviews"
      RENAME CONSTRAINT "learning_project_admin_ai_reviews_generated_by_admin_user_id_fkey"
      TO "learning_project_admin_ai_reviews_generated_by_admin_user__fkey";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_build_learning_answer_attempts_assignment_id_attempt_number_key'
  ) THEN
    ALTER INDEX "project_build_learning_answer_attempts_assignment_id_attempt_number_key"
      RENAME TO "project_build_learning_answer_attempts_assignment_id_attemp_key";
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_build_learning_answer_attempts_assignment_id_attempt_nu'
  ) THEN
    ALTER INDEX "project_build_learning_answer_attempts_assignment_id_attempt_nu"
      RENAME TO "project_build_learning_answer_attempts_assignment_id_attemp_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_build_learning_answer_attempts_assignment_id_submitted_at_idx'
  ) THEN
    ALTER INDEX "project_build_learning_answer_attempts_assignment_id_submitted_at_idx"
      RENAME TO "project_build_learning_answer_attempts_assignment_id_submit_idx";
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_build_learning_answer_attempts_assignment_id_submitted_'
  ) THEN
    ALTER INDEX "project_build_learning_answer_attempts_assignment_id_submitted_"
      RENAME TO "project_build_learning_answer_attempts_assignment_id_submit_idx";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_build_learning_question_assignments_session_id_question_id_key'
  ) THEN
    ALTER INDEX "project_build_learning_question_assignments_session_id_question_id_key"
      RENAME TO "project_build_learning_question_assignments_session_id_ques_key";
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_build_learning_question_assignments_session_id_question'
  ) THEN
    ALTER INDEX "project_build_learning_question_assignments_session_id_question"
      RENAME TO "project_build_learning_question_assignments_session_id_ques_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_build_learning_question_assignments_session_id_stage_order_scope_key_display_order_key'
  ) THEN
    ALTER INDEX "project_build_learning_question_assignments_session_id_stage_order_scope_key_display_order_key"
      RENAME TO "project_build_learning_question_assignments_session_id_stag_key";
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_build_learning_question_assignments_session_id_stage_or'
  ) THEN
    ALTER INDEX "project_build_learning_question_assignments_session_id_stage_or"
      RENAME TO "project_build_learning_question_assignments_session_id_stag_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_build_learning_question_assignments_session_id_status_idx'
  ) THEN
    ALTER INDEX "project_build_learning_question_assignments_session_id_status_idx"
      RENAME TO "project_build_learning_question_assignments_session_id_stat_idx";
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_build_learning_question_assignments_session_id_status_i'
  ) THEN
    ALTER INDEX "project_build_learning_question_assignments_session_id_status_i"
      RENAME TO "project_build_learning_question_assignments_session_id_stat_idx";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_learning_questions_pack_id_stage_order_scope_key_pack_display_order_key'
  ) THEN
    ALTER INDEX "project_learning_questions_pack_id_stage_order_scope_key_pack_display_order_key"
      RENAME TO "project_learning_questions_pack_id_stage_order_scope_key_pa_key";
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'project_learning_questions_pack_id_stage_order_scope_key_pack_d'
  ) THEN
    ALTER INDEX "project_learning_questions_pack_id_stage_order_scope_key_pack_d"
      RENAME TO "project_learning_questions_pack_id_stage_order_scope_key_pa_key";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'recommendation_actions_entity_type_entity_id_action_type_action_at_idx'
  ) THEN
    ALTER INDEX "recommendation_actions_entity_type_entity_id_action_type_action_at_idx"
      RENAME TO "recommendation_actions_entity_type_entity_id_action_type_ac_idx";
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'recommendation_actions_entity_type_entity_id_action_type_action'
  ) THEN
    ALTER INDEX "recommendation_actions_entity_type_entity_id_action_type_action"
      RENAME TO "recommendation_actions_entity_type_entity_id_action_type_ac_idx";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'recommendation_candidate_traces_entity_type_entity_id_created_at_idx'
  ) THEN
    ALTER INDEX "recommendation_candidate_traces_entity_type_entity_id_created_at_idx"
      RENAME TO "recommendation_candidate_traces_entity_type_entity_id_creat_idx";
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'recommendation_candidate_traces_entity_type_entity_id_created_a'
  ) THEN
    ALTER INDEX "recommendation_candidate_traces_entity_type_entity_id_created_a"
      RENAME TO "recommendation_candidate_traces_entity_type_entity_id_creat_idx";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'recommendation_impressions_learner_entity_surface_shown_at_idx'
  ) THEN
    ALTER INDEX "recommendation_impressions_learner_entity_surface_shown_at_idx"
      RENAME TO "recommendation_impressions_learner_id_entity_type_entity_id_idx";
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'recommendation_impressions_request_item_position_key'
  ) THEN
    ALTER INDEX "recommendation_impressions_request_item_position_key"
      RENAME TO "recommendation_impressions_request_id_entity_type_entity_id_key";
  END IF;
END $$;
