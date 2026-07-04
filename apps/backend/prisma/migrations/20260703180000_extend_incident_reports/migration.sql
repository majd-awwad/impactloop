-- Extend incident / no-show report model for Phase 6+7

ALTER TYPE "NoShowReportStatus" ADD VALUE IF NOT EXISTS 'RESOLVED_NO_STRIKE';
ALTER TYPE "NoShowReportTargetRole" ADD VALUE IF NOT EXISTS 'SUPPLIER';
ALTER TYPE "NoShowReportTargetRole" ADD VALUE IF NOT EXISTS 'SYSTEM';
ALTER TYPE "NoShowReportReason" ADD VALUE IF NOT EXISTS 'SUPPLIER_UNAVAILABLE';
ALTER TYPE "NoShowReportReason" ADD VALUE IF NOT EXISTS 'SUPPLIER_MATERIAL_NOT_READY';
ALTER TYPE "NoShowReportReason" ADD VALUE IF NOT EXISTS 'NO_DRIVER_AVAILABLE';
ALTER TYPE "NoShowReportReason" ADD VALUE IF NOT EXISTS 'PICKUP_FAILED';
ALTER TYPE "NoShowReportReason" ADD VALUE IF NOT EXISTS 'DELIVERY_FAILED';
ALTER TYPE "NoShowReportReason" ADD VALUE IF NOT EXISTS 'DRIVER_ISSUE';

ALTER TABLE "no_show_reports" ADD COLUMN IF NOT EXISTS "delivery_id" TEXT;

ALTER TABLE "no_show_reports" ALTER COLUMN "target_user_id" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_show_reports_delivery_id_fkey'
  ) THEN
    ALTER TABLE "no_show_reports"
      ADD CONSTRAINT "no_show_reports_delivery_id_fkey"
      FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "no_show_reports_delivery_id_idx" ON "no_show_reports"("delivery_id");
