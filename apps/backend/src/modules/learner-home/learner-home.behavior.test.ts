import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildBehaviorAffinityProfile,
  createEmptyBehaviorContext,
  hasLearnerActivity,
  scoreMaterialBehaviorMatch,
} from './learner-home.affinity.js';
import {
  sortAllRankedMaterials,
  SAVED_PROJECT_MATERIAL_TIERS,
  SUGGESTED_MATERIAL_TIERS,
  FREE_MATERIAL_TIERS,
} from './learner-home.ranking.js';
import {
  resolveSuggestedMaterialsSubtitle,
  scoreFreeNearbyMaterial,
  scoreMaterialForSavedProjects,
  scoreSuggestedMaterial,
} from './learner-home.scoring.js';
import { parseLearnerHomeSectionQuery } from './learner-home.validation.js';
import type {
  LearnerBehaviorContext,
  LearnerBehaviorMaterialSignal,
  LearnerHomeMaterialCandidate,
} from './learner-home.types.js';

const materialSignal = (
  overrides: Partial<LearnerBehaviorMaterialSignal> = {},
): LearnerBehaviorMaterialSignal => ({
  materialId: 'material-1',
  title: 'Wax Molds',
  description: 'Craft wax molds for casting',
  materialType: 'Craft supplies',
  categoryNameEn: 'Art, Craft & Molding',
  categoryNameAr: 'Art, Craft & Molding',
  tags: ['wax', 'craft', 'molding'],
  ...overrides,
});

const baseMaterial = (
  overrides: Partial<LearnerHomeMaterialCandidate> = {},
): LearnerHomeMaterialCandidate => ({
  id: 'material-1',
  ownerId: 'owner-1',
  title: 'Wax Molds',
  description: 'Craft wax molds for casting',
  materialType: 'Craft supplies',
  categoryId: 'cat-craft',
  categoryNameEn: 'Art, Craft & Molding',
  categoryNameAr: 'Art, Craft & Molding',
  status: 'AVAILABLE',
  isFree: false,
  deliveryAllowed: false,
  pickupAllowed: true,
  viewsCount: 2,
  likesCount: 0,
  city: 'Ramallah',
  area: null,
  tags: ['wax', 'craft'],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  availableQuantity: 3,
  mapped: {},
  ...overrides,
});

const buildBehavior = (
  overrides: Partial<LearnerBehaviorContext> = {},
): LearnerBehaviorContext => ({
  ...createEmptyBehaviorContext(),
  ...overrides,
});

