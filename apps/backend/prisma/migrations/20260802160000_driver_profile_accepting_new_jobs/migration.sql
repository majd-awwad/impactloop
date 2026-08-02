-- Separate the driver's preference for future work from their effective
-- operational availability. Existing AVAILABLE and ON_DELIVERY profiles
-- already received and could accept new work, so preserve that behavior.
ALTER TABLE "driver_profiles"
ADD COLUMN "accepting_new_jobs" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "driver_profiles"
SET "accepting_new_jobs" = TRUE
WHERE "availability" IN ('AVAILABLE', 'ON_DELIVERY');

UPDATE "driver_profiles"
SET "accepting_new_jobs" = FALSE
WHERE "availability" = 'OFFLINE';

-- Reconcile effective availability with active assignment ownership.
UPDATE "driver_profiles" AS profile
SET "availability" = CASE
  WHEN EXISTS (
    SELECT 1
    FROM "deliveries" AS delivery
    WHERE delivery."assigned_driver_profile_id" = profile."id"
      AND delivery."status" IN (
        'DRIVER_ASSIGNED',
        'ARRIVED_PICKUP',
        'PICKED_UP',
        'ON_THE_WAY',
        'ARRIVED_DROPOFF'
      )
  ) THEN 'ON_DELIVERY'::"DriverAvailabilityStatus"
  WHEN profile."accepting_new_jobs" = TRUE
    THEN 'AVAILABLE'::"DriverAvailabilityStatus"
  ELSE 'OFFLINE'::"DriverAvailabilityStatus"
END;

CREATE INDEX "driver_profiles_status_accepting_new_jobs_idx"
ON "driver_profiles"("status", "accepting_new_jobs");
