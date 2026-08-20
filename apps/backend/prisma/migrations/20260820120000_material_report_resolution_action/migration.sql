-- CreateEnum
CREATE TYPE "MaterialReportResolutionAction" AS ENUM ('NO_MATERIAL_ACTION', 'MARKED_UNAVAILABLE', 'HIDDEN');

-- AlterTable
ALTER TABLE "material_reports" ADD COLUMN "resolution_action" "MaterialReportResolutionAction";
