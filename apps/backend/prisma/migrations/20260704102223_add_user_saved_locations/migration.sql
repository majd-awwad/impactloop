-- DropIndex
DROP INDEX "locations_location_gist_idx";

-- AlterTable
ALTER TABLE "user_saved_locations" ALTER COLUMN "updated_at" DROP DEFAULT;
