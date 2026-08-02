import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
  '../../../prisma/migrations/20260802160000_driver_profile_accepting_new_jobs/migration.sql',
  import.meta.url,
);

test('DR-03 migration preserves the legacy willingness-to-accept behavior', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  assert.match(
    sql,
    /SET "accepting_new_jobs" = TRUE[\s\S]*"availability" IN \('AVAILABLE', 'ON_DELIVERY'\)/,
  );
  assert.match(
    sql,
    /SET "accepting_new_jobs" = FALSE[\s\S]*"availability" = 'OFFLINE'/,
  );
});

test('DR-03 migration reconciles effective availability against active assignments', async () => {
  const sql = await readFile(migrationUrl, 'utf8');

  for (const status of [
    'DRIVER_ASSIGNED',
    'ARRIVED_PICKUP',
    'PICKED_UP',
    'ON_THE_WAY',
    'ARRIVED_DROPOFF',
  ]) {
    assert.ok(sql.includes(`'${status}'`));
  }

  assert.match(sql, /THEN 'ON_DELIVERY'/);
  assert.match(
    sql,
    /WHEN profile\."accepting_new_jobs" = TRUE[\s\S]*THEN 'AVAILABLE'/,
  );
  assert.match(sql, /ELSE 'OFFLINE'/);
  assert.match(sql, /driver_profiles_status_accepting_new_jobs_idx/);
});
