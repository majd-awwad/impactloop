import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  parseRecommendationScorerVersion,
  RECOMMENDATION_SCORER_VERSIONS,
} from '../../config/recommendation-scoring-version.js';
import { BEHAVIOR_SCORE_WEIGHTS } from './learner-home.affinity.js';
import { SUGGESTED_MATERIAL_TIERS } from './learner-home.ranking.js';
import {
  algorithmVersionForEffectiveMode,
  algorithmVersionForModeDecision,
  assertCanonicalContextPresent,
  buildCanonicalProfileMap,
  buildLearnerHomeModeDecision,
  CANONICAL_SCORING_MODE,
  CanonicalContextInvariantError,
  CanonicalScoringContextRequiredError,
  createFallbackCanonicalContext,
  createSuccessfulCanonicalContext,
  projectCanonicalMaterialProfile,
  scoreCanonicalMaterialCandidate,
  scoreCanonicalMaterialPool,
  type CanonicalMaterialScoreBreakdown,
  type CanonicalScoredMaterialResult,
  type CanonicalMaterialSemanticProfile,
  type MaterialConceptRowInput,
} from './learner-home.canonical-scoring.js';
import { ALREADY_LIKED_MATERIAL_PENALTY } from './learner-home.scoring.js';
import {
  assessSuggestedMaterialRelevance,
  buildMaterialScoringSharedState,
  scoreSuggestedMaterial,
  scoreSuggestedProject,
} from './learner-home.scoring.js';
import {
  buildMaterialRecommendationFeature,
  getOrBuildMaterialFeaturePool,
  preScoreMaterialPool,
  resetMaterialFeaturePoolCacheForTests,
  scoreMaterialPoolWithFeatures,
} from './learner-home.material-features.js';
import { loadMaterialConceptsForScoring } from './learner-home.repository.js';
import {
  createLearnerHomeCacheForTests,
  preScoreMaterials,
  resolveMaterialModeDecisionAndContext,
  type LearnerHomeContext,
} from './learner-home.service.js';
import type {
  LearnerBehaviorContext,
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
  LearnerHomeSavedLocationContext,
} from './learner-home.types.js';
import { createEmptyAffinityProfile, createEmptyBehaviorContext } from './learner-home.affinity.js';
import { prisma } from '../../database/prisma.js';

/**
 * Recomputes the expected total score from the signed component
 * contributions, proving the returned `score` never disagrees with
 * `components` (RP-03.1 correction #3). One general formula now covers every
 * section (suggested, savedProjects, free, unavailable) because each section's
 * returned breakdown reports zero for any field that does not actually
 * contribute to that section's score.
 */
const assertCanonicalScoreMatchesComponents = (
  result: CanonicalScoredMaterialResult,
) => {
  const c: CanonicalMaterialScoreBreakdown = result.components;
  const expected =
    c.likedSimilarity +
    c.reservedSimilarity +
    c.viewedSimilarity +
    c.location +
    c.free +
    c.delivery +
    c.popularity +
    c.recency -
    c.alreadyLikedPenalty -
    c.unavailablePenalty;

  assert.equal(
    result.score,
    expected,
    `score (${result.score}) must equal signed component sum (${expected})`,
  );
};

const material = (
  overrides: Partial<LearnerHomeMaterialCandidate> = {},
): LearnerHomeMaterialCandidate => ({
  id: 'mat-1',
  ownerId: 'owner-1',
  title: 'Arduino Uno',
  description: 'Board',
  materialType: 'Arduino Board',
  categoryId: 'cat-electronics',
  categoryNameEn: 'Electronics',
  categoryNameAr: 'الكترونيات',
  status: 'AVAILABLE',
  isFree: false,
  deliveryAllowed: true,
  pickupAllowed: true,
  viewsCount: 10,
  likesCount: 2,
  city: 'Ramallah',
  area: null,
  tags: ['arduino'],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  availableQuantity: 3,
  mapped: { id: 'mat-1' },
  ...overrides,
});

const emptyLocation = (): LearnerHomeSavedLocationContext => ({
  city: null,
  area: null,
});

const profile = (
  materialId: string,
  rows: MaterialConceptRowInput[],
): CanonicalMaterialSemanticProfile =>
  projectCanonicalMaterialProfile(materialId, rows);

const familyForm = (
  materialId: string,
  family = 'material-family:electronics',
  form?: string,
) =>
  profile(materialId, [
    {
      canonicalKey: family,
      conceptType: 'MATERIAL_FAMILY',
      status: 'ACTIVE',
    },
    ...(form
      ? [
          {
            canonicalKey: form,
            conceptType: 'MATERIAL_FORM',
            status: 'ACTIVE',
          } satisfies MaterialConceptRowInput,
        ]
      : []),
  ]);

const contextWith = (input: {
  candidate: CanonicalMaterialSemanticProfile;
  liked?: CanonicalMaterialSemanticProfile[];
  reserved?: CanonicalMaterialSemanticProfile[];
  viewed?: CanonicalMaterialSemanticProfile[];
}) =>
  createSuccessfulCanonicalContext({
    candidateMaterialProfiles: new Map([[input.candidate.materialId, input.candidate]]),
    likedMaterialProfiles: new Map(
      (input.liked ?? []).map((row) => [row.materialId, row]),
    ),
    reservedMaterialProfiles: new Map(
      (input.reserved ?? []).map((row) => [row.materialId, row]),
    ),
    viewedMaterialProfiles: new Map(
      (input.viewed ?? []).map((row) => [row.materialId, row]),
    ),
  });

describe('RP-03.1 scoring mode registry', () => {
  test('missing mode defaults to legacy-v1', () => {
    assert.equal(parseRecommendationScorerVersion(undefined), 'legacy-v1');
    assert.equal(parseRecommendationScorerVersion(''), 'legacy-v1');
    assert.equal(parseRecommendationScorerVersion('  '), 'legacy-v1');
  });

  test('accepts canonical-taxonomy-v3 and rejects unknown', () => {
    assert.equal(
      parseRecommendationScorerVersion('canonical-taxonomy-v3'),
      CANONICAL_SCORING_MODE,
    );
    assert.ok(RECOMMENDATION_SCORER_VERSIONS.includes(CANONICAL_SCORING_MODE));
    assert.throws(() => parseRecommendationScorerVersion('normalized-v2'));
  });

  test('algorithm stamp uses effective mode', () => {
    assert.equal(
      algorithmVersionForEffectiveMode('canonical-taxonomy-v3'),
      'learner-home-v1:canonical-taxonomy-v3',
    );
    assert.equal(
      algorithmVersionForEffectiveMode('legacy-v1'),
      'learner-home-v1:legacy-v1',
    );
  });
});

describe('RP-03.1 canonical material profiles', () => {
  test('duplicate identical family rows remain one valid family', () => {
    const result = projectCanonicalMaterialProfile('m1', [
      {
        canonicalKey: 'material-family:electronics',
        conceptType: 'MATERIAL_FAMILY',
        status: 'ACTIVE',
      },
      {
        canonicalKey: 'material-family:electronics',
        conceptType: 'MATERIAL_FAMILY',
        status: 'ACTIVE',
      },
    ]);
    assert.equal(result.coverage, 'READY_FAMILY_ONLY');
    assert.equal(result.similarityEligible, true);
    assert.deepEqual(result.familyKeys, ['material-family:electronics']);
  });

  test('two distinct families are INVALID_FAMILY_CARDINALITY', () => {
    const result = projectCanonicalMaterialProfile('m1', [
      {
        canonicalKey: 'material-family:electronics',
        conceptType: 'MATERIAL_FAMILY',
        status: 'ACTIVE',
      },
      {
        canonicalKey: 'material-family:wood',
        conceptType: 'MATERIAL_FAMILY',
        status: 'ACTIVE',
      },
    ]);
    assert.equal(result.coverage, 'INVALID_FAMILY_CARDINALITY');
    assert.equal(result.similarityEligible, false);
  });

  test('one valid family plus malformed extra still uses the valid family', () => {
    const result = projectCanonicalMaterialProfile('m1', [
      {
        canonicalKey: 'material-family:electronics',
        conceptType: 'MATERIAL_FAMILY',
        status: 'ACTIVE',
      },
      {
        canonicalKey: 'not-a-key',
        conceptType: 'MATERIAL_FAMILY',
        status: 'ACTIVE',
      },
      {
        canonicalKey: 'interest:arduino',
        conceptType: 'INTEREST',
        status: 'ACTIVE',
      },
    ]);
    assert.equal(result.coverage, 'READY_FAMILY_ONLY');
    assert.equal(result.similarityEligible, true);
    assert.ok(result.diagnostics.includes('INVALID_CONCEPT_PROJECTION'));
  });

  test('zero families is MISSING_CANONICAL_ASSIGNMENT', () => {
    const result = projectCanonicalMaterialProfile('m1', []);
    assert.equal(result.coverage, 'MISSING_CANONICAL_ASSIGNMENT');
    assert.equal(result.similarityEligible, false);
  });

  test('buildCanonicalProfileMap covers every input id', () => {
    const map = buildCanonicalProfileMap(
      ['a', 'b', 'a'],
      new Map([
        [
          'a',
          [
            {
              canonicalKey: 'material-family:electronics',
              conceptType: 'MATERIAL_FAMILY',
              status: 'ACTIVE',
            },
          ],
        ],
      ]),
    );
    assert.equal(map.size, 2);
    assert.equal(map.get('a')?.coverage, 'READY_FAMILY_ONLY');
    assert.equal(map.get('b')?.coverage, 'MISSING_CANONICAL_ASSIGNMENT');
  });
});

