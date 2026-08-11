/**
 * Permanent current-schema catalog invariants for Available Jobs indexes (DR-04).
 * Asserts PostGIS + waiting/geography indexes on the final schema.
 * Performance/EXPLAIN scale remains in bench:driver:query-scale.
 */
import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';

describe('driver available-jobs index schema invariants', () => {
  after(async () => {
    await prisma.$disconnect();
  });

  test('PostGIS extension is installed', async () => {
    const rows = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'postgis'
    `;
    assert.equal(rows.length, 1);
  });

  test('locations.location is geography', async () => {
    const rows = await prisma.$queryRaw<Array<{ format_type: string }>>`
      SELECT format_type(a.atttypid, a.atttypmod) AS format_type
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'locations'
        AND a.attname = 'location'
        AND a.attnum > 0
        AND NOT a.attisdropped
    `;
    assert.equal(rows.length, 1);
    assert.match(rows[0]!.format_type.toLowerCase(), /geography/);
  });

  test('waiting unassigned deliveries index exists with correct predicate', async () => {
    const indexes = await prisma.$queryRaw<
      Array<{ indexname: string; indexdef: string }>
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'deliveries_waiting_unassigned_requested_at_id_idx'
    `;
    assert.equal(indexes.length, 1);
    const def = indexes[0]!.indexdef;
    assert.match(def, /requested_at/i);
    assert.match(def, /WAITING_FOR_DRIVER/);
    assert.match(def, /assigned_driver_profile_id IS NULL/i);
  });

  test('geography GiST and lower(city/area) indexes exist', async () => {
    const indexes = await prisma.$queryRaw<
      Array<{ indexname: string; indexdef: string }>
    >`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'locations_geography_gist_idx',
          'locations_lower_city_idx',
          'locations_lower_area_idx'
        )
      ORDER BY indexname
    `;
    assert.equal(indexes.length, 3);
    const byName = new Map(indexes.map((row) => [row.indexname, row.indexdef]));
    assert.match(byName.get('locations_geography_gist_idx') ?? '', /USING gist/i);
    assert.match(byName.get('locations_lower_city_idx') ?? '', /lower\(city\)/i);
    assert.match(byName.get('locations_lower_area_idx') ?? '', /lower\(area\)/i);
  });

  test('locations geography sync trigger and function exist', async () => {
    const triggers = await prisma.$queryRaw<Array<{ tgname: string }>>`
      SELECT tgname FROM pg_trigger WHERE tgname = 'locations_sync_geography_trg'
    `;
    const functions = await prisma.$queryRaw<Array<{ proname: string }>>`
      SELECT proname FROM pg_proc WHERE proname = 'locations_sync_geography'
    `;
    assert.equal(triggers.length, 1);
    assert.equal(functions.length, 1);
  });

  test('no locations have lat/lng set with null geography', async () => {
    const rows = await prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(*)::int AS count
      FROM locations
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND location IS NULL
    `;
    assert.equal(Number(rows[0]?.count ?? -1), 0);
  });
});
