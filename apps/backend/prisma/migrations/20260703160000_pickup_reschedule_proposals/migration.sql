-- ReservationStatus: AWAITING_SUPPLIER_CONFIRMATION
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'AWAITING_SUPPLIER_CONFIRMATION';

-- NoShowReportReason: additional supplier report reasons
ALTER TYPE "NoShowReportReason" ADD VALUE IF NOT EXISTS 'REPEATED_DELAY';
ALTER TYPE "NoShowReportReason" ADD VALUE IF NOT EXISTS 'WRONG_INFORMATION';
ALTER TYPE "NoShowReportReason" ADD VALUE IF NOT EXISTS 'SAFETY_OR_TRUST_CONCERN';

-- Reschedule proposal metadata
CREATE TYPE "RescheduleRequestedBy" AS ENUM ('SUPPLIER', 'LEARNER');

ALTER TABLE "reservations"
  ADD COLUMN IF NOT EXISTS "learner_proposed_pickup_window_start" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "learner_proposed_pickup_window_end" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pending_reschedule_requested_by" "RescheduleRequestedBy",
  ADD COLUMN IF NOT EXISTS "pending_reschedule_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "pending_reschedule_note" TEXT;
