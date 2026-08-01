import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  AFFINITY_PROFILE_BOOSTS,
  buildBehaviorAffinityProfile,
  buildLearnerAffinityProfile,
  createEmptyBehaviorContext,
  extractAffinityTermsFromMaterial,
  scoreMaterialBehaviorMatch,
  scoreMaterialSimilarityToLikedMaterials,
  scoreProjectBehaviorMatch,
  VIEW_AFFINITY_CAP_PER_MATERIAL,
} from './learner-home.affinity.js';
import { dedupeMaterialItems } from './learner-home.deduplication.js';
import {
  normalizeInterests,
  resolveSuggestedMaterialsSubtitle,
  scoreFreeNearbyMaterial,
  scoreSuggestedMaterial,
  scoreSuggestedProject,
} from './learner-home.scoring.js';
import type {
  LearnerBehaviorContext,
  LearnerBehaviorMaterialSignal,
  LearnerBehaviorProjectSignal,
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
} from './learner-home.types.js';

const materialSignal = (
  overrides: Partial<LearnerBehaviorMaterialSignal> = {},
): LearnerBehaviorMaterialSignal => ({
  materialId: 'material-1',
  title: 'Arduino Uno Board',
  description: 'Microcontroller starter board',
  materialType: 'Electronics',
  categoryNameEn: 'Electronics',
  categoryNameAr: 'Electronics',
  tags: ['arduino', 'electronics'],
  ...overrides,
});

const projectSignal = (
  overrides: Partial<LearnerBehaviorProjectSignal> = {},
): LearnerBehaviorProjectSignal => ({
  projectId: 'project-1',
  title: 'Robot Car',
  shortDescription: 'Build a small robot car',
  categoryNameEn: 'Robotics',
  categoryNameAr: 'Robotics',
  tags: ['robotics'],
  components: [
    {
      componentName: 'Arduino Uno',
      materialType: 'Electronics',
      categoryNameEn: 'Electronics',
    },
  ],
  ...overrides,
});

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

const electronicsInterests = normalizeInterests([
  'Robotics',
  'Arduino',
  'Electronics',
]);

const buildBehavior = (
  overrides: Partial<LearnerBehaviorContext> = {},
): LearnerBehaviorContext => ({
  ...createEmptyBehaviorContext(),
  ...overrides,
});

describe('learner-home affinity profile', () => {
  test('extractAffinityTermsFromMaterial maps Arduino board to arduino/electronics', () => {
    const terms = extractAffinityTermsFromMaterial(materialSignal());
    assert.ok(terms.includes('arduino'));
    assert.ok(terms.includes('electronics'));
  });

  test('buildLearnerAffinityProfile starts explicit interests at base weight', () => {
    const profile = buildLearnerAffinityProfile({
      interests: ['Arduino'],
      behavior: createEmptyBehaviorContext(),
    });

    assert.ok((profile.get('arduino') ?? 0) >= AFFINITY_PROFILE_BOOSTS.explicitInterest);
  });

  test('reserved and liked materials boost affinity terms', () => {
    const profile = buildLearnerAffinityProfile({
      interests: [],
      behavior: buildBehavior({
        reservedMaterials: [materialSignal({ title: 'Servo Motors', tags: ['servo', 'robotics'] })],
        likedMaterials: [materialSignal()],
      }),
    });

    assert.ok((profile.get('robotics') ?? 0) >= AFFINITY_PROFILE_BOOSTS.reservedMaterial);
    assert.ok((profile.get('arduino') ?? 0) >= AFFINITY_PROFILE_BOOSTS.likedMaterial);
  });

  test('repeated views are capped per material', () => {
    const repeatedViews = Array.from({ length: 10 }, () => materialSignal());
    const profile = buildLearnerAffinityProfile({
      interests: [],
      behavior: buildBehavior({
        viewedMaterials: repeatedViews,
      }),
    });

    const expectedMax =
      AFFINITY_PROFILE_BOOSTS.viewedMaterial * VIEW_AFFINITY_CAP_PER_MATERIAL;
    assert.equal(profile.get('arduino'), expectedMax);
  });
});

