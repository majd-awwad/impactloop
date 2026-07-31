import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  dedupeMaterialItems,
  normalizeMaterialTitleKey,
} from './learner-home.deduplication.js';
import {
  findMatchingSavedComponent,
  getInterestSearchTerms,
  matchesInterest,
  normalizeInterestKey,
  normalizeInterests,
  scoreFreeNearbyMaterial,
  scoreMaterialForSavedProjects,
  scoreSuggestedMaterial,
  scoreSuggestedProject,
  UNAVAILABLE_MATERIAL_PENALTY,
} from './learner-home.scoring.js';
import type {
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
  LearnerHomeSavedProjectComponent,
} from './learner-home.types.js';

const baseMaterial = (
  overrides: Partial<LearnerHomeMaterialCandidate> = {},
): LearnerHomeMaterialCandidate => ({
  id: 'material-1',
  ownerId: 'owner-1',
  title: 'Arduino Uno board',
  description: 'Microcontroller starter board',
  materialType: 'Electronics',
  categoryId: 'cat-electronics',
  categoryNameEn: 'Electronics',
  categoryNameAr: 'Electronics',
  status: 'AVAILABLE',
  isFree: false,
  deliveryAllowed: false,
  pickupAllowed: true,
  viewsCount: 4,
  likesCount: 1,
  city: 'Ramallah',
  area: 'Al-Bireh',
  tags: ['arduino'],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  availableQuantity: 2,
  mapped: {},
  ...overrides,
});

const baseProject = (
  overrides: Partial<LearnerHomeProjectCandidate> = {},
): LearnerHomeProjectCandidate => ({
  id: 'project-1',
  title: 'Robot Car',
  shortDescription: 'Build a small robot car',
  difficulty: 'BEGINNER',
  estimatedDurationMinutes: 120,
  coverImageUrl: null,
  categoryId: 'cat-robotics',
  categoryNameEn: 'Robotics',
  categoryNameAr: 'Robotics',
  tags: ['robotics'],
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  likesCount: 3,
  savesCount: 2,
  reviewCount: 1,
  reviewAverage: 4,
  requiredComponents: [
    {
      id: 'component-1',
      categoryId: 'cat-electronics',
      componentName: 'Arduino Uno',
      materialType: 'Electronics',
      searchKeywords: ['arduino'],
    },
  ],
  mapped: {},
  ...overrides,
});

const savedComponent: LearnerHomeSavedProjectComponent = {
  projectId: 'project-1',
  projectTitle: 'Robot Car',
  componentId: 'component-1',
  componentName: 'Arduino Uno',
  categoryId: 'cat-electronics',
  materialType: 'Electronics',
  searchKeywords: ['arduino'],
};

const electronicsInterests = normalizeInterests([
  'Robotics',
  'Arduino',
  'Electronics',
]);

