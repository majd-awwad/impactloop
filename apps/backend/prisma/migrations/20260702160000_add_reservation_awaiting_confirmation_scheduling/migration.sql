-- AlterEnum
ALTER TYPE "ReservationStatus" ADD VALUE 'AWAITING_LEARNER_CONFIRMATION' BEFORE 'ACCEPTED';

-- AlterTable
ALTER TABLE "reservations"
ADD COLUMN "supplier_proposed_pickup_window_start" TIMESTAMP(3),
ADD COLUMN "supplier_proposed_pickup_window_end" TIMESTAMP(3),
ADD COLUMN "supplier_pickup_window_start" TIMESTAMP(3),
ADD COLUMN "supplier_pickup_window_end" TIMESTAMP(3),
ADD COLUMN "confirmed_delivery_window_start" TIMESTAMP(3),
ADD COLUMN "confirmed_delivery_window_end" TIMESTAMP(3),
ADD COLUMN "earliest_delivery_start" TIMESTAMP(3),
ADD COLUMN "scheduling_conflict_reason" TEXT;
