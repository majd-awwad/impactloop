-- Extend verification document status for admin change requests
ALTER TYPE "VerificationDocumentStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';

-- Supplier verification review metadata
ALTER TABLE "supplier_profiles"
  ADD COLUMN "verification_submitted_at" TIMESTAMP(3),
  ADD COLUMN "verification_reviewed_at" TIMESTAMP(3),
  ADD COLUMN "verification_reviewed_by_id" TEXT,
  ADD COLUMN "verification_admin_note" TEXT;

ALTER TABLE "supplier_profiles"
  ADD CONSTRAINT "supplier_profiles_verification_reviewed_by_id_fkey"
  FOREIGN KEY ("verification_reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "supplier_profiles_verification_reviewed_by_id_idx"
  ON "supplier_profiles"("verification_reviewed_by_id");

-- Organization verification document metadata
ALTER TABLE "organization_profiles"
  ADD COLUMN "verification_document_url" TEXT,
  ADD COLUMN "verification_document_name" TEXT;
