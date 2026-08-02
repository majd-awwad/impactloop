# DR-04 — Driver Delivery Query Performance

Local query-scalability work for the Driver portal. Numbers below are from a
disposable local PostgreSQL benchmark and are **not** production SLAs.

## Why geography moved to PostGIS

1. **Manual Node Haversine** loaded the full waiting pool into memory to compute
   distance, sort, and paginate. That does not scale with waiting-row growth.
2. **Manual SQL trigonometry** (`SIN`/`COS` Haversine + application bounding boxes)
   duplicated what PostGIS already provides and could not use a spatial GiST index
   for radius membership or KNN nearest ordering.
3. **PostGIS** supplies spatial operators (`ST_DWithin`, `ST_Distance`, `<->`).
   **GiST** is the index access method that lets PostgreSQL accelerate those
   operators. GiST alone does not “calculate distance”; PostGIS does.

## Confirmed original defects (still fixed)

1. Available Jobs loaded the entire waiting pool into Node.
2. Available counts used in-memory array lengths / duplicate COUNT queries.
3. New-job notification eligibility performed one active-delivery `count` per Driver (N+1).
4. Available Jobs reused the heavy active-detail include.
5. Hydration could return rows claimed between SQL page select and Prisma load.

History and Incidents already used SQL keyset pagination and were left unchanged.

## Final query architecture

| Endpoint | Approach |
|---|---|
| Available newest / city / area | SQL keyset on `(requested_at DESC, id DESC)`, `LIMIT + 1`, light list select |
| Available nearest + radius | PostGIS `ST_DWithin(..., false)` + GiST; KNN `<->` order; meters keyset |
| Available nearest (no radius) | Global PostGIS KNN on `locations.location`; no implicit radius |
| Available counts | One SQL aggregate: `COUNT(*)` + optional `COUNT(*) FILTER (ST_DWithin…)` |
| Active list | Light reservation-id scan → escalate → one include read (max 3) |
| New-job recipients | One set-based SQL query with grouped active counts |
| History / incidents | Unchanged keyset pagination |

## Spatial column ownership

- Column: `locations.location` as `geography(Point,4326)` (`Unsupported` in Prisma).
- Compatibility columns `latitude` / `longitude` remain and are not removed in DR-04.
- Synchronization: database trigger `locations_sync_geography_trg` rebuilds geography
  on `INSERT` / `UPDATE OF latitude, longitude` via
  `ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography`.
- Null coordinates produce a null geography value.
- Invalid coordinates raise on write.
- Existing rows are backfilled by the DR-04 migration.
- Application helpers that still call `updateLocationGeography` are redundant with
  the trigger for lat/lng writes; the trigger is the enforced source of truth.

## Nearest / radius distance metric

- **Canonical KNN order key:** `pl.location <-> driver_reference_geography`
- Used for SELECT (`order_distance_meters`), `ORDER BY`, nearest keyset, cursor
  `distanceMeters`, and cursor-anchor verification
- **Radius membership** remains `ST_DWithin(..., false)` (spherical)
- Presentation `distanceKm` is derived from the KNN meter value; it is not the
  cursor/order key
- Query leads `FROM locations pl JOIN deliveries d` so PostgreSQL can choose a
  GiST `Index Scan` with `Order By (location <-> …)`

## Indexes

```sql
CREATE INDEX "deliveries_waiting_unassigned_requested_at_id_idx"
ON "deliveries" ("requested_at" DESC, "id" DESC)
WHERE "status" = 'WAITING_FOR_DRIVER'
  AND "assigned_driver_profile_id" IS NULL;

CREATE INDEX "locations_geography_gist_idx"
ON "locations" USING GIST ("location");

CREATE INDEX "locations_lower_city_idx" ON "locations" (lower("city"));
CREATE INDEX "locations_lower_area_idx" ON "locations" (lower("area"));
```

