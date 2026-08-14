-- Slice 4 preserves physical custody after a final delivery failure until the
-- supplier confirms that all authoritative carried items were returned.
ALTER TYPE "DeliveryStatus" ADD VALUE 'RETURN_TO_SUPPLIER_REQUIRED';
ALTER TYPE "DeliveryStatus" ADD VALUE 'RETURNED_TO_SUPPLIER';

CREATE TYPE "DeliveryReturnReason" AS ENUM (
  'FINAL_ATTEMPT_FAILED',
  'RETRY_DEADLINE_EXPIRED'
);

CREATE TYPE "DeliveryResolutionOutcome" AS ENUM (
  'VERIFIED_LEARNER_RESPONSIBILITY',
  'LEARNER_NOT_RESPONSIBLE'
);

ALTER TABLE "deliveries"
ADD COLUMN "return_required_at" TIMESTAMP(3),
ADD COLUMN "return_reason" "DeliveryReturnReason",
ADD COLUMN "returned_to_supplier_at" TIMESTAMP(3),
ADD COLUMN "return_confirmed_by_user_id" TEXT,
ADD COLUMN "return_custody_driver_profile_id" TEXT,
ADD COLUMN "resolution_outcome" "DeliveryResolutionOutcome",
ADD COLUMN "administratively_resolved_at" TIMESTAMP(3),
ADD COLUMN "administratively_resolved_by_user_id" TEXT;

CREATE INDEX "deliveries_status_return_required_at_idx"
ON "deliveries"("status", "return_required_at");

CREATE INDEX "deliveries_return_custody_driver_profile_id_idx"
ON "deliveries"("return_custody_driver_profile_id");

ALTER TABLE "deliveries"
ADD CONSTRAINT "deliveries_return_confirmed_by_user_id_fkey"
FOREIGN KEY ("return_confirmed_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deliveries"
ADD CONSTRAINT "deliveries_return_custody_driver_profile_id_fkey"
FOREIGN KEY ("return_custody_driver_profile_id") REFERENCES "driver_profiles"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deliveries"
ADD CONSTRAINT "deliveries_administratively_resolved_by_user_id_fkey"
FOREIGN KEY ("administratively_resolved_by_user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
