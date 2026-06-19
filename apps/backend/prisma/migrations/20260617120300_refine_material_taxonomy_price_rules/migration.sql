-- Create stricter enum types for taxonomy and price rule workflow state.
CREATE TYPE "MaterialPriceRuleStatus" AS ENUM ('ACTIVE', 'PENDING_REVIEW', 'REJECTED');
CREATE TYPE "MaterialPriceRuleSourceType" AS ENUM ('MANUAL', 'IMPORTED', 'AI_PROPOSED');
CREATE TYPE "MaterialRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "AiLookupStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED', 'PENDING_REVIEW');

-- Material display/cache fields remain, but paid-listing audit fields are now available.
ALTER TABLE "materials"
  ADD COLUMN "price_rule_id" TEXT,
  ADD COLUMN "price_checked_at" TIMESTAMP(3),
  ADD COLUMN "max_allowed_price_at_check" DECIMAL(12,2);

-- Add normalized names safely for existing development data, then require them.
ALTER TABLE "material_types" ADD COLUMN "normalized_name" TEXT;

UPDATE "material_types"
SET "normalized_name" = regexp_replace(lower(btrim("name_en")), '\s+', ' ', 'g')
WHERE "normalized_name" IS NULL;

ALTER TABLE "material_types" ALTER COLUMN "normalized_name" SET NOT NULL;

-- Clean accidental duplicate aliases inside the same material type before unique constraint.
DELETE FROM "material_type_aliases" a
USING "material_type_aliases" b
WHERE a.ctid < b.ctid
  AND a."material_type_id" = b."material_type_id"
  AND a."normalized_alias" = b."normalized_alias";

-- Convert loose string workflow columns to enums while preserving existing values.
ALTER TABLE "material_price_rules" ALTER COLUMN "source_type" DROP DEFAULT;
ALTER TABLE "material_price_rules" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "material_price_rules"
  ALTER COLUMN "source_type" TYPE "MaterialPriceRuleSourceType"
  USING "source_type"::"MaterialPriceRuleSourceType";

ALTER TABLE "material_price_rules"
  ALTER COLUMN "status" TYPE "MaterialPriceRuleStatus"
  USING "status"::"MaterialPriceRuleStatus";

ALTER TABLE "material_price_rules" ALTER COLUMN "source_type" SET DEFAULT 'MANUAL';
ALTER TABLE "material_price_rules" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';

ALTER TABLE "material_type_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "material_type_requests"
  ALTER COLUMN "status" TYPE "MaterialRequestStatus"
  USING "status"::"MaterialRequestStatus";
ALTER TABLE "material_type_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "price_rule_requests" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "price_rule_requests"
  ALTER COLUMN "status" TYPE "MaterialRequestStatus"
  USING "status"::"MaterialRequestStatus";
ALTER TABLE "price_rule_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "ai_price_lookup_logs"
  ALTER COLUMN "status" TYPE "AiLookupStatus"
  USING "status"::"AiLookupStatus";

-- Approved material types and aliases should be unique within their local context.
CREATE UNIQUE INDEX "material_types_category_id_normalized_name_key"
  ON "material_types"("category_id", "normalized_name");

CREATE UNIQUE INDEX "material_type_aliases_material_type_id_normalized_alias_key"
  ON "material_type_aliases"("material_type_id", "normalized_alias");

-- Preserve the rule used for future listing approval decisions.
CREATE INDEX "materials_price_rule_id_idx" ON "materials"("price_rule_id");

ALTER TABLE "materials"
  ADD CONSTRAINT "materials_price_rule_id_fkey"
  FOREIGN KEY ("price_rule_id") REFERENCES "material_price_rules"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
