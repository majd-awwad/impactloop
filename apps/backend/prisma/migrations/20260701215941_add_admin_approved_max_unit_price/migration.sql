-- AlterTable
ALTER TABLE "price_rule_requests" ADD COLUMN "admin_approved_max_unit_price_nis" DECIMAL(10,2);

-- Backfill admin-approved adjusted prices from legacy overwrites of ai_suggested_max_unit_price_nis
UPDATE "price_rule_requests"
SET "admin_approved_max_unit_price_nis" = "ai_suggested_max_unit_price_nis"
WHERE "status" IN ('APPROVED', 'REJECTED')
  AND "ai_suggested_max_unit_price_nis" IS NOT NULL;

-- Restore base AI suggested price from stored ai_result_json where available
UPDATE "price_rule_requests"
SET "ai_suggested_max_unit_price_nis" = (
  ("ai_result_json"->'suggestion'->>'suggestedMaxAllowedUnitPriceNis')::decimal
)
WHERE "status" IN ('APPROVED', 'REJECTED')
  AND "ai_result_json" IS NOT NULL
  AND "ai_result_json"->'suggestion'->>'suggestedMaxAllowedUnitPriceNis' IS NOT NULL
  AND ("ai_result_json"->'suggestion'->>'suggestedMaxAllowedUnitPriceNis')::decimal > 0;
