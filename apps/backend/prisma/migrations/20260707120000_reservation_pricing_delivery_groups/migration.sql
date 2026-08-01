-- CreateEnum
CREATE TYPE "DeliveryZone" AS ENUM ('SAME_CITY', 'WEST_BANK', 'JERUSALEM', 'INSIDE_48', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DeliveryGroupStatus" AS ENUM ('OPEN', 'ASSIGNED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "delivery_groups" (
    "id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "supplier_profile_id" TEXT NOT NULL,
    "dropoff_city" TEXT NOT NULL,
    "dropoff_area" TEXT,
    "delivery_address_text" TEXT,
    "delivery_fee" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NIS',
    "delivery_zone" "DeliveryZone" NOT NULL,
    "status" "DeliveryGroupStatus" NOT NULL DEFAULT 'OPEN',
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "assigned_driver_profile_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "unit_price_at_reservation" DECIMAL(12,2),
ADD COLUMN     "material_subtotal" DECIMAL(12,2),
ADD COLUMN     "delivery_fee" DECIMAL(12,2),
ADD COLUMN     "total_amount" DECIMAL(12,2),
ADD COLUMN     "pricing_currency" TEXT DEFAULT 'NIS',
ADD COLUMN     "delivery_zone" "DeliveryZone",
ADD COLUMN     "dropoff_city" TEXT,
ADD COLUMN     "dropoff_area" TEXT,
ADD COLUMN     "delivery_group_id" TEXT;

-- CreateIndex
CREATE INDEX "delivery_groups_learner_id_supplier_profile_id_status_idx" ON "delivery_groups"("learner_id", "supplier_profile_id", "status");

-- CreateIndex
CREATE INDEX "delivery_groups_supplier_profile_id_idx" ON "delivery_groups"("supplier_profile_id");

-- CreateIndex
CREATE INDEX "delivery_groups_assigned_driver_profile_id_idx" ON "delivery_groups"("assigned_driver_profile_id");

-- CreateIndex
CREATE INDEX "reservations_delivery_group_id_idx" ON "reservations"("delivery_group_id");

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_delivery_group_id_fkey" FOREIGN KEY ("delivery_group_id") REFERENCES "delivery_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_groups" ADD CONSTRAINT "delivery_groups_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_groups" ADD CONSTRAINT "delivery_groups_supplier_profile_id_fkey" FOREIGN KEY ("supplier_profile_id") REFERENCES "supplier_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_groups" ADD CONSTRAINT "delivery_groups_assigned_driver_profile_id_fkey" FOREIGN KEY ("assigned_driver_profile_id") REFERENCES "driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
