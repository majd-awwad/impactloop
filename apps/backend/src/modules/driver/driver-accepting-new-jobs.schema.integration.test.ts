/**
 * Permanent current-schema invariants for DriverProfile.acceptingNewJobs (DR-03).
 * Asserts the final database catalog — not historical migration chronology.
 */
import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';

describe('driver acceptingNewJobs schema invariants', () => {
  after(async () => {
    await prisma.$disconnect();
  });

  test('accepting_new_jobs column is boolean NOT NULL DEFAULT false', async () => {
    const columns = await prisma.$queryRaw<
      Array<{
        column_default: string | null;
        is_nullable: string;
        data_type: string;
      }>
    >`
      SELECT column_default, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'driver_profiles'
        AND column_name = 'accepting_new_jobs'
    `;

    assert.equal(columns.length, 1, 'driver_profiles.accepting_new_jobs must exist');
    const column = columns[0]!;
    assert.equal(column.data_type, 'boolean');
    assert.equal(column.is_nullable, 'NO');
    assert.match(
      String(column.column_default ?? ''),
      /false/i,
      `expected DEFAULT false, got ${column.column_default}`,
    );
  });

  test('status + accepting_new_jobs composite index exists', async () => {
    const indexes = await prisma.$queryRaw<
      Array<{ indexname: string; indexdef: string }>
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'driver_profiles'
        AND indexname = 'driver_profiles_status_accepting_new_jobs_idx'
    `;

    assert.equal(indexes.length, 1);
    assert.match(indexes[0]!.indexdef, /status/i);
    assert.match(indexes[0]!.indexdef, /accepting_new_jobs/i);
  });
});