describe('RP-03.1 canonical liked similarity', () => {
  test('self-only liked yields zero likedSimilarity and keeps already-liked penalty', () => {
    const candidate = material({ id: 'mat-self' });
    const candidateProfile = familyForm('mat-self', 'material-family:electronics', 'material-form:arduino-board');
    const ctx = contextWith({
      candidate: candidateProfile,
      liked: [candidateProfile],
    });
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      likedMaterials: [
        {
          materialId: 'mat-self',
          title: 'Arduino Uno',
          description: '',
          materialType: 'Arduino Board',
          categoryNameEn: 'Electronics',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };

    const scored = scoreCanonicalMaterialCandidate({
      candidate,
      context: ctx,
      savedLocation: emptyLocation(),
      behavior,
      now: new Date('2026-07-20T00:00:00.000Z'),
    });

    assert.equal(scored.components.likedSimilarity, 0);
    assert.equal(scored.components.alreadyLikedPenalty, ALREADY_LIKED_MATERIAL_PENALTY);
    assert.equal(scored.hasPrimaryRelevance, false);
    // Correction #3: the self-only-liked case has no other relevance, but the
    // already-liked penalty still applies to the final score, not only the
    // component field.
    assert.equal(scored.score, -ALREADY_LIKED_MATERIAL_PENALTY);
    assertCanonicalScoreMatchesComponents(scored);
  });

  test('self plus another form-sharing liked yields 28 and penalty', () => {
    const candidate = material({ id: 'mat-self' });
    const candidateProfile = familyForm(
      'mat-self',
      'material-family:electronics',
      'material-form:arduino-board',
    );
    const otherLiked = familyForm(
      'mat-other',
      'material-family:electronics',
      'material-form:arduino-board',
    );
    const ctx = contextWith({
      candidate: candidateProfile,
      liked: [candidateProfile, otherLiked],
    });
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      likedMaterials: [
        {
          materialId: 'mat-self',
          title: 'Self',
          description: '',
          materialType: 'x',
          categoryNameEn: 'Electronics',
          categoryNameAr: '',
          tags: [],
        },
        {
          materialId: 'mat-other',
          title: 'Other',
          description: '',
          materialType: 'x',
          categoryNameEn: 'Electronics',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };

    const scored = scoreCanonicalMaterialCandidate({
      candidate,
      context: ctx,
      savedLocation: emptyLocation(),
      behavior,
      now: new Date('2026-07-20T00:00:00.000Z'),
    });

    assert.equal(scored.components.likedSimilarity, BEHAVIOR_SCORE_WEIGHTS.likedSimilar);
    assert.equal(scored.components.alreadyLikedPenalty, ALREADY_LIKED_MATERIAL_PENALTY);
    assert.ok(scored.internalReasonCodes.includes('CANONICAL_FORM_OVERLAP'));
    assert.equal(scored.tier, SUGGESTED_MATERIAL_TIERS.behaviorStrong);
    assert.equal(scored.hasPrimaryRelevance, false);
    assertCanonicalScoreMatchesComponents(scored);
  });

  test('family overlap contributes 14 and duplicate liked rows do not inflate', () => {
    const candidate = material({ id: 'mat-1' });
    const candidateProfile = familyForm('mat-1');
    const likedProfile = familyForm('mat-liked');
    const ctx = contextWith({
      candidate: candidateProfile,
      liked: [likedProfile],
    });
    const likedSignal = {
      materialId: 'mat-liked',
      title: 'Liked',
      description: '',
      materialType: 'x',
      categoryNameEn: 'Electronics',
      categoryNameAr: '',
      tags: [],
    };
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      likedMaterials: [likedSignal, likedSignal],
    };

    const scored = scoreCanonicalMaterialCandidate({
      candidate,
      context: ctx,
      savedLocation: emptyLocation(),
      behavior,
      now: new Date('2026-07-20T00:00:00.000Z'),
    });

    assert.equal(
      scored.components.likedSimilarity,
      Math.floor(BEHAVIOR_SCORE_WEIGHTS.likedSimilar / 2),
    );
    assert.ok(scored.internalReasonCodes.includes('CANONICAL_FAMILY_OVERLAP'));
    assertCanonicalScoreMatchesComponents(scored);
  });

  test('defective multi-family liked profile cannot contribute overlap', () => {
    const candidate = material({ id: 'mat-1' });
    const candidateProfile = familyForm('mat-1');
    const badLiked = projectCanonicalMaterialProfile('mat-liked', [
      {
        canonicalKey: 'material-family:electronics',
        conceptType: 'MATERIAL_FAMILY',
        status: 'ACTIVE',
      },
      {
        canonicalKey: 'material-family:wood',
        conceptType: 'MATERIAL_FAMILY',
        status: 'ACTIVE',
      },
    ]);
    const ctx = contextWith({
      candidate: candidateProfile,
      liked: [badLiked],
    });
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      likedMaterials: [
        {
          materialId: 'mat-liked',
          title: 'Liked',
          description: '',
          materialType: 'x',
          categoryNameEn: 'Electronics',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };

    const scored = scoreCanonicalMaterialCandidate({
      candidate,
      context: ctx,
      savedLocation: emptyLocation(),
      behavior,
      now: new Date('2026-07-20T00:00:00.000Z'),
    });

    assert.equal(scored.components.likedSimilarity, 0);
  });
});

describe('RP-03.1 canonical interest and component fail-closed', () => {
  test('interest and saved-component contributions stay zero with internal codes', () => {
    const candidate = material();
    const candidateProfile = familyForm('mat-1');
    const ctx = contextWith({ candidate: candidateProfile });
    const scored = scoreCanonicalMaterialCandidate({
      candidate,
      context: ctx,
      savedLocation: { city: 'Ramallah', area: null },
      behavior: createEmptyBehaviorContext(),
      now: new Date('2026-07-20T00:00:00.000Z'),
    });

    assert.equal(scored.components.interest, 0);
    assert.equal(scored.components.savedComponent, 0);
    assert.ok(
      scored.internalReasonCodes.includes('CANONICAL_INTEREST_RELATION_UNAVAILABLE'),
    );
    assert.ok(
      scored.internalReasonCodes.includes('CANONICAL_COMPONENT_RELATION_UNAVAILABLE'),
    );
    assert.equal(scored.hasPrimaryRelevance, false);
    assert.equal(scored.tier, SUGGESTED_MATERIAL_TIERS.fallback);
  });

  test('no cross-namespace interest/form equality shortcut', () => {
    const candidate = material({ id: 'mat-1' });
    // Candidate has material-form:arduino-board only via family+form; interest keys never consulted.
    const candidateProfile = familyForm(
      'mat-1',
      'material-family:electronics',
      'material-form:arduino-board',
    );
    const ctx = contextWith({ candidate: candidateProfile });
    const scored = scoreCanonicalMaterialCandidate({
      candidate,
      context: ctx,
      savedLocation: emptyLocation(),
      behavior: createEmptyBehaviorContext(),
      now: new Date('2026-07-20T00:00:00.000Z'),
    });
    assert.equal(scored.components.interest, 0);
    assert.equal(scored.components.likedSimilarity, 0);
  });
});

describe('RP-03.1 canonical context requirements', () => {
  test('direct helper selecting canonical without context throws typed error', () => {
    assert.throws(
      () =>
        scoreSuggestedMaterial({
          material: material(),
          interests: [],
          savedComponents: [],
          savedLocation: emptyLocation(),
          scorerVersion: CANONICAL_SCORING_MODE,
        }),
      (error: unknown) => error instanceof CanonicalScoringContextRequiredError,
    );
  });

  test('assertCanonicalContextPresent throws when absent', () => {
    assert.throws(() => assertCanonicalContextPresent(undefined));
  });

  test('missing candidate map entry throws context invariant', () => {
    const ctx = createSuccessfulCanonicalContext({
      candidateMaterialProfiles: new Map(),
      likedMaterialProfiles: new Map(),
      reservedMaterialProfiles: new Map(),
      viewedMaterialProfiles: new Map(),
    });
    assert.throws(() =>
      scoreCanonicalMaterialCandidate({
        candidate: material(),
        context: ctx,
        savedLocation: emptyLocation(),
        behavior: createEmptyBehaviorContext(),
      }),
    );
  });

  test('fallback context is not cacheable and stamps legacy effective mode', () => {
    const fallback = createFallbackCanonicalContext('CANONICAL_LOADER_FALLBACK_LEGACY_V1');
    assert.equal(fallback.requestedScoringMode, CANONICAL_SCORING_MODE);
    assert.equal(fallback.effectiveScoringMode, 'legacy-v1');
    assert.equal(fallback.cacheable, false);
    assert.equal(
      algorithmVersionForEffectiveMode(fallback.effectiveScoringMode),
      'learner-home-v1:legacy-v1',
    );
  });
});

describe('RP-03.1 candidate-pool invariance and hydration coverage', () => {
  test('score is independent of surrounding pool size and order', () => {
    const candidate = material({ id: 'focus' });
    const focusProfile = familyForm('focus');
    const otherA = familyForm('other-a', 'material-family:wood');
    const otherB = familyForm('other-b', 'material-family:fabric');
    const liked = familyForm('liked');
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      likedMaterials: [
        {
          materialId: 'liked',
          title: 'Liked',
          description: '',
          materialType: 'x',
          categoryNameEn: 'Electronics',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };

    const scoreFocus = (others: CanonicalMaterialSemanticProfile[]) => {
      const candidates = [focusProfile, ...others];
      const ctx = createSuccessfulCanonicalContext({
        candidateMaterialProfiles: new Map(
          candidates.map((row) => [row.materialId, row]),
        ),
        likedMaterialProfiles: new Map([[liked.materialId, liked]]),
        reservedMaterialProfiles: new Map(),
        viewedMaterialProfiles: new Map(),
      });
      return scoreCanonicalMaterialCandidate({
        candidate,
        context: ctx,
        savedLocation: emptyLocation(),
        behavior,
        now: new Date('2026-07-20T00:00:00.000Z'),
      });
    };

    const alone = scoreFocus([]);
    const withOthers = scoreFocus([otherA, otherB]);
    const reordered = scoreFocus([otherB, otherA]);
    assert.equal(alone.score, withOthers.score);
    assert.equal(alone.score, reordered.score);
    assert.deepEqual(alone.components, withOthers.components);
  });

  test('pool of more than 200 candidates keeps complete profile coverage', () => {
    const ids = Array.from({ length: 250 }, (_, index) => `mat-${index}`);
    const rows = new Map<string, MaterialConceptRowInput[]>();
    for (const id of ids) {
      rows.set(id, [
        {
          canonicalKey: 'material-family:electronics',
          conceptType: 'MATERIAL_FAMILY',
          status: 'ACTIVE',
        },
      ]);
    }
    const map = buildCanonicalProfileMap(ids, rows);
    assert.equal(map.size, 250);
    for (const id of ids) {
      assert.equal(map.get(id)?.coverage, 'READY_FAMILY_ONLY');
      assert.notEqual(map.get(id)?.coverage, 'MISSING_CANONICAL_ASSIGNMENT');
    }

    const materials = ids.map((id) => material({ id, mapped: { id } }));
    const ctx = createSuccessfulCanonicalContext({
      candidateMaterialProfiles: map,
      likedMaterialProfiles: new Map(),
      reservedMaterialProfiles: new Map(),
      viewedMaterialProfiles: new Map(),
    });
    const pool = scoreCanonicalMaterialPool({
      materials: [...materials].reverse(),
      context: ctx,
      savedLocation: emptyLocation(),
      behavior: createEmptyBehaviorContext(),
      now: new Date('2026-07-20T00:00:00.000Z'),
    });
    assert.equal(pool.length, 250);
    assert.equal(pool.map((row) => row.material.id).join(','), [...ids].reverse().join(','));
  });
});

describe('RP-03.1 project separation', () => {
  test('scoreSuggestedProject under canonical delegates to legacy-v1 matching', () => {
    const project: LearnerHomeProjectCandidate = {
      id: 'proj-1',
      title: 'Arduino robot',
      shortDescription: 'Build with arduino',
      difficulty: 'BEGINNER',
      estimatedDurationMinutes: 60,
      coverImageUrl: null,
      categoryId: 'cat',
      categoryNameEn: 'Electronics',
      categoryNameAr: '',
      tags: ['arduino'],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      likesCount: 1,
      savesCount: 1,
      reviewCount: 0,
      reviewAverage: 0,
      requiredComponents: [],
      mapped: { id: 'proj-1' },
    };

    const withCanonicalMode = scoreSuggestedProject({
      project,
      interests: ['arduino'],
      availableMaterials: [],
      behaviorAffinityProfile: createEmptyAffinityProfile(),
      behavior: createEmptyBehaviorContext(),
      scorerVersion: CANONICAL_SCORING_MODE,
    });
    const withLegacy = scoreSuggestedProject({
      project,
      interests: ['arduino'],
      availableMaterials: [],
      behaviorAffinityProfile: createEmptyAffinityProfile(),
      behavior: createEmptyBehaviorContext(),
      scorerVersion: 'legacy-v1',
    });

    assert.equal(withCanonicalMode.score, withLegacy.score);
    assert.deepEqual(withCanonicalMode.reasons, withLegacy.reasons);
  });
});

describe('RP-03.1 non-semantic preservation', () => {
  test('location and free still affect score under identical canonical semantics', () => {
    const candidateNear = material({
      id: 'mat-1',
      isFree: true,
      city: 'Ramallah',
      area: 'Center',
    });
    const candidateFar = material({
      id: 'mat-1',
      isFree: false,
      city: 'Nablus',
      area: null,
    });
    const candidateProfile = familyForm('mat-1');
    const ctx = contextWith({ candidate: candidateProfile });
    const now = new Date('2026-07-20T00:00:00.000Z');
    const near = scoreCanonicalMaterialCandidate({
      candidate: candidateNear,
      context: ctx,
      savedLocation: { city: 'Ramallah', area: 'Center' },
      behavior: createEmptyBehaviorContext(),
      now,
    });
    const far = scoreCanonicalMaterialCandidate({
      candidate: candidateFar,
      context: ctx,
      savedLocation: { city: 'Ramallah', area: 'Center' },
      behavior: createEmptyBehaviorContext(),
      now,
    });
    assert.ok(near.score > far.score);
    assert.ok(near.components.location > 0);
    assert.ok(near.components.free > 0);
    assertCanonicalScoreMatchesComponents(near);
    assertCanonicalScoreMatchesComponents(far);
  });
});

describe('RP-03.1 single evaluation timestamp for the full canonical pool', () => {
  test('every candidate shares one evaluationTime regardless of pool order, and Date() is captured exactly once when omitted', () => {
    const fixedNow = new Date('2026-07-20T00:00:00.000Z');
    const RealDate = globalThis.Date;
    let noArgConstructions = 0;

    class SpyDate extends RealDate {
      constructor(...args: unknown[]) {
        if (args.length === 0) {
          noArgConstructions += 1;
          super(fixedNow.getTime());
          return;
        }
        // @ts-expect-error forwarding constructor args to the real Date
        super(...args);
      }
      static override now() {
        return fixedNow.getTime();
      }
    }

    // @ts-expect-error test-only global monkeypatch; restored in finally below
    globalThis.Date = SpyDate;

    try {
      const dayMs = 24 * 60 * 60 * 1000;
      // Exactly at the 7-day recency boundary (recencyMax) and one day past
      // it (recencyMax - 2), evaluated against the same fixed instant.
      const idOnBoundary = 'mat-on-boundary';
      const idPastBoundary = 'mat-past-boundary';
      const onBoundary = new RealDate(fixedNow.getTime() - 7 * dayMs);
      const justPastBoundary = new RealDate(fixedNow.getTime() - 8 * dayMs);

      const ctx = createSuccessfulCanonicalContext({
        candidateMaterialProfiles: new Map([
          [idOnBoundary, familyForm(idOnBoundary)],
          [idPastBoundary, familyForm(idPastBoundary)],
        ]),
        likedMaterialProfiles: new Map(),
        reservedMaterialProfiles: new Map(),
        viewedMaterialProfiles: new Map(),
      });

      const materialOnBoundary = material({ id: idOnBoundary, createdAt: onBoundary });
      const materialPastBoundary = material({ id: idPastBoundary, createdAt: justPastBoundary });

      const forward = scoreCanonicalMaterialPool({
        materials: [materialOnBoundary, materialPastBoundary],
        context: ctx,
        savedLocation: emptyLocation(),
        behavior: createEmptyBehaviorContext(),
      });
      const reversed = scoreCanonicalMaterialPool({
        materials: [materialPastBoundary, materialOnBoundary],
        context: ctx,
        savedLocation: emptyLocation(),
        behavior: createEmptyBehaviorContext(),
      });

      const byId = (rows: typeof forward) =>
        new Map(rows.map((row) => [row.material.id, row.scores]));
      const forwardById = byId(forward);
      const reversedById = byId(reversed);

      for (const id of [idOnBoundary, idPastBoundary]) {
        assert.deepEqual(forwardById.get(id), reversedById.get(id));
      }

      assert.equal(forwardById.get(idOnBoundary)!.suggested.components.recency, 5);
      assert.equal(forwardById.get(idPastBoundary)!.suggested.components.recency, 3);

      // The pool must capture evaluationTime exactly once (not once per
      // candidate/section) when `now` is omitted: 2 candidates x 2 pool
      // calls x 2 sections (suggested/free) would be 8 independent
      // new Date() reads under the old per-call-default behavior.
      assert.equal(noArgConstructions, 2);
    } finally {
      globalThis.Date = RealDate;
    }
  });
});

describe('RP-03.1 explicit scorer-version threading (fixes process-global leakage)', () => {
  // Fixture reused from learner-home.normalized-scoring.test.ts: matches
  // interest key 'art_crafts' only via the reviewed-alias vocabulary, never
  // via legacy canonical keyword matching.
  const aliasOnlyMaterial = (): LearnerHomeMaterialCandidate =>
    material({
      id: 'mat-alias-only',
      title: 'Art and Crafts',
      description: 'A reviewed interest alias only',
      materialType: 'Miscellaneous',
      categoryNameEn: 'Other Reusable Materials',
      categoryNameAr: 'مواد أخرى',
      tags: [],
      deliveryAllowed: false,
      viewsCount: 0,
      likesCount: 0,
    });

  const poolFor = (scorerVersion: 'legacy-v1' | 'normalized-interests-v2') => {
    resetMaterialFeaturePoolCacheForTests();
    return preScoreMaterialPool({
      materials: [aliasOnlyMaterial()],
      interests: ['art_crafts'],
      savedComponents: [],
      savedLocation: emptyLocation(),
      behavior: createEmptyBehaviorContext(),
      behaviorAffinityProfile: createEmptyAffinityProfile(),
      scorerVersion,
    })[0]!.scores.suggested;
  };

  test('explicit legacy-v1 does not match the reviewed-alias-only material', () => {
    const result = poolFor('legacy-v1');
    assert.equal(result.score, 0);
    assert.deepEqual(result.reasons, []);
    assert.equal(result.hasPrimaryRelevance, false);
  });

  test('explicit normalized-interests-v2 matches via reviewed alias', () => {
    const result = poolFor('normalized-interests-v2');
    assert.ok(result.score > 0);
    assert.equal(result.hasPrimaryRelevance, true);
    assert.ok(
      result.reasons.some((reason) => reason.includes('reviewed interest term')),
    );
  });

  test('fallback output (explicit legacy-v1) differs from normalized where the alias changes ranking', () => {
    const legacy = poolFor('legacy-v1');
    const normalized = poolFor('normalized-interests-v2');
    assert.notEqual(legacy.score, normalized.score);
    assert.equal(legacy.hasPrimaryRelevance, false);
    assert.equal(normalized.hasPrimaryRelevance, true);
  });

  test('canonical without a successful context throws rather than silently degrading', () => {
    resetMaterialFeaturePoolCacheForTests();
    assert.throws(
      () =>
        preScoreMaterialPool({
          materials: [aliasOnlyMaterial()],
          interests: ['art_crafts'],
          savedComponents: [],
          savedLocation: emptyLocation(),
          behavior: createEmptyBehaviorContext(),
          behaviorAffinityProfile: createEmptyAffinityProfile(),
          scorerVersion: CANONICAL_SCORING_MODE,
        }),
      (error: unknown) => error instanceof CanonicalScoringContextRequiredError,
    );
  });

  // Renamed from an earlier, over-claiming title ("whole-request fallback
  // always threads..."): this only proves that two direct explicit
  // legacy-v1 calls to preScoreMaterialPool are idempotent and identical.
  // It does NOT exercise learner-home.service.ts's real fallback retry
  // branch — see "RP-03.1 honest whole-request fallback integration" below
  // for that proof.
  test('explicit legacy-v1 calls are idempotent regardless of process-global state', () => {
    const first = poolFor('legacy-v1');
    const second = poolFor('legacy-v1');
    assert.deepEqual(first, second);
    assert.equal(first.score, 0);
  });
});

describe('RP-03.1 sealed non-canonical helper boundary', () => {
  // These five helpers are legacy/normalized-only. They must never process
  // canonical-taxonomy-v3, even when called directly (bypassing
  // preScoreMaterialPool's own canonical dispatch).
  const candidate = material({ id: 'mat-sealed-boundary' });

  test('buildMaterialRecommendationFeature(..., canonical) throws typed error', () => {
    assert.throws(
      () => buildMaterialRecommendationFeature(candidate, CANONICAL_SCORING_MODE),
      (error: unknown) => error instanceof CanonicalScoringContextRequiredError,
    );
  });

  test('getOrBuildMaterialFeaturePool(..., canonical) throws typed error', () => {
    assert.throws(
      () => getOrBuildMaterialFeaturePool([candidate], CANONICAL_SCORING_MODE),
      (error: unknown) => error instanceof CanonicalScoringContextRequiredError,
    );
  });

  test('scoreMaterialPoolWithFeatures(..., canonical) throws typed error', () => {
    assert.throws(
      () =>
        scoreMaterialPoolWithFeatures({
          materials: [candidate],
          interests: [],
          savedComponents: [],
          savedLocation: emptyLocation(),
          behavior: createEmptyBehaviorContext(),
          behaviorAffinityProfile: createEmptyAffinityProfile(),
          scorerVersion: CANONICAL_SCORING_MODE,
        }),
      (error: unknown) => error instanceof CanonicalScoringContextRequiredError,
    );
  });

  test('assessSuggestedMaterialRelevance(..., canonical) throws typed error', () => {
    assert.throws(
      () =>
        assessSuggestedMaterialRelevance({
          material: candidate,
          interests: [],
          savedComponents: [],
          savedLocation: emptyLocation(),
          scorerVersion: CANONICAL_SCORING_MODE,
        }),
      (error: unknown) => error instanceof CanonicalScoringContextRequiredError,
    );
  });

  test('buildMaterialScoringSharedState(..., canonical) throws typed error', () => {
    assert.throws(
      () =>
        buildMaterialScoringSharedState({
          material: candidate,
          interests: [],
          savedComponents: [],
          savedLocation: emptyLocation(),
          scorerVersion: CANONICAL_SCORING_MODE,
        }),
      (error: unknown) => error instanceof CanonicalScoringContextRequiredError,
    );
  });

  test('explicit legacy and normalized behavior remains unchanged through the sealed resolver', () => {
    resetMaterialFeaturePoolCacheForTests();
    const legacyFeature = buildMaterialRecommendationFeature(candidate, 'legacy-v1');
    const normalizedFeature = buildMaterialRecommendationFeature(candidate, 'normalized-interests-v2');
    assert.equal(legacyFeature.materialId, candidate.id);
    assert.equal(normalizedFeature.materialId, candidate.id);

    const relevanceLegacy = assessSuggestedMaterialRelevance({
      material: candidate,
      interests: ['arduino'],
      savedComponents: [],
      savedLocation: emptyLocation(),
      scorerVersion: 'legacy-v1',
    });
    assert.equal(relevanceLegacy.interestMatch?.key, 'arduino');

    const sharedNormalized = buildMaterialScoringSharedState({
      material: candidate,
      interests: ['arduino'],
      savedComponents: [],
      savedLocation: emptyLocation(),
      scorerVersion: 'normalized-interests-v2',
    });
    assert.equal(sharedNormalized.interestMatch?.key, 'arduino');
  });
});

describe('RP-03.1 honest whole-request fallback integration', () => {
  test('preScoreMaterials real catch/retry branch: canonical context failure produces output identical to an explicit legacy-v1 call', () => {
    const candidateMaterial = material({ id: 'mat-fallback-integration' });
    const baseInput = {
      materials: [candidateMaterial],
      interests: [],
      savedComponents: [],
      savedLocation: emptyLocation(),
      behavior: createEmptyBehaviorContext(),
      behaviorAffinityProfile: createEmptyAffinityProfile(),
    };

    // Simulates the inconsistent state that forces preScoreMaterialPool's own
    // required-context guard to throw: requested and effective mode both say
    // canonical, but no successful canonicalContext is attached. This
    // exercises preScoreMaterials's REAL try/catch fallback branch (the
    // exported production function itself, not a re-implementation of it).
    const brokenContext: LearnerHomeContext = {
      ...baseInput,
      projects: [],
      savedProjectItems: [],
      inProgressBuilds: [],
      savedProjectIds: new Set(),
      hasSavedProjects: false,
      hasActivity: false,
      modeDecision: buildLearnerHomeModeDecision({
        requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
        effectiveMaterialScoringMode: CANONICAL_SCORING_MODE,
        fallbackCode: null,
        cacheable: true,
      }),
      canonicalContext: undefined,
    };

    resetMaterialFeaturePoolCacheForTests();
    const fallbackResult = preScoreMaterials(brokenContext);

    // The catch branch must have downgraded the mode decision in place.
    assert.equal(brokenContext.modeDecision.effectiveMaterialScoringMode, 'legacy-v1');
    assert.equal(
      brokenContext.modeDecision.fallbackCode,
      'CANONICAL_SCORER_INVARIANT_FALLBACK',
    );
    assert.equal(brokenContext.modeDecision.cacheable, false);

    resetMaterialFeaturePoolCacheForTests();
    const explicitLegacyResult = preScoreMaterialPool({
      ...baseInput,
      scorerVersion: 'legacy-v1',
    });

    assert.deepEqual(
      fallbackResult.map((entry) => entry.scores.suggested),
      explicitLegacyResult.map((entry) => entry.scores.suggested),
    );
  });
});

describe('RP-03.1 domain-truthful algorithm identity (mode decision)', () => {
  test('canonical success: material stamps canonical, project stays legacy', () => {
    const decision = buildLearnerHomeModeDecision({
      requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
      effectiveMaterialScoringMode: CANONICAL_SCORING_MODE,
      fallbackCode: null,
      cacheable: true,
    });
    assert.equal(decision.effectiveMaterialScoringMode, CANONICAL_SCORING_MODE);
    assert.equal(decision.effectiveProjectScoringMode, 'legacy-v1');
    assert.equal(decision.fallbackCode, null);
    assert.equal(decision.cacheable, true);
    assert.equal(
      algorithmVersionForEffectiveMode(decision.effectiveMaterialScoringMode),
      'learner-home-v1:canonical-taxonomy-v3',
    );
    assert.equal(
      algorithmVersionForEffectiveMode(decision.effectiveProjectScoringMode),
      'learner-home-v1:legacy-v1',
    );
  });

  test('full home stamps a truthful mixed material/project stamp when material is canonical', () => {
    const decision = buildLearnerHomeModeDecision({
      requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
      effectiveMaterialScoringMode: CANONICAL_SCORING_MODE,
      fallbackCode: null,
      cacheable: true,
    });
    assert.equal(
      algorithmVersionForModeDecision(decision),
      'learner-home-v1:material=canonical-taxonomy-v3;project=legacy-v1',
    );
  });

  test('material fallback: both domains stamp legacy-v1 and fallbackCode remains internally observable', () => {
    const decision = buildLearnerHomeModeDecision({
      requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
      effectiveMaterialScoringMode: 'legacy-v1',
      fallbackCode: 'CANONICAL_LOADER_FALLBACK_LEGACY_V1',
      cacheable: false,
    });
    assert.equal(decision.effectiveMaterialScoringMode, 'legacy-v1');
    assert.equal(decision.effectiveProjectScoringMode, 'legacy-v1');
    assert.equal(algorithmVersionForModeDecision(decision), 'learner-home-v1:legacy-v1');
    // fallbackCode must not disappear after context construction.
    assert.equal(decision.fallbackCode, 'CANONICAL_LOADER_FALLBACK_LEGACY_V1');
    assert.equal(decision.cacheable, false);
  });

  test('legacy/normalized requests: both domains match the requested mode exactly', () => {
    const legacyDecision = buildLearnerHomeModeDecision({
      requestedMaterialScoringMode: 'legacy-v1',
      effectiveMaterialScoringMode: 'legacy-v1',
      fallbackCode: null,
      cacheable: true,
    });
    assert.equal(legacyDecision.effectiveProjectScoringMode, 'legacy-v1');
    assert.equal(algorithmVersionForModeDecision(legacyDecision), 'learner-home-v1:legacy-v1');

    const normalizedDecision = buildLearnerHomeModeDecision({
      requestedMaterialScoringMode: 'normalized-interests-v2',
      effectiveMaterialScoringMode: 'normalized-interests-v2',
      fallbackCode: null,
      cacheable: true,
    });
    assert.equal(normalizedDecision.effectiveProjectScoringMode, 'normalized-interests-v2');
    assert.equal(
      algorithmVersionForModeDecision(normalizedDecision),
      'learner-home-v1:normalized-interests-v2',
    );
  });

  test('a project ranking is never stamped canonical-taxonomy-v3', () => {
    for (const requested of [
      'legacy-v1',
      'normalized-interests-v2',
      CANONICAL_SCORING_MODE,
    ] as const) {
      const decision = buildLearnerHomeModeDecision({
        requestedMaterialScoringMode: requested,
        effectiveMaterialScoringMode: requested,
        fallbackCode: null,
        cacheable: true,
      });
      assert.notEqual(decision.effectiveProjectScoringMode, CANONICAL_SCORING_MODE);
    }
  });
});

describe('RP-03.1 context completeness before availability handling', () => {
  test('unavailable candidate missing from the profile map throws a typed context invariant', () => {
    const ctx = createSuccessfulCanonicalContext({
      candidateMaterialProfiles: new Map(),
      likedMaterialProfiles: new Map(),
      reservedMaterialProfiles: new Map(),
      viewedMaterialProfiles: new Map(),
    });
    const unavailableCandidate = material({
      id: 'mat-unavailable-missing',
      status: 'RESERVED',
      availableQuantity: 0,
    });

    assert.throws(
      () =>
        scoreCanonicalMaterialCandidate({
          candidate: unavailableCandidate,
          context: ctx,
          savedLocation: emptyLocation(),
          behavior: createEmptyBehaviorContext(),
        }),
      (error: unknown) => error instanceof CanonicalContextInvariantError,
    );
  });

  test('unavailable candidate with a valid profile reports factual coverage, not CONTEXT_MISSING', () => {
    const unavailableCandidate = material({
      id: 'mat-unavailable-valid',
      status: 'AVAILABLE',
      availableQuantity: 0,
    });
    const candidateProfile = familyForm('mat-unavailable-valid');
    const ctx = contextWith({ candidate: candidateProfile });

    const scored = scoreCanonicalMaterialCandidate({
      candidate: unavailableCandidate,
      context: ctx,
      savedLocation: emptyLocation(),
      behavior: createEmptyBehaviorContext(),
    });

    assert.equal(scored.score, -1000);
    assert.equal(scored.semanticCoverage, 'READY_FAMILY_ONLY');
    assert.notEqual(scored.semanticCoverage, 'CONTEXT_MISSING');
    // Correction #3: the breakdown must be able to derive -1000, not report
    // all zeros alongside a nonzero score.
    assert.equal(scored.components.unavailablePenalty, 1000);
    assertCanonicalScoreMatchesComponents(scored);
  });

  test('unavailable candidate with a MISSING_CANONICAL_ASSIGNMENT profile reports that fact, not CONTEXT_MISSING', () => {
    const unavailableCandidate = material({
      id: 'mat-unavailable-missing-assignment',
      status: 'AVAILABLE',
      availableQuantity: 0,
    });
    const candidateProfile = projectCanonicalMaterialProfile(
      'mat-unavailable-missing-assignment',
      [],
    );
    const ctx = contextWith({ candidate: candidateProfile });

    const scored = scoreCanonicalMaterialCandidate({
      candidate: unavailableCandidate,
      context: ctx,
      savedLocation: emptyLocation(),
      behavior: createEmptyBehaviorContext(),
    });

    assert.equal(scored.score, -1000);
    assert.equal(scored.semanticCoverage, 'MISSING_CANONICAL_ASSIGNMENT');
    assertCanonicalScoreMatchesComponents(scored);
  });

  test('non-free candidate evaluated for the free section reports the unavailable penalty in its breakdown', () => {
    const nonFreeCandidate = material({
      id: 'mat-non-free',
      isFree: false,
      status: 'AVAILABLE',
      availableQuantity: 5,
    });
    const candidateProfile = familyForm('mat-non-free');
    const ctx = contextWith({ candidate: candidateProfile });

    const scored = scoreCanonicalMaterialCandidate({
      candidate: nonFreeCandidate,
      context: ctx,
      savedLocation: emptyLocation(),
      behavior: createEmptyBehaviorContext(),
      section: 'free',
    });

    assert.equal(scored.score, -1000);
    assert.equal(scored.components.unavailablePenalty, 1000);
    assertCanonicalScoreMatchesComponents(scored);
  });

  test('savedProjects section breakdown is contribution-exact (mirrors suggested)', () => {
    const candidate = material({ id: 'mat-saved', deliveryAllowed: true, isFree: true });
    const candidateProfile = familyForm('mat-saved');
    const ctx = contextWith({ candidate: candidateProfile });

    const pool = scoreCanonicalMaterialPool({
      materials: [candidate],
      context: ctx,
      savedLocation: { city: 'Ramallah', area: null },
      behavior: createEmptyBehaviorContext(),
      now: new Date('2026-07-20T00:00:00.000Z'),
    });
    const savedProjects = pool[0]!.scores.savedProjects;
    assert.equal(savedProjects.components.savedComponent, 0);
    assert.ok(
      savedProjects.internalReasonCodes.includes('CANONICAL_COMPONENT_RELATION_UNAVAILABLE'),
    );
    assertCanonicalScoreMatchesComponents(savedProjects);
  });

  test('free section breakdown zeros non-contributing fields even when behavior/delivery would otherwise apply', () => {
    // deliveryAllowed true and a reserved-identity match would contribute
    // under 'suggested', but the free-score formula never adds delivery or
    // behavior overlap — the returned breakdown must say so honestly.
    const candidate = material({
      id: 'mat-free-with-signals',
      isFree: true,
      deliveryAllowed: true,
    });
    const candidateProfile = familyForm('mat-free-with-signals');
    // Reserved-identity match: the reserved signal is the candidate itself,
    // so its profile must also be present in reservedMaterialProfiles to
    // satisfy the complete-behavior-map invariant (identity does not bypass
    // context completeness).
    const ctx = contextWith({
      candidate: candidateProfile,
      reserved: [candidateProfile],
    });
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      reservedMaterials: [
        {
          materialId: 'mat-free-with-signals',
          title: 'x',
          description: '',
          materialType: 'x',
          categoryNameEn: '',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };

    const scored = scoreCanonicalMaterialCandidate({
      candidate,
      context: ctx,
      savedLocation: emptyLocation(),
      behavior,
      now: new Date('2026-07-20T00:00:00.000Z'),
      section: 'free',
    });

    assert.equal(scored.components.delivery, 0);
    assert.equal(scored.components.reservedSimilarity, 0);
    assert.equal(scored.components.alreadyLikedPenalty, 0);
    assertCanonicalScoreMatchesComponents(scored);
  });
});

describe('RP-03.1 material-concept hydration chunking (repository test seam)', () => {
  const chunkQueryEcho = async (chunk: readonly string[]) =>
    chunk.map((materialId) => ({
      materialId,
      concept: {
        canonicalKey: 'material-family:electronics',
        conceptType: 'MATERIAL_FAMILY',
        status: 'ACTIVE',
      },
    }));

  test('450 ids chunk deterministically into 200/200/50 with complete coverage', async () => {
    const ids = Array.from({ length: 450 }, (_, index) => `mat-${String(index).padStart(4, '0')}`);
    const chunkSizes: number[] = [];
    const map = await loadMaterialConceptsForScoring(ids, async (chunk) => {
      chunkSizes.push(chunk.length);
      return chunkQueryEcho(chunk);
    });

    assert.deepEqual(chunkSizes, [200, 200, 50]);
    assert.equal(map.size, 450);
    for (const id of ids) {
      assert.ok(map.has(id), `expected coverage for ${id}`);
      assert.equal(map.get(id)!.length, 1);
    }
  });

  test('reordered input produces equivalent chunk sizes and complete coverage', async () => {
    const ids = Array.from({ length: 450 }, (_, index) => `mat-${String(index).padStart(4, '0')}`);
    const reordered = [...ids].reverse();
    const chunkSizes: number[] = [];
    const map = await loadMaterialConceptsForScoring(reordered, async (chunk) => {
      chunkSizes.push(chunk.length);
      return chunkQueryEcho(chunk);
    });

    assert.deepEqual(chunkSizes, [200, 200, 50]);
    assert.equal(map.size, 450);
    for (const id of ids) {
      assert.ok(map.has(id), `expected coverage for ${id}`);
    }
  });

  test('no candidate truncation even with duplicate ids interleaved', async () => {
    const ids = Array.from({ length: 450 }, (_, index) => `mat-${String(index).padStart(4, '0')}`);
    const withDuplicates = [...ids, ...ids.slice(0, 10)];
    const map = await loadMaterialConceptsForScoring(withDuplicates, chunkQueryEcho);
    assert.equal(map.size, 450);
  });
});

describe('RP-03.1 cache correctness: fallback never cached under the canonical key', () => {
  test('canonical fallback is not cached; a later canonical success is cached and reused', async () => {
    type FakePayload = { cacheable: boolean; effectiveMode: string; token: number };
    let loadCount = 0;
    const cache = createLearnerHomeCacheForTests<FakePayload>(
      async () => {
        loadCount += 1;
        if (loadCount === 1) {
          return { cacheable: false, effectiveMode: 'legacy-v1', token: loadCount };
        }
        return { cacheable: true, effectiveMode: CANONICAL_SCORING_MODE, token: loadCount };
      },
      Date.now,
      (payload) => payload.cacheable,
    );

    // 1. canonical request; 2. registry/concept loader fails; 3. legacy
    // fallback is returned.
    const first = await cache.getWithState('learner-x');
    assert.equal(first.state, 'MISS');
    assert.equal(first.payload.effectiveMode, 'legacy-v1');
    assert.equal(loadCount, 1);

    // 4. no canonical cache write occurs: the loader must run again.
    const second = await cache.getWithState('learner-x');
    assert.equal(second.state, 'MISS');
    assert.equal(second.payload.effectiveMode, CANONICAL_SCORING_MODE);
    assert.equal(loadCount, 2);

    // 5. loader succeeds; 6. canonical scorer executes; the successful
    // canonical result was cacheable, so a third read must hit cache.
    const third = await cache.getWithState('learner-x');
    assert.equal(third.state, 'HIT');
    assert.equal(loadCount, 2);
    assert.equal(third.payload.token, 2);

    // 7. the previous fallback result is never reused as a successful
    // canonical result.
    assert.notEqual(first.payload.effectiveMode, third.payload.effectiveMode);
  });
});

describe('RP-03.1 skip canonical material hydration for project-only section requests', () => {
  const spyOnMaterialConceptFindMany = () => {
    const original = prisma.materialConcept.findMany.bind(prisma.materialConcept);
    let callCount = 0;
    // @ts-expect-error test-only monkeypatch of a mutable Prisma delegate method; restored by the caller
    prisma.materialConcept.findMany = (...args: unknown[]) => {
      callCount += 1;
      // Never touch the real DB: return an empty result synchronously.
      return Promise.resolve([]);
    };
    return {
      getCallCount: () => callCount,
      restore: () => {
        prisma.materialConcept.findMany = original;
      },
    };
  };

  const smallMaterials = (count: number): LearnerHomeMaterialCandidate[] =>
    Array.from({ length: count }, (_, index) => material({ id: `mat-hydration-${index}` }));

  test('canonical suggested_projects-equivalent request (needsCanonicalMaterialScoring=false) issues zero concept-loader calls', async () => {
    const spy = spyOnMaterialConceptFindMany();
    try {
      const { modeDecision, canonicalContext } = await resolveMaterialModeDecisionAndContext({
        requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
        needsCanonicalMaterialScoring: false,
        materials: smallMaterials(3),
        behavior: createEmptyBehaviorContext(),
      });

      assert.equal(spy.getCallCount(), 0);
      assert.equal(canonicalContext, undefined);
      // No fallback was recorded: hydration was never attempted, so there is
      // nothing to fall back from.
      assert.equal(modeDecision.fallbackCode, null);
      assert.equal(modeDecision.cacheable, true);
    } finally {
      spy.restore();
    }
  });

  test('canonical popular_projects-equivalent request issues zero concept-loader calls', async () => {
    const spy = spyOnMaterialConceptFindMany();
    try {
      const { canonicalContext } = await resolveMaterialModeDecisionAndContext({
        requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
        needsCanonicalMaterialScoring: false,
        materials: smallMaterials(3),
        behavior: createEmptyBehaviorContext(),
      });
      assert.equal(spy.getCallCount(), 0);
      assert.equal(canonicalContext, undefined);
    } finally {
      spy.restore();
    }
  });

  test('canonical suggested_materials-equivalent request performs exactly one context-hydration operation', async () => {
    const spy = spyOnMaterialConceptFindMany();
    try {
      const { modeDecision, canonicalContext } = await resolveMaterialModeDecisionAndContext({
        requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
        needsCanonicalMaterialScoring: true,
        materials: smallMaterials(3),
        behavior: createEmptyBehaviorContext(),
      });
      assert.equal(spy.getCallCount(), 1);
      assert.equal(modeDecision.effectiveMaterialScoringMode, CANONICAL_SCORING_MODE);
      assert.notEqual(canonicalContext, undefined);
    } finally {
      spy.restore();
    }
  });

  test('canonical full-home-equivalent request performs exactly one context-hydration operation', async () => {
    const spy = spyOnMaterialConceptFindMany();
    try {
      const { modeDecision } = await resolveMaterialModeDecisionAndContext({
        requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
        needsCanonicalMaterialScoring: true,
        materials: smallMaterials(5),
        behavior: createEmptyBehaviorContext(),
      });
      assert.equal(spy.getCallCount(), 1);
      assert.equal(modeDecision.effectiveMaterialScoringMode, CANONICAL_SCORING_MODE);
    } finally {
      spy.restore();
    }
  });

  test('legacy-v1 requested: needsCanonicalMaterialScoring is irrelevant, zero calls either way', async () => {
    const spy = spyOnMaterialConceptFindMany();
    try {
      const trueCase = await resolveMaterialModeDecisionAndContext({
        requestedMaterialScoringMode: 'legacy-v1',
        needsCanonicalMaterialScoring: true,
        materials: smallMaterials(3),
        behavior: createEmptyBehaviorContext(),
      });
      const falseCase = await resolveMaterialModeDecisionAndContext({
        requestedMaterialScoringMode: 'legacy-v1',
        needsCanonicalMaterialScoring: false,
        materials: smallMaterials(3),
        behavior: createEmptyBehaviorContext(),
      });
      assert.equal(spy.getCallCount(), 0);
      assert.equal(trueCase.modeDecision.effectiveMaterialScoringMode, 'legacy-v1');
      assert.equal(falseCase.modeDecision.effectiveMaterialScoringMode, 'legacy-v1');
    } finally {
      spy.restore();
    }
  });
});

describe('RP-03.1 canonical weak-fallback gate uses only canonical-supported material activity', () => {
  const buildContextFor = (candidateId: string) => {
    const candidateProfile = familyForm(candidateId, 'material-family:electronics', 'material-form:arduino-board');
    return contextWith({ candidate: candidateProfile });
  };

  test('saved-project activity only does not suppress location/free/popularity/recency fallback', () => {
    const candidate = material({
      id: 'mat-project-activity-1',
      isFree: true,
      city: 'Ramallah',
      area: null,
    });
    const ctx = buildContextFor('mat-project-activity-1');
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      savedProjects: [
        {
          projectId: 'proj-1',
          title: 'Saved project',
          shortDescription: '',
          categoryNameEn: '',
          categoryNameAr: '',
          tags: [],
          components: [],
        },
      ],
    };

    const scored = scoreCanonicalMaterialCandidate({
      candidate,
      context: ctx,
      savedLocation: { city: 'Ramallah', area: null },
      behavior,
      now: new Date('2026-07-20T00:00:00.000Z'),
    });

    // Project-only activity must not count as canonical-supported material
    // activity: the weak-only fallback gate remains open, so free/location
    // bonuses still apply.
    assert.ok(scored.score > 0);
    assert.equal(scored.fallbackOnly, true);
    assertCanonicalScoreMatchesComponents(scored);
  });

  test('followed/liked-project activity only does not suppress fallback', () => {
    const candidate = material({
      id: 'mat-project-activity-2',
      isFree: true,
      city: 'Ramallah',
      area: null,
    });
    const ctx = buildContextFor('mat-project-activity-2');
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      likedProjects: [
        {
          projectId: 'proj-liked',
          title: 'Liked project',
          shortDescription: '',
          categoryNameEn: '',
          categoryNameAr: '',
          tags: [],
          components: [],
        },
      ],
      followedProjects: [
        {
          projectId: 'proj-followed',
          title: 'Followed project',
          shortDescription: '',
          categoryNameEn: '',
          categoryNameAr: '',
          tags: [],
          components: [],
        },
      ],
    };

    const scored = scoreCanonicalMaterialCandidate({
      candidate,
      context: ctx,
      savedLocation: { city: 'Ramallah', area: null },
      behavior,
      now: new Date('2026-07-20T00:00:00.000Z'),
    });

    assert.ok(scored.score > 0);
    assert.equal(scored.fallbackOnly, true);
    assertCanonicalScoreMatchesComponents(scored);
  });

  test('material activity with no family/form overlap retains the active-user relevance gate (no fallback score)', () => {
    const candidate = material({
      id: 'mat-activity-no-overlap',
      isFree: true,
      city: 'Ramallah',
      area: null,
    });
    const candidateProfile = familyForm('mat-activity-no-overlap');
    const unrelatedLiked = familyForm('mat-unrelated-liked', 'material-family:wood');
    const ctx = contextWith({
      candidate: candidateProfile,
      liked: [unrelatedLiked],
    });
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      likedMaterials: [
        {
          materialId: 'mat-unrelated-liked',
          title: 'Unrelated',
          description: '',
          materialType: 'x',
          categoryNameEn: '',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };

    const scored = scoreCanonicalMaterialCandidate({
      candidate,
      context: ctx,
      savedLocation: { city: 'Ramallah', area: null },
      behavior,
      now: new Date('2026-07-20T00:00:00.000Z'),
    });

    // Material activity exists (liked materials non-empty) but no overlap:
    // allowsWeakOnlyFallback is false (hasActivity=true), so the explicit
    // active-user relevance gate applies and this candidate scores 0 despite
    // being free and near the saved location.
    assert.equal(scored.score, 0);
    assertCanonicalScoreMatchesComponents(scored);
  });

  test('material activity with form overlap still produces canonical behavior scoring', () => {
    const candidate = material({ id: 'mat-activity-with-overlap' });
    const candidateProfile = familyForm(
      'mat-activity-with-overlap',
      'material-family:electronics',
      'material-form:arduino-board',
    );
    const likedProfile = familyForm(
      'mat-liked-overlap',
      'material-family:electronics',
      'material-form:arduino-board',
    );
    const ctx = contextWith({
      candidate: candidateProfile,
      liked: [likedProfile],
    });
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      likedMaterials: [
        {
          materialId: 'mat-liked-overlap',
          title: 'Liked',
          description: '',
          materialType: 'x',
          categoryNameEn: '',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };

    const scored = scoreCanonicalMaterialCandidate({
      candidate,
      context: ctx,
      savedLocation: emptyLocation(),
      behavior,
      now: new Date('2026-07-20T00:00:00.000Z'),
    });

    assert.equal(scored.components.likedSimilarity, BEHAVIOR_SCORE_WEIGHTS.likedSimilar);
    assert.ok(scored.score > 0);
    assertCanonicalScoreMatchesComponents(scored);
  });
});

describe('RP-03.1 complete behavior profile map invariants', () => {
  test('missing liked profile entry throws a typed context invariant', () => {
    const candidateProfile = familyForm('mat-1');
    const ctx = contextWith({ candidate: candidateProfile }); // no liked profiles at all
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      likedMaterials: [
        {
          materialId: 'mat-liked-missing',
          title: 'x',
          description: '',
          materialType: 'x',
          categoryNameEn: '',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };

    assert.throws(
      () =>
        scoreCanonicalMaterialCandidate({
          candidate: material({ id: 'mat-1' }),
          context: ctx,
          savedLocation: emptyLocation(),
          behavior,
        }),
      (error: unknown) => {
        if (!(error instanceof CanonicalContextInvariantError)) return false;
        // No raw material IDs in the exception message.
        assert.doesNotMatch(error.message, /mat-liked-missing/);
        return true;
      },
    );
  });

  test('missing reserved profile entry throws a typed context invariant', () => {
    const candidateProfile = familyForm('mat-1');
    const ctx = contextWith({ candidate: candidateProfile });
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      reservedMaterials: [
        {
          materialId: 'mat-reserved-missing',
          title: 'x',
          description: '',
          materialType: 'x',
          categoryNameEn: '',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };

    assert.throws(
      () =>
        scoreCanonicalMaterialCandidate({
          candidate: material({ id: 'mat-1' }),
          context: ctx,
          savedLocation: emptyLocation(),
          behavior,
        }),
      (error: unknown) => {
        if (!(error instanceof CanonicalContextInvariantError)) return false;
        assert.doesNotMatch(error.message, /mat-reserved-missing/);
        return true;
      },
    );
  });

  test('missing viewed profile entry throws a typed context invariant', () => {
    const candidateProfile = familyForm('mat-1');
    const ctx = contextWith({ candidate: candidateProfile });
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      viewedMaterials: [
        {
          materialId: 'mat-viewed-missing',
          title: 'x',
          description: '',
          materialType: 'x',
          categoryNameEn: '',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };

    assert.throws(
      () =>
        scoreCanonicalMaterialCandidate({
          candidate: material({ id: 'mat-1' }),
          context: ctx,
          savedLocation: emptyLocation(),
          behavior,
        }),
      (error: unknown) => {
        if (!(error instanceof CanonicalContextInvariantError)) return false;
        assert.doesNotMatch(error.message, /mat-viewed-missing/);
        return true;
      },
    );
  });

  test('present entry with MISSING_CANONICAL_ASSIGNMENT does not throw and contributes zero overlap', () => {
    const candidateProfile = familyForm('mat-1');
    const likedDefectiveProfile = projectCanonicalMaterialProfile('mat-liked-defective', []);
    const ctx = contextWith({
      candidate: candidateProfile,
      liked: [likedDefectiveProfile],
    });
    const behavior: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      likedMaterials: [
        {
          materialId: 'mat-liked-defective',
          title: 'x',
          description: '',
          materialType: 'x',
          categoryNameEn: '',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };

    const scored = scoreCanonicalMaterialCandidate({
      candidate: material({ id: 'mat-1' }),
      context: ctx,
      savedLocation: emptyLocation(),
      behavior,
      now: new Date('2026-07-20T00:00:00.000Z'),
    });

    assert.equal(scored.components.likedSimilarity, 0);
    assertCanonicalScoreMatchesComponents(scored);
  });

  test('production fallback result (missing behavior profile) equals explicit legacy-v1', () => {
    const materialWithMissingSignal = material({ id: 'mat-fallback-behavior-map' });
    const baseInput = {
      materials: [materialWithMissingSignal],
      interests: [],
      savedComponents: [],
      savedLocation: emptyLocation(),
      behaviorAffinityProfile: createEmptyAffinityProfile(),
    };
    const behaviorWithMissingSignal: LearnerBehaviorContext = {
      ...createEmptyBehaviorContext(),
      likedMaterials: [
        {
          materialId: 'mat-with-no-profile-entry',
          title: 'x',
          description: '',
          materialType: 'x',
          categoryNameEn: '',
          categoryNameAr: '',
          tags: [],
        },
      ],
    };
    const candidateProfile = familyForm('mat-fallback-behavior-map');

    const brokenContext: LearnerHomeContext = {
      materials: [materialWithMissingSignal],
      interests: [],
      savedComponents: [],
      savedLocation: emptyLocation(),
      behavior: behaviorWithMissingSignal,
      behaviorAffinityProfile: createEmptyAffinityProfile(),
      projects: [],
      savedProjectItems: [],
      inProgressBuilds: [],
      savedProjectIds: new Set(),
      hasSavedProjects: false,
      hasActivity: false,
      modeDecision: buildLearnerHomeModeDecision({
        requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
        effectiveMaterialScoringMode: CANONICAL_SCORING_MODE,
        fallbackCode: null,
        cacheable: true,
      }),
      canonicalContext: createSuccessfulCanonicalContext({
        candidateMaterialProfiles: new Map([[candidateProfile.materialId, candidateProfile]]),
        likedMaterialProfiles: new Map(), // 'mat-with-no-profile-entry' intentionally absent
        reservedMaterialProfiles: new Map(),
        viewedMaterialProfiles: new Map(),
      }),
    };

    resetMaterialFeaturePoolCacheForTests();
    const fallbackResult = preScoreMaterials(brokenContext);
    assert.equal(brokenContext.modeDecision.effectiveMaterialScoringMode, 'legacy-v1');
    assert.equal(brokenContext.modeDecision.cacheable, false);

    resetMaterialFeaturePoolCacheForTests();
    const explicitLegacyResult = preScoreMaterialPool({
      ...baseInput,
      behavior: behaviorWithMissingSignal,
      scorerVersion: 'legacy-v1',
    });

    assert.deepEqual(
      fallbackResult.map((entry) => entry.scores.suggested),
      explicitLegacyResult.map((entry) => entry.scores.suggested),
    );
  });
});

describe('RP-03.1 preScoreMaterials: original errors preserved, only one canonical retry', () => {
  const malformedMaterial = (id: string): LearnerHomeMaterialCandidate =>
    ({ ...material({ id }), tags: undefined }) as unknown as LearnerHomeMaterialCandidate;

  const contextFor = (
    modeDecision: ReturnType<typeof buildLearnerHomeModeDecision>,
    materials: LearnerHomeMaterialCandidate[],
    canonicalContext?: LearnerHomeContext['canonicalContext'],
  ): LearnerHomeContext => ({
    materials,
    interests: [],
    savedComponents: [],
    savedLocation: emptyLocation(),
    behavior: createEmptyBehaviorContext(),
    behaviorAffinityProfile: createEmptyAffinityProfile(),
    projects: [],
    savedProjectItems: [],
    inProgressBuilds: [],
    savedProjectIds: new Set(),
    hasSavedProjects: false,
    hasActivity: false,
    modeDecision,
    canonicalContext,
  });

  test('canonical scorer invariant (both requested and effective canonical) triggers exactly one legacy retry', () => {
    const context = contextFor(
      buildLearnerHomeModeDecision({
        requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
        effectiveMaterialScoringMode: CANONICAL_SCORING_MODE,
        fallbackCode: null,
        cacheable: true,
      }),
      [material({ id: 'mat-retry-1' })],
      undefined, // missing context forces preScoreMaterialPool to throw
    );

    resetMaterialFeaturePoolCacheForTests();
    const result = preScoreMaterials(context);
    assert.equal(context.modeDecision.effectiveMaterialScoringMode, 'legacy-v1');
    assert.equal(context.modeDecision.fallbackCode, 'CANONICAL_SCORER_INVARIANT_FALLBACK');
    assert.equal(context.modeDecision.cacheable, false);
    assert.ok(result.length === 1);
  });

  test('already-effective-legacy + a legacy error → no second retry, original error and fallbackCode preserved', () => {
    const context = contextFor(
      buildLearnerHomeModeDecision({
        requestedMaterialScoringMode: CANONICAL_SCORING_MODE,
        effectiveMaterialScoringMode: 'legacy-v1', // already downgraded by an earlier loader fallback
        fallbackCode: 'CANONICAL_LOADER_FALLBACK_LEGACY_V1',
        cacheable: false,
      }),
      [malformedMaterial('mat-already-legacy-error')],
      undefined,
    );

    resetMaterialFeaturePoolCacheForTests();
    assert.throws(
      () => preScoreMaterials(context),
      (error: unknown) => error instanceof TypeError,
    );
    // fallbackCode must remain the ORIGINAL loader-fallback code — no second
    // (nonexistent) scorer-invariant retry overwrote it.
    assert.equal(context.modeDecision.fallbackCode, 'CANONICAL_LOADER_FALLBACK_LEGACY_V1');
    assert.equal(context.modeDecision.effectiveMaterialScoringMode, 'legacy-v1');
  });

  test('explicit legacy-v1 request: the original error object is rethrown unchanged, not a generic wrapper', () => {
    const context = contextFor(
      buildLearnerHomeModeDecision({
        requestedMaterialScoringMode: 'legacy-v1',
        effectiveMaterialScoringMode: 'legacy-v1',
        fallbackCode: null,
        cacheable: true,
      }),
      [malformedMaterial('mat-legacy-error')],
      undefined,
    );

    resetMaterialFeaturePoolCacheForTests();
    let caught: unknown;
    try {
      preScoreMaterials(context);
      assert.fail('expected preScoreMaterials to throw');
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof TypeError);
    assert.notEqual((caught as Error).message, 'preScoreMaterials failed');
  });

  test('explicit normalized-interests-v2 request: the original error object is rethrown unchanged', () => {
    const context = contextFor(
      buildLearnerHomeModeDecision({
        requestedMaterialScoringMode: 'normalized-interests-v2',
        effectiveMaterialScoringMode: 'normalized-interests-v2',
        fallbackCode: null,
        cacheable: true,
      }),
      [malformedMaterial('mat-normalized-error')],
      undefined,
    );

    resetMaterialFeaturePoolCacheForTests();
    let caught: unknown;
    try {
      preScoreMaterials(context);
      assert.fail('expected preScoreMaterials to throw');
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof TypeError);
    assert.notEqual((caught as Error).message, 'preScoreMaterials failed');
  });
});