describe('learner-home scoring', () => {
  test('normalizeInterests handles display labels and keys consistently', () => {
    assert.deepEqual(
      normalizeInterests(['Electronics', 'Art & crafts', 'art_crafts']),
      ['electronics', 'art_crafts'],
    );
    assert.equal(normalizeInterestKey(' Arduino '), 'arduino');
  });

  test('getInterestSearchTerms expands robotics and arduino terms', () => {
    const roboticsTerms = getInterestSearchTerms('robotics');
    assert.ok(roboticsTerms.includes('servo'));
    assert.ok(roboticsTerms.includes('robot'));

    const arduinoTerms = getInterestSearchTerms('arduino');
    assert.ok(arduinoTerms.includes('microcontroller'));
    assert.ok(arduinoTerms.includes('uno'));
  });

  test('materials matching learner interests rank above unrelated materials', () => {
    const matching = scoreSuggestedMaterial({
      material: baseMaterial(),
      interests: ['Arduino'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
    });
    const unrelated = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'material-2',
        title: 'Wooden pallet',
        description: 'Large wood panel',
        materialType: 'Wood',
        categoryId: 'cat-wood',
        categoryNameEn: 'Wood',
        categoryNameAr: 'Wood',
        tags: [],
      }),
      interests: ['Arduino'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
    });

    assert.ok(matching.score > unrelated.score);
    assert.match(matching.reasons.join(' '), /Arduino/i);
  });

  test('Electronics/Arduino learner ranks Arduino above free Fabric in suggested materials', () => {
    const arduino = scoreSuggestedMaterial({
      material: baseMaterial({
        title: 'Arduino Uno Board',
        tags: ['arduino', 'electronics'],
      }),
      interests: electronicsInterests,
      savedComponents: [],
      savedLocation: { city: 'Ramallah', area: null },
    });
    const fabric = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'fabric-1',
        title: 'Fabric Scraps',
        description: 'Mixed textile scraps',
        materialType: 'Textiles',
        categoryId: 'cat-textiles',
        categoryNameEn: 'Textiles',
        categoryNameAr: 'Textiles',
        tags: ['fabric', 'textile'],
        isFree: true,
        city: 'Ramallah',
      }),
      interests: electronicsInterests,
      savedComponents: [],
      savedLocation: { city: 'Ramallah', area: null },
    });

    assert.ok(arduino.score > 0);
    assert.equal(fabric.score, 0);
    assert.ok(arduino.score > fabric.score);
    assert.match(arduino.reasons.join(' '), /Arduino|Electronics|Robotics/i);
  });

  test('free-only unrelated material still appears in free_materials_near_you scoring', () => {
    const fabric = baseMaterial({
      id: 'fabric-1',
      title: 'Fabric Scraps',
      description: 'Mixed textile scraps',
      materialType: 'Textiles',
      categoryNameEn: 'Textiles',
      categoryNameAr: 'Textiles',
      tags: ['fabric'],
      isFree: true,
    });

    const suggested = scoreSuggestedMaterial({
      material: fabric,
      interests: electronicsInterests,
      savedComponents: [],
      savedLocation: { city: 'Ramallah', area: null },
    });
    const freeSection = scoreFreeNearbyMaterial({
      material: fabric,
      savedLocation: { city: 'Ramallah', area: null },
    });

    assert.equal(suggested.score, 0);
    assert.ok(freeSection.score > 0);
    assert.ok(freeSection.reasons.includes('Free material'));
  });

  test('materials useful for saved projects rank high', () => {
    const scored = scoreMaterialForSavedProjects({
      material: baseMaterial(),
      interests: [],
      savedComponents: [savedComponent],
      savedLocation: { city: null, area: null },
    });

    assert.ok(scored.score > 40);
    assert.match(scored.reasons.join(' '), /Robot Car/i);
    assert.match(scored.reasons.join(' '), /Arduino Uno/i);
  });

  test('unavailable materials are excluded via penalty score', () => {
    const scored = scoreSuggestedMaterial({
      material: baseMaterial({
        status: 'RESERVED',
        availableQuantity: 0,
      }),
      interests: ['Arduino'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
    });

    assert.equal(scored.score, UNAVAILABLE_MATERIAL_PENALTY);
    assert.equal(scored.reasons.length, 0);
  });

  test('no-interests fallback can still score via popularity and recency', () => {
    const scored = scoreSuggestedMaterial({
      material: baseMaterial({
        viewsCount: 40,
        likesCount: 6,
        isFree: true,
      }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: null, area: null },
    });

    assert.ok(scored.score > 0);
    assert.ok(scored.reasons.includes('Free material'));
    assert.equal(
      scored.reasons.some((reason) => reason.toLowerCase().includes('interest')),
      false,
    );
  });

  test('no-interests fallback does not include interest-match reasons', () => {
    const scored = scoreSuggestedMaterial({
      material: baseMaterial({ tags: ['arduino'] }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: null, area: null },
    });

    assert.equal(
      scored.reasons.some((reason) => reason.toLowerCase().includes('interest')),
      false,
    );
  });

  test('suggested materials does not force-fill irrelevant items when relevant pool is smaller', () => {
    const materials = [
      baseMaterial({ id: 'arduino-1', title: 'Arduino Uno Board' }),
      baseMaterial({
        id: 'servo-1',
        title: 'Servo Motors',
        tags: ['servo', 'robotics'],
      }),
      baseMaterial({
        id: 'fabric-1',
        title: 'Fabric Scraps',
        description: 'Mixed textile scraps',
        materialType: 'Textiles',
        categoryNameEn: 'Textiles',
        categoryNameAr: 'Textiles',
        tags: ['fabric'],
        isFree: true,
      }),
    ];

    const ranked = materials
      .map((material) =>
        scoreSuggestedMaterial({
          material,
          interests: electronicsInterests,
          savedComponents: [],
          savedLocation: { city: null, area: null },
        }),
      )
      .map((scored, index) => ({
        type: 'material' as const,
        score: scored.score,
        reasons: scored.reasons,
        material: { id: materials[index]!.id, title: materials[index]!.title },
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    const selected = dedupeMaterialItems(ranked, 4);

    assert.equal(selected.length, 2);
    assert.deepEqual(
      selected.map((item) => item.material.id),
      ['arduino-1', 'servo-1'],
    );
  });

  test('same-city materials rank above far free fallback without saved-project match', () => {
    const nearby = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'nearby',
        city: 'Ramallah',
        isFree: false,
        deliveryAllowed: true,
      }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: 'Ramallah', area: null },
    });
    const farFree = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'far-free',
        city: 'Nablus',
        isFree: true,
      }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: 'Ramallah', area: null },
    });

    assert.ok(nearby.score > farFree.score);
    assert.ok(nearby.reasons.includes('Available near your saved location'));
    assert.equal(
      farFree.reasons.some((reason) => reason.toLowerCase().includes('near')),
      false,
    );
  });

  test('reasons are included for suggested projects', () => {
    const scored = scoreSuggestedProject({
      project: baseProject(),
      interests: ['Robotics'],
      availableMaterials: [baseMaterial()],
    });

    assert.ok(scored.score > 0);
    assert.ok(scored.reasons.length > 0);
    assert.match(scored.reasons.join(' '), /Robotics/i);
  });

  test('matchesInterest finds normalized interest tokens', () => {
    const haystack = 'arduino uno microcontroller board';
    assert.equal(matchesInterest(haystack, ['Arduino']), 'Arduino');
  });

  test('findMatchingSavedComponent uses category and component name', () => {
    const match = findMatchingSavedComponent(baseMaterial(), [savedComponent]);
    assert.ok(match);
    assert.equal(match?.componentName, 'Arduino Uno');
  });

  test('free near section uses combined near reason only when location matches', () => {
    const near = scoreFreeNearbyMaterial({
      material: baseMaterial({ city: 'Ramallah', area: 'Al-Bireh', isFree: true }),
      savedLocation: { city: 'Ramallah', area: 'Al-Bireh' },
    });
    const far = scoreFreeNearbyMaterial({
      material: baseMaterial({
        id: 'material-far',
        city: 'Nablus',
        isFree: true,
      }),
      savedLocation: { city: 'Ramallah', area: 'Al-Bireh' },
    });

    assert.ok(near.reasons.includes('Free material near your saved location'));
    assert.ok(far.reasons.includes('Free material'));
    assert.equal(
      far.reasons.some((reason) => reason.toLowerCase().includes('near')),
      false,
    );
  });
});

describe('learner-home material dedupe', () => {
  test('normalizeMaterialTitleKey collapses near-duplicate titles', () => {
    assert.equal(
      normalizeMaterialTitleKey('Arduino Uno Board'),
      normalizeMaterialTitleKey('Arduino Uno Boards'),
    );
  });

  test('dedupeMaterialItems suppresses near-duplicate titles when alternatives exist', () => {
    const items = dedupeMaterialItems(
      [
        {
          type: 'material',
          score: 90,
          reasons: ['Matches your Arduino interest'],
          material: { id: 'mat-1', title: 'Arduino Uno Board' },
        },
        {
          type: 'material',
          score: 80,
          reasons: ['Matches your Arduino interest'],
          material: { id: 'mat-2', title: 'Arduino Uno Boards' },
        },
        {
          type: 'material',
          score: 70,
          reasons: ['Matches your Robotics interest'],
          material: { id: 'mat-3', title: 'Servo Motors' },
        },
      ],
      4,
    );

    assert.equal(items.length, 2);
    assert.deepEqual(
      items.map((item) => item.material.id),
      ['mat-1', 'mat-3'],
    );
  });
});
