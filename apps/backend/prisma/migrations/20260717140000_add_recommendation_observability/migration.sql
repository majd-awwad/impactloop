-- Recommendation observability is additive and intentionally contains no
-- destructive changes. Candidate entity IDs remain application validated
-- because material/project polymorphism cannot be enforced by Prisma FKs.

CREATE TYPE "RecommendationEntityType" AS ENUM ('MATERIAL', 'PROJECT');
CREATE TYPE "RecommendationCacheState" AS ENUM ('MISS', 'HIT', 'SINGLE_FLIGHT', 'UNCACHED');
CREATE TYPE "RecommendationActionType" AS ENUM (
  'MATERIAL_VIEW',
  'MATERIAL_LIKE',
  'RESERVATION_SUBMITTED',
  'PROJECT_LIKE',
  'PROJECT_SAVE',
  'PROJECT_FOLLOW',
  'PROJECT_BUILD_STARTED',
  'PROJECT_BUILD_PROGRESSED'
);
CREATE TYPE "RecommendationAttributionType" AS ENUM ('DIRECT', 'ASSISTED');
CREATE TYPE "RecommendationEventSource" AS ENUM ('REAL', 'SYNTHETIC', 'TEST', 'LOAD_TEST');
CREATE TYPE "RecommendationEligibilityResult" AS ENUM ('ELIGIBLE', 'EXCLUDED');

