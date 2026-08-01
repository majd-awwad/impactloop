-- AlterTable
ALTER TABLE "category_requests" ADD COLUMN "published_material_id" TEXT,
ADD COLUMN "published_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "price_rule_requests" ADD COLUMN "published_material_id" TEXT,
ADD COLUMN "published_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "category_requests_published_material_id_key" ON "category_requests"("published_material_id");

-- CreateIndex
CREATE UNIQUE INDEX "price_rule_requests_published_material_id_key" ON "price_rule_requests"("published_material_id");

-- AddForeignKey
ALTER TABLE "category_requests" ADD CONSTRAINT "category_requests_published_material_id_fkey" FOREIGN KEY ("published_material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rule_requests" ADD CONSTRAINT "price_rule_requests_published_material_id_fkey" FOREIGN KEY ("published_material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