describe('learner-home behavior-aware material scoring', () => {
  test('Arduino behavior ranks Arduino above unrelated free Fabric', () => {
    const behavior = buildBehavior({
      likedMaterials: [materialSignal()],
      reservedMaterials: [
        materialSignal({
          materialId: 'servo-1',
          title: 'Servo Motors',
          tags: ['servo', 'robotics'],
        }),
      ],
      savedProjects: [projectSignal()],
    });
    const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);

    const breadboard = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'breadboard-1',
        title: 'Breadboard Kit',
        description: 'Half-size solderless breadboard for Arduino prototyping',
        tags: ['breadboard', 'arduino', 'prototyping'],
      }),
      interests: electronicsInterests,
      savedComponents: [],
      savedLocation: { city: 'Ramallah', area: null },
      behaviorAffinityProfile,
      behavior,
    });
    const fabric = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'fabric-1',
        title: 'Fabric Scraps',
        description: 'Mixed textile scraps',
        materialType: 'Textiles',
        categoryNameEn: 'Textiles',
        categoryNameAr: 'Textiles',
        tags: ['fabric'],
        isFree: true,
      }),
      interests: electronicsInterests,
      savedComponents: [],
      savedLocation: { city: 'Ramallah', area: null },
      behaviorAffinityProfile,
      behavior,
    });

    assert.ok(breadboard.score > fabric.score);
    assert.equal(fabric.score, 0);
    assert.ok(breadboard.reasons.some((reason) => reason.toLowerCase().includes('liked')));
  });

  test('reserved Servo Motor boosts robotics/servo materials', () => {
    const behavior = buildBehavior({
      reservedMaterials: [
        materialSignal({
          materialId: 'servo-1',
          title: 'Servo Motors',
          tags: ['servo', 'robotics'],
        }),
      ],
    });
    const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);

    const servo = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'servo-1',
        title: 'Servo Motors',
        tags: ['servo', 'robotics'],
      }),
      interests: electronicsInterests,
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behaviorAffinityProfile,
      behavior,
    });

    assert.ok(servo.score > 0);
    assert.ok(
      servo.reasons.some((reason) =>
        reason.toLowerCase().includes('reserved'),
      ),
    );
  });

  test('free-only unrelated items still appear in free_materials_near_you', () => {
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

    const freeSection = scoreFreeNearbyMaterial({
      material: fabric,
      savedLocation: { city: 'Ramallah', area: null },
    });

    assert.ok(freeSection.score > 0);
    assert.ok(freeSection.reasons.includes('Free material'));
  });
});

describe('learner-home behavior-aware project scoring', () => {
  test('saved/liked robotics projects boost robotics projects', () => {
    const behavior = buildBehavior({
      savedProjects: [projectSignal()],
      likedProjects: [projectSignal({ projectId: 'project-2', title: 'Line Follower Bot' })],
    });
    const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);

    const scored = scoreSuggestedProject({
      project: baseProject({ id: 'project-3', title: 'Obstacle Avoidance Robot' }),
      interests: electronicsInterests,
      availableMaterials: [baseMaterial()],
      behaviorAffinityProfile,
      behavior,
    });

    assert.ok(scored.score > 0);
    assert.ok(
      scored.reasons.some(
        (reason) =>
          reason.includes('saved projects') || reason.includes('liked'),
      ),
    );
  });

  test('active robotics build boosts related projects', () => {
    const behavior = buildBehavior({
      inProgressBuildProjects: [projectSignal()],
    });
    const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);

    const scored = scoreProjectBehaviorMatch({
      project: baseProject(),
      behaviorAffinityProfile,
      behavior,
    });

    assert.ok(scored.score > 0);
    assert.ok(
      scored.reasons.some((reason) => reason.toLowerCase().includes('building')),
    );
  });
});

describe('learner-home no-interests behavior', () => {
  test('Arduino behavior still personalizes suggested materials without explicit interests', () => {
    const behavior = buildBehavior({
      likedMaterials: [materialSignal()],
      savedProjects: [projectSignal()],
      viewedMaterials: [
        materialSignal({
          materialId: 'breadboard-1',
          title: 'Breadboard Kit',
          tags: ['breadboard', 'electronics'],
        }),
      ],
    });
    const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);

    const arduino = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'nano-1',
        title: 'Arduino Nano Board',
        tags: ['arduino'],
      }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behaviorAffinityProfile,
      behavior,
    });

    assert.ok(arduino.score > 0);
    assert.ok(arduino.reasons.some((reason) => reason.toLowerCase().includes('liked')));
    assert.equal(
      arduino.reasons.some((reason) => reason.toLowerCase().includes('interest')),
      false,
    );
  });

  test('subtitle mentions recent activity when no explicit interests exist', () => {
    const subtitle = resolveSuggestedMaterialsSubtitle({
      hasInterests: false,
      hasBehavior: true,
      items: [{ reasons: ['Based on materials you liked'] }],
    });

    assert.equal(subtitle, 'Personalized from your recent activity.');
  });

  test('does not force-fill irrelevant items when relevant pool is smaller', () => {
    const behavior = buildBehavior({
      likedMaterials: [materialSignal()],
    });
    const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);

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
          behaviorAffinityProfile,
          behavior,
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
});

