-- LH-14: AI Learning System Foundation

CREATE TYPE "ProjectLearningPackStatus" AS ENUM ('GENERATING', 'READY', 'FAILED', 'STALE');
CREATE TYPE "ProjectLearningQuestionStage" AS ENUM ('START', 'STEP', 'FINAL');
CREATE TYPE "ProjectLearningQuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'BEST_ACTION');
CREATE TYPE "ProjectLearningAssignmentStatus" AS ENUM ('NOT_ATTEMPTED', 'ANSWERED', 'SKIPPED');

CREATE TABLE "project_learning_packs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "content_hash" TEXT NOT NULL,
    "hash_algorithm" TEXT NOT NULL DEFAULT 'SHA-256',
    "hash_schema_version" INTEGER NOT NULL DEFAULT 1,
    "status" "ProjectLearningPackStatus" NOT NULL DEFAULT 'GENERATING',
    "generated_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "stale_at" TIMESTAMP(3),
    "stale_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_learning_packs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_learning_questions" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "stage" "ProjectLearningQuestionStage" NOT NULL,
    "project_step_id" TEXT,
    "question_type" "ProjectLearningQuestionType" NOT NULL,
    "concept_key" TEXT NOT NULL,
    "prompt_en" TEXT NOT NULL,
    "prompt_ar" TEXT NOT NULL,
    "explanation_en" TEXT NOT NULL,
    "explanation_ar" TEXT NOT NULL,
    "hint_en" TEXT NOT NULL,
    "hint_ar" TEXT NOT NULL,
    "relative_difficulty" INTEGER NOT NULL DEFAULT 2,
    "correct_option_key" TEXT NOT NULL,
    "order_scope_key" TEXT NOT NULL,
    "pack_display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_learning_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_learning_question_options" (
    "id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "option_key" TEXT NOT NULL,
    "text_en" TEXT NOT NULL,
    "text_ar" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_learning_question_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_build_learning_sessions" (
    "id" TEXT NOT NULL,
    "build_id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "learning_goal" TEXT,
    "confidence_before" INTEGER,
    "confidence_after" INTEGER,
    "final_reflection" TEXT,
    "learning_summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_build_learning_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_build_learning_question_assignments" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "stage" "ProjectLearningQuestionStage" NOT NULL,
    "project_step_id" TEXT,
    "order_scope_key" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL,
    "status" "ProjectLearningAssignmentStatus" NOT NULL DEFAULT 'NOT_ATTEMPTED',
    "hint_viewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_build_learning_question_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_build_learning_answer_attempts" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "selected_option_key" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_build_learning_answer_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_learning_packs_project_id_content_hash_key"
ON "project_learning_packs"("project_id", "content_hash");

CREATE UNIQUE INDEX "project_learning_packs_project_id_version_number_key"
ON "project_learning_packs"("project_id", "version_number");

CREATE INDEX "project_learning_packs_project_id_idx"
ON "project_learning_packs"("project_id");

CREATE INDEX "project_learning_packs_project_id_status_idx"
ON "project_learning_packs"("project_id", "status");

CREATE INDEX "project_learning_packs_status_idx"
ON "project_learning_packs"("status");

CREATE UNIQUE INDEX "project_learning_questions_pack_id_stage_order_scope_key_pack_display_order_key"
ON "project_learning_questions"("pack_id", "stage", "order_scope_key", "pack_display_order");

CREATE INDEX "project_learning_questions_pack_id_idx"
ON "project_learning_questions"("pack_id");

CREATE INDEX "project_learning_questions_pack_id_stage_idx"
ON "project_learning_questions"("pack_id", "stage");

CREATE INDEX "project_learning_questions_project_step_id_idx"
ON "project_learning_questions"("project_step_id");

CREATE UNIQUE INDEX "project_learning_question_options_question_id_option_key_key"
ON "project_learning_question_options"("question_id", "option_key");

CREATE INDEX "project_learning_question_options_question_id_idx"
ON "project_learning_question_options"("question_id");

CREATE UNIQUE INDEX "project_build_learning_sessions_build_id_key"
ON "project_build_learning_sessions"("build_id");

CREATE INDEX "project_build_learning_sessions_pack_id_idx"
ON "project_build_learning_sessions"("pack_id");

CREATE UNIQUE INDEX "project_build_learning_question_assignments_session_id_question_id_key"
ON "project_build_learning_question_assignments"("session_id", "question_id");

CREATE UNIQUE INDEX "project_build_learning_question_assignments_session_id_stage_order_scope_key_display_order_key"
ON "project_build_learning_question_assignments"("session_id", "stage", "order_scope_key", "display_order");

CREATE INDEX "project_build_learning_question_assignments_session_id_idx"
ON "project_build_learning_question_assignments"("session_id");

CREATE INDEX "project_build_learning_question_assignments_session_id_status_idx"
ON "project_build_learning_question_assignments"("session_id", "status");

CREATE UNIQUE INDEX "project_build_learning_answer_attempts_assignment_id_attempt_number_key"
ON "project_build_learning_answer_attempts"("assignment_id", "attempt_number");

CREATE INDEX "project_build_learning_answer_attempts_assignment_id_idx"
ON "project_build_learning_answer_attempts"("assignment_id");

CREATE INDEX "project_build_learning_answer_attempts_assignment_id_submitted_at_idx"
ON "project_build_learning_answer_attempts"("assignment_id", "submitted_at");

ALTER TABLE "project_learning_packs"
ADD CONSTRAINT "project_learning_packs_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_learning_questions"
ADD CONSTRAINT "project_learning_questions_pack_id_fkey"
FOREIGN KEY ("pack_id") REFERENCES "project_learning_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_learning_questions"
ADD CONSTRAINT "project_learning_questions_project_step_id_fkey"
FOREIGN KEY ("project_step_id") REFERENCES "project_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_learning_question_options"
ADD CONSTRAINT "project_learning_question_options_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "project_learning_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_build_learning_sessions"
ADD CONSTRAINT "project_build_learning_sessions_build_id_fkey"
FOREIGN KEY ("build_id") REFERENCES "project_builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_build_learning_sessions"
ADD CONSTRAINT "project_build_learning_sessions_pack_id_fkey"
FOREIGN KEY ("pack_id") REFERENCES "project_learning_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_build_learning_question_assignments"
ADD CONSTRAINT "project_build_learning_question_assignments_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "project_build_learning_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_build_learning_question_assignments"
ADD CONSTRAINT "project_build_learning_question_assignments_question_id_fkey"
FOREIGN KEY ("question_id") REFERENCES "project_learning_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_build_learning_answer_attempts"
ADD CONSTRAINT "project_build_learning_answer_attempts_assignment_id_fkey"
FOREIGN KEY ("assignment_id") REFERENCES "project_build_learning_question_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_learning_questions"
ADD CONSTRAINT "project_learning_questions_step_scope_check"
CHECK (
  ("stage" = 'STEP' AND "project_step_id" IS NOT NULL) OR
  ("stage" IN ('START', 'FINAL') AND "project_step_id" IS NULL)
);

ALTER TABLE "project_learning_questions"
ADD CONSTRAINT "project_learning_questions_relative_difficulty_check"
CHECK ("relative_difficulty" BETWEEN 1 AND 5);

ALTER TABLE "project_build_learning_question_assignments"
ADD CONSTRAINT "project_build_learning_question_assignments_step_scope_check"
CHECK (
  ("stage" = 'STEP' AND "project_step_id" IS NOT NULL) OR
  ("stage" IN ('START', 'FINAL') AND "project_step_id" IS NULL)
);

ALTER TABLE "project_build_learning_sessions"
ADD CONSTRAINT "project_build_learning_sessions_confidence_before_check"
CHECK ("confidence_before" IS NULL OR ("confidence_before" BETWEEN 1 AND 5));

ALTER TABLE "project_build_learning_sessions"
ADD CONSTRAINT "project_build_learning_sessions_confidence_after_check"
CHECK ("confidence_after" IS NULL OR ("confidence_after" BETWEEN 1 AND 5));
