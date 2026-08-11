/**
 * DR-04 disposable Available Jobs / notification scale benchmark.
 *
 * Usage:
 *   npx tsx scripts/bench-driver-query-scale.ts
 *   npx tsx scripts/bench-driver-query-scale.ts --keep
 *
 * Creates impactloop_dr04_bench from the local DATABASE_URL template, seeds
 * deterministic synthetic operational rows, measures query shapes, then drops
 * the database unless --keep is passed.
 *
 * Local numbers are not production guarantees.
 *
 * Safety:
 * - localhost-only source DATABASE_URL
 * - never targets CI/test/E2E/production-like sources
 * - never terminates the source/developer database (fail if busy)
 * - only terminate/drop the disposable bench database
 */
import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';

import {
  assertBenchmarkDatabaseNameForDestructiveOps,
  assertSafeDriverBenchmarkSource,
} from './lib/local-database-guard.mjs';
import {
  adminDatabaseUrl,
  assertDisposableDatabaseName,
  databaseUrlFor,
  prepareTemplateClone,
  terminateDatabaseConnections,
} from './driver-e2e-db.js';

const SOURCE_URL = process.env.DATABASE_URL;
const BENCH_DB = 'impactloop_dr04_bench';

const benchSafety = assertSafeDriverBenchmarkSource(SOURCE_URL, BENCH_DB);
assertDisposableDatabaseName(BENCH_DB);

const adminUrl = new URL(adminDatabaseUrl(SOURCE_URL!));
const benchUrl = new URL(databaseUrlFor(SOURCE_URL!, BENCH_DB));
const sourceDbName = benchSafety.sourceDatabaseName;
const keep = process.argv.includes('--keep');

const cuid = (() => {
  let n = 0;
  return (prefix = 'b') => {
    n += 1;
    return (
      prefix +
      createHash('sha1')
        .update(`${prefix}-${n}-${randomBytes(4).toString('hex')}`)
        .digest('hex')
        .slice(0, 22)
    );
  };
})();

const q = async (client: pg.Client, sql: string, params: unknown[] = []) =>
  (await client.query(sql, params)).rows;

