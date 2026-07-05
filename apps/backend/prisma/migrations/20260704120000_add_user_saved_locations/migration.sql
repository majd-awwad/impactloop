-- Saved locations for authenticated users. Exact address/coordinates remain private.
CREATE TABLE IF NOT EXISTS "user_saved_locations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_saved_locations_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_saved_locations"
  ADD CONSTRAINT "user_saved_locations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_saved_locations"
  ADD CONSTRAINT "user_saved_locations_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "user_saved_locations_user_id_idx"
  ON "user_saved_locations"("user_id");

CREATE INDEX IF NOT EXISTS "user_saved_locations_user_id_is_default_idx"
  ON "user_saved_locations"("user_id", "is_default");

CREATE INDEX IF NOT EXISTS "user_saved_locations_location_id_idx"
  ON "user_saved_locations"("location_id");

UPDATE "locations"
SET "location" = ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)::geography
WHERE "latitude" IS NOT NULL
  AND "longitude" IS NOT NULL
  AND "location" IS NULL;

CREATE INDEX IF NOT EXISTS "locations_location_gist_idx"
  ON "locations" USING GIST ("location");
