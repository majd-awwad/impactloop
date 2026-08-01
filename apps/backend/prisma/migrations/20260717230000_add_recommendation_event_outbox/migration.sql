-- Durable recommendation delivery is additive. The existing recommendation
-- domain migration is intentionally not modified.

CREATE TYPE "RecommendationOutboxEventKind" AS ENUM (
  'RECOMMENDATION_GENERATION',
  'RECOMMENDATION_EXPOSURE'
);

CREATE TYPE "RecommendationOutboxStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'RETRY',
  'PROCESSED',
  'DEAD'
);

CREATE TABLE "recommendation_event_outbox" (
  "id" TEXT NOT NULL,
  "event_kind" "RecommendationOutboxEventKind" NOT NULL,
  "schema_version" TEXT NOT NULL,
  "deduplication_key" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "RecommendationOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "lock_token" TEXT,
  "processed_at" TIMESTAMP(3),
  "last_error_code" TEXT,
  "last_error_summary" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recommendation_event_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "recommendation_event_outbox_deduplication_key_key"
  ON "recommendation_event_outbox"("deduplication_key");
CREATE INDEX "recommendation_event_outbox_status_available_at_created_at_idx"
  ON "recommendation_event_outbox"("status", "available_at", "created_at");
CREATE INDEX "recommendation_event_outbox_locked_at_idx"
  ON "recommendation_event_outbox"("locked_at");
CREATE INDEX "recommendation_event_outbox_processed_at_idx"
  ON "recommendation_event_outbox"("processed_at");
CREATE INDEX "recommendation_event_outbox_created_at_idx"
  ON "recommendation_event_outbox"("created_at");