Migration: `20260802180000_driver_available_jobs_waiting_index`
Verify: `npm run verify:driver-available-jobs-waiting-index`

Requires PostGIS (`CREATE EXTENSION IF NOT EXISTS postgis`). Local/CI already use
PostGIS-capable PostgreSQL (`postgis/postgis` in recommendation CI; local docs require
PostgreSQL + PostGIS).

## Cursor strategy

- Opaque base64url JSON, version **v2**.
- Nearest cursors bind sort mode, city, area, `maxDistanceKm`, driver reference
  (`refLat`/`refLng`), canonical **distanceMeters**, `requestedAt`, and `id`.
- Presentation `distanceKm` is not the ordering key.
- v1 (km-rounded) cursors are rejected fail-closed (409).
- Filter / reference / sort mismatches → 409.
- Deleted or moved anchors → 409.

## Remaining limitations

- Global nearest still considers the filtered waiting set; Node receives at most
  `LIMIT + 1` rows, but PostgreSQL may need a spatial plan over matching pickups.
- Secondary `requested_at` / `id` ordering after KNN can change the planner’s
  preferred path; EXPLAIN verification documents whether GiST KNN is used.
- No route optimization, ETA, geocoding, or production infra redesign in DR-04.

## Benchmark

```bash
cd apps/backend
npm run bench:driver-query-scale
```

Compares:

1. Original load-all waiting ids into Node
2. Manual SQL Haversine (superseded)
3. Final PostGIS `ST_DWithin` / KNN queries

Target disposable dataset: ≥150 Drivers, ≥3k waiting, ≥9k deliveries, ≥7.5k pings, ≥2k reports.

### Before / after (local disposable bench)

Dataset: 150 Drivers, 3,000 waiting, 9,000 deliveries, 9,000 assignments,
7,500 pings, 2,250 reports.

| Scenario | Load-all / before | Manual SQL Haversine | PostGIS (final) |
|---|---|---|---|
| Newest page one | full pool | ~0.8 ms / 21 rows; waiting B-tree Index Only Scan | same SQL keyset |
| Newest later page | full reload | ~0.8 ms / 21 rows | same |
| City page | full city collection | ~1.1 ms / ≤21 rows | same |
| Radius nearest page one | 3,000 rows into Node | ~4.9 ms / 21 rows | ~7.6 ms / 21 rows; GiST for `ST_DWithin` |
| Radius nearest later | full pool | (n/a in prior) | ~14.7 ms / 21 rows |
| Global nearest page one | 3,000 rows into Node | ~manual SQL | ~3.0 ms / 21 rows; **GiST Index Scan + Order By `<->`** |
| Counts | array lengths | 2 COUNT queries | 1 aggregate (~8 ms) |
| Notify eligibility @150 | N+1 counts | 1 query | ~2.0 ms / 1 query |
| Heap delta (suite) | multi‑MB full load | — | ~0 MB observed locally |

EXPLAIN notes (bench DB, fail-closed recursive JSON walk):

- Newest: `deliveries_waiting_unassigned_requested_at_id_idx` Index Only Scan.
- Radius: `locations_geography_gist_idx` via Index/Bitmap Index Scan for `ST_DWithin`.
- Global KNN: `locations_geography_gist_idx` **Index Scan** with **Order By `<->`** (not Sort-only).
- Secondary `requested_at`/`id` may appear as Incremental Sort above the KNN scan.

## Rollback

Additive only:

1. Revert application code to stop reading `locations.location` for Available Jobs.
2. Leave in place: PostGIS extension, `locations.location`, GiST index, waiting-order index.
3. Do **not** drop latitude/longitude or destroy spatial data for rollback.

## Deferred debt

- Production provider / CI images without PostGIS remain an environment blocker
  (not silently replaced with custom Haversine).
- Optional cleanup of redundant `updateLocationGeography` app writes once all writers
  are confirmed trigger-covered.
