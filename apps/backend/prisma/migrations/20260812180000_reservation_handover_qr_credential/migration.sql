-- AlterTable
ALTER TABLE "reservations" ADD COLUMN "handover_token_hash" TEXT;
ALTER TABLE "reservations" ADD COLUMN "handover_token_issued_at" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN "handover_token_expires_at" TIMESTAMP(3);
ALTER TABLE "reservations" ADD COLUMN "handover_token_used_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "reservations_handover_token_hash_key" ON "reservations"("handover_token_hash");
