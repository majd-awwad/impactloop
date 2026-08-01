-- CreateEnum
CREATE TYPE "ReservationFulfillmentMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- AlterTable
ALTER TABLE "reservations"
ADD COLUMN "fulfillment_method" "ReservationFulfillmentMethod" NOT NULL DEFAULT 'PICKUP',
ADD COLUMN "learner_preferred_pickup_windows" JSONB,
ADD COLUMN "learner_preferred_delivery_windows" JSONB,
ADD COLUMN "delivery_address_text" TEXT,
ADD COLUMN "safe_dropoff_allowed" BOOLEAN,
ADD COLUMN "delivery_note" TEXT;
