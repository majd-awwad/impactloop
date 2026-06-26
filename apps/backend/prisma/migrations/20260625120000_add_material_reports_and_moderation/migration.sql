-- CreateEnum
CREATE TYPE "MaterialReportReason" AS ENUM ('MISLEADING_INFORMATION', 'WRONG_CATEGORY', 'WRONG_PRICE', 'INAPPROPRIATE', 'ITEM_NOT_AVAILABLE', 'SUSPICIOUS_SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "MaterialReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'REJECTED');

-- AlterTable
ALTER TABLE "materials" ADD COLUMN "moderation_reason" TEXT,
ADD COLUMN "moderated_at" TIMESTAMP(3),
ADD COLUMN "moderated_by_id" TEXT;

-- CreateTable
CREATE TABLE "material_reports" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reason" "MaterialReportReason" NOT NULL,
    "note" TEXT,
    "status" "MaterialReportStatus" NOT NULL DEFAULT 'PENDING',
    "admin_note" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "material_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_reports_material_id_idx" ON "material_reports"("material_id");

-- CreateIndex
CREATE INDEX "material_reports_reporter_id_idx" ON "material_reports"("reporter_id");

-- CreateIndex
CREATE INDEX "material_reports_status_idx" ON "material_reports"("status");

-- CreateIndex
CREATE INDEX "material_reports_reviewed_by_id_idx" ON "material_reports"("reviewed_by_id");

-- CreateIndex
CREATE INDEX "materials_moderated_by_id_idx" ON "materials"("moderated_by_id");

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_moderated_by_id_fkey" FOREIGN KEY ("moderated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reports" ADD CONSTRAINT "material_reports_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reports" ADD CONSTRAINT "material_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_reports" ADD CONSTRAINT "material_reports_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
