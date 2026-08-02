import 'dotenv/config';

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const migrationName = '20260802160000_driver_profile_accepting_new_jobs';
const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) throw new Error('DATABASE_URL is required.');

const parsed = new URL(baseUrl);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
  throw new Error('DR-03 migration verification only runs against local PostgreSQL.');
}
if (/prod|production/i.test(parsed.pathname)) {
  throw new Error('DR-03 migration verification refuses production-like databases.');
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
const databases = {
  fresh: `dr03_verify_fresh_${suffix}`,
  legacy: `dr03_verify_legacy_${suffix}`,
};
for (const database of Object.values(databases)) {
  if (!/^dr03_verify_(fresh|legacy)_[a-f0-9]{10}$/.test(database)) {
    throw new Error('Unsafe temporary database name.');
  }
}

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const migrationsRoot = join(backendRoot, 'prisma', 'migrations');
const targetMigrationSql = join(
  migrationsRoot,
  migrationName,
  'migration.sql',
);
if (!existsSync(targetMigrationSql)) {
  throw new Error(`Missing migration ${migrationName}.`);
}

const migrationDirectories = readdirSync(migrationsRoot)
  .filter((entry) => {
    const path = join(migrationsRoot, entry);
    return statSync(path).isDirectory() && existsSync(join(path, 'migration.sql'));
  })
  .sort();
const targetIndex = migrationDirectories.indexOf(migrationName);
if (targetIndex < 1) {
  throw new Error('DR-03 migration does not have a valid predecessor history.');
}
if (targetIndex !== migrationDirectories.length - 1) {
  throw new Error(
    'DR-03 is not the latest migration; predecessor construction must be updated.',
  );
}

const postgresBins = [
  'C:/Program Files/PostgreSQL/18/bin',
  'C:/Program Files/PostgreSQL/17/bin',
];
const postgresBin = postgresBins.find((candidate) =>
  existsSync(join(candidate, 'psql.exe')) &&
  existsSync(join(candidate, 'pg_dump.exe')),
);
if (!postgresBin) throw new Error('Local PostgreSQL client tools are required.');

const verificationTemp = join(backendRoot, `.dr03-verify-${suffix}`);
mkdirSync(verificationTemp);
const predecessorSchemaDump = join(verificationTemp, 'pre-dr03-schema.sql');
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
const assertSucceeded = (
  label: string,
  result: ReturnType<typeof run>,
) => {
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

const legacyScenarios = [
  ['A', 'OFFLINE', false, 'OFFLINE', false],
  ['B', 'AVAILABLE', false, 'AVAILABLE', true],
  ['C', 'ON_DELIVERY', false, 'AVAILABLE', true],
  ['D', 'OFFLINE', true, 'ON_DELIVERY', false],
  ['E', 'AVAILABLE', true, 'ON_DELIVERY', true],
  ['F', 'ON_DELIVERY', true, 'ON_DELIVERY', true],
] as const;

const insertLegacyScenarios = (database: string) =>
  withDatabase(database, async (client) => {
    await client.query('SET session_replication_role = replica');
    try {
      for (const [scenario, availability, hasActiveDelivery] of legacyScenarios) {
        const profileId = `dr03-profile-${scenario.toLowerCase()}`;
        await client.query(
          `INSERT INTO "driver_profiles" (
            "id", "user_id", "display_name", "phone", "city", "area",
            "transportation_type", "status", "availability", "vehicle_type",
            "created_at", "updated_at"
          ) VALUES ($1, $2, $3, $4, 'Nablus', 'Rafidia', 'MOTORCYCLE',
            'ACTIVE', $5::"DriverAvailabilityStatus", 'MOTORCYCLE', NOW(), NOW())`,
          [
            profileId,
            `dr03-user-${scenario.toLowerCase()}`,
            `Legacy Driver ${scenario}`,
            `+97059910000${scenario.charCodeAt(0)}`,
            availability,
          ],
        );

        if (hasActiveDelivery) {
          await client.query(
            `INSERT INTO "deliveries" (
              "id", "reservation_id", "pickup_location_id",
              "dropoff_location_id", "assigned_driver_profile_id",
              "requested_by_user_id", "status", "requested_at",
              "created_at", "updated_at"
            ) VALUES ($1, $2, $3, $4, $5, $6, 'DRIVER_ASSIGNED',
              NOW(), NOW(), NOW())`,
            [
              `dr03-delivery-${scenario.toLowerCase()}`,
              `dr03-reservation-${scenario.toLowerCase()}`,
              `dr03-pickup-${scenario.toLowerCase()}`,
              `dr03-dropoff-${scenario.toLowerCase()}`,
              profileId,
              `dr03-requester-${scenario.toLowerCase()}`,
            ],
          );
        }
      }
    } finally {
      await client.query('SET session_replication_role = origin');
    }
  });

const verifyLegacyResults = (database: string) =>
  withDatabase(database, async (client) => {
    const result = await client.query<{
      id: string;
      availability: string;
      accepting_new_jobs: boolean;
    }>(
      `SELECT "id", "availability"::text, "accepting_new_jobs"
       FROM "driver_profiles"
       WHERE "id" LIKE 'dr03-profile-%'
       ORDER BY "id"`,
    );

    assert.equal(result.rows.length, legacyScenarios.length);
    for (const [scenario, , , expectedAvailability, expectedPreference] of legacyScenarios) {
      const row = result.rows.find(
        (candidate) => candidate.id === `dr03-profile-${scenario.toLowerCase()}`,
      );
      assert.ok(row, `Missing scenario ${scenario}`);
      assert.equal(row.accepting_new_jobs, expectedPreference, scenario);
      assert.equal(row.availability, expectedAvailability, scenario);
      process.stdout.write(
        `scenario_${scenario}=acceptingNewJobs:${expectedPreference},availability:${expectedAvailability}\n`,
      );
    }

    const index = await client.query<{ indexname: string }>(
      `SELECT "indexname" FROM "pg_indexes"
       WHERE "schemaname" = 'public'
         AND "tablename" = 'driver_profiles'
         AND "indexname" = 'driver_profiles_status_accepting_new_jobs_idx'`,
    );
    assert.equal(index.rows.length, 1);
    process.stdout.write('status_accepting_new_jobs_index=present\n');
  });

const admin = new pg.Client({ connectionString: baseUrl });
await admin.connect();
try {
  assertSucceeded(
    'current schema-only export',
    run(join(postgresBin, 'pg_dump.exe'), [
      '--schema-only',
      '--no-owner',
      '--no-privileges',
      '--file',
      predecessorSchemaDump,
      postgresUrl(baseUrl),
    ]),
  );

  for (const database of Object.values(databases)) {
    await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
    applySqlFile(
      database,
      predecessorSchemaDump,
      `${database} schema-only import`,
    );
    await withDatabase(database, async (client) => {
      await client.query(
        'DROP INDEX IF EXISTS "driver_profiles_status_accepting_new_jobs_idx"',
      );
      await client.query(
        'ALTER TABLE "driver_profiles" DROP COLUMN IF EXISTS "accepting_new_jobs"',
      );
      const predecessor = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS "count"
         FROM "information_schema"."columns"
         WHERE "table_schema" = 'public'
           AND "table_name" = 'driver_profiles'
           AND "column_name" = 'accepting_new_jobs'`,
      );
      assert.equal(Number(predecessor.rows[0]?.count ?? 0), 0);
    });
  }

  applySqlFile(
    databases.fresh,
    targetMigrationSql,
    `fresh migration ${migrationName}`,
  );
  await withDatabase(databases.fresh, async (client) => {
    const column = await client.query<{
      column_default: string | null;
      is_nullable: string;
    }>(
      `SELECT "column_default", "is_nullable"
       FROM "information_schema"."columns"
       WHERE "table_schema" = 'public'
         AND "table_name" = 'driver_profiles'
         AND "column_name" = 'accepting_new_jobs'`,
    );
    assert.equal(column.rows.length, 1);
    assert.match(column.rows[0]?.column_default ?? '', /false/i);
    assert.equal(column.rows[0]?.is_nullable, 'NO');
    const index = await client.query<{ indexname: string }>(
      `SELECT "indexname" FROM "pg_indexes"
       WHERE "schemaname" = 'public'
         AND "tablename" = 'driver_profiles'
         AND "indexname" = 'driver_profiles_status_accepting_new_jobs_idx'`,
    );
    assert.equal(index.rows.length, 1);
    process.stdout.write('fresh_default=false,fresh_index=present\n');
  });

  await insertLegacyScenarios(databases.legacy);
  applySqlFile(
    databases.legacy,
    targetMigrationSql,
    `legacy migration ${migrationName}`,
  );
  await verifyLegacyResults(databases.legacy);

  const verificationEnv = join(verificationTemp, 'verification.env');
  writeFileSync(
    verificationEnv,
    `DATABASE_URL=${databaseUrl(databases.fresh)}\n`,
    'utf8',
  );
  const isolatedEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl(databases.fresh),
    IMPACTLOOP_BACKEND_ENV_FILE_PATH: verificationEnv,
  };

  const invitationTest = run(
    process.execPath,
    [
      '--import',
      'tsx',
      '--test',
      '--test-name-pattern=accept DRIVER creates user, role, and driver profile',
      'src/modules/invitations/invitations.test.ts',
    ],
    isolatedEnv,
  );
  assertSucceeded('invitation default integration test', invitationTest);
  process.stdout.write('invitation_default=acceptingNewJobs:false,availability:OFFLINE\n');

  const seed = run(
    process.execPath,
    ['--import', 'tsx', 'prisma/seed.ts'],
    isolatedEnv,
  );
  assertSucceeded('fresh demo seed', seed);

  await withDatabase(databases.fresh, async (client) => {
    const seeded = await client.query<{
      driver_count: string;
      matching_count: string;
    }>(
      `SELECT COUNT(*)::text AS "driver_count",
              COUNT(*) FILTER (
                WHERE dp."accepting_new_jobs" = TRUE
                  AND dp."availability" = 'AVAILABLE'
              )::text AS "matching_count"
       FROM "driver_profiles" dp
       JOIN "users" u ON u."id" = dp."user_id"
       WHERE u."email" IN ('majd@driver.com', 'israa@driver.com', 'driver@driver.com')`,
    );
    const driverCount = Number(seeded.rows[0]?.driver_count ?? 0);
    const matchingCount = Number(seeded.rows[0]?.matching_count ?? 0);
    assert.ok(driverCount > 0, 'Demo seed created no Driver profiles.');
    assert.equal(matchingCount, driverCount);
    process.stdout.write(
      `seeded_demo_drivers=${driverCount},acceptingNewJobs:true,availability:AVAILABLE\n`,
    );
  });

  process.stdout.write('fresh_migration=applied legacy_migration=applied cleanup=pending\n');
} finally {
  for (const database of Object.values(databases)) {
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [database],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
  }
  const remaining = await admin.query<{ count: string }>(
    `SELECT COUNT(*)::text AS "count"
     FROM "pg_database"
     WHERE "datname" LIKE 'dr03_verify_%'`,
  );
  assert.equal(Number(remaining.rows[0]?.count ?? 0), 0);
  await admin.end();
  rmSync(verificationTemp, { force: true, recursive: true });
  process.stdout.write('cleanup=complete,remaining_temp_databases=0\n');
}
