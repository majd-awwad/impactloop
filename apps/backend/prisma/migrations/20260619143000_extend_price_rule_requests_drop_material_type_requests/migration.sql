-- Extend price_rule_requests for unknown paid material names
ALTER TABLE "price_rule_requests" DROP CONSTRAINT IF EXISTS "price_rule_requests_material_type_id_fkey";
ALTER TABLE "price_rule_requests" ALTER COLUMN "material_type_id" DROP NOT NULL;

ALTER TABLE "price_rule_requests" ADD COLUMN IF NOT EXISTS "material_name" TEXT;
ALTER TABLE "price_rule_requests" ADD COLUMN IF NOT EXISTS "normalized_material_name" TEXT;
ALTER TABLE "price_rule_requests" ADD COLUMN IF NOT EXISTS "category_id" TEXT;
ALTER TABLE "price_rule_requests" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "price_rule_requests" ADD COLUMN IF NOT EXISTS "condition" "MaterialCondition";
ALTER TABLE "price_rule_requests" ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(10,2);
ALTER TABLE "price_rule_requests" ADD COLUMN IF NOT EXISTS "supplier_price_nis" DECIMAL(10,2);

ALTER TABLE "price_rule_requests"
  ADD CONSTRAINT "price_rule_requests_material_type_id_fkey"
  FOREIGN KEY ("material_type_id") REFERENCES "material_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'price_rule_requests_category_id_fkey'
  ) THEN
    ALTER TABLE "price_rule_requests"
      ADD CONSTRAINT "price_rule_requests_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "price_rule_requests_category_id_idx" ON "price_rule_requests"("category_id");
CREATE INDEX IF NOT EXISTS "price_rule_requests_normalized_material_name_idx" ON "price_rule_requests"("normalized_material_name");

-- Remove deprecated material type request flow
DROP TABLE IF EXISTS "material_type_requests";
