-- Canonical idempotency key for no-show / incident reports.
ALTER TABLE "no_show_reports"
ADD COLUMN "incident_key" TEXT;

UPDATE "no_show_reports"
SET "incident_key" =
  CASE
    WHEN "target_role" = 'SUPPLIER'
      AND (
        "reason_code" IN (
          'SUPPLIER_UNAVAILABLE',
          'SUPPLIER_MATERIAL_NOT_READY',
          'WRONG_INFORMATION',
          'OTHER'
        )
        OR (
          "reason_code" = 'PICKUP_FAILED'
          AND ("note" IS NULL OR "note" NOT LIKE '%PARTIAL_PICKUP_INCIDENT%')
        )
      )
      THEN "reservation_id"
        || ':_:SUPPLIER:'
        || COALESCE("target_user_id", '_')
        || ':*'
    WHEN "target_role" = 'LEARNER'
      AND "reason_code" = 'DELIVERY_FAILED'
      THEN "reservation_id"
        || ':_:LEARNER:'
        || COALESCE("target_user_id", '_')
        || ':*'
    WHEN "target_role" = 'SYSTEM'
      AND "reason_code" IN ('NO_DRIVER_AVAILABLE', 'NO_RESPONSE_AFTER_PICKUP_WINDOW')
      THEN "reservation_id"
        || ':_:SYSTEM:_:'
        || "reason_code"::text
    WHEN "target_role" = 'DRIVER'
      AND "reason_code" = 'DRIVER_ISSUE'
      THEN "reservation_id"
        || ':_:DRIVER:'
        || COALESCE("target_user_id", '_')
        || ':DRIVER_ISSUE'
    ELSE "reservation_id"
      || ':' || COALESCE("delivery_id", '_')
      || ':' || "target_role"::text
      || ':' || COALESCE("target_user_id", '_')
      || ':' || "reason_code"::text
  END;

-- Keep the oldest row when historical duplicates exist.
DELETE FROM "no_show_reports" AS newer
USING "no_show_reports" AS older
WHERE newer."incident_key" = older."incident_key"
  AND newer."id" <> older."id"
  AND (
    newer."created_at" > older."created_at"
    OR (
      newer."created_at" = older."created_at"
      AND newer."id" > older."id"
    )
  );

ALTER TABLE "no_show_reports"
ALTER COLUMN "incident_key" SET NOT NULL;

CREATE UNIQUE INDEX "no_show_reports_incident_key_key"
ON "no_show_reports"("incident_key");