const timed = async <T>(
  label: string,
  fn: () => Promise<T>,
  repeats = 7,
) => {
  const samples: number[] = [];
  let last!: T;
  for (let i = 0; i < repeats; i += 1) {
    const t0 = performance.now();
    last = await fn();
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const at = (p: number) =>
    samples[Math.min(samples.length - 1, Math.floor((p / 100) * samples.length))]!;
  return {
    label,
    medianMs: Number(at(50).toFixed(2)),
    p95Ms: Number(at(95).toFixed(2)),
    result: last,
  };
};

const withAdmin = async <T>(fn: (client: pg.Client) => Promise<T>) => {
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
};

const ensureBenchDb = async () => {
  await withAdmin(async (admin) => {
    // Reuse DR-05 TEMPLATE clone safety: terminate only the disposable bench DB;
    // refuse if the source/developer DB still has open clients.
    await prepareTemplateClone(admin, {
      sourceDb: sourceDbName,
      e2eDatabaseName: BENCH_DB,
    });
  });
  console.log('CREATED', BENCH_DB, '(template from', sourceDbName + ')');
};

const dropBenchDb = async () => {
  assertBenchmarkDatabaseNameForDestructiveOps(BENCH_DB);
  await withAdmin(async (admin) => {
    await terminateDatabaseConnections(admin, BENCH_DB);
    await admin.query(`DROP DATABASE IF EXISTS "${BENCH_DB}"`);
  });
  console.log('DROPPED', BENCH_DB);
};

const seed = async (client: pg.Client) => {
  const drivers = 150;
  const waiting = 3000;
  const historicalPerDriver = 40;
  const pingsPerDelivery = 5;
  const reportsPerDriver = 15;

  await client.query('SET session_replication_role = replica');
  await client.query('DELETE FROM delivery_location_pings');
  await client.query('DELETE FROM delivery_pickup_items');
  await client.query('DELETE FROM delivery_status_history');
  await client.query('DELETE FROM delivery_assignments');
  await client.query('DELETE FROM no_show_reports');
  await client.query('DELETE FROM deliveries');
  await client.query(
    `UPDATE materials SET reused_by_reservation_id = NULL WHERE reused_by_reservation_id IS NOT NULL`,
  );
  await client.query('DELETE FROM reservations');
  await client.query('DELETE FROM delivery_groups');
  await client.query('SET session_replication_role = DEFAULT');

  await client.query(`
    CREATE TEMP TABLE tmp_locs AS
    SELECT id, city, latitude::float8 AS lat, longitude::float8 AS lng,
           row_number() OVER () AS rn
    FROM locations
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL
    LIMIT 400
  `);
  await client.query(`
    CREATE TEMP TABLE tmp_materials AS
    SELECT id, owner_id, row_number() OVER () AS rn FROM materials LIMIT 80
  `);
  await client.query(`
    CREATE TEMP TABLE tmp_learners AS
    SELECT u.id, row_number() OVER () AS rn
    FROM users u
    LEFT JOIN driver_profiles dp ON dp.user_id = u.id
    WHERE dp.id IS NULL
    LIMIT 40
  `);

  const locCount = (await q(client, `SELECT count(*)::int AS c FROM tmp_locs`))[0].c;
  const matCount = (await q(client, `SELECT count(*)::int AS c FROM tmp_materials`))[0].c;
  let learners = (await q(client, `SELECT count(*)::int AS c FROM tmp_learners`))[0].c;
  if (learners < 5) {
    for (let i = 0; i < 10; i += 1) {
      const id = cuid('l');
      await client.query(
        `INSERT INTO users (id, email, password_hash, display_name, phone, account_status, active_role, created_at, updated_at)
         VALUES ($1,$2,'bench',$3,$4,'ACTIVE','LEARNER',NOW(),NOW())`,
        [id, `dr04.l.${i}@example.test`, `Learner ${i}`, `0597000${String(i).padStart(3, '0')}`],
      );
    }
    await client.query('DROP TABLE tmp_learners');
    await client.query(`
      CREATE TEMP TABLE tmp_learners AS
      SELECT u.id, row_number() OVER () AS rn
      FROM users u
      LEFT JOIN driver_profiles dp ON dp.user_id = u.id
      WHERE dp.id IS NULL
      LIMIT 40
    `);
    learners = (await q(client, `SELECT count(*)::int AS c FROM tmp_learners`))[0].c;
  }

  const existingDrivers = (await q(client, `SELECT count(*)::int AS c FROM driver_profiles`))[0].c;
  for (let i = existingDrivers; i < drivers; i += 1) {
    const userId = cuid('u');
    const profileId = cuid('dp');
    await client.query(
      `INSERT INTO users (id, email, password_hash, display_name, phone, account_status, active_role, created_at, updated_at)
       VALUES ($1,$2,'bench',$3,$4,'ACTIVE','DRIVER',NOW(),NOW())`,
      [userId, `dr04.d.${i}@example.test`, `Driver ${i}`, `0598000${String(i).padStart(3, '0')}`],
    );
    await client.query(
      `INSERT INTO user_roles (id, user_id, role, is_primary, created_at)
       VALUES ($1,$2,'DRIVER',true,NOW())`,
      [cuid('ur'), userId],
    );
    const loc = (
      await q(client, `SELECT city FROM tmp_locs WHERE rn = $1`, [(i % locCount) + 1])
    )[0];
    await client.query(
      `INSERT INTO driver_profiles (
         id, user_id, display_name, phone, city, area, transportation_type,
         status, availability, accepting_new_jobs, vehicle_type, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,'Center','CAR','ACTIVE','AVAILABLE',true,'CAR',NOW(),NOW())`,
      [profileId, userId, `Driver ${i}`, `0598000${String(i).padStart(3, '0')}`, loc.city],
    );
  }

  await client.query(
    `UPDATE driver_profiles SET accepting_new_jobs = true, status = 'ACTIVE', availability = 'AVAILABLE'`,
  );
  await client.query(`
    CREATE TEMP TABLE tmp_drivers AS
    SELECT id, user_id, row_number() OVER (ORDER BY created_at, id) AS rn
    FROM driver_profiles
    LIMIT $1
  `, [drivers]);

  await client.query(
    `
    WITH seq AS (SELECT generate_series(1, $1) AS i),
    ins_res AS (
      INSERT INTO reservations (
        id, material_id, owner_id, requester_id, quantity_requested,
        status, fulfillment_method, created_at, updated_at
      )
      SELECT 'rw' || lpad(i::text, 10, '0'), m.id, m.owner_id, l.id, 1,
             'ACCEPTED', 'DELIVERY', NOW(), NOW()
      FROM seq
      JOIN tmp_materials m ON m.rn = ((i - 1) % $2) + 1
      JOIN tmp_learners l ON l.rn = ((i - 1) % $3) + 1
      RETURNING id, (substring(id from 3)::int) AS i
    )
    INSERT INTO deliveries (
      id, reservation_id, pickup_location_id, dropoff_location_id,
      requested_by_user_id, status, requested_at, created_at, updated_at
    )
    SELECT 'dw' || lpad(r.i::text, 10, '0'), r.id, p.id, d.id, l.id,
           'WAITING_FOR_DRIVER', NOW() - (r.i || ' minutes')::interval, NOW(),
           NOW() - (r.i || ' minutes')::interval
    FROM ins_res r
    JOIN tmp_locs p ON p.rn = ((r.i - 1) % $4) + 1
    JOIN tmp_locs d ON d.rn = ((r.i + 5) % $4) + 1
    JOIN tmp_learners l ON l.rn = ((r.i - 1) % $3) + 1
  `,
    [waiting, matCount, learners, locCount],
  );

  const historicalTotal = drivers * historicalPerDriver;
  await client.query(
    `
    WITH seq AS (SELECT generate_series(1, $1) AS i),
    mapped AS (
      SELECT i, ((i - 1) % $2) + 1 AS driver_rn FROM seq
    ),
    ins_res AS (
      INSERT INTO reservations (
        id, material_id, owner_id, requester_id, quantity_requested,
        status, fulfillment_method, created_at, updated_at
      )
      SELECT 'rh' || lpad(m.i::text, 10, '0'), mat.id, mat.owner_id, l.id, 1,
             'COMPLETED', 'DELIVERY', NOW(), NOW()
      FROM mapped m
      JOIN tmp_materials mat ON mat.rn = ((m.i - 1) % $3) + 1
      JOIN tmp_learners l ON l.rn = ((m.i - 1) % $4) + 1
      RETURNING id, (substring(id from 3)::int) AS i
    ),
    ins_del AS (
      INSERT INTO deliveries (
        id, reservation_id, pickup_location_id, dropoff_location_id,
        requested_by_user_id, status, requested_at, delivered_at, created_at, updated_at
      )
      SELECT 'dh' || lpad(r.i::text, 10, '0'), r.id, p.id, d.id, l.id, 'DELIVERED',
             NOW() - (r.i || ' hours')::interval, NOW() - (r.i || ' hours')::interval,
             NOW(), NOW() - (r.i || ' hours')::interval
      FROM ins_res r
      JOIN tmp_locs p ON p.rn = ((r.i - 1) % $5) + 1
      JOIN tmp_locs d ON d.rn = ((r.i + 2) % $5) + 1
      JOIN tmp_learners l ON l.rn = ((r.i - 1) % $4) + 1
      RETURNING id, (substring(id from 3)::int) AS i
    )
    INSERT INTO delivery_assignments (
      id, delivery_id, driver_profile_id, status, accepted_at, released_at, created_at
    )
    SELECT 'ah' || lpad(d.i::text, 10, '0'), d.id, dr.id, 'RELEASED',
           NOW() - ((d.i + 1) || ' hours')::interval,
           NOW() - (d.i || ' hours')::interval, NOW()
    FROM ins_del d
    JOIN mapped m ON m.i = d.i
    JOIN tmp_drivers dr ON dr.rn = m.driver_rn
  `,
    [historicalTotal, drivers, matCount, learners, locCount],
  );

  await client.query(
    `
    INSERT INTO no_show_reports (
      id, reservation_id, delivery_id, reporter_user_id, target_role,
      reason_code, status, created_at
    )
    SELECT 'ns' || lpad(substring(d.id from 3)::text, 10, '0'),
           d.reservation_id, d.id, dr.user_id, 'SUPPLIER',
           'SUPPLIER_UNAVAILABLE', 'PENDING_REVIEW', d.updated_at
    FROM deliveries d
    JOIN delivery_assignments a ON a.delivery_id = d.id AND a.id LIKE 'ah%'
    JOIN tmp_drivers dr ON dr.id = a.driver_profile_id
    WHERE d.id LIKE 'dh%'
      AND ((substring(d.id from 3)::int - 1) / $1) < $2
  `,
    [drivers, reportsPerDriver],
  );

  // Extra prior-assignment noise so assignment volume exceeds 8k at default scale.
  await client.query(
    `
    INSERT INTO delivery_assignments (
      id, delivery_id, driver_profile_id, status, accepted_at, released_at, created_at
    )
    SELECT
      'ax' || lpad(substring(d.id from 3)::text, 10, '0'),
      d.id,
      dr2.id,
      'RELEASED',
      d.updated_at - interval '2 hours',
      d.updated_at - interval '1 hour',
      NOW()
    FROM deliveries d
    JOIN delivery_assignments a ON a.delivery_id = d.id AND a.id LIKE 'ah%'
    JOIN tmp_drivers dr ON dr.id = a.driver_profile_id
    JOIN tmp_drivers dr2 ON dr2.rn = ((dr.rn % $1) + 1)
    WHERE d.id LIKE 'dh%'
      AND (substring(d.id from 3)::int % 2) = 0
  `,
    [drivers],
  );

  await client.query(
    `
    INSERT INTO delivery_location_pings (
      id, delivery_id, driver_profile_id, latitude, longitude, captured_at, created_at
    )
    SELECT 'pg' || lpad((row_number() OVER ())::text, 12, '0'),
           d.id, a.driver_profile_id, p.lat, p.lng,
           NOW() - (gs.n || ' minutes')::interval, NOW()
    FROM deliveries d
    JOIN delivery_assignments a ON a.delivery_id = d.id AND a.id LIKE 'ah%'
    JOIN tmp_locs p ON p.id = d.pickup_location_id
    CROSS JOIN generate_series(0, $1 - 1) AS gs(n)
    WHERE d.id LIKE 'dh%' AND (substring(d.id from 3)::int % 4) = 0
  `,
    [pingsPerDelivery],
  );

  await client.query('ANALYZE deliveries');
  await client.query('ANALYZE delivery_assignments');
  await client.query('ANALYZE delivery_location_pings');
  await client.query('ANALYZE no_show_reports');
  await client.query('ANALYZE driver_profiles');

  const counts = await q(
    client,
    `
    SELECT 'deliveries' t, count(*)::bigint c FROM deliveries
    UNION ALL SELECT 'waiting', count(*) FROM deliveries
      WHERE status='WAITING_FOR_DRIVER' AND assigned_driver_profile_id IS NULL
    UNION ALL SELECT 'assignments', count(*) FROM delivery_assignments
    UNION ALL SELECT 'pings', count(*) FROM delivery_location_pings
    UNION ALL SELECT 'reports', count(*) FROM no_show_reports
    UNION ALL SELECT 'drivers', count(*) FROM driver_profiles
  `,
  );
  console.log(
    'DATASET',
    JSON.stringify(counts, (_, v) => (typeof v === 'bigint' ? v.toString() : v)),
  );

  const driver = (await q(client, `SELECT id, user_id FROM tmp_drivers ORDER BY rn LIMIT 1`))[0];
  const loc = (await q(client, `SELECT city, lat, lng FROM tmp_locs ORDER BY rn LIMIT 1`))[0];
  return { driverId: driver.id as string, userId: driver.user_id as string, loc };
};

const measure = async (
  client: pg.Client,
  ctx: { driverId: string; userId: string; loc: { city: string; lat: number; lng: number } },
) => {
  const memBefore = process.memoryUsage().heapUsed;
  const { driverId, userId, loc } = ctx;

  const newestPage1 = await timed('available_newest_limit21', async () => {
    const rows = await q(
      client,
      `SELECT d.id FROM deliveries d
       JOIN locations pl ON pl.id = d.pickup_location_id
       WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
       ORDER BY d.requested_at DESC, d.id DESC LIMIT 21`,
    );
    return { rows: rows.length };
  });

  const mid = await q(
    client,
    `SELECT d.requested_at, d.id FROM deliveries d
     WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
     ORDER BY d.requested_at DESC, d.id DESC OFFSET 40 LIMIT 1`,
  );
  const newestLater = await timed('available_newest_later', async () => {
    if (!mid[0]) return { rows: 0 };
    const rows = await q(
      client,
      `SELECT d.id FROM deliveries d
       WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
         AND (d.requested_at < $1 OR (d.requested_at = $1 AND d.id < $2))
       ORDER BY d.requested_at DESC, d.id DESC LIMIT 21`,
      [mid[0].requested_at, mid[0].id],
    );
    return { rows: rows.length };
  });

  const cityPage = await timed('available_city_limit21', async () => {
    const rows = await q(
      client,
      `SELECT d.id FROM deliveries d
       JOIN locations pl ON pl.id = d.pickup_location_id
       WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
         AND lower(pl.city) = lower($1)
       ORDER BY d.requested_at DESC, d.id DESC LIMIT 21`,
      [loc.city],
    );
    return { rows: rows.length };
  });

  const refGeog = `ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography`;

  // Baseline: original Node-style load-all candidate ids (distance computed later in app).
  const loadAllNearest = await timed('baseline_load_all_waiting_ids', async () => {
    const rows = await q(
      client,
      `SELECT d.id, pl.latitude::float8 AS lat, pl.longitude::float8 AS lng
       FROM deliveries d
       JOIN locations pl ON pl.id = d.pickup_location_id
       WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL`,
    );
    return { rows: rows.length, transferredToNode: rows.length };
  });

  // Intermediate: manual SQL Haversine (superseded geographic approach).
  const manualHaversineRadius = await timed('manual_sql_haversine_radius_limit21', async () => {
    const rows = await q(
      client,
      `SELECT d.id FROM deliveries d
       JOIN locations pl ON pl.id = d.pickup_location_id
       WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
         AND pl.latitude IS NOT NULL AND pl.longitude IS NOT NULL
         AND (
           6371 * 2 * ASIN(SQRT(
             POWER(SIN(RADIANS(pl.latitude::float8 - $1)/2),2)
             + COS(RADIANS($1))*COS(RADIANS(pl.latitude::float8))
               * POWER(SIN(RADIANS(pl.longitude::float8 - $2)/2),2)
           ))
         ) <= 30
       ORDER BY
         (
           6371 * 2 * ASIN(SQRT(
             POWER(SIN(RADIANS(pl.latitude::float8 - $1)/2),2)
             + COS(RADIANS($1))*COS(RADIANS(pl.latitude::float8))
               * POWER(SIN(RADIANS(pl.longitude::float8 - $2)/2),2)
           ))
         ) ASC,
         d.requested_at DESC, d.id DESC
       LIMIT 21`,
      [loc.lat, loc.lng],
    );
    return { rows: rows.length, transferredToNode: rows.length };
  });

  const nearestRadius = await timed('postgis_nearest_radius_limit21', async () => {
    const rows = await q(
      client,
      `SELECT d.id,
              (pl.location <-> ${refGeog}) AS order_distance_meters
       FROM locations pl
       INNER JOIN deliveries d ON d.pickup_location_id = pl.id
       WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
         AND pl.location IS NOT NULL
         AND ST_DWithin(pl.location, ${refGeog}, 30000, false)
       ORDER BY
         (pl.location <-> ${refGeog}) ASC NULLS LAST,
         d.requested_at DESC, d.id DESC
       LIMIT 21`,
      [loc.lat, loc.lng],
    );
    return { rows: rows.length, transferredToNode: rows.length };
  });

  const nearestGlobal = await timed('postgis_nearest_global_limit21', async () => {
    const rows = await q(
      client,
      `SELECT d.id,
              (pl.location <-> ${refGeog}) AS order_distance_meters
       FROM locations pl
       INNER JOIN deliveries d ON d.pickup_location_id = pl.id
       WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
       ORDER BY
         (pl.location <-> ${refGeog}) ASC NULLS LAST,
         d.requested_at DESC, d.id DESC
       LIMIT 21`,
      [loc.lat, loc.lng],
    );
    return { rows: rows.length, transferredToNode: rows.length };
  });

  const nearestRadiusLater = await timed('postgis_nearest_radius_later', async () => {
    const first = await q(
      client,
      `SELECT d.id,
              (pl.location <-> ${refGeog}) AS order_distance_meters,
              d.requested_at
       FROM locations pl
       INNER JOIN deliveries d ON d.pickup_location_id = pl.id
       WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
         AND pl.location IS NOT NULL
         AND ST_DWithin(pl.location, ${refGeog}, 30000, false)
       ORDER BY (pl.location <-> ${refGeog}) ASC NULLS LAST, d.requested_at DESC, d.id DESC
       LIMIT 1 OFFSET 20`,
      [loc.lat, loc.lng],
    );
    if (!first[0]) return { rows: 0, transferredToNode: 0 };
    const rows = await q(
      client,
      `SELECT d.id FROM locations pl
       INNER JOIN deliveries d ON d.pickup_location_id = pl.id
       WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
         AND pl.location IS NOT NULL
         AND ST_DWithin(pl.location, ${refGeog}, 30000, false)
         AND (
           (pl.location <-> ${refGeog}) > $3
           OR (
             (pl.location <-> ${refGeog}) = $3
             AND (
               d.requested_at < $4
               OR (d.requested_at = $4 AND d.id < $5)
             )
           )
         )
       ORDER BY (pl.location <-> ${refGeog}) ASC NULLS LAST, d.requested_at DESC, d.id DESC
       LIMIT 21`,
      [loc.lat, loc.lng, first[0].order_distance_meters, first[0].requested_at, first[0].id],
    );
    return { rows: rows.length, transferredToNode: rows.length };
  });

  const counts = await timed('available_counts_postgis', async () => {
    const rows = await q(
      client,
      `SELECT
         COUNT(*)::int AS total_count,
         COUNT(*) FILTER (
           WHERE pl.location IS NOT NULL
             AND ST_DWithin(pl.location, ${refGeog}, 30000, false)
         )::int AS nearby_count
       FROM deliveries d
       JOIN locations pl ON pl.id = d.pickup_location_id
       WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL`,
      [loc.lat, loc.lng],
    );
    return {
      total: rows[0].total_count,
      nearby: rows[0].nearby_count,
      queries: 1,
    };
  });
  const notifySet = await timed('notify_set_based', async () => {
    const rows = await q(
      client,
      `SELECT dp.user_id
       FROM driver_profiles dp
       JOIN users u ON u.id = dp.user_id
       LEFT JOIN (
         SELECT assigned_driver_profile_id AS driver_id, count(*)::int AS active_count
         FROM deliveries
         WHERE status IN ('DRIVER_ASSIGNED','ARRIVED_PICKUP','PICKED_UP','ON_THE_WAY','ARRIVED_DROPOFF')
           AND assigned_driver_profile_id IS NOT NULL
         GROUP BY assigned_driver_profile_id
       ) a ON a.driver_id = dp.id
       WHERE dp.status='ACTIVE' AND dp.accepting_new_jobs=true AND u.account_status='ACTIVE'
         AND COALESCE(a.active_count,0) < 3`,
    );
    return { eligible: rows.length, queries: 1 };
  });

  const active = await timed('active_list', async () => {
    const rows = await q(
      client,
      `SELECT id FROM deliveries
       WHERE assigned_driver_profile_id = $1
         AND status IN ('DRIVER_ASSIGNED','ARRIVED_PICKUP','PICKED_UP','ON_THE_WAY','ARRIVED_DROPOFF')`,
      [driverId],
    );
    return { rows: rows.length };
  });

  const history1 = await timed('history_page1', async () => {
    const rows = await q(
      client,
      `SELECT d.id FROM deliveries d
       WHERE EXISTS (
         SELECT 1 FROM delivery_assignments a
         WHERE a.delivery_id = d.id AND a.driver_profile_id = $1
       )
       AND NOT (
         d.assigned_driver_profile_id = $1
         AND d.status IN ('DRIVER_ASSIGNED','ARRIVED_PICKUP','PICKED_UP','ON_THE_WAY','ARRIVED_DROPOFF')
       )
       ORDER BY d.updated_at DESC, d.id DESC LIMIT 21`,
      [driverId],
    );
    return { rows: rows.length };
  });

  const incidents1 = await timed('incidents_page1', async () => {
    const rows = await q(
      client,
      `SELECT id FROM no_show_reports
       WHERE reporter_user_id = $1
       ORDER BY created_at DESC, id DESC LIMIT 21`,
      [userId],
    );
    return { rows: rows.length };
  });

  const latestPing = await timed('latest_ping', async () => {
    const rows = await q(
      client,
      `SELECT latitude FROM delivery_location_pings
       WHERE driver_profile_id = $1
         AND captured_at >= NOW() - INTERVAL '24 hours'
       ORDER BY captured_at DESC LIMIT 1`,
      [driverId],
    );
    return { rows: rows.length };
  });

  const planNewest = await q(
    client,
    `EXPLAIN (FORMAT JSON)
     SELECT d.id FROM deliveries d
     WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
     ORDER BY d.requested_at DESC, d.id DESC LIMIT 21`,
  );
  const planRadius = await q(
    client,
    `EXPLAIN (FORMAT JSON)
     SELECT d.id, (pl.location <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS order_distance_meters
     FROM locations pl
     INNER JOIN deliveries d ON d.pickup_location_id = pl.id
     WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
       AND pl.location IS NOT NULL
       AND ST_DWithin(
         pl.location,
         ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
         30000,
         false
       )
     ORDER BY
       (pl.location <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) ASC NULLS LAST,
       d.requested_at DESC, d.id DESC
     LIMIT 21`,
    [loc.lat, loc.lng],
  );
  const planKnn = await q(
    client,
    `EXPLAIN (FORMAT JSON)
     SELECT d.id, (pl.location <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) AS order_distance_meters
     FROM locations pl
     INNER JOIN deliveries d ON d.pickup_location_id = pl.id
     WHERE d.status='WAITING_FOR_DRIVER' AND d.assigned_driver_profile_id IS NULL
     ORDER BY
       (pl.location <-> ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) ASC NULLS LAST,
       d.requested_at DESC, d.id DESC
     LIMIT 21`,
    [loc.lat, loc.lng],
  );

  const walk = (node: unknown, acc: Array<Record<string, unknown>> = []) => {
    if (!node || typeof node !== 'object') return acc;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, acc);
      return acc;
    }
    const record = node as Record<string, unknown>;
    if (typeof record['Node Type'] === 'string') acc.push(record);
    if (record.Plans) walk(record.Plans, acc);
    if (record.Plan) walk(record.Plan, acc);
    return acc;
  };

  const summarizePlan = (plan: unknown) => {
    const nodes = walk(plan);
    return {
      usesWaitingBtree: nodes.some(
        (n) =>
          (n['Node Type'] === 'Index Scan' || n['Node Type'] === 'Index Only Scan') &&
          n['Index Name'] === 'deliveries_waiting_unassigned_requested_at_id_idx',
      ),
      usesGeographyGist: nodes.some(
        (n) =>
          (n['Node Type'] === 'Index Scan' || n['Node Type'] === 'Bitmap Index Scan') &&
          n['Index Name'] === 'locations_geography_gist_idx',
      ),
      knnOrderByGist: nodes.some(
        (n) =>
          n['Node Type'] === 'Index Scan' &&
          n['Index Name'] === 'locations_geography_gist_idx' &&
          typeof n['Order By'] === 'string' &&
          String(n['Order By']).includes('<->'),
      ),
      snippet: JSON.stringify(plan).slice(0, 400),
    };
  };

  const memAfter = process.memoryUsage().heapUsed;
  const out = {
    newestPage1,
    newestLater,
    cityPage,
    loadAllNearest,
    manualHaversineRadius,
    nearestRadius,
    nearestRadiusLater,
    nearestGlobal,
    counts,
    notifySet,
    active,
    history1,
    incidents1,
    latestPing,
    heapDeltaMb: Number(((memAfter - memBefore) / (1024 * 1024)).toFixed(2)),
    explainNewest: summarizePlan(planNewest[0]?.['QUERY PLAN']),
    explainRadius: summarizePlan(planRadius[0]?.['QUERY PLAN']),
    explainKnn: summarizePlan(planKnn[0]?.['QUERY PLAN']),
    caveat:
      'Local disposable PostgreSQL benchmark only. Not a production SLA.',
  };
  console.log('MEASUREMENTS', JSON.stringify(out, null, 2));
};

const main = async () => {
  assertBenchmarkDatabaseNameForDestructiveOps(
    decodeURIComponent(benchUrl.pathname.replace(/^\//, '')),
  );
  await ensureBenchDb();
  const client = new pg.Client({ connectionString: benchUrl.toString() });
  await client.connect();
  try {
    const ctx = await seed(client);
    await measure(client, ctx);
  } finally {
    await client.end();
  }
  if (!keep) await dropBenchDb();
  else console.log(`Retained ${BENCH_DB}; re-run without --keep or drop manually.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