CREATE TABLE "recommendation_generations" (
  "id" TEXT NOT NULL,
  "generation_key" TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "algorithm_name" TEXT NOT NULL,
  "algorithm_version" TEXT NOT NULL,
  "policy_version" TEXT NOT NULL,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cache_state" "RecommendationCacheState" NOT NULL,
  "candidate_count" INTEGER NOT NULL,
  "shown_item_count" INTEGER NOT NULL,
  "generation_duration_ms" INTEGER NOT NULL,
  "event_source" "RecommendationEventSource" NOT NULL DEFAULT 'REAL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recommendation_generations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recommendation_requests" (
  "id" TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "generation_id" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "algorithm_name" TEXT NOT NULL,
  "algorithm_version" TEXT NOT NULL,
  "policy_version" TEXT NOT NULL,
  "cache_state" "RecommendationCacheState" NOT NULL,
  "correlation_id" TEXT,
  "candidate_count" INTEGER NOT NULL,
  "shown_item_count" INTEGER NOT NULL,
  "generation_duration_ms" INTEGER NOT NULL,
  "event_source" "RecommendationEventSource" NOT NULL DEFAULT 'REAL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recommendation_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recommendation_candidate_traces" (
  "id" TEXT NOT NULL,
  "generation_id" TEXT NOT NULL,
  "entity_type" "RecommendationEntityType" NOT NULL,
  "entity_id" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "section_key" TEXT,
  "candidate_source" TEXT NOT NULL,
  "eligibility_result" "RecommendationEligibilityResult" NOT NULL,
  "rank_before_selection" INTEGER,
  "final_score" DOUBLE PRECISION,
  "score_components" JSONB,
  "exclusion_reason" TEXT,
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "event_source" "RecommendationEventSource" NOT NULL DEFAULT 'REAL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recommendation_candidate_traces_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recommendation_impressions" (
  "id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "entity_type" "RecommendationEntityType" NOT NULL,
  "entity_id" TEXT NOT NULL,
  "surface" TEXT NOT NULL,
  "section_key" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "reason_code" TEXT NOT NULL,
  "algorithm_name" TEXT NOT NULL,
  "algorithm_version" TEXT NOT NULL,
  "shown_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "event_source" "RecommendationEventSource" NOT NULL DEFAULT 'REAL',
  CONSTRAINT "recommendation_impressions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recommendation_actions" (
  "id" TEXT NOT NULL,
  "impression_id" TEXT NOT NULL,
  "learner_id" TEXT NOT NULL,
  "entity_type" "RecommendationEntityType" NOT NULL,
  "entity_id" TEXT NOT NULL,
  "action_type" "RecommendationActionType" NOT NULL,
  "attribution_type" "RecommendationAttributionType" NOT NULL,
  "action_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source_operation_id" TEXT,
  "event_source" "RecommendationEventSource" NOT NULL DEFAULT 'REAL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recommendation_actions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recommendation_generations_generation_key_key"
  ON "recommendation_generations"("generation_key");
CREATE INDEX "recommendation_generations_learner_id_generated_at_idx"
  ON "recommendation_generations"("learner_id", "generated_at" DESC);
CREATE INDEX "recommendation_generations_surface_generated_at_idx"
  ON "recommendation_generations"("surface", "generated_at" DESC);
CREATE INDEX "recommendation_generations_algorithm_name_algorithm_version_idx"
  ON "recommendation_generations"("algorithm_name", "algorithm_version");
CREATE INDEX "recommendation_requests_learner_id_created_at_idx"
  ON "recommendation_requests"("learner_id", "created_at" DESC);
CREATE INDEX "recommendation_requests_surface_created_at_idx"
  ON "recommendation_requests"("surface", "created_at" DESC);
CREATE INDEX "recommendation_requests_generation_id_idx"
  ON "recommendation_requests"("generation_id");
CREATE INDEX "recommendation_candidate_traces_generation_id_section_key_idx"
  ON "recommendation_candidate_traces"("generation_id", "section_key");
CREATE INDEX "recommendation_candidate_traces_entity_type_entity_id_created_at_idx"
  ON "recommendation_candidate_traces"("entity_type", "entity_id", "created_at" DESC);
CREATE UNIQUE INDEX "recommendation_impressions_request_item_position_key"
  ON "recommendation_impressions"("request_id", "entity_type", "entity_id", "section_key", "position");
CREATE INDEX "recommendation_impressions_learner_id_surface_shown_at_idx"
  ON "recommendation_impressions"("learner_id", "surface", "shown_at" DESC);
CREATE INDEX "recommendation_impressions_learner_entity_surface_shown_at_idx"
  ON "recommendation_impressions"("learner_id", "entity_type", "entity_id", "surface", "shown_at" DESC);
CREATE INDEX "recommendation_impressions_request_id_idx"
  ON "recommendation_impressions"("request_id");
CREATE INDEX "recommendation_actions_impression_id_idx"
  ON "recommendation_actions"("impression_id");
CREATE INDEX "recommendation_actions_learner_id_action_at_idx"
  ON "recommendation_actions"("learner_id", "action_at" DESC);
CREATE INDEX "recommendation_actions_entity_type_entity_id_action_type_action_at_idx"
  ON "recommendation_actions"("entity_type", "entity_id", "action_type", "action_at" DESC);
CREATE INDEX "recommendation_actions_source_operation_id_idx"
  ON "recommendation_actions"("source_operation_id");

ALTER TABLE "recommendation_generations"
  ADD CONSTRAINT "recommendation_generations_learner_id_fkey"
  FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendation_requests"
  ADD CONSTRAINT "recommendation_requests_learner_id_fkey"
  FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "recommendation_requests_generation_id_fkey"
  FOREIGN KEY ("generation_id") REFERENCES "recommendation_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendation_candidate_traces"
  ADD CONSTRAINT "recommendation_candidate_traces_generation_id_fkey"
  FOREIGN KEY ("generation_id") REFERENCES "recommendation_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendation_impressions"
  ADD CONSTRAINT "recommendation_impressions_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "recommendation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "recommendation_impressions_learner_id_fkey"
  FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendation_actions"
  ADD CONSTRAINT "recommendation_actions_impression_id_fkey"
  FOREIGN KEY ("impression_id") REFERENCES "recommendation_impressions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "recommendation_actions_learner_id_fkey"
  FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
