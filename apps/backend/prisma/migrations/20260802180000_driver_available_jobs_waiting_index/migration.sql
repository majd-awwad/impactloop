-- DR-04: Available Jobs query scalability
-- 1) Partial B-tree for waiting/unassigned newest keyset
-- 2) Backfill + sync Location.location geography(Point,4326)
-- 3) GiST spatial index for radius / KNN nearest

CREATE INDEX IF NOT EXISTS "deliveries_waiting_unassigned_requested_at_id_idx"
ON "deliveries" ("requested_at" DESC, "id" DESC)
WHERE "status" = 'WAITING_FOR_DRIVER'
  AND "assigned_driver_profile_id" IS NULL;

-- Ensure PostGIS remains available (already required since auth schema).
CREATE EXTENSION IF NOT EXISTS postgis;

-- Backfill spatial points from decimal latitude/longitude.
UPDATE "locations"
SET "location" = ST_SetSRID(
  ST_MakePoint("longitude"::double precision, "latitude"::double precision),
  4326
)::geography
WHERE "latitude" IS NOT NULL
  AND "longitude" IS NOT NULL
  AND (
    "location" IS NULL
    OR NOT ST_DWithin(
      "location",
      ST_SetSRID(
        ST_MakePoint("longitude"::double precision, "latitude"::double precision),
        4326
      )::geography,
      0.01,
      false
    )
  );

-- Keep geography synchronized whenever latitude/longitude change.
CREATE OR REPLACE FUNCTION "locations_sync_geography"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."latitude" IS NULL OR NEW."longitude" IS NULL THEN
    NEW."location" := NULL;
    RETURN NEW;
  END IF;

  IF NEW."latitude"::double precision < -90
    OR NEW."latitude"::double precision > 90
    OR NEW."longitude"::double precision < -180
    OR NEW."longitude"::double precision > 180
  THEN
    RAISE EXCEPTION 'Invalid location coordinates (lat=%, lng=%)',
      NEW."latitude", NEW."longitude";
  END IF;

  NEW."location" := ST_SetSRID(
    ST_MakePoint(
      NEW."longitude"::double precision,
      NEW."latitude"::double precision
    ),
    4326
  )::geography;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "locations_sync_geography_trg" ON "locations";
CREATE TRIGGER "locations_sync_geography_trg"
BEFORE INSERT OR UPDATE OF "latitude", "longitude"
ON "locations"
FOR EACH ROW
EXECUTE FUNCTION "locations_sync_geography"();

-- Spatial GiST index for ST_DWithin / KNN (<->) on pickup locations.
CREATE INDEX IF NOT EXISTS "locations_geography_gist_idx"
ON "locations"
USING GIST ("location");

-- Functional city/area indexes so case-insensitive filters keep accurate
-- selectivities for GiST KNN join plans (lower(city) otherwise underestimates).
CREATE INDEX IF NOT EXISTS "locations_lower_city_idx"
ON "locations" (lower("city"));

CREATE INDEX IF NOT EXISTS "locations_lower_area_idx"
ON "locations" (lower("area"));
