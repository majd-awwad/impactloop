-- CreateEnum
CREATE TYPE "DriverAvailabilityStatus" AS ENUM ('OFFLINE', 'AVAILABLE', 'ON_DELIVERY');

-- CreateEnum
CREATE TYPE "DeliveryAssignmentStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'ARRIVED_PICKUP';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'ARRIVED_DROPOFF';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'FAILED_DELIVERY';

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "pickup_location_id" TEXT NOT NULL,
    "dropoff_location_id" TEXT NOT NULL,
    "assigned_driver_profile_id" TEXT,
    "requested_by_user_id" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'WAITING_FOR_DRIVER',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_at" TIMESTAMP(3),
    "arrived_pickup_at" TIMESTAMP(3),
    "picked_up_at" TIMESTAMP(3),
    "on_the_way_at" TIMESTAMP(3),
    "arrived_dropoff_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "learner_note" TEXT,
    "driver_note" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_assignments" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "driver_profile_id" TEXT NOT NULL,
    "assigned_by_user_id" TEXT,
    "status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMP(3),
    "release_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_status_history" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "old_status" "DeliveryStatus",
    "new_status" "DeliveryStatus" NOT NULL,
    "changed_by_user_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_location_pings" (
    "id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "driver_profile_id" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "accuracy_meters" DECIMAL(8,2),
    "heading" DECIMAL(6,2),
    "speed" DECIMAL(8,2),
    "captured_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_location_pings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deliveries_reservation_id_idx" ON "deliveries"("reservation_id");

-- CreateIndex
CREATE INDEX "deliveries_status_idx" ON "deliveries"("status");

-- CreateIndex
CREATE INDEX "deliveries_assigned_driver_profile_id_status_idx" ON "deliveries"("assigned_driver_profile_id", "status");

-- CreateIndex
CREATE INDEX "deliveries_requested_by_user_id_idx" ON "deliveries"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "deliveries_pickup_location_id_idx" ON "deliveries"("pickup_location_id");

-- CreateIndex
CREATE INDEX "deliveries_dropoff_location_id_idx" ON "deliveries"("dropoff_location_id");

-- CreateIndex
CREATE INDEX "delivery_assignments_delivery_id_idx" ON "delivery_assignments"("delivery_id");

-- CreateIndex
CREATE INDEX "delivery_assignments_driver_profile_id_status_idx" ON "delivery_assignments"("driver_profile_id", "status");

-- CreateIndex
CREATE INDEX "delivery_assignments_assigned_by_user_id_idx" ON "delivery_assignments"("assigned_by_user_id");

-- CreateIndex
CREATE INDEX "delivery_status_history_delivery_id_idx" ON "delivery_status_history"("delivery_id");

-- CreateIndex
CREATE INDEX "delivery_status_history_changed_by_user_id_idx" ON "delivery_status_history"("changed_by_user_id");

-- CreateIndex
CREATE INDEX "delivery_status_history_new_status_idx" ON "delivery_status_history"("new_status");

-- CreateIndex
CREATE INDEX "delivery_location_pings_delivery_id_captured_at_idx" ON "delivery_location_pings"("delivery_id", "captured_at");

-- CreateIndex
CREATE INDEX "delivery_location_pings_driver_profile_id_captured_at_idx" ON "delivery_location_pings"("driver_profile_id", "captured_at");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_pickup_location_id_fkey" FOREIGN KEY ("pickup_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_dropoff_location_id_fkey" FOREIGN KEY ("dropoff_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_assigned_driver_profile_id_fkey" FOREIGN KEY ("assigned_driver_profile_id") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_driver_profile_id_fkey" FOREIGN KEY ("driver_profile_id") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_status_history" ADD CONSTRAINT "delivery_status_history_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_status_history" ADD CONSTRAINT "delivery_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_location_pings" ADD CONSTRAINT "delivery_location_pings_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_location_pings" ADD CONSTRAINT "delivery_location_pings_driver_profile_id_fkey" FOREIGN KEY ("driver_profile_id") REFERENCES "driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
