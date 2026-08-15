-- Restore driver spatial index removed by accidental duplicate index-sync migrations
-- (20260812175942 / 20260814001434). PostGIS geography column and KNN queries
-- remain part of the current driver available-jobs implementation.
CREATE INDEX IF NOT EXISTS "locations_geography_gist_idx"
ON "locations"
USING GIST ("location");
