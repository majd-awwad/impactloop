-- Extend driver profile enums and columns for internal delivery while keeping invitation signup fields.

ALTER TYPE "DriverProfileStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';
ALTER TYPE "DriverProfileStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

ALTER TABLE "driver_profiles"
ADD COLUMN IF NOT EXISTS "display_name" TEXT,
ADD COLUMN IF NOT EXISTS "availability" "DriverAvailabilityStatus" NOT NULL DEFAULT 'OFFLINE',
ADD COLUMN IF NOT EXISTS "vehicle_type" TEXT NOT NULL DEFAULT 'UNSPECIFIED',
ADD COLUMN IF NOT EXISTS "vehicle_label" TEXT,
ADD COLUMN IF NOT EXISTS "vehicle_plate" TEXT,
ADD COLUMN IF NOT EXISTS "capacity_notes" TEXT;

UPDATE "driver_profiles"
SET
    "display_name" = COALESCE("display_name", "users"."display_name"),
    "vehicle_type" = CASE
        WHEN "vehicle_type" = 'UNSPECIFIED' AND "driver_profiles"."transportation_type" IS NOT NULL
            THEN "driver_profiles"."transportation_type"::TEXT
        ELSE "vehicle_type"
    END
FROM "users"
WHERE "driver_profiles"."user_id" = "users"."id"
  AND "driver_profiles"."display_name" IS NULL;

UPDATE "driver_profiles"
SET "display_name" = 'Driver'
WHERE "display_name" IS NULL;

ALTER TABLE "driver_profiles"
ALTER COLUMN "display_name" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "driver_profiles_status_availability_idx"
ON "driver_profiles"("status", "availability");

-- Backfill driver profiles for DRIVER role users created before profile rows existed.
INSERT INTO "driver_profiles" (
    "id",
    "user_id",
    "display_name",
    "phone",
    "city",
    "area",
    "transportation_type",
    "status",
    "availability",
    "vehicle_type",
    "created_at",
    "updated_at"
)
SELECT
    'drv_' || md5("users"."id"),
    "users"."id",
    "users"."display_name",
    COALESCE("users"."phone", ''),
    'Unknown',
    'Unknown',
    'CAR',
    'ACTIVE',
    'OFFLINE',
    'UNSPECIFIED',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "users"
INNER JOIN "user_roles" ON "user_roles"."user_id" = "users"."id"
WHERE "user_roles"."role" = 'DRIVER'
ON CONFLICT ("user_id") DO NOTHING;
