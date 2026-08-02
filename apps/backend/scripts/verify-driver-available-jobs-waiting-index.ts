/**
 * DR-04 migration verification (PostGIS + waiting-order index).
 *
 * Populated path: clone local DB, strip DR-04 artifacts, seed representative
 * rows, apply migration, assert indexes + fail-closed EXPLAIN plans.
 *
 * Fresh empty migrate deploy: attempted honestly; older unrelated migrations
 * may block. A current-schema dump is NOT a complete fresh migration chain.
 */
import 'dotenv/config';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const migrationName = '20260802180000_driver_available_jobs_waiting_index';
const waitingIndex = 'deliveries_waiting_unassigned_requested_at_id_idx';
const gistIndex = 'locations_geography_gist_idx';
const syncTrigger = 'locations_sync_geography_trg';
const syncFunction = 'locations_sync_geography';

const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) throw new Error('DATABASE_URL is required.');

const parsed = new URL(baseUrl);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
  throw new Error('DR-04 migration verification only runs against local PostgreSQL.');
}
if (/prod|production/i.test(parsed.pathname)) {
  throw new Error('DR-04 migration verification refuses production-like databases.');
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
const databases = {
  populated: `dr04_verify_populated_${suffix}`,
  empty: `dr04_verify_empty_${suffix}`,
};

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const migrationsRoot = join(backendRoot, 'prisma', 'migrations');
const targetMigrationSql = join(migrationsRoot, migrationName, 'migration.sql');
if (!existsSync(targetMigrationSql)) {
  throw new Error(`Missing migration ${migrationName}.`);
}

const migrationDirectories = readdirSync(migrationsRoot)
  .filter((entry) => {
    const path = join(migrationsRoot, entry);
    return (
      statSync(path).isDirectory() && existsSync(join(path, 'migration.sql'))
    );
  })
  .sort();
const targetIndex = migrationDirectories.indexOf(migrationName);
if (targetIndex < 1) {
  throw new Error('DR-04 migration does not have a valid predecessor history.');
}
if (targetIndex !== migrationDirectories.length - 1) {
  throw new Error(
    'DR-04 is not the latest migration; predecessor construction must be updated.',
  );
}

const postgresBins = [
  'C:/Program Files/PostgreSQL/18/bin',
  'C:/Program Files/PostgreSQL/17/bin',
  'C:/Program Files/PostgreSQL/16/bin',
];
const postgresBin = postgresBins.find(
  (candidate) =>
    existsSync(join(candidate, 'psql.exe')) &&
    existsSync(join(candidate, 'pg_dump.exe')),
);
if (!postgresBin) throw new Error('Local PostgreSQL client tools are required.');

const verificationTemp = join(backendRoot, `.dr04-verify-${suffix}`);
mkdirSync(verificationTemp);

const sourceDbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

const databaseUrl = (database: string) => {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
};
const postgresUrl = (value: string) => {
  const url = new URL(value);
  url.searchParams.delete('schema');
  return url.toString();
};
const run = (command: string, args: string[], env = process.env) =>
  spawnSync(command, args, {
    cwd: backendRoot,
    encoding: 'utf8',
    env,
    maxBuffer: 20 * 1024 * 1024,
  });
const assertSucceeded = (label: string, result: ReturnType<typeof run>) => {
  if (result.status !== 0) {
    throw new Error(
      `${label} failed: ${result.error?.message ?? ''}\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }
};
const applySqlFile = (database: string, sqlFile: string, label: string) =>
  assertSucceeded(
    label,
    run(join(postgresBin, 'psql.exe'), [
      '--set',
      'ON_ERROR_STOP=1',
      '--dbname',
      postgresUrl(databaseUrl(database)),
      '--file',
      sqlFile,
    ]),
  );

const withDatabase = async <T>(
  database: string,
  operation: (client: pg.Client) => Promise<T>,
) => {
  const client = new pg.Client({ connectionString: databaseUrl(database) });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
};

type PlanNode = {
  'Node Type'?: string;
  'Index Name'?: string;
  'Order By'?: string;
  'Relation Name'?: string;
  Plans?: PlanNode[];
  Plan?: PlanNode;
};

const walkPlanNodes = (node: unknown, acc: PlanNode[] = []): PlanNode[] => {
  if (!node || typeof node !== 'object') {
    return acc;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkPlanNodes(item, acc);
    return acc;
  }
  const record = node as PlanNode & Record<string, unknown>;
  if (typeof record['Node Type'] === 'string') {
    acc.push(record);
  }
  if (record.Plans) walkPlanNodes(record.Plans, acc);
  if (record.Plan) walkPlanNodes(record.Plan, acc);
  return acc;
};

const explainNodes = async (client: pg.Client, sql: string, params: unknown[] = []) => {
  const result = await client.query(`EXPLAIN (FORMAT JSON) ${sql}`, params);
  return walkPlanNodes(result.rows[0]['QUERY PLAN']);
};

const assertNewestUsesWaitingBtree = (nodes: PlanNode[], label: string) => {
  const hit = nodes.some(
    (node) =>
      (node['Node Type'] === 'Index Scan' ||
        node['Node Type'] === 'Index Only Scan') &&
      node['Index Name'] === waitingIndex,
  );
  assert.equal(hit, true, `${label}: newest must use ${waitingIndex}`);
};

const assertRadiusUsesGeographyGist = (nodes: PlanNode[], label: string) => {
  const hit = nodes.some(
    (node) =>
      (node['Node Type'] === 'Index Scan' ||
        node['Node Type'] === 'Bitmap Index Scan') &&
      node['Index Name'] === gistIndex,
  );
  assert.equal(hit, true, `${label}: radius must use ${gistIndex}`);
};

const assertGlobalKnnUsesGeographyGistOrderBy = (
  nodes: PlanNode[],
  label: string,
) => {
  const hit = nodes.some(
    (node) =>
      node['Node Type'] === 'Index Scan' &&
      node['Index Name'] === gistIndex &&
      typeof node['Order By'] === 'string' &&
      node['Order By'].includes('<->'),
  );
  if (!hit) {
    process.stdout.write(
      `${label}_explain_dump=${JSON.stringify(nodes).slice(0, 2000)}\n`,
    );
  }
  assert.equal(
    hit,
    true,
    `${label}: global KNN must Index Scan ${gistIndex} with Order By <-> (not Sort-only)`,
  );
};

const refSql = `ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography`;

const stripDr04Artifacts = async (client: pg.Client) => {
  await client.query(`DROP INDEX IF EXISTS "${waitingIndex}"`);
  await client.query(`DROP INDEX IF EXISTS "${gistIndex}"`);
  await client.query(`DROP INDEX IF EXISTS "locations_lower_city_idx"`);
  await client.query(`DROP INDEX IF EXISTS "locations_lower_area_idx"`);
  await client.query(
    `DROP TRIGGER IF EXISTS "${syncTrigger}" ON "locations"`,
  );
  await client.query(`DROP FUNCTION IF EXISTS "${syncFunction}"()`);
  await client.query(`
    UPDATE "locations"
    SET "location" = NULL
    WHERE "latitude" IS NOT NULL AND "longitude" IS NOT NULL
  `);
};

const seedRepresentativeRows = async (client: pg.Client) => {
  const stamp = new Date();
  const stampIso = stamp.toISOString();

  await client.query(`
    INSERT INTO "locations" (
      "id", "country", "city", "area", "latitude", "longitude",
      "visibility", "is_approximate", "created_at", "updated_at"
    ) VALUES
      ('dr04-loc-a', 'Palestine', 'Nablus', 'Center', 32.220, 35.260, 'ORDER_ONLY', false, NOW(), NOW()),
      ('dr04-loc-b', 'Palestine', 'Nablus', 'Center', 32.221, 35.261, 'ORDER_ONLY', false, NOW(), NOW()),
      ('dr04-loc-c', 'Palestine', 'Nablus', 'East', 32.230, 35.270, 'ORDER_ONLY', false, NOW(), NOW()),
      ('dr04-loc-null', 'Palestine', 'Jenin', 'North', NULL, NULL, 'ORDER_ONLY', true, NOW(), NOW()),
      ('dr04-loc-drop', 'Palestine', 'Ramallah', 'Center', 31.9, 35.2, 'PRIVATE', false, NOW(), NOW())
    ON CONFLICT ("id") DO NOTHING
  `);

  // Ensure these rows need backfill before migration re-application.
  await client.query(`
    UPDATE "locations"
    SET "location" = NULL
    WHERE "id" IN ('dr04-loc-a','dr04-loc-b','dr04-loc-c','dr04-loc-drop')
  `);

  const material = await client.query<{ id: string; owner_id: string }>(
    `SELECT "id", "owner_id" FROM "materials" LIMIT 1`,
  );
  const requester = await client.query<{ id: string }>(
    `SELECT "id" FROM "users" WHERE "account_status" = 'ACTIVE' LIMIT 1`,
  );
  const driver = await client.query<{ id: string }>(
    `SELECT "id" FROM "driver_profiles" WHERE "status" = 'ACTIVE' LIMIT 1`,
  );

  assert.ok(material.rows[0], 'populated seed needs a material');
  assert.ok(requester.rows[0], 'populated seed needs a user');
  assert.ok(driver.rows[0], 'populated seed needs a driver profile');

  const mat = material.rows[0]!;
  const requesterId = requester.rows[0]!.id;
  const driverId = driver.rows[0]!.id;

  const reservations = [
    ['dr04-res-w1', 'ACCEPTED'],
    ['dr04-res-w2', 'ACCEPTED'],
    ['dr04-res-w3', 'ACCEPTED'],
    ['dr04-res-w4', 'ACCEPTED'],
    ['dr04-res-assigned', 'ACCEPTED'],
    ['dr04-res-terminal', 'COMPLETED'],
  ] as const;

  for (const [id, status] of reservations) {
    await client.query(
      `INSERT INTO "reservations" (
         "id", "material_id", "owner_id", "requester_id", "quantity_requested",
         "status", "fulfillment_method", "created_at", "updated_at"
       ) VALUES ($1,$2,$3,$4,1,$5::"ReservationStatus",'DELIVERY',NOW(),NOW())
       ON CONFLICT ("id") DO NOTHING`,
      [id, mat.id, mat.owner_id, requesterId, status],
    );
  }

  // Multiple waiting + duplicate requestedAt + null-coordinate waiting.
  await client.query(
    `INSERT INTO "deliveries" (
       "id", "reservation_id", "pickup_location_id", "dropoff_location_id",
       "requested_by_user_id", "status", "requested_at", "created_at", "updated_at"
     ) VALUES
       ('dr04-del-w1', 'dr04-res-w1', 'dr04-loc-a', 'dr04-loc-drop', $1, 'WAITING_FOR_DRIVER', $2::timestamptz, NOW(), NOW()),
       ('dr04-del-w2', 'dr04-res-w2', 'dr04-loc-b', 'dr04-loc-drop', $1, 'WAITING_FOR_DRIVER', $2::timestamptz, NOW(), NOW()),
       ('dr04-del-w3', 'dr04-res-w3', 'dr04-loc-c', 'dr04-loc-drop', $1, 'WAITING_FOR_DRIVER', $3::timestamptz, NOW(), NOW()),
       ('dr04-del-w4', 'dr04-res-w4', 'dr04-loc-null', 'dr04-loc-drop', $1, 'WAITING_FOR_DRIVER', $2::timestamptz, NOW(), NOW())
     ON CONFLICT ("id") DO NOTHING`,
    [
      requesterId,
      stampIso,
      new Date(stamp.getTime() - 60_000).toISOString(),
    ],
  );

  // Assigned active.
  await client.query(
    `INSERT INTO "deliveries" (
       "id", "reservation_id", "pickup_location_id", "dropoff_location_id",
       "requested_by_user_id", "assigned_driver_profile_id", "status",
       "requested_at", "created_at", "updated_at"
     ) VALUES (
       'dr04-del-assigned', 'dr04-res-assigned', 'dr04-loc-a', 'dr04-loc-drop',
       $1, $2, 'DRIVER_ASSIGNED', NOW(), NOW(), NOW()
     )
     ON CONFLICT ("id") DO NOTHING`,
    [requesterId, driverId],
  );

  // Actual terminal delivery.
  await client.query(
    `INSERT INTO "deliveries" (
       "id", "reservation_id", "pickup_location_id", "dropoff_location_id",
       "requested_by_user_id", "assigned_driver_profile_id", "status",
       "requested_at", "delivered_at", "created_at", "updated_at"
     ) VALUES (
       'dr04-del-terminal', 'dr04-res-terminal', 'dr04-loc-b', 'dr04-loc-drop',
       $1, $2, 'DELIVERED', NOW() - interval '2 hours', NOW() - interval '1 hour', NOW(), NOW()
     )
     ON CONFLICT ("id") DO NOTHING`,
    [requesterId, driverId],
  );

  // Extra waiting volume across many distinct geo points so GiST KNN wins vs Sort.
  await client.query(
    `
    INSERT INTO reservations (
      id, material_id, owner_id, requester_id, quantity_requested,
      status, fulfillment_method, created_at, updated_at
    )
    SELECT
      'dr04-res-vol-' || s.i,
      $1, $2, $3, 1, 'ACCEPTED', 'DELIVERY', NOW(), NOW()
    FROM generate_series(0, 799) AS s(i)
    ON CONFLICT (id) DO NOTHING
    `,
    [mat.id, mat.owner_id, requesterId],
  );
  await client.query(
    `
    WITH locs AS (
      SELECT id, row_number() OVER () AS rn
      FROM locations
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      LIMIT 250
    ),
    loc_count AS (SELECT COUNT(*)::int AS c FROM locs)
    INSERT INTO deliveries (
      id, reservation_id, pickup_location_id, dropoff_location_id,
      requested_by_user_id, status, requested_at, created_at, updated_at
    )
    SELECT
      'dr04-del-vol-' || s.i,
      'dr04-res-vol-' || s.i,
      l.id,
      'dr04-loc-drop',
      $1,
      'WAITING_FOR_DRIVER',
      NOW() - ((s.i + 1) || ' minutes')::interval,
      NOW(),
      NOW()
    FROM generate_series(0, 799) AS s(i)
    JOIN loc_count lc ON lc.c > 0
    JOIN locs l ON l.rn = ((s.i % lc.c) + 1)
    ON CONFLICT (id) DO NOTHING
    `,
    [requesterId],
  );

  // Dedicated Nablus volume for city/area nearest EXPLAIN.
  await client.query(
    `
    INSERT INTO reservations (
      id, material_id, owner_id, requester_id, quantity_requested,
      status, fulfillment_method, created_at, updated_at
    )
    SELECT
      'dr04-res-nablus-' || s.i,
      $1, $2, $3, 1, 'ACCEPTED', 'DELIVERY', NOW(), NOW()
    FROM generate_series(0, 199) AS s(i)
    ON CONFLICT (id) DO NOTHING
    `,
    [mat.id, mat.owner_id, requesterId],
  );
  await client.query(
    `
    INSERT INTO locations (
      id, country, city, area, latitude, longitude,
      visibility, is_approximate, created_at, updated_at
    )
    SELECT
      'dr04-loc-nablus-' || s.i,
      'Palestine',
      'Nablus',
      'Vol',
      32.20 + (s.i * 0.0003),
      35.25 + (s.i * 0.0003),
      'ORDER_ONLY',
      false,
      NOW(),
      NOW()
    FROM generate_series(0, 199) AS s(i)
    ON CONFLICT (id) DO NOTHING
    `,
  );
  await client.query(
    `
    INSERT INTO deliveries (
      id, reservation_id, pickup_location_id, dropoff_location_id,
      requested_by_user_id, status, requested_at, created_at, updated_at
    )
    SELECT
      'dr04-del-nablus-' || s.i,
      'dr04-res-nablus-' || s.i,
      'dr04-loc-nablus-' || s.i,
      'dr04-loc-drop',
      $1,
      'WAITING_FOR_DRIVER',
      NOW() - ((s.i + 1) || ' minutes')::interval,
      NOW(),
      NOW()
    FROM generate_series(0, 199) AS s(i)
    ON CONFLICT (id) DO NOTHING
    `,
    [requesterId],
  );

  process.stdout.write('populated_seed=ok\n');
};

const assertApplicationExplainPlans = async (
  client: pg.Client,
  label: string,
) => {
  await client.query('ANALYZE deliveries');
  await client.query('ANALYZE locations');

  const lat = 32.22;
  const lng = 35.26;

  // Newest page one
  assertNewestUsesWaitingBtree(
    await explainNodes(
      client,
      `SELECT d.id, d.requested_at
       FROM deliveries d
       INNER JOIN locations pl ON pl.id = d.pickup_location_id
       WHERE d.status = 'WAITING_FOR_DRIVER'
         AND d.assigned_driver_profile_id IS NULL
       ORDER BY d.requested_at DESC, d.id DESC
       LIMIT 21`,
    ),
    `${label}_newest_page1`,
  );

  // Newest later page
  const mid = await client.query<{ requested_at: Date; id: string }>(
    `SELECT d.requested_at, d.id FROM deliveries d
     WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
     ORDER BY d.requested_at DESC, d.id DESC OFFSET 20 LIMIT 1`,
  );
  if (mid.rows[0]) {
    assertNewestUsesWaitingBtree(
      await explainNodes(
        client,
        `SELECT d.id, d.requested_at
         FROM deliveries d
         INNER JOIN locations pl ON pl.id = d.pickup_location_id
         WHERE d.status = 'WAITING_FOR_DRIVER'
           AND d.assigned_driver_profile_id IS NULL
           AND (
             d.requested_at < $1
             OR (d.requested_at = $1 AND d.id < $2)
           )
         ORDER BY d.requested_at DESC, d.id DESC
         LIMIT 21`,
        [mid.rows[0].requested_at, mid.rows[0].id],
      ),
      `${label}_newest_later`,
    );
  }

  // Global nearest page one (application join shape)
  const globalNearestSql = `
    SELECT d.id, d.requested_at,
      (pl.location <-> ${refSql}) AS order_distance_meters
    FROM locations pl
    INNER JOIN deliveries d ON d.pickup_location_id = pl.id
    WHERE d.status = 'WAITING_FOR_DRIVER'
      AND d.assigned_driver_profile_id IS NULL
    ORDER BY
      (pl.location <-> ${refSql}) ASC NULLS LAST,
      d.requested_at DESC,
      d.id DESC
    LIMIT 21`;
  assertGlobalKnnUsesGeographyGistOrderBy(
    await explainNodes(client, globalNearestSql, [lat, lng]),
    `${label}_global_nearest_page1`,
  );

  // Global nearest later page
  const knnAnchor = await client.query<{
    id: string;
    requested_at: Date;
    order_distance_meters: number;
  }>(
    `SELECT d.id, d.requested_at, (pl.location <-> ${refSql}) AS order_distance_meters
     FROM locations pl
     INNER JOIN deliveries d ON d.pickup_location_id = pl.id
     WHERE d.status = 'WAITING_FOR_DRIVER'
       AND d.assigned_driver_profile_id IS NULL
       AND pl.location IS NOT NULL
     ORDER BY (pl.location <-> ${refSql}) ASC NULLS LAST, d.requested_at DESC, d.id DESC
     OFFSET 20 LIMIT 1`,
    [lat, lng],
  );
  if (knnAnchor.rows[0]) {
    assertGlobalKnnUsesGeographyGistOrderBy(
      await explainNodes(
        client,
        `SELECT d.id, d.requested_at,
           (pl.location <-> ${refSql}) AS order_distance_meters
         FROM locations pl
         INNER JOIN deliveries d ON d.pickup_location_id = pl.id
         WHERE d.status = 'WAITING_FOR_DRIVER'
           AND d.assigned_driver_profile_id IS NULL
           AND (
             (
               pl.location IS NOT NULL
               AND (
                 (pl.location <-> ${refSql}) > $3
                 OR (
                   (pl.location <-> ${refSql}) = $3
                   AND (
                     d.requested_at < $4
                     OR (d.requested_at = $4 AND d.id < $5)
                   )
                 )
               )
             )
             OR pl.location IS NULL
           )
         ORDER BY
           (pl.location <-> ${refSql}) ASC NULLS LAST,
           d.requested_at DESC,
           d.id DESC
         LIMIT 21`,
        [
          lat,
          lng,
          knnAnchor.rows[0].order_distance_meters,
          knnAnchor.rows[0].requested_at,
          knnAnchor.rows[0].id,
        ],
      ),
      `${label}_global_nearest_later`,
    );
  }

  // Radius nearest page one
  const radiusSql = `
    SELECT d.id, d.requested_at,
      (pl.location <-> ${refSql}) AS order_distance_meters
    FROM locations pl
    INNER JOIN deliveries d ON d.pickup_location_id = pl.id
    WHERE d.status = 'WAITING_FOR_DRIVER'
      AND d.assigned_driver_profile_id IS NULL
      AND pl.location IS NOT NULL
      AND ST_DWithin(pl.location, ${refSql}, 30000, false)
    ORDER BY
      (pl.location <-> ${refSql}) ASC NULLS LAST,
      d.requested_at DESC,
      d.id DESC
    LIMIT 21`;
  assertRadiusUsesGeographyGist(
    await explainNodes(client, radiusSql, [lat, lng]),
    `${label}_radius_nearest_page1`,
  );

  // Radius later page
  const radiusAnchor = await client.query<{
    id: string;
    requested_at: Date;
    order_distance_meters: number;
  }>(
    `SELECT d.id, d.requested_at, (pl.location <-> ${refSql}) AS order_distance_meters
     FROM locations pl
     INNER JOIN deliveries d ON d.pickup_location_id = pl.id
     WHERE d.status = 'WAITING_FOR_DRIVER'
       AND d.assigned_driver_profile_id IS NULL
       AND pl.location IS NOT NULL
       AND ST_DWithin(pl.location, ${refSql}, 30000, false)
     ORDER BY (pl.location <-> ${refSql}) ASC NULLS LAST, d.requested_at DESC, d.id DESC
     OFFSET 10 LIMIT 1`,
    [lat, lng],
  );
  if (radiusAnchor.rows[0]) {
    assertRadiusUsesGeographyGist(
      await explainNodes(
        client,
        `SELECT d.id, d.requested_at,
           (pl.location <-> ${refSql}) AS order_distance_meters
         FROM locations pl
         INNER JOIN deliveries d ON d.pickup_location_id = pl.id
         WHERE d.status = 'WAITING_FOR_DRIVER'
           AND d.assigned_driver_profile_id IS NULL
           AND pl.location IS NOT NULL
           AND ST_DWithin(pl.location, ${refSql}, 30000, false)
           AND (
             (pl.location <-> ${refSql}) > $3
             OR (
               (pl.location <-> ${refSql}) = $3
               AND (
                 d.requested_at < $4
                 OR (d.requested_at = $4 AND d.id < $5)
               )
             )
           )
         ORDER BY
           (pl.location <-> ${refSql}) ASC NULLS LAST,
           d.requested_at DESC,
           d.id DESC
         LIMIT 21`,
        [
          lat,
          lng,
          radiusAnchor.rows[0].order_distance_meters,
          radiusAnchor.rows[0].requested_at,
          radiusAnchor.rows[0].id,
        ],
      ),
      `${label}_radius_nearest_later`,
    );
  }

  // City/area nearest
  assertGlobalKnnUsesGeographyGistOrderBy(
    await explainNodes(
      client,
      `SELECT d.id, d.requested_at,
         (pl.location <-> ${refSql}) AS order_distance_meters
       FROM locations pl
       INNER JOIN deliveries d ON d.pickup_location_id = pl.id
       WHERE d.status = 'WAITING_FOR_DRIVER'
         AND d.assigned_driver_profile_id IS NULL
         AND lower(pl.city) = lower($3)
       ORDER BY
         (pl.location <-> ${refSql}) ASC NULLS LAST,
         d.requested_at DESC,
         d.id DESC
       LIMIT 21`,
      [lat, lng, 'Nablus'],
    ),
    `${label}_city_nearest`,
  );

  // Tie-breaker presence: duplicate requestedAt still uses waiting btree for newest.
  assertNewestUsesWaitingBtree(
    await explainNodes(
      client,
      `SELECT d.id FROM deliveries d
       INNER JOIN locations pl ON pl.id = d.pickup_location_id
       WHERE d.status='WAITING_FOR_DRIVER'
         AND d.assigned_driver_profile_id IS NULL
       ORDER BY d.requested_at DESC, d.id DESC
       LIMIT 5`,
    ),
    `${label}_requestedAt_id_tiebreak_newest`,
  );

  process.stdout.write(`${label}_explain_assertions=passed\n`);
};

const assertPostgisReady = async (client: pg.Client, label: string) => {
  const ext = await client.query(
    `SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis'`,
  );
  assert.equal(ext.rows.length, 1, `${label}: postgis missing`);
  process.stdout.write(`${label}_postgis=${ext.rows[0].extversion}\n`);

  const col = await client.query<{ typmod: string }>(`
    SELECT format_type(a.atttypid, a.atttypmod) AS typmod
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'locations' AND a.attname = 'location'
  `);
  assert.match(col.rows[0]!.typmod, /geography/i);

  const waiting = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE indexname = $1`,
    [waitingIndex],
  );
  assert.equal(waiting.rows.length, 1, `${label}: missing ${waitingIndex}`);
  assert.equal(waiting.rows[0]!.indexname, waitingIndex);
  assert.match(waiting.rows[0]!.indexdef, /WAITING_FOR_DRIVER/);
  assert.match(waiting.rows[0]!.indexdef, /assigned_driver_profile_id IS NULL/);

  const gist = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE indexname = $1`,
    [gistIndex],
  );
  assert.equal(gist.rows.length, 1, `${label}: missing ${gistIndex}`);
  assert.equal(gist.rows[0]!.indexname, gistIndex);
  assert.match(gist.rows[0]!.indexdef, /USING gist/i);

  const trigger = await client.query(
    `SELECT 1 FROM pg_trigger WHERE tgname = $1`,
    [syncTrigger],
  );
  assert.equal(trigger.rows.length, 1, `${label}: missing sync trigger`);

  const backfill = await client.query<{ missing: string }>(`
    SELECT COUNT(*) FILTER (
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND location IS NULL
    )::text AS missing
    FROM locations
  `);
  assert.equal(backfill.rows[0]!.missing, '0', `${label}: spatial backfill incomplete`);

  await client.query(`
    UPDATE locations
    SET latitude = 32.2211, longitude = 35.2611
    WHERE id = 'dr04-loc-a'
  `);
  const synced = await client.query<{ ok: boolean }>(`
    SELECT ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(35.2611, 32.2211), 4326)::geography,
      0.01,
      false
    ) AS ok
    FROM locations WHERE id = 'dr04-loc-a'
  `);
  assert.equal(synced.rows[0]?.ok, true, `${label}: sync trigger failed`);

  const statuses = await client.query<{ status: string; c: string }>(`
    SELECT status::text AS status, COUNT(*)::text AS c
    FROM deliveries
    WHERE id LIKE 'dr04-del-%'
    GROUP BY status
  `);
  const byStatus = Object.fromEntries(
    statuses.rows.map((row) => [row.status, Number(row.c)]),
  );
  assert.ok((byStatus.WAITING_FOR_DRIVER ?? 0) >= 4, `${label}: need waiting rows`);
  assert.ok((byStatus.DRIVER_ASSIGNED ?? 0) >= 1, `${label}: need assigned row`);
  assert.ok((byStatus.DELIVERED ?? 0) >= 1, `${label}: need terminal row`);

  await assertApplicationExplainPlans(client, label);
};

const admin = new pg.Client({ connectionString: baseUrl });
await admin.connect();
let emptyChainResult = 'not_attempted';

try {
  for (const database of Object.values(databases)) {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [database],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
  }

  // Populated: clone live local DB (has users/materials), strip DR-04, re-apply.
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [sourceDbName],
  );
  await admin.query(
    `CREATE DATABASE "${databases.populated}" TEMPLATE "${sourceDbName}"`,
  );

  await withDatabase(databases.populated, async (client) => {
    await stripDr04Artifacts(client);
    const before = await client.query(
      `SELECT 1 FROM pg_indexes WHERE indexname = ANY($1::text[])`,
      [[waitingIndex, gistIndex]],
    );
    assert.equal(before.rowCount, 0, 'populated still has DR-04 indexes');
    await seedRepresentativeRows(client);
  });

  applySqlFile(
    databases.populated,
    targetMigrationSql,
    `populated migration ${migrationName}`,
  );
  await withDatabase(databases.populated, (client) =>
    assertPostgisReady(client, 'populated'),
  );

  // Fresh empty migrate deploy (honest)
  await admin.query(`CREATE DATABASE "${databases.empty}" TEMPLATE template0`);
  const emptyDeploy = run(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'migrate', 'deploy'],
    {
      ...process.env,
      DATABASE_URL: databaseUrl(databases.empty),
    },
  );
  if (emptyDeploy.status === 0) {
    emptyChainResult = 'passed';
    process.stdout.write('fresh_empty_migrate_deploy=passed\n');
  } else {
    emptyChainResult = 'blocked';
    const detail = `${emptyDeploy.stdout ?? ''}\n${emptyDeploy.stderr ?? ''}`.slice(
      0,
      1200,
    );
    process.stdout.write('fresh_empty_migrate_deploy=blocked\n');
    process.stdout.write(
      'fresh_empty_note=Older unrelated migrations blocked empty-chain deploy; populated pre-DR-04 path verified instead. A current-schema dump is not a complete fresh migration chain.\n',
    );
    process.stdout.write(`fresh_empty_error=${JSON.stringify(detail)}\n`);
  }

  process.stdout.write(`empty_chain_result=${emptyChainResult}\n`);
  process.stdout.write('DR-04 PostGIS migration verification passed.\n');
} finally {
  for (const database of Object.values(databases)) {
    await admin
      .query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [database],
      )
      .catch(() => undefined);
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`).catch(() => undefined);
  }
  await admin
    .query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
       WHERE datname = 'dr04_knn_probe' AND pid <> pg_backend_pid()`,
    )
    .catch(() => undefined);
  await admin.query(`DROP DATABASE IF EXISTS dr04_knn_probe`).catch(() => undefined);
  await admin.end().catch(() => undefined);
  rmSync(verificationTemp, { recursive: true, force: true });
}
