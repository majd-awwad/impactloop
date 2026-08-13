-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN "supplier_pickup_handover_token_hash" TEXT;
ALTER TABLE "deliveries" ADD COLUMN "supplier_pickup_handover_token_issued_at" TIMESTAMP(3);
ALTER TABLE "deliveries" ADD COLUMN "supplier_pickup_handover_token_expires_at" TIMESTAMP(3);
ALTER TABLE "deliveries" ADD COLUMN "supplier_pickup_handover_token_used_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_supplier_pickup_handover_token_hash_key" ON "deliveries"("supplier_pickup_handover_token_hash");
