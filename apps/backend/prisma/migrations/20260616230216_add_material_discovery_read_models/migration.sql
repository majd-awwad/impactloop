-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "material_tags" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_tags_material_id_idx" ON "material_tags"("material_id");

-- CreateIndex
CREATE INDEX "material_tags_tag_idx" ON "material_tags"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "material_tags_material_id_tag_key" ON "material_tags"("material_id", "tag");

-- CreateIndex
CREATE INDEX "categories_category_type_is_active_idx" ON "categories"("category_type", "is_active");

-- AddForeignKey
ALTER TABLE "material_tags" ADD CONSTRAINT "material_tags_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
