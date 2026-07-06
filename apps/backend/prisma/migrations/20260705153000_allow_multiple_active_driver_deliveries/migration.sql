-- Allow multiple active assigned deliveries per driver (queue up to app-level max).
DROP INDEX IF EXISTS "deliveries_one_active_per_driver_key";
