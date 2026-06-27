-- Rejected big-refactor cleanup (only if those objects exist locally)
ALTER TABLE "price_rule_requests" DROP CONSTRAINT IF EXISTS "price_rule_requests_listing_draft_id_fkey";
ALTER TABLE "price_rule_requests" DROP CONSTRAINT IF EXISTS "price_rule_requests_approved_price_rule_id_fkey";
DROP INDEX IF EXISTS "price_rule_requests_listing_draft_id_idx";
DROP INDEX IF EXISTS "price_rule_requests_approved_price_rule_id_idx";
ALTER TABLE "price_rule_requests" DROP COLUMN IF EXISTS "listing_draft_id";
ALTER TABLE "price_rule_requests" DROP COLUMN IF EXISTS "approved_price_rule_id";

DROP TABLE IF EXISTS "price_reference_requests";

ALTER TABLE "category_requests" DROP CONSTRAINT IF EXISTS "category_requests_listing_draft_id_fkey";
DROP INDEX IF EXISTS "category_requests_listing_draft_id_idx";
ALTER TABLE "category_requests" DROP COLUMN IF EXISTS "listing_draft_id";
ALTER TABLE "category_requests" DROP COLUMN IF EXISTS "description";

DROP TABLE IF EXISTS "material_listing_drafts";

DROP TYPE IF EXISTS "MaterialListingDraftStatus";

-- Ensure minimal category_requests shape
CREATE TABLE IF NOT EXISTS "category_requests" (
    "id" TEXT NOT NULL,
    "requested_name" TEXT NOT NULL,
    "normalized_requested_name" TEXT NOT NULL,
    "requested_by_user_id" TEXT NOT NULL,
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approved_category_id" TEXT,
    "moderator_note" TEXT,
    "listing_draft_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "category_requests" ADD COLUMN IF NOT EXISTS "listing_draft_json" JSONB;

CREATE INDEX IF NOT EXISTS "category_requests_requested_by_user_id_idx" ON "category_requests"("requested_by_user_id");
CREATE INDEX IF NOT EXISTS "category_requests_status_idx" ON "category_requests"("status");
CREATE INDEX IF NOT EXISTS "category_requests_normalized_requested_name_idx" ON "category_requests"("normalized_requested_name");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_requests_requested_by_user_id_fkey'
  ) THEN
    ALTER TABLE "category_requests"
      ADD CONSTRAINT "category_requests_requested_by_user_id_fkey"
      FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'category_requests_approved_category_id_fkey'
  ) THEN
    ALTER TABLE "category_requests"
      ADD CONSTRAINT "category_requests_approved_category_id_fkey"
      FOREIGN KEY ("approved_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
