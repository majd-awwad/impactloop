-- Remove legacy reservation columns superseded by fulfillment_method + deliveries domain.

ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_dropoff_location_id_fkey";

ALTER TABLE "reservations" DROP COLUMN IF EXISTS "pickup_type";
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "delivery_requested";
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "delivery_status";
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "delivery_cost";
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "dropoff_location_id";
ALTER TABLE "reservations" DROP COLUMN IF EXISTS "driver_profile_id";

DROP TYPE IF EXISTS "PickupType";
