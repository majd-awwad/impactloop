-- AlterTable
ALTER TABLE "project_build_items" ADD COLUMN "linked_material_id" TEXT,
ADD COLUMN "linked_reservation_id" TEXT,
ADD COLUMN "linked_material_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "project_build_items_linked_material_id_idx" ON "project_build_items"("linked_material_id");

-- CreateIndex
CREATE INDEX "project_build_items_linked_reservation_id_idx" ON "project_build_items"("linked_reservation_id");

-- AddForeignKey
ALTER TABLE "project_build_items" ADD CONSTRAINT "project_build_items_linked_material_id_fkey" FOREIGN KEY ("linked_material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_build_items" ADD CONSTRAINT "project_build_items_linked_reservation_id_fkey" FOREIGN KEY ("linked_reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