describe('learner-home liked-material similarity', () => {
  test('liking Arduino Uno boosts similar breadboard/jumper materials above fabric', () => {
    const behavior = buildBehavior({
      likedMaterials: [materialSignal({ materialId: 'liked-arduino-1' })],
    });
    const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);

    const breadboard = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'breadboard-1',
        title: 'Breadboard Kit',
        tags: ['breadboard', 'arduino'],
      }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behaviorAffinityProfile,
      behavior,
    });
    const jumperWires = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'jumper-1',
        title: 'Jumper Wires Pack',
        tags: ['jumper', 'wires', 'arduino'],
      }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behaviorAffinityProfile,
      behavior,
    });
    const fabric = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'fabric-1',
        title: 'Fabric Scraps',
        description: 'Sorted fabric scraps for sewing',
        materialType: 'Textiles',
        categoryNameEn: 'Fabric & Textile',
        tags: ['fabric', 'textiles'],
      }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behaviorAffinityProfile,
      behavior,
    });

    assert.ok(breadboard.score > fabric.score);
    assert.ok(jumperWires.score > fabric.score);
    assert.ok(
      breadboard.reasons.some((reason) =>
        reason.toLowerCase().includes('liked'),
      ),
    );
  });

  test('liked fabric boosts fabric materials, not electronics', () => {
    const behavior = buildBehavior({
      likedMaterials: [
        materialSignal({
          materialId: 'liked-fabric-1',
          title: 'Fabric Scraps',
          description: 'Sorted fabric scraps for sewing',
          materialType: 'Fabric remnants',
          categoryNameEn: 'Fabric & Textile',
          tags: ['fabric', 'textiles', 'sewing'],
        }),
      ],
    });
    const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);

    const fabricMatch = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'fabric-2',
        title: 'Cotton Fabric Remnants',
        materialType: 'Fabric remnants',
        categoryNameEn: 'Fabric & Textile',
        tags: ['fabric', 'cotton', 'textiles'],
      }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behaviorAffinityProfile,
      behavior,
    });
    const arduino = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'arduino-1',
        title: 'Arduino Uno Board',
        tags: ['arduino', 'electronics'],
      }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behaviorAffinityProfile,
      behavior,
    });

    assert.ok(fabricMatch.score > arduino.score);
    assert.ok(
      fabricMatch.reasons.some((reason) =>
        reason.toLowerCase().includes('liked'),
      ),
    );
    assert.equal(
      arduino.reasons.some((reason) => reason.toLowerCase().includes('liked')),
      false,
    );
  });

  test('already-liked material ranks below similar unliked alternatives', () => {
    const behavior = buildBehavior({
      likedMaterials: [materialSignal({ materialId: 'liked-arduino-1' })],
    });
    const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);

    const likedAgain = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'liked-arduino-1',
        title: 'Arduino Uno Board',
        tags: ['arduino'],
      }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behaviorAffinityProfile,
      behavior,
    });
    const nano = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'nano-1',
        title: 'Arduino Nano Board',
        tags: ['arduino', 'microcontroller'],
      }),
      interests: [],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      behaviorAffinityProfile,
      behavior,
    });

    assert.ok(nano.score > likedAgain.score);
  });

  test('scoreMaterialSimilarityToLikedMaterials requires real overlap', () => {
    const liked = materialSignal({ materialId: 'liked-arduino-1' });

    const similar = scoreMaterialSimilarityToLikedMaterials({
      material: baseMaterial({
        id: 'sensor-1',
        title: 'Ultrasonic Sensor Module',
        tags: ['sensor', 'arduino'],
      }),
      likedMaterials: [liked],
    });
    const unrelated = scoreMaterialSimilarityToLikedMaterials({
      material: baseMaterial({
        id: 'fabric-1',
        title: 'Fabric Scraps',
        description: 'Sorted fabric scraps for sewing',
        materialType: 'Textiles',
        categoryNameEn: 'Fabric & Textile',
        tags: ['fabric'],
      }),
      likedMaterials: [liked],
    });

    assert.ok(similar.score >= 10);
    assert.ok(similar.reason?.toLowerCase().includes('liked'));
    assert.equal(unrelated.score, 0);
    assert.equal(unrelated.reason, null);
  });

  test('scoreMaterialBehaviorMatch ignores another learner liked materials', () => {
    const otherBehavior = buildBehavior({
      likedMaterials: [materialSignal({ materialId: 'other-like' })],
    });
    const currentBehavior = createEmptyBehaviorContext();
    const otherProfile = buildBehaviorAffinityProfile(otherBehavior);

    const match = scoreMaterialBehaviorMatch({
      material: baseMaterial({
        id: 'breadboard-1',
        title: 'Breadboard Kit',
        tags: ['breadboard', 'arduino'],
      }),
      behaviorAffinityProfile: otherProfile,
      behavior: currentBehavior,
    });

    assert.equal(match.score, 0);
    assert.deepEqual(match.reasons, []);
  });
});
describe('learner-home behavior material match helper', () => {
  test('scoreMaterialBehaviorMatch returns capped reasons', () => {
    const behavior = buildBehavior({
      likedMaterials: [materialSignal()],
      reservedMaterials: [
        materialSignal({
          materialId: 'servo-1',
          title: 'Servo Motors',
          tags: ['servo', 'robotics'],
        }),
      ],
      savedProjects: [projectSignal()],
    });
    const behaviorAffinityProfile = buildBehaviorAffinityProfile(behavior);

    const match = scoreMaterialBehaviorMatch({
      material: baseMaterial({
        id: 'breadboard-1',
        title: 'Breadboard Kit',
        tags: ['breadboard', 'arduino'],
      }),
      behaviorAffinityProfile,
      behavior,
    });

    assert.ok(match.score > 0);
    assert.ok(match.reasons.length <= 2);
  });
});
