-- LH-20: Question unclear feedback + AI explanation request tracking

DO $$ BEGIN
  CREATE TYPE "ProjectBuildLearningFeedbackType" AS ENUM ('UNCLEAR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "project_build_learning_question_assignments"
ADD COLUMN IF NOT EXISTS "ai_explanation_requested_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "project_build_learning_question_feedback" (
  "id" TEXT NOT NULL,
  "assignment_id" TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "type" "ProjectBuildLearningFeedbackType" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "cleared_at" TIMESTAMP(3),
  CONSTRAINT "project_build_learning_question_feedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_build_learning_question_feedback_assignment_id_type_key"
ON "project_build_learning_question_feedback"("assignment_id", "type");

CREATE INDEX IF NOT EXISTS "project_build_learning_question_feedback_assignment_id_idx"
ON "project_build_learning_question_feedback"("assignment_id");

CREATE INDEX IF NOT EXISTS "project_build_learning_question_feedback_learner_id_idx"
ON "project_build_learning_question_feedback"("learner_id");

CREATE INDEX IF NOT EXISTS "project_build_learning_question_feedback_type_cleared_at_idx"
ON "project_build_learning_question_feedback"("type", "cleared_at");

CREATE INDEX IF NOT EXISTS "project_build_learning_question_assignments_question_id_idx"
ON "project_build_learning_question_assignments"("question_id");

DO $$ BEGIN
  ALTER TABLE "project_build_learning_question_feedback"
  ADD CONSTRAINT "project_build_learning_question_feedback_assignment_id_fkey"
  FOREIGN KEY ("assignment_id") REFERENCES "project_build_learning_question_assignments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "project_build_learning_question_feedback"
  ADD CONSTRAINT "project_build_learning_question_feedback_learner_id_fkey"
  FOREIGN KEY ("learner_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
