import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { PreScoredMaterialEntry } from './learner-home.material-features.js';
import type { LearnerHomeMaterialCandidate } from './learner-home.types.js';
import {
  assessMaterialSuggestionSurfaceEligibility,
  buildDeterministicSuggestedMaterialCandidatePool,
  buildMlPrimaryMaterialRecallPool,
  compareNeutralMaterialRecallOrder,
  mapPreScoredToRankedEntry,
  ML_MATERIAL_RECALL_CAP,
  resolveSuggestedMaterialCandidatePoolForServing,
} from './learner-home.material-candidate-recall.js';
import { rankPreScoredMaterialEntries } from './learner-home.service.js';

const materialCandidate = (
  id: string,
  overrides: {
    status?: string;
    availableQuantity?: number;
  } = {},
): LearnerHomeMaterialCandidate => ({
  id,
  ownerId: `owner-${id}`,
  title: `Material ${id}`,
  description: '',
  materialType: 'GENERIC',
  status: overrides.status ?? 'AVAILABLE',
  availableQuantity: overrides.availableQuantity ?? 1,
  mapped: { id, title: `Material ${id}` },
  categoryId: 'cat-1',
  categoryNameEn: 'Category',
  categoryNameAr: 'Category',
  isFree: false,
  pickupAllowed: true,
  deliveryAllowed: false,
  viewsCount: 0,
  likesCount: 0,
  city: 'City',
  area: null,
  tags: [],
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
});

const scoredEntry = (
  id: string,
  suggestedScore: number,
  overrides: Parameters<typeof materialCandidate>[1] = {},
): PreScoredMaterialEntry => ({
  material: materialCandidate(id, overrides),
  ownerId: `owner-${id}`,
  scores: {
    suggested: {
      score: suggestedScore,
      reasons: suggestedScore > 0 ? ['Matches your interest'] : [],
      tier: suggestedScore > 0 ? 2 : 5,
      hasPrimaryRelevance: suggestedScore > 0,
      fallbackOnly: false,
    },
    savedProjects: {
      score: 0,
      reasons: [],
      tier: 5,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
    },
    free: {
      score: 0,
      reasons: [],
      tier: 5,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
    },
  },
});

describe('material candidate recall (ML_PRIMARY)', () => {
  test('deterministic score <= 0 alone does not exclude ML-primary recall', () => {
    const entries = [
      scoredEntry('material-a', 12),
      scoredEntry('material-b', 0),
      scoredEntry('material-c', -5),
    ];
    const { pool, audit } = buildMlPrimaryMaterialRecallPool(entries);

    assert.equal(audit.hardEligibleCount, 3);
    assert.equal(audit.surfaceEligibleCount, 3);
    assert.equal(audit.mlRecallPoolCount, 3);
    assert.deepEqual(
      pool.map((entry) => String(entry.material.id)),
      ['material-a', 'material-b', 'material-c'],
    );
  });

  test('true hard ineligibility still excludes from ML recall', () => {
    const entries = [
      scoredEntry('material-a', 10),
      scoredEntry('material-b', 8, { status: 'ARCHIVED' }),
      scoredEntry('material-c', 6, { availableQuantity: 0 }),
    ];
    const { pool, audit } = buildMlPrimaryMaterialRecallPool(entries);

    assert.equal(audit.surfaceEligibleCount, 1);
    assert.equal(audit.excludedBySurfaceCount, 2);
    assert.equal(pool.length, 1);
    assert.equal(String(pool[0]?.material.id), 'material-a');
    assert.equal(
      assessMaterialSuggestionSurfaceEligibility(entries[1]!).eligible,
      false,
    );
  });

  test('recall cap is deterministic and uses neutral ordering', () => {
    const entries = Array.from({ length: 5 }, (_, index) =>
      scoredEntry(`material-${index}`, index + 1),
    );
    const { pool: first } = buildMlPrimaryMaterialRecallPool(entries, { cap: 3 });
    const { pool: second } = buildMlPrimaryMaterialRecallPool(entries, { cap: 3 });

    assert.deepEqual(
      first.map((entry) => String(entry.material.id)),
      second.map((entry) => String(entry.material.id)),
    );
    assert.equal(first.length, 3);
    assert.notDeepEqual(
      first.map((entry) => entry.score),
      [...first].sort((left, right) => right.score - left.score).map((entry) => entry.score),
    );
  });

  test('ML_PRIMARY serving resolves broad pool; DETERMINISTIC preserves score gate', () => {
    const entries = [
      scoredEntry('material-a', 20),
      scoredEntry('material-b', 0),
      scoredEntry('material-c', 15),
    ];

    const mlPrimary = resolveSuggestedMaterialCandidatePoolForServing({
      entries,
      runtimeMode: 'ML_PRIMARY',
      browseAll: false,
      rankPreScoredMaterialEntries,
    });
    assert.equal(mlPrimary.pool.length, 3);
    assert.equal(mlPrimary.audit.excludedByDeterministicScoreGateCount, 1);

    const deterministic = resolveSuggestedMaterialCandidatePoolForServing({
      entries,
      runtimeMode: 'DETERMINISTIC',
      browseAll: false,
      rankPreScoredMaterialEntries,
    });
    assert.equal(deterministic.pool.length, 2);
    assert.deepEqual(
      deterministic.pool.map((entry) => String(entry.material.id)),
      ['material-a', 'material-c'],
    );
  });

  test('deterministic fallback pool builder keeps score>0 and top-N semantics', () => {
    const entries = Array.from({ length: 60 }, (_, index) =>
      scoredEntry(`material-${String(index).padStart(2, '0')}`, index + 1),
    );
    const deterministicPool = buildDeterministicSuggestedMaterialCandidatePool(
      entries,
      rankPreScoredMaterialEntries,
      false,
    );
    assert.equal(deterministicPool.length, 48);
    assert.ok(deterministicPool.every((entry) => entry.score > 0));
  });

  test('neutral ordering is stable by material id', () => {
    const left = mapPreScoredToRankedEntry(scoredEntry('material-b', 1));
    const right = mapPreScoredToRankedEntry(scoredEntry('material-a', 99));
    assert.equal(compareNeutralMaterialRecallOrder(left, right), 1);
  });

  test('ML recall cap matches upstream DB pool cap', () => {
    assert.equal(ML_MATERIAL_RECALL_CAP, 120);
  });
});
