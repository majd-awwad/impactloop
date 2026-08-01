-- AlterTable
ALTER TABLE "deliveries" ADD COLUMN "delivery_group_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "deliveries_delivery_group_id_key" ON "deliveries"("delivery_group_id");

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_delivery_group_id_fkey" FOREIGN KEY ("delivery_group_id") REFERENCES "delivery_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
