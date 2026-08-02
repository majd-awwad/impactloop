import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  paginateHydratedAvailableJobs,
  type AvailableJobPageRow,
} from './driver-available-jobs.query.js';

const row = (
  id: string,
  distanceMeters: number | null = null,
): AvailableJobPageRow => ({
  id,
  requestedAt: new Date('2026-08-01T10:00:00.000Z'),
  distanceMeters,
  distanceKm: distanceMeters == null ? null : distanceMeters / 1000,
});

describe('hydrate-safe available jobs pagination', () => {
  test('1: middle claim keeps hasMore from raw limit+1 and anchors last survivor', () => {
    // limit=2, raw A,B,C; B claimed. D+ exist after C beyond the fetch.
    const pageRows = [row('a'), row('b'), row('c')];
    const hydrated = [{ id: 'a' }, { id: 'c' }];
    const { page, hasMore, needsRetry } = paginateHydratedAvailableJobs(
      pageRows,
      hydrated,
      2,
    );

    assert.equal(needsRetry, false);
    assert.equal(hasMore, true);
    assert.deepEqual(
      page.map((item) => item.row.id),
      ['a', 'c'],
    );
    assert.equal(page.at(-1)?.row.id, 'c');
  });

  test('2: sentinel claimed still continues when raw limit+1 proved more', () => {
    // Raw A,B,C with C claimed; D,E exist after C. Page A,B must keep hasMore.
    const pageRows = [row('a'), row('b'), row('c')];
    const hydrated = [{ id: 'a' }, { id: 'b' }];
    const { page, hasMore, needsRetry } = paginateHydratedAvailableJobs(
      pageRows,
      hydrated,
      2,
    );

    assert.equal(needsRetry, false);
    assert.equal(hasMore, true);
    assert.deepEqual(
      page.map((item) => item.row.id),
      ['a', 'b'],
    );
    assert.equal(page.at(-1)?.row.id, 'b');
  });

  test('4: middle-row claim does not create duplicate returned ids', () => {
    const pageRows = [row('a'), row('b'), row('c'), row('d')];
    const hydrated = [{ id: 'a' }, { id: 'c' }, { id: 'd' }];
    const { page, hasMore } = paginateHydratedAvailableJobs(
      pageRows,
      hydrated,
      2,
    );

    assert.equal(hasMore, true);
    assert.deepEqual(
      page.map((item) => item.row.id),
      ['a', 'c'],
    );
    assert.equal(new Set(page.map((item) => item.row.id)).size, page.length);
  });

  test('5: last-visible-row claim does not skip the replacement survivor', () => {
    // Would-be page A,B with sentinel C; B claimed → return A,C and continue.
    const pageRows = [row('a'), row('b'), row('c')];
    const hydrated = [{ id: 'a' }, { id: 'c' }];
    const { page, hasMore } = paginateHydratedAvailableJobs(
      pageRows,
      hydrated,
      2,
    );

    assert.equal(hasMore, true);
    assert.deepEqual(
      page.map((item) => item.row.id),
      ['a', 'c'],
    );
    assert.equal(page.some((item) => item.row.id === 'b'), false);
  });

  test('6: all fetched rows claimed signals bounded retry, never hasMore without page', () => {
    const pageRows = [row('a'), row('b'), row('c')];
    const hydrated: Array<{ id: string }> = [];
    const { page, hasMore, needsRetry } = paginateHydratedAvailableJobs(
      pageRows,
      hydrated,
      2,
    );

    assert.equal(page.length, 0);
    assert.equal(hasMore, false);
    assert.equal(needsRetry, true);
  });

  test('7a: stable data keeps normal limit+1 hasMore', () => {
    const pageRows = [row('a'), row('b'), row('c')];
    const hydrated = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const { page, hasMore, needsRetry } = paginateHydratedAvailableJobs(
      pageRows,
      hydrated,
      2,
    );

    assert.equal(needsRetry, false);
    assert.equal(hasMore, true);
    assert.deepEqual(
      page.map((item) => item.row.id),
      ['a', 'b'],
    );
  });

  test('7b: final page correctly returns hasMore=false', () => {
    const pageRows = [row('a'), row('b')];
    const hydrated = [{ id: 'a' }, { id: 'b' }];
    const { page, hasMore, needsRetry } = paginateHydratedAvailableJobs(
      pageRows,
      hydrated,
      2,
    );

    assert.equal(needsRetry, false);
    assert.equal(hasMore, false);
    assert.deepEqual(
      page.map((item) => item.row.id),
      ['a', 'b'],
    );
  });

  test('nextCursor anchor is always a returned survivor', () => {
    const pageRows = [row('a'), row('b'), row('ghost'), row('d')];
    const hydrated = [{ id: 'a' }, { id: 'b' }, { id: 'd' }];
    const { page, hasMore } = paginateHydratedAvailableJobs(
      pageRows,
      hydrated,
      2,
    );

    assert.equal(hasMore, true);
    const anchor = page.at(-1)!;
    assert.equal(anchor.row.id, 'b');
    assert.equal(
      hydrated.some((delivery) => delivery.id === anchor.row.id),
      true,
    );
    assert.notEqual(anchor.row.id, 'ghost');
  });

  test('claimed ids never appear in the hydrated page', () => {
    const pageRows = [row('open'), row('claimed'), row('open-2')];
    const hydrated = [{ id: 'open' }, { id: 'open-2' }];
    const { page, hasMore } = paginateHydratedAvailableJobs(
      pageRows,
      hydrated,
      2,
    );
    assert.equal(hasMore, true);
    assert.equal(
      page.some((item) => item.row.id === 'claimed'),
      false,
    );
  });

  test('pagination stays bounded to the fetched page rows', () => {
    const pageRows = [row('a'), row('b'), row('c')];
    const hydrated = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'extra' }];
    const { page } = paginateHydratedAvailableJobs(pageRows, hydrated, 2);
    assert.equal(page.length, 2);
    assert.equal(
      page.every((item) =>
        pageRows.some((rowItem) => rowItem.id === item.row.id),
      ),
      true,
    );
  });
});