describe('learner-home activity correctness', () => {
  test('new learner with interests but no behavior has hasActivity false', () => {
    assert.equal(hasLearnerActivity(createEmptyBehaviorContext()), false);
  });

  test('new learner with interests never gets Matches your recent activity', () => {
    const scored = scoreSuggestedMaterial({
      material: baseMaterial(),
      interests: ['art_crafts'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behavior: createEmptyBehaviorContext(),
      behaviorAffinityProfile: buildBehaviorAffinityProfile(createEmptyBehaviorContext()),
    });

    assert.ok(scored.score > 0);
    assert.equal(
      scored.reasons.some((reason) =>
        reason.toLowerCase().includes('recent activity'),
      ),
      false,
    );
    assert.ok(
      scored.reasons.some((reason) => reason.includes('Art & Crafts')),
    );
  });

  test('explicit interests do not create behavior reasons via behavior match helper', () => {
    const behavior = createEmptyBehaviorContext();
    const behaviorProfile = buildBehaviorAffinityProfile(behavior);

    const match = scoreMaterialBehaviorMatch({
      material: baseMaterial(),
      behaviorAffinityProfile: behaviorProfile,
      behavior,
    });

    assert.equal(match.score, 0);
    assert.deepEqual(match.reasons, []);
  });

  test('behavior from another user does not affect current learner scoring', () => {
    const otherUserBehavior = buildBehavior({
      likedMaterials: [
        materialSignal({
          materialId: 'other-like',
          title: 'Fabric Scraps',
          tags: ['fabric'],
          categoryNameEn: 'Textiles',
        }),
      ],
    });
    const currentLearnerBehavior = createEmptyBehaviorContext();
    const otherProfile = buildBehaviorAffinityProfile(otherUserBehavior);

    const leakedMatch = scoreMaterialBehaviorMatch({
      material: baseMaterial({
        title: 'Fabric Scraps',
        tags: ['fabric'],
        categoryNameEn: 'Textiles',
      }),
      behaviorAffinityProfile: otherProfile,
      behavior: currentLearnerBehavior,
    });

    assert.equal(leakedMatch.score, 0);
    assert.deepEqual(leakedMatch.reasons, []);
  });

  test('material views only produce weak recent activity when behavior exists', () => {
    const behavior = buildBehavior({
      viewedMaterials: [
        materialSignal({ materialId: 'viewed-1', title: 'Wax Mold Set' }),
      ],
    });
    const behaviorProfile = buildBehaviorAffinityProfile(behavior);

    const match = scoreMaterialBehaviorMatch({
      material: baseMaterial({ title: 'Wax Mold Set', tags: ['wax'] }),
      behaviorAffinityProfile: behaviorProfile,
      behavior,
    });

    assert.ok(match.score > 0);
    assert.ok(match.reasons.includes('Matches your recent activity'));
  });
});

describe('learner-home behavior reasons', () => {
  test('liked material can produce similar-to-liked reason', () => {
    const behavior = buildBehavior({
      likedMaterials: [materialSignal({ materialId: 'liked-arduino-1' })],
    });

    const match = scoreMaterialBehaviorMatch({
      material: baseMaterial({
        id: 'breadboard-1',
        title: 'Breadboard Kit',
        tags: ['breadboard', 'arduino'],
      }),
      behaviorAffinityProfile: buildBehaviorAffinityProfile(behavior),
      behavior,
    });

    assert.ok(match.reasons.some((reason) => reason.toLowerCase().includes('liked')));
  });

  test('reserved material can produce Similar to materials you reserved', () => {
    const behavior = buildBehavior({
      reservedMaterials: [materialSignal({ title: 'Craft Wax Blocks' })],
    });

    const match = scoreMaterialBehaviorMatch({
      material: baseMaterial({ title: 'Wax Mold Set', tags: ['wax'] }),
      behaviorAffinityProfile: buildBehaviorAffinityProfile(behavior),
      behavior,
    });

    assert.ok(match.reasons.includes('Similar to materials you reserved'));
  });

  test('saved project can produce Related to your saved projects', () => {
    const behavior = buildBehavior({
      savedProjects: [
        {
          projectId: 'project-1',
          title: 'Candle Casting',
          shortDescription: 'Cast candles with wax molds',
          categoryNameEn: 'Art, Craft & Molding',
          categoryNameAr: 'Art, Craft & Molding',
          tags: ['craft'],
          components: [],
        },
      ],
    });

    const match = scoreMaterialBehaviorMatch({
      material: baseMaterial(),
      behaviorAffinityProfile: buildBehaviorAffinityProfile(behavior),
      behavior,
    });

    assert.ok(match.reasons.includes('Related to your saved projects'));
  });

  test('no behavior means none of the behavior reasons appear', () => {
    const behavior = createEmptyBehaviorContext();
    const match = scoreMaterialBehaviorMatch({
      material: baseMaterial(),
      behaviorAffinityProfile: buildBehaviorAffinityProfile(behavior),
      behavior,
    });

    assert.deepEqual(match.reasons, []);
  });
});

describe('learner-home subtitles', () => {
  test('interests only subtitle excludes activity wording', () => {
    const subtitle = resolveSuggestedMaterialsSubtitle({
      hasInterests: true,
      hasBehavior: false,
      items: [{ reasons: ['Matches your Art & Crafts interest'] }],
    });

    assert.equal(
      subtitle,
      'Personalized from your interests and saved projects.',
    );
  });

  test('interests plus activity subtitle mentions activity', () => {
    const subtitle = resolveSuggestedMaterialsSubtitle({
      hasInterests: true,
      hasBehavior: true,
      items: [{ reasons: ['Based on materials you liked'] }],
    });

    assert.equal(
      subtitle,
      'Personalized from your interests, saved projects, and activity.',
    );
  });
});

describe('learner-home browse-all controls', () => {
  test('parseLearnerHomeSectionQuery defaults offset to 0', () => {
    assert.deepEqual(parseLearnerHomeSectionQuery({}), {
      limit: 20,
      offset: 0,
    });
  });

  test('parseLearnerHomeSectionQuery accepts limit 20 and 40', () => {
    assert.deepEqual(parseLearnerHomeSectionQuery({ limit: 20 }), {
      limit: 20,
      offset: 0,
    });
    assert.deepEqual(parseLearnerHomeSectionQuery({ limit: 40 }), {
      limit: 40,
      offset: 0,
    });
  });

  test('parseLearnerHomeSectionQuery rejects invalid limit', () => {
    assert.throws(() => parseLearnerHomeSectionQuery({ limit: 51 }));
    assert.throws(() => parseLearnerHomeSectionQuery({ limit: 0 }));
  });

  test('suggested_materials tier sort keeps direct matches before fallback free items', () => {
    const directMatch = scoreSuggestedMaterial({
      material: baseMaterial({ id: 'wax-1', title: 'Wax Mold Kit', tags: ['wax'] }),
      interests: ['art_crafts'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behavior: createEmptyBehaviorContext(),
      behaviorAffinityProfile: buildBehaviorAffinityProfile(createEmptyBehaviorContext()),
    });
    const freeFallback = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'free-1',
        title: 'Random Free Item',
        description: 'Generic surplus item',
        tags: [],
        isFree: true,
        deliveryAllowed: true,
      }),
      interests: ['art_crafts'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behavior: createEmptyBehaviorContext(),
      behaviorAffinityProfile: buildBehaviorAffinityProfile(createEmptyBehaviorContext()),
    });

    const sorted = sortAllRankedMaterials([
      {
        item: { id: 'free-1' },
        score: freeFallback.score,
        tier: freeFallback.tier as (typeof SUGGESTED_MATERIAL_TIERS)[keyof typeof SUGGESTED_MATERIAL_TIERS],
        reasons: freeFallback.reasons,
        hasPrimaryRelevance: freeFallback.hasPrimaryRelevance ?? false,
        fallbackOnly: freeFallback.fallbackOnly ?? false,
      },
      {
        item: { id: 'wax-1' },
        score: directMatch.score,
        tier: directMatch.tier as (typeof SUGGESTED_MATERIAL_TIERS)[keyof typeof SUGGESTED_MATERIAL_TIERS],
        reasons: directMatch.reasons,
        hasPrimaryRelevance: directMatch.hasPrimaryRelevance ?? false,
        fallbackOnly: directMatch.fallbackOnly ?? false,
      },
    ]);

    assert.ok(directMatch.tier < (freeFallback.tier ?? 5));
    assert.equal(sorted[0]?.item.id, 'wax-1');
  });

  test('offset pagination slices ranked pool', () => {
    const ranked = Array.from({ length: 30 }, (_, index) => ({
      item: { id: `material-${index}` },
      score: 100 - index,
      tier: SUGGESTED_MATERIAL_TIERS.fallback,
      reasons: [],
      hasPrimaryRelevance: false,
      fallbackOnly: true,
    }));

    const sorted = sortAllRankedMaterials(ranked);
    const pageOne = sorted.slice(0, 20);
    const pageTwo = sorted.slice(20, 40);

    assert.equal(pageOne.length, 20);
    assert.equal(pageTwo.length, 10);
    assert.equal(pageOne[0]?.item.id, 'material-0');
    assert.equal(pageTwo[0]?.item.id, 'material-20');
  });

  test('materials_for_saved_projects ranks saved-project matches first', () => {
    const savedComponents = [
      {
        projectId: 'project-robot',
        projectTitle: 'Obstacle Avoidance Robot',
        componentId: 'component-arduino',
        componentName: 'Arduino Uno',
        categoryId: 'cat-electronics',
        materialType: 'Electronics',
        searchKeywords: ['arduino'],
      },
    ];

    const savedMatch = scoreMaterialForSavedProjects({
      material: baseMaterial({
        id: 'arduino-1',
        title: 'Arduino Uno Board',
        tags: ['arduino'],
      }),
      interests: [],
      savedComponents,
      savedLocation: { city: null, area: null },
    });

    assert.equal(
      savedMatch.tier,
      SAVED_PROJECT_MATERIAL_TIERS.savedProjectComponent,
    );
    assert.ok(savedMatch.reasons[0]?.includes('Obstacle Avoidance Robot'));
  });

  test('free materials do not outrank direct interest matches in suggested_materials tiers', () => {
    const interestMatch = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'wax-1',
        title: 'Wax Molds Set',
        description: 'Reusable wax molds for handmade craft projects.',
        tags: ['wax mold', 'craft project'],
        categoryNameEn: 'Art, Craft & Molding',
      }),
      interests: ['art_crafts'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
    });

    const freeFallback = scoreFreeNearbyMaterial({
      material: baseMaterial({
        id: 'free-1',
        title: 'Random Free Item',
        isFree: true,
      }),
      savedLocation: { city: null, area: null },
    });

    assert.equal(interestMatch.tier, SUGGESTED_MATERIAL_TIERS.interestStrong);
    assert.equal(freeFallback.tier, FREE_MATERIAL_TIERS.freeFallback);
    assert.ok(interestMatch.tier < freeFallback.tier);
  });
});
