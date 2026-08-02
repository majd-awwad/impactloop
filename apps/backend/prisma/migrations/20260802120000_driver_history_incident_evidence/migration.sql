-- Refuse to collapse ambiguous legacy incidents into one occurrence. This is
-- intentionally a deterministic migration blocker: product review is required
-- before deleting or merging audit evidence.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "no_show_reports"
    GROUP BY
      "reservation_id",
      COALESCE("delivery_id", ''),
      COALESCE("target_user_id", ''),
      "reason_code"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'DR02_DUPLICATE_NO_SHOW_REPORT_OCCURRENCES';
  END IF;
END $$;

-- Preserve the exact grouped-pickup manifest after reservations are detached or regrouped.
CREATE TABLE "delivery_pickup_items" (
  "id" TEXT NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "reservation_id" TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "material_title" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "condition" TEXT,
  "was_picked" BOOLEAN NOT NULL,
  "unpicked_reason" TEXT,
  "driver_note" TEXT,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_pickup_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "delivery_pickup_items_delivery_id_fkey"
    FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "delivery_pickup_items_delivery_id_reservation_id_key"
  ON "delivery_pickup_items"("delivery_id", "reservation_id");
CREATE INDEX "delivery_pickup_items_delivery_id_was_picked_idx"
  ON "delivery_pickup_items"("delivery_id", "was_picked");

ALTER TABLE "no_show_reports"
  ADD COLUMN "reporter_reason_detail" TEXT,
  ADD COLUMN "reporter_note" TEXT,
  ADD COLUMN "recovery_action" TEXT,
  ADD COLUMN "recovery_action_at" TIMESTAMP(3),
  ADD COLUMN "recovery_delivery_id" TEXT,
  ADD COLUMN "recovery_delivery_group_id" TEXT,
  ADD COLUMN "recovery_completed_at" TIMESTAMP(3),
  ADD COLUMN "hold_released_at" TIMESTAMP(3);

CREATE INDEX "no_show_reports_reporter_user_id_created_at_id_idx"
  ON "no_show_reports"("reporter_user_id", "created_at" DESC, "id" DESC);

-- A reservation can have distinct operational incidents on replacement
-- deliveries. Keep retries idempotent without suppressing later occurrences.
DROP INDEX "no_show_reports_reservation_id_target_user_id_key";
CREATE UNIQUE INDEX "no_show_reports_operational_occurrence_key"
  ON "no_show_reports"(
    "reservation_id",
    COALESCE("delivery_id", ''),
    COALESCE("target_user_id", ''),
    "reason_code"
  );

CREATE INDEX "delivery_assignments_driver_profile_id_accepted_at_id_idx"
  ON "delivery_assignments"("driver_profile_id", "accepted_at" DESC, "id" DESC);

CREATE INDEX "deliveries_updated_at_id_idx"
  ON "deliveries"("updated_at" DESC, "id" DESC);
