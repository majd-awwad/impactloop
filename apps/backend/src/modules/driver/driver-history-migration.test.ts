import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
  '../../../prisma/migrations/20260802120000_driver_history_incident_evidence/migration.sql',
  import.meta.url,
);

test('DR-02 migration preflights operational occurrence duplicates before mutation', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  const blockerAt = sql.indexOf('DR02_DUPLICATE_NO_SHOW_REPORT_OCCURRENCES');
  const firstMutationAt = sql.indexOf('CREATE TABLE "delivery_pickup_items"');

  assert.ok(blockerAt >= 0);
  assert.ok(firstMutationAt > blockerAt);
  assert.match(sql, /GROUP BY[\s\S]*"reservation_id"/);
  assert.match(sql, /COALESCE\("delivery_id", ''\)/);
  assert.match(sql, /COALESCE\("target_user_id", ''\)/);
  assert.match(sql, /"reason_code"[\s\S]*HAVING COUNT\(\*\) > 1/);
});

test('DR-02 operational occurrence uniqueness uses the same normalized key', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  const uniqueIndex = sql.slice(
    sql.indexOf('CREATE UNIQUE INDEX "no_show_reports_operational_occurrence_key"'),
  );
  assert.match(uniqueIndex, /"reservation_id"/);
  assert.match(uniqueIndex, /COALESCE\("delivery_id", ''\)/);
  assert.match(uniqueIndex, /COALESCE\("target_user_id", ''\)/);
  assert.match(uniqueIndex, /"reason_code"/);
});
