ALTER TABLE "material_views"
ADD COLUMN "operation_key" TEXT;

CREATE UNIQUE INDEX "material_views_material_id_operation_key_key"
ON "material_views"("material_id", "operation_key");
