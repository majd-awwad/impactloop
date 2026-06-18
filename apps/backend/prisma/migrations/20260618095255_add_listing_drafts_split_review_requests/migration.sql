-- CreateEnum
CREATE TYPE "MaterialListingDraftStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'READY_TO_PUBLISH', 'PUBLISHED', 'CANCELLED');

-- AlterTable
ALTER TABLE "price_rule_requests" ADD COLUMN     "approved_price_rule_id" TEXT,
ADD COLUMN     "listing_draft_id" TEXT;

-- CreateTable
CREATE TABLE "material_listing_drafts" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "material_name" TEXT NOT NULL,
    "normalized_material_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category_id" TEXT,
    "requested_category_name" TEXT,
    "condition" "MaterialCondition" NOT NULL,
    "source_type" "MaterialSourceType" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "is_free" BOOLEAN NOT NULL,
    "price" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'NIS',
    "pickup_allowed" BOOLEAN NOT NULL DEFAULT true,
    "delivery_allowed" BOOLEAN NOT NULL DEFAULT false,
    "pickup_notes" TEXT,
    "suggested_uses" TEXT,
    "image_urls_json" JSONB,
    "status" "MaterialListingDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "created_material_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_listing_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_requests" (
    "id" TEXT NOT NULL,
    "listing_draft_id" TEXT,
    "requested_name" TEXT NOT NULL,
    "normalized_requested_name" TEXT NOT NULL,
    "description" TEXT,
    "requested_by_user_id" TEXT NOT NULL,
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approved_category_id" TEXT,
    "moderator_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_reference_requests" (
    "id" TEXT NOT NULL,
    "listing_draft_id" TEXT,
    "material_name" TEXT NOT NULL,
    "normalized_material_name" TEXT NOT NULL,
    "category_id" TEXT,
    "requested_category_name" TEXT,
    "unit" TEXT NOT NULL,
    "condition" "MaterialCondition" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "supplier_price_nis" DECIMAL(10,2),
    "requested_by_user_id" TEXT,
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'PENDING',
    "ai_suggested_unit" TEXT,
    "ai_suggested_max_unit_price_nis" DECIMAL(10,2),
    "ai_suggested_max_total_price_nis" DECIMAL(10,2),
    "ai_suggested_aliases_json" JSONB,
    "ai_result_json" JSONB,
    "approved_material_type_id" TEXT,
    "approved_price_rule_id" TEXT,
    "moderator_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "price_reference_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_listing_drafts_owner_id_idx" ON "material_listing_drafts"("owner_id");

-- CreateIndex
CREATE INDEX "material_listing_drafts_status_idx" ON "material_listing_drafts"("status");

-- CreateIndex
CREATE INDEX "material_listing_drafts_category_id_idx" ON "material_listing_drafts"("category_id");

-- CreateIndex
CREATE INDEX "material_listing_drafts_normalized_material_name_idx" ON "material_listing_drafts"("normalized_material_name");

-- CreateIndex
CREATE INDEX "category_requests_listing_draft_id_idx" ON "category_requests"("listing_draft_id");

-- CreateIndex
CREATE INDEX "category_requests_requested_by_user_id_idx" ON "category_requests"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "category_requests_status_idx" ON "category_requests"("status");

-- CreateIndex
CREATE INDEX "category_requests_normalized_requested_name_idx" ON "category_requests"("normalized_requested_name");

-- CreateIndex
CREATE INDEX "price_reference_requests_listing_draft_id_idx" ON "price_reference_requests"("listing_draft_id");

-- CreateIndex
CREATE INDEX "price_reference_requests_requested_by_user_id_idx" ON "price_reference_requests"("requested_by_user_id");

-- CreateIndex
CREATE INDEX "price_reference_requests_status_idx" ON "price_reference_requests"("status");

-- CreateIndex
CREATE INDEX "price_reference_requests_normalized_material_name_idx" ON "price_reference_requests"("normalized_material_name");

-- CreateIndex
CREATE INDEX "price_reference_requests_approved_material_type_id_idx" ON "price_reference_requests"("approved_material_type_id");

-- CreateIndex
CREATE INDEX "price_reference_requests_approved_price_rule_id_idx" ON "price_reference_requests"("approved_price_rule_id");

-- CreateIndex
CREATE INDEX "price_rule_requests_listing_draft_id_idx" ON "price_rule_requests"("listing_draft_id");

-- CreateIndex
CREATE INDEX "price_rule_requests_approved_price_rule_id_idx" ON "price_rule_requests"("approved_price_rule_id");

-- AddForeignKey
ALTER TABLE "price_rule_requests" ADD CONSTRAINT "price_rule_requests_listing_draft_id_fkey" FOREIGN KEY ("listing_draft_id") REFERENCES "material_listing_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rule_requests" ADD CONSTRAINT "price_rule_requests_approved_price_rule_id_fkey" FOREIGN KEY ("approved_price_rule_id") REFERENCES "material_price_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_listing_drafts" ADD CONSTRAINT "material_listing_drafts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_listing_drafts" ADD CONSTRAINT "material_listing_drafts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_listing_drafts" ADD CONSTRAINT "material_listing_drafts_created_material_id_fkey" FOREIGN KEY ("created_material_id") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_requests" ADD CONSTRAINT "category_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_requests" ADD CONSTRAINT "category_requests_listing_draft_id_fkey" FOREIGN KEY ("listing_draft_id") REFERENCES "material_listing_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_requests" ADD CONSTRAINT "category_requests_approved_category_id_fkey" FOREIGN KEY ("approved_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_reference_requests" ADD CONSTRAINT "price_reference_requests_listing_draft_id_fkey" FOREIGN KEY ("listing_draft_id") REFERENCES "material_listing_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_reference_requests" ADD CONSTRAINT "price_reference_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_reference_requests" ADD CONSTRAINT "price_reference_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_reference_requests" ADD CONSTRAINT "price_reference_requests_approved_material_type_id_fkey" FOREIGN KEY ("approved_material_type_id") REFERENCES "material_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_reference_requests" ADD CONSTRAINT "price_reference_requests_approved_price_rule_id_fkey" FOREIGN KEY ("approved_price_rule_id") REFERENCES "material_price_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
