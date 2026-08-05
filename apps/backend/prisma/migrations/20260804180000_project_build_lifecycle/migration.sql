-- Add PAUSED to ProjectBuildStatus
ALTER TYPE "ProjectBuildStatus" ADD VALUE IF NOT EXISTS 'PAUSED' BEFORE 'COMPLETED';

-- Lifecycle columns and multi-attempt support
ALTER TABLE "project_builds" ADD COLUMN IF NOT EXISTS "attempt_number" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "project_builds" ADD COLUMN IF NOT EXISTS "paused_at" TIMESTAMP(3);
ALTER TABLE "project_builds" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

UPDATE "project_builds"
SET "archived_at" = COALESCE("archived_at", "updated_at")
WHERE "status" = 'ARCHIVED' AND "archived_at" IS NULL;

DROP INDEX IF EXISTS "project_builds_project_id_learner_id_key";

CREATE UNIQUE INDEX IF NOT EXISTS "project_builds_project_id_learner_id_attempt_number_key"
ON "project_builds"("project_id", "learner_id", "attempt_number");

CREATE UNIQUE INDEX IF NOT EXISTS "project_builds_one_active_per_learner_project_idx"
ON "project_builds"("project_id", "learner_id")
WHERE "status" IN ('IN_PROGRESS', 'PAUSED');

CREATE INDEX IF NOT EXISTS "project_builds_learner_id_status_updated_at_idx"
ON "project_builds"("learner_id", "status", "updated_at" DESC);

CREATE INDEX IF NOT EXISTS "project_builds_learner_id_status_completed_at_idx"
ON "project_builds"("learner_id", "status", "completed_at" DESC);

CREATE INDEX IF NOT EXISTS "project_builds_learner_id_status_archived_at_idx"
ON "project_builds"("learner_id", "status", "archived_at" DESC);

CREATE TABLE IF NOT EXISTS "project_build_completion_stories" (
    "id" TEXT NOT NULL,
    "build_id" TEXT NOT NULL,
    "reflection" TEXT,
    "caption" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_build_completion_stories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_build_completion_photos" (
    "id" TEXT NOT NULL,
    "story_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "caption" VARCHAR(120),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_build_completion_photos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "project_build_completion_snapshots" (
    "id" TEXT NOT NULL,
    "build_id" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_build_completion_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_build_completion_stories_build_id_key"
ON "project_build_completion_stories"("build_id");

CREATE INDEX IF NOT EXISTS "project_build_completion_photos_story_id_sort_order_idx"
ON "project_build_completion_photos"("story_id", "sort_order");

CREATE UNIQUE INDEX IF NOT EXISTS "project_build_completion_snapshots_build_id_key"
ON "project_build_completion_snapshots"("build_id");

ALTER TABLE "project_build_completion_stories"
ADD CONSTRAINT "project_build_completion_stories_build_id_fkey"
FOREIGN KEY ("build_id") REFERENCES "project_builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_build_completion_photos"
ADD CONSTRAINT "project_build_completion_photos_story_id_fkey"
FOREIGN KEY ("story_id") REFERENCES "project_build_completion_stories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_build_completion_snapshots"
ADD CONSTRAINT "project_build_completion_snapshots_build_id_fkey"
FOREIGN KEY ("build_id") REFERENCES "project_builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
