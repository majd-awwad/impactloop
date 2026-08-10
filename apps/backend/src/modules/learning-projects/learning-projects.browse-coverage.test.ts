import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  compareBrowseProjectsForSort,
  matchesMaterialAvailabilityFilter,
  paginateBrowseResults,
  requiresCoverageBeforePagination,
  sortBrowseProjects,
  summarizeMaterialCoverage,
  type BrowseProjectSortEntry,
  type ProjectMaterialCoverageSummary,
} from './learning-projects.material-coverage.js';

const summary = (
  overrides: Partial<ProjectMaterialCoverageSummary> = {},
): ProjectMaterialCoverageSummary => ({
  totalRequiredComponents: 4,
  availableComponents: 2,
  partialComponents: 1,
  missingComponents: 1,
  unknownComponents: 0,
  availabilityRatio: 0.5,
  coverageLevel: 'MOST',
  ...overrides,
});

const sortEntry = (
  overrides: Partial<BrowseProjectSortEntry> = {},
): BrowseProjectSortEntry => ({
  id: 'project-a',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  difficulty: 'BEGINNER',
  estimatedDurationMinutes: 60,
  coverage: summary(),
  likesCount: 0,
  ...overrides,
});

describe('learning-projects browse coverage pipeline', () => {
  test('requiresCoverageBeforePagination only for availability filters and MOST_AVAILABLE', () => {
    assert.equal(
      requiresCoverageBeforePagination({ availability: 'ANY', sort: 'DEFAULT' }),
      false,
    );
    assert.equal(
      requiresCoverageBeforePagination({ availability: 'ANY', sort: 'NEWEST' }),
      false,
    );
    assert.equal(
      requiresCoverageBeforePagination({
        availability: 'ANY',
        sort: 'SHORTEST_DURATION',
      }),
      false,
    );
    assert.equal(
      requiresCoverageBeforePagination({ availability: 'ANY', sort: 'EASIEST' }),
      false,
    );
    assert.equal(
      requiresCoverageBeforePagination({
        availability: 'ANY',
        sort: 'MOST_POPULAR',
      }),
      false,
    );
    assert.equal(
      requiresCoverageBeforePagination({
        availability: 'ANY',
        sort: 'MOST_AVAILABLE',
      }),
      true,
    );
    assert.equal(
      requiresCoverageBeforePagination({ availability: 'FULL', sort: 'DEFAULT' }),
      true,
    );
    assert.equal(
      requiresCoverageBeforePagination({ availability: 'NONE', sort: 'NEWEST' }),
      true,
    );
  });

  test('FULL classification requires every required component to be AVAILABLE', () => {
    const full = summarizeMaterialCoverage([
      { componentId: 'a', componentName: 'A', availabilityStatus: 'AVAILABLE' },
      { componentId: 'b', componentName: 'B', availabilityStatus: 'AVAILABLE' },
    ]);

    assert.equal(full.coverageLevel, 'FULL');
    assert.equal(full.availabilityRatio, 1);
  });

  test('MOST classification uses ratio >= 0.5 and < 1', () => {
    const most = summarizeMaterialCoverage([
      { componentId: 'a', componentName: 'A', availabilityStatus: 'AVAILABLE' },
      { componentId: 'b', componentName: 'B', availabilityStatus: 'AVAILABLE' },
      { componentId: 'c', componentName: 'C', availabilityStatus: 'MISSING' },
      { componentId: 'd', componentName: 'D', availabilityStatus: 'MISSING' },
    ]);

    assert.equal(most.coverageLevel, 'MOST');
    assert.equal(most.availabilityRatio, 0.5);
  });

  test('SOME classification uses ratio > 0 and < 0.5', () => {
    const some = summarizeMaterialCoverage([
      { componentId: 'a', componentName: 'A', availabilityStatus: 'AVAILABLE' },
      { componentId: 'b', componentName: 'B', availabilityStatus: 'MISSING' },
      { componentId: 'c', componentName: 'C', availabilityStatus: 'MISSING' },
      { componentId: 'd', componentName: 'D', availabilityStatus: 'MISSING' },
    ]);

    assert.equal(some.coverageLevel, 'SOME');
    assert.equal(some.availabilityRatio, 0.25);
  });

  test('NONE classification covers zero availability with evaluated components', () => {
    const none = summarizeMaterialCoverage([
      { componentId: 'a', componentName: 'A', availabilityStatus: 'MISSING' },
      { componentId: 'b', componentName: 'B', availabilityStatus: 'PARTIAL' },
    ]);

    assert.equal(none.coverageLevel, 'NONE');
    assert.equal(none.availabilityRatio, 0);
    assert.equal(none.partialComponents, 1);
  });

  test('UNKNOWN classification applies when no required material components exist', () => {
    const unknown = summarizeMaterialCoverage([]);

    assert.equal(unknown.coverageLevel, 'UNKNOWN');
    assert.equal(unknown.totalRequiredComponents, 0);
  });

  test('UNKNOWN classification applies when every component is UNKNOWN', () => {
    const unknownOnly = summarizeMaterialCoverage([
      { componentId: 'a', componentName: 'A', availabilityStatus: 'UNKNOWN' },
      { componentId: 'b', componentName: 'B', availabilityStatus: 'UNKNOWN' },
    ]);

    assert.equal(unknownOnly.coverageLevel, 'UNKNOWN');
    assert.equal(unknownOnly.unknownComponents, 2);
  });

  test('availability filters are non-overlapping by coverage level', () => {
    const full = summary({ coverageLevel: 'FULL' });
    const most = summary({ coverageLevel: 'MOST' });
    const some = summary({ coverageLevel: 'SOME' });
    const none = summary({ coverageLevel: 'NONE' });

    assert.equal(matchesMaterialAvailabilityFilter(full, 'FULL'), true);
    assert.equal(matchesMaterialAvailabilityFilter(full, 'MOST'), false);
    assert.equal(matchesMaterialAvailabilityFilter(most, 'MOST'), true);
    assert.equal(matchesMaterialAvailabilityFilter(some, 'SOME'), true);
    assert.equal(matchesMaterialAvailabilityFilter(none, 'NONE'), true);
    assert.equal(matchesMaterialAvailabilityFilter(none, 'FULL'), false);
  });

  test('availability filter executes before pagination', () => {
    const filtered = [
      summary({ coverageLevel: 'FULL' }),
      summary({ coverageLevel: 'NONE' }),
      summary({ coverageLevel: 'FULL' }),
    ].filter((entry) => matchesMaterialAvailabilityFilter(entry, 'FULL'));

    const paginated = paginateBrowseResults(filtered, 1, 1);

    assert.equal(filtered.length, 2);
    assert.equal(paginated.pagination.total, 2);
    assert.equal(paginated.items.length, 1);
    assert.equal(paginated.pagination.totalPages, 2);
  });

  test('FULL filter can surface a project outside the original unfiltered first page', () => {
    const ranked = [
      { id: 'newest-none', coverage: summary({ coverageLevel: 'NONE' }) },
      { id: 'older-full', coverage: summary({ coverageLevel: 'FULL' }) },
    ];

    const filtered = ranked.filter((entry) =>
      matchesMaterialAvailabilityFilter(entry.coverage, 'FULL'),
    );
    const paginated = paginateBrowseResults(filtered, 1, 1);

    assert.deepEqual(paginated.items, [ranked[1]]);
  });

  test('MOST_AVAILABLE sort executes before pagination', () => {
    const entries = sortBrowseProjects(
      [
        sortEntry({
          id: 'low',
          coverage: summary({
            availabilityRatio: 0.25,
            availableComponents: 1,
            partialComponents: 0,
            coverageLevel: 'SOME',
          }),
        }),
        sortEntry({
          id: 'high',
          coverage: summary({
            availabilityRatio: 0.75,
            availableComponents: 3,
            partialComponents: 0,
            coverageLevel: 'MOST',
          }),
        }),
      ],
      'MOST_AVAILABLE',
    );

    const paginated = paginateBrowseResults(entries, 1, 1);
    assert.equal(paginated.items[0]?.id, 'high');
  });

  test('SHORTEST_DURATION places unknown duration last', () => {
    const sorted = sortBrowseProjects(
      [
        sortEntry({ id: 'unknown', estimatedDurationMinutes: null }),
        sortEntry({ id: 'short', estimatedDurationMinutes: 30 }),
        sortEntry({ id: 'long', estimatedDurationMinutes: 120 }),
      ],
      'SHORTEST_DURATION',
    );

    assert.deepEqual(
      sorted.map((entry) => entry.id),
      ['short', 'long', 'unknown'],
    );
  });

  test('EASIEST uses deterministic enum order', () => {
    const sorted = sortBrowseProjects(
      [
        sortEntry({ id: 'advanced', difficulty: 'ADVANCED' }),
        sortEntry({ id: 'beginner', difficulty: 'BEGINNER' }),
        sortEntry({ id: 'intermediate', difficulty: 'INTERMEDIATE' }),
      ],
      'EASIEST',
    );

    assert.deepEqual(
      sorted.map((entry) => entry.id),
      ['beginner', 'intermediate', 'advanced'],
    );
  });

  test('MOST_POPULAR uses likes count before createdAt', () => {
    const sorted = sortBrowseProjects(
      [
        sortEntry({
          id: 'less-popular',
          likesCount: 1,
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
        }),
        sortEntry({
          id: 'more-popular',
          likesCount: 9,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ],
      'MOST_POPULAR',
    );

    assert.equal(sorted[0]?.id, 'more-popular');
  });

  test('NEWEST is deterministic with project ID tie-breaker', () => {
    const sameCreatedAt = new Date('2026-01-01T00:00:00.000Z');
    const sorted = sortBrowseProjects(
      [
        sortEntry({ id: 'project-b', createdAt: sameCreatedAt }),
        sortEntry({ id: 'project-a', createdAt: sameCreatedAt }),
      ],
      'NEWEST',
    );

    assert.deepEqual(
      sorted.map((entry) => entry.id),
      ['project-a', 'project-b'],
    );
  });

  test('no duplicate projects across page boundaries', () => {
    const items = ['a', 'b', 'c', 'd'];
    const pageOne = paginateBrowseResults(items, 1, 2);
    const pageTwo = paginateBrowseResults(items, 2, 2);

    const combined = [...pageOne.items, ...pageTwo.items];
    assert.equal(new Set(combined).size, combined.length);
    assert.deepEqual(combined, items);
  });

  test('different page limits preserve the same ranked prefix', () => {
    const ranked = ['first', 'second', 'third'];
    const pageLimitTwo = paginateBrowseResults(ranked, 1, 2).items;
    const pageLimitOne = paginateBrowseResults(ranked, 1, 1).items;

    assert.deepEqual(pageLimitTwo.slice(0, 1), pageLimitOne);
  });

  test('page beyond filtered result returns empty list with correct metadata', () => {
    const paginated = paginateBrowseResults(['only'], 3, 1);

    assert.deepEqual(paginated.items, []);
    assert.equal(paginated.pagination.total, 1);
    assert.equal(paginated.pagination.totalPages, 1);
    assert.equal(paginated.pagination.page, 3);
  });

  test('MOST_AVAILABLE ends with deterministic project ID ordering', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const sharedCoverage = summary({
      availabilityRatio: 0.5,
      availableComponents: 2,
      partialComponents: 0,
      coverageLevel: 'MOST',
    });

    const comparison = compareBrowseProjectsForSort(
      sortEntry({ id: 'project-b', createdAt, coverage: sharedCoverage }),
      sortEntry({ id: 'project-a', createdAt, coverage: sharedCoverage }),
      'MOST_AVAILABLE',
    );

    assert.equal(comparison > 0, true);
  });
});
