-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "self_pickup_code_hash" TEXT,
ADD COLUMN "self_pickup_code_generated_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN "supplier_handover_code_hash" TEXT,
ADD COLUMN "supplier_handover_code_generated_at" TIMESTAMP(3),
ADD COLUMN "learner_delivery_code_hash" TEXT,
ADD COLUMN "learner_delivery_code_generated_at" TIMESTAMP(3);
