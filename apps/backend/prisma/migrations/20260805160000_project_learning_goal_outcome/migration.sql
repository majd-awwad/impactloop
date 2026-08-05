-- LH-18: Personal learning goal outcome on build learning sessions

DO $$ BEGIN
  CREATE TYPE "ProjectBuildLearningGoalOutcome" AS ENUM (
    'ACHIEVED',
    'PARTIALLY_ACHIEVED',
    'NOT_YET_ACHIEVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "project_build_learning_sessions"
ADD COLUMN IF NOT EXISTS "goal_outcome" "ProjectBuildLearningGoalOutcome";
