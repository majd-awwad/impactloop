-- prisma:disable-transaction
-- RP-04.2A: authoritative event origin + fail-closed historical REAL backfill.
-- Deploy only together with the A2 worker that preserves LEGACY_UNCLASSIFIED / DEMO_SEED.
-- Non-transactional so new enum values can be used in the same migration (PostgreSQL).

ALTER TYPE "RecommendationEventSource" ADD VALUE IF NOT EXISTS 'DEMO_SEED';
ALTER TYPE "RecommendationEventSource" ADD VALUE IF NOT EXISTS 'LEGACY_UNCLASSIFIED';

UPDATE "recommendation_generations"
SET "event_source" = 'LEGACY_UNCLASSIFIED'
WHERE "event_source" = 'REAL';

UPDATE "recommendation_requests"
SET "event_source" = 'LEGACY_UNCLASSIFIED'
WHERE "event_source" = 'REAL';

UPDATE "recommendation_candidate_traces"
SET "event_source" = 'LEGACY_UNCLASSIFIED'
WHERE "event_source" = 'REAL';

UPDATE "recommendation_impressions"
SET "event_source" = 'LEGACY_UNCLASSIFIED'
WHERE "event_source" = 'REAL';

UPDATE "recommendation_actions"
SET "event_source" = 'LEGACY_UNCLASSIFIED'
WHERE "event_source" = 'REAL';

ALTER TABLE "recommendation_generations" ALTER COLUMN "event_source" DROP DEFAULT;
ALTER TABLE "recommendation_requests" ALTER COLUMN "event_source" DROP DEFAULT;
ALTER TABLE "recommendation_candidate_traces" ALTER COLUMN "event_source" DROP DEFAULT;
ALTER TABLE "recommendation_impressions" ALTER COLUMN "event_source" DROP DEFAULT;
ALTER TABLE "recommendation_actions" ALTER COLUMN "event_source" DROP DEFAULT;

-- Outbox JSON rewrite is status-agnostic (PENDING/RETRY/PROCESSING/DEAD/PROCESSED) so later replay cannot resurrect ambiguous REAL.
UPDATE "recommendation_event_outbox"
SET "payload" = jsonb_set(
  CASE
    WHEN jsonb_typeof("payload"->'candidateTraces') = 'array' THEN (
      SELECT jsonb_set(
        "payload",
        '{candidateTraces}',
        COALESCE(
          (
            SELECT jsonb_agg(
              CASE
                WHEN (trace->>'eventSource') IS NULL
                  OR (trace->>'eventSource') = 'REAL'
                THEN jsonb_set(trace, '{eventSource}', '"LEGACY_UNCLASSIFIED"'::jsonb)
                ELSE trace
              END
            )
            FROM jsonb_array_elements("payload"->'candidateTraces') AS trace
          ),
          '[]'::jsonb
        )
      )
    )
    ELSE "payload"
  END,
  '{eventSource}',
  CASE
    WHEN ("payload"->>'eventSource') IS NULL
      OR ("payload"->>'eventSource') = 'REAL'
    THEN '"LEGACY_UNCLASSIFIED"'::jsonb
    ELSE to_jsonb("payload"->>'eventSource')
  END
)
WHERE (
    ("payload"->>'eventSource') IS NULL
    OR ("payload"->>'eventSource') = 'REAL'
    OR (
      jsonb_typeof("payload"->'candidateTraces') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements("payload"->'candidateTraces') AS trace
        WHERE (trace->>'eventSource') IS NULL
          OR (trace->>'eventSource') = 'REAL'
      )
    )
  );
