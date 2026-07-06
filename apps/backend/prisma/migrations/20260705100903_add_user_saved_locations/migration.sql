-- DropIndex
DROP INDEX IF EXISTS "locations_location_gist_idx";

-- AlterTable
ALTER TABLE IF EXISTS "user_saved_locations" ALTER COLUMN "updated_at" DROP DEFAULT;
