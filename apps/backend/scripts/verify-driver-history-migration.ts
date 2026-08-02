import 'dotenv/config';

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const migrationName = '20260802120000_driver_history_incident_evidence';
const baseUrl = process.env.DATABASE_URL;
if (!baseUrl) throw new Error('DATABASE_URL is required.');

const parsed = new URL(baseUrl);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
  throw new Error('DR-02 migration verification only runs against local PostgreSQL.');
}
if (/prod|production/i.test(parsed.pathname)) {
  throw new Error('DR-02 migration verification refuses production-like databases.');
}

const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
const databases = {
  fresh: `dr02_verify_fresh_${suffix}`,
  legacy: `dr02_verify_legacy_${suffix}`,
  duplicate: `dr02_verify_duplicate_${suffix}`,
};
for (const database of Object.values(databases)) {
  if (!/^dr02_verify_[a-z]+_[a-f0-9]{10}$/.test(database)) {
    throw new Error('Unsafe temporary database name.');
  }
}

const postgresBins = [
  'C:/Program Files/PostgreSQL/18/bin',
  'C:/Program Files/PostgreSQL/17/bin',
];
const postgresBin = postgresBins.find((candidate) =>
  existsSync(join(candidate, 'pg_dump.exe')),
);
if (!postgresBin) throw new Error('Local PostgreSQL client tools are required.');

const verificationTemp = join(process.cwd(), `.dr02-verify-${suffix}`);
mkdirSync(verificationTemp);
const schemaDump = join(verificationTemp, 'preflight-schema.sql');
const prismaCli = fileURLToPath(
  new URL('../../../node_modules/prisma/build/index.js', import.meta.url),
);
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
  spawnSync(command, args, { encoding: 'utf8', env });
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
const deploy = (database: string) =>
  run(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    ...process.env,
    DATABASE_URL: databaseUrl(database),
    TEMP: verificationTemp,
    TMP: verificationTemp,
  });
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
const insertLegacyReport = (database: string, id: string) =>
  withDatabase(database, async (client) => {
    await client.query('SET session_replication_role = replica');
    try {
      await client.query(
        `INSERT INTO "no_show_reports" (
          "id", "reservation_id", "reporter_user_id", "target_user_id",
          "target_role", "reason_code", "status", "created_at"
        ) VALUES ($1, 'legacy-reservation', 'legacy-reporter', NULL,
          'SYSTEM', 'NO_DRIVER_AVAILABLE', 'PENDING_REVIEW', NOW())`,
        [id],
      );
    } finally {
      await client.query('SET session_replication_role = origin');
    }
  });

const admin = new pg.Client({ connectionString: baseUrl });
await admin.connect();
try {
  const applied = await admin.query<{
    id: string;
    checksum: string;
    finished_at: Date | null;
    migration_name: string;
    logs: string | null;
    rolled_back_at: Date | null;
    started_at: Date;
    applied_steps_count: number;
  }>('SELECT * FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL');
  if (applied.rows.some((row) => row.migration_name === migrationName)) {
    throw new Error('Configured baseline already contains the DR-02 migration.');
  }

  assertSucceeded(
    'pre-DR-02 schema export',
    run(join(postgresBin, 'pg_dump.exe'), [
      '--schema-only',
      '--no-owner',
      '--no-privileges',
      '--file',
      schemaDump,
      postgresUrl(baseUrl),
    ]),
  );

  for (const database of Object.values(databases)) {
    await admin.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
    assertSucceeded(
      `${database} schema import`,
      run(join(postgresBin, 'psql.exe'), [
        '--set',
        'ON_ERROR_STOP=1',
        '--dbname',
        postgresUrl(databaseUrl(database)),
        '--file',
        schemaDump,
      ]),
    );
    await withDatabase(database, async (client) => {
      for (const row of applied.rows) {
        await client.query(
          `INSERT INTO "_prisma_migrations" (
            "id", "checksum", "finished_at", "migration_name", "logs",
            "rolled_back_at", "started_at", "applied_steps_count"
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT ("id") DO NOTHING`,
          [
            row.id,
            row.checksum,
            row.finished_at,
            row.migration_name,
            row.logs,
            row.rolled_back_at,
            row.started_at,
            row.applied_steps_count,
          ],
        );
      }
    });
  }

  assertSucceeded('fresh DR-02 migration', deploy(databases.fresh));

  if (process.argv.includes('--run-recovery-tests')) {
    await withDatabase(databases.fresh, async (client) => {
      await client.query(
        `INSERT INTO "categories" (
          "id", "name_en", "name_ar", "category_type", "is_active", "created_at"
        ) VALUES ('dr02-recovery-test-category', 'DR-02 recovery test',
          'DR-02 recovery test', 'MATERIAL', TRUE, NOW())`,
      );
    });
    const recoveryTestEnv = join(verificationTemp, 'recovery-tests.env');
    writeFileSync(
      recoveryTestEnv,
      `DATABASE_URL=${databaseUrl(databases.fresh)}\n`,
      'utf8',
    );
    const recoveryTests = run(
      process.execPath,
      [
        '--import',
        'tsx',
        '--test',
        '--test-name-pattern=partial recovery',
        'src/modules/delivery-groups/delivery-groups.operational.test.ts',
      ],
      {
        ...process.env,
        DATABASE_URL: databaseUrl(databases.fresh),
        IMPACTLOOP_BACKEND_ENV_FILE_PATH: recoveryTestEnv,
      },
    );
    assertSucceeded('focused partial-recovery tests', recoveryTests);
    process.stdout.write(recoveryTests.stdout);
  }

  await insertLegacyReport(databases.legacy, 'legacy-report-1');
  assertSucceeded('legacy DR-02 migration', deploy(databases.legacy));

  await insertLegacyReport(databases.duplicate, 'duplicate-report-1');
  await insertLegacyReport(databases.duplicate, 'duplicate-report-2');
  const duplicateResult = deploy(databases.duplicate);
  const duplicateOutput = `${duplicateResult.stdout}\n${duplicateResult.stderr}`;
  if (
    duplicateResult.status === 0 ||
    !duplicateOutput.includes('DR02_DUPLICATE_NO_SHOW_REPORT_OCCURRENCES')
  ) {
    throw new Error('Duplicate occurrence preflight did not block deterministically.');
  }

  process.stdout.write(
    'fresh_dr02=applied legacy_dr02=applied duplicate_preflight=blocked cleanup=pending\n',
  );
} finally {
  for (const database of Object.values(databases)) {
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [database],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
  }
  await admin.end();
  rmSync(verificationTemp, { force: true, recursive: true });
  process.stdout.write('cleanup=complete\n');
}
