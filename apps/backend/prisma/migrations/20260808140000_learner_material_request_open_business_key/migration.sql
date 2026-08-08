-- Canonical active key for OPEN learner material requests.
-- Cleared when a request leaves OPEN so historical rows do not block re-requests.
ALTER TABLE "learner_material_requests"
ADD COLUMN "open_business_key" TEXT;

UPDATE "learner_material_requests"
SET "open_business_key" = 'open:' || "learner_id" || ':' || "category_id" || ':' || "normalized_requested_item_name"
WHERE "status" = 'OPEN';

CREATE UNIQUE INDEX "learner_material_requests_open_business_key_key"
ON "learner_material_requests"("open_business_key");
