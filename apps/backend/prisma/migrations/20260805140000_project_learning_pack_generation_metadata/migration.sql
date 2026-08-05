-- LH-15: Learning Pack generation metadata

ALTER TABLE "project_learning_packs"
ADD COLUMN IF NOT EXISTS "provider_name" TEXT,
ADD COLUMN IF NOT EXISTS "model_name" TEXT,
ADD COLUMN IF NOT EXISTS "generator_schema_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "prompt_version" TEXT,
ADD COLUMN IF NOT EXISTS "generation_started_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "generation_completed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "generation_attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "last_generation_error_code" TEXT;
