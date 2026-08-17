import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildCandidateMatchHints,
  isBuildCandidateSemanticallyEligible,
  rankBuildMaterialCandidates,
  scoreBuildMaterialCandidate,
  type BuildCandidateComponentInput,
  type BuildCandidateLearnerContext,
  type BuildCandidateMaterialInput,
} from './learning-projects.build-candidate-ranking.js';

const learnerRamallah: BuildCandidateLearnerContext = {
  city: 'Ramallah',
  area: 'Al Bireh',
};

const buildMaterial = (
  overrides: Partial<BuildCandidateMaterialInput> = {},
): BuildCandidateMaterialInput => ({
  id: overrides.id ?? 'material-1',
  title: overrides.title ?? 'Generic listing',
  description: overrides.description ?? 'Surplus listing',
  materialType: overrides.materialType ?? 'Electronics',
  condition: overrides.condition ?? 'GOOD',
  isFree: overrides.isFree ?? true,
  price: overrides.price ?? null,
  pickupAllowed: overrides.pickupAllowed ?? true,
  deliveryAllowed: overrides.deliveryAllowed ?? true,
  createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
  categoryId: overrides.categoryId ?? 'cat-electronics',
  city: overrides.city ?? 'Ramallah',
  area: overrides.area ?? 'Al Bireh',
  tags: overrides.tags ?? [],
  supplierVerified: overrides.supplierVerified ?? true,
  ownerCompletedHandovers: overrides.ownerCompletedHandovers ?? 2,
  ...overrides,
});

const rankedIds = (
  materials: BuildCandidateMaterialInput[],
  component: BuildCandidateComponentInput,
  limit = 10,
) =>
  rankBuildMaterialCandidates(
    materials,
    component,
    learnerRamallah,
    limit,
  ).map((entry) => entry.material.id);

describe('build candidate relevance gate', () => {
  const a4988: BuildCandidateComponentInput = {
    categoryId: 'cat-electronics',
    componentName: 'A4988 Stepper Driver',
    materialType: 'A4988 Stepper Motor Driver',
    searchKeywords: ['a4988'],
    alternativeKeywords: [
      'TB6600 Stepper Motor Driver',
      'DRV8825 Stepper Motor Driver',
    ],
    searchTerms: [
      'A4988 Stepper Driver',
      'a4988',
      'A4988 Stepper Motor Driver',
    ],
  };

  const gt2Pulley: BuildCandidateComponentInput = {
    categoryId: 'cat-mechanical',
    componentName: 'GT2 Pulley',
    materialType: 'Pulley',
    searchKeywords: ['gt2', 'pulley'],
    alternativeKeywords: ['Pulley Set'],
    searchTerms: ['GT2 Pulley', 'gt2', 'pulley', 'Pulley'],
  };

  const piCamera: BuildCandidateComponentInput = {
    categoryId: 'cat-electronics',
    componentName: 'Raspberry Pi Camera',
    materialType: 'Camera Module',
    searchKeywords: ['pi camera', 'camera module'],
    alternativeKeywords: [],
    searchTerms: ['Raspberry Pi Camera', 'pi camera', 'camera module'],
  };

  const servoSg90: BuildCandidateComponentInput = {
    categoryId: 'cat-mechanical',
    componentName: 'Servo SG90',
    materialType: 'Servo Motor',
    searchKeywords: ['sg90', 'micro servo'],
    alternativeKeywords: [],
    searchTerms: ['Servo SG90', 'sg90', 'micro servo', 'Servo Motor'],
  };

  test('A4988 Stepper Motor Driver passes; speakers and USB cables do not', () => {
    const driver = buildMaterial({
      id: 'a4988-driver',
      title: 'A4988 Stepper Motor Driver',
      materialType: 'A4988 Stepper Motor Driver',
      isFree: false,
      price: 10,
      city: 'Nablus',
      pickupAllowed: false,
      deliveryAllowed: false,
    });
    const speakers = buildMaterial({
      id: 'speakers',
      title: 'Small Reclaimed Speaker Pairs',
      materialType: 'Small Speakers',
      tags: ['speaker', 'audio', 'reuse'],
    });
    const usb = buildMaterial({
      id: 'usb',
      title: 'Mixed USB Data Cable Bundles',
      materialType: 'USB Cables',
      tags: ['usb', 'data cable', 'reuse'],
    });

    assert.equal(isBuildCandidateSemanticallyEligible(driver, a4988), true);
    assert.equal(isBuildCandidateSemanticallyEligible(speakers, a4988), false);
    assert.equal(isBuildCandidateSemanticallyEligible(usb, a4988), false);

    assert.deepEqual(rankedIds([speakers, usb, driver], a4988), [
      'a4988-driver',
    ]);
  });

  test('GT2 Timing Pulley ranks above a generic pulley; linear rail is not a match', () => {
    const timingPulley = buildMaterial({
      id: 'gt2-timing',
      title: 'GT2 Timing Pulley',
      materialType: 'Pulley',
      categoryId: 'cat-mechanical',
      city: 'Gaza',
      isFree: false,
      price: 50,
      pickupAllowed: false,
      deliveryAllowed: false,
    });
    const pulleySet = buildMaterial({
      id: 'pulley-set',
      title: 'Small Pulley Wheel Sets',
      materialType: 'Pulley Set',
      categoryId: 'cat-mechanical',
      tags: ['pulley', 'lift', 'mechanical'],
    });
    const linearRail = buildMaterial({
      id: 'linear-rail',
      title: 'MGN12H Carriage + 40 cm MGN12 Linear Rail Set',
      materialType: 'Linear Rail / Slider',
      categoryId: 'cat-mechanical',
      description:
        'Used with a stepper NEMA 17 and a GT2 belt on a previous CNC build.',
    });

    assert.equal(
      isBuildCandidateSemanticallyEligible(timingPulley, gt2Pulley),
      true,
    );
    assert.equal(
      isBuildCandidateSemanticallyEligible(pulleySet, gt2Pulley),
      true,
    );
    assert.equal(
      isBuildCandidateSemanticallyEligible(linearRail, gt2Pulley),
      false,
    );

    const ranked = rankBuildMaterialCandidates(
      [linearRail, pulleySet, timingPulley],
      gt2Pulley,
      learnerRamallah,
      10,
    );
    assert.deepEqual(
      ranked.map((entry) => entry.material.id),
      ['gt2-timing', 'pulley-set'],
    );
    assert.ok(ranked[0]!.score.relevance > ranked[1]!.score.relevance);
  });

  test('Raspberry Pi Camera Module passes; Pi board and unrelated electronics do not', () => {
    const cameraModule = buildMaterial({
      id: 'pi-camera',
      title: 'Raspberry Pi Camera Module',
      materialType: 'Camera Module',
    });
    const piBoard = buildMaterial({
      id: 'pi-board',
      title: 'Raspberry Pi 3 Model B Boards',
      materialType: 'Raspberry Pi 3B',
    });
    const unrelated = buildMaterial({
      id: 'usb',
      title: 'Mixed USB Data Cable Bundles',
      materialType: 'USB Cables',
    });

    assert.equal(
      isBuildCandidateSemanticallyEligible(cameraModule, piCamera),
      true,
    );
    assert.equal(isBuildCandidateSemanticallyEligible(piBoard, piCamera), false);
    assert.equal(
      isBuildCandidateSemanticallyEligible(unrelated, piCamera),
      false,
    );
    assert.deepEqual(rankedIds([unrelated, piBoard, cameraModule], piCamera), [
      'pi-camera',
    ]);
  });

  test('SG90 servo passes strongly; unrelated DC motor does not because both are motors', () => {
    const sg90 = buildMaterial({
      id: 'sg90',
      title: 'SG90 Micro Servo Motors',
      materialType: 'Servo Motor',
      categoryId: 'cat-mechanical',
      tags: ['sg90', 'micro servo'],
    });
    const dcMotor = buildMaterial({
      id: 'dc-motor',
      title: '12 volt DC drill motor',
      materialType: 'DC Motor',
      categoryId: 'cat-mechanical',
      tags: ['dc motor', 'robotics'],
    });

    assert.equal(isBuildCandidateSemanticallyEligible(sg90, servoSg90), true);
    assert.equal(isBuildCandidateSemanticallyEligible(dcMotor, servoSg90), false);
    assert.deepEqual(rankedIds([dcMotor, sg90], servoSg90), ['sg90']);
  });

  test('category-only, city-only, free-only, and pickup/delivery-only cannot qualify', () => {
    const component: BuildCandidateComponentInput = {
      categoryId: 'cat-electronics',
      componentName: 'A4988 Stepper Driver',
      materialType: 'A4988 Stepper Motor Driver',
      searchKeywords: ['a4988'],
      alternativeKeywords: [],
      searchTerms: ['a4988'],
    };

    const categoryOnly = buildMaterial({
      id: 'category-only',
      title: 'Unrelated scrap wood',
      materialType: 'Wood',
      isFree: false,
      pickupAllowed: false,
      deliveryAllowed: false,
      city: 'Gaza',
    });
    const cityOnly = buildMaterial({
      id: 'city-only',
      title: 'Random workshop leftover',
      materialType: 'Mixed',
      categoryId: 'cat-other',
      isFree: false,
      pickupAllowed: false,
      deliveryAllowed: false,
    });
    const freeOnly = buildMaterial({
      id: 'free-only',
      title: 'Free leftover bag',
      materialType: 'Mixed',
      categoryId: 'cat-other',
      city: 'Gaza',
      pickupAllowed: false,
      deliveryAllowed: false,
    });
    const pickupDeliveryOnly = buildMaterial({
      id: 'logistics-only',
      title: 'Courier-friendly leftover',
      materialType: 'Mixed',
      categoryId: 'cat-other',
      city: 'Gaza',
      isFree: false,
    });

    for (const material of [
      categoryOnly,
      cityOnly,
      freeOnly,
      pickupDeliveryOnly,
    ]) {
      assert.equal(
        isBuildCandidateSemanticallyEligible(material, component),
        false,
        material.id,
      );
    }

    assert.deepEqual(
      rankedIds(
        [categoryOnly, cityOnly, freeOnly, pickupDeliveryOnly],
        component,
      ),
      [],
    );
  });

  test('strong name/model identifier and specific type matches still pass', () => {
    const modelMatch = buildMaterial({
      id: 'model',
      title: 'A4988 Stepper Motor Driver',
      materialType: 'A4988 Stepper Motor Driver',
    });
    const typeMatch = buildMaterial({
      id: 'type',
      title: 'Workshop pulley leftovers',
      materialType: 'Pulley Set',
      categoryId: 'cat-mechanical',
      tags: ['pulley'],
    });

    assert.equal(isBuildCandidateSemanticallyEligible(modelMatch, a4988), true);
    assert.equal(isBuildCandidateSemanticallyEligible(typeMatch, gt2Pulley), true);
  });

  test('semantic relevance outranks convenience when both candidates are valid', () => {
    const distantExact = buildMaterial({
      id: 'distant-gt2',
      title: 'GT2 Timing Pulley',
      materialType: 'Pulley',
      categoryId: 'cat-mechanical',
      city: 'Gaza',
      area: 'City Center',
      isFree: false,
      price: 40,
      pickupAllowed: false,
      deliveryAllowed: false,
    });
    const localGeneric = buildMaterial({
      id: 'local-generic',
      title: 'Small Pulley Wheel Sets',
      materialType: 'Pulley Set',
      categoryId: 'cat-mechanical',
      tags: ['pulley'],
      city: 'Ramallah',
      area: 'Al Bireh',
      isFree: true,
    });

    const ranked = rankBuildMaterialCandidates(
      [localGeneric, distantExact],
      gt2Pulley,
      learnerRamallah,
      10,
    );

    assert.equal(ranked[0]?.material.id, 'distant-gt2');
    assert.ok(ranked[0]!.score.relevance > ranked[1]!.score.relevance);
    assert.ok(ranked[1]!.score.convenience > ranked[0]!.score.convenience);
  });

  test('does not pad results up to the requested limit', () => {
    const driver = buildMaterial({
      id: 'a4988-driver',
      title: 'A4988 Stepper Motor Driver',
      materialType: 'A4988 Stepper Motor Driver',
    });
    const fillers = Array.from({ length: 9 }, (_, index) =>
      buildMaterial({
        id: `filler-${index}`,
        title: `Unrelated electronics leftover ${index}`,
        materialType: 'Electronics',
      }),
    );

    assert.deepEqual(rankedIds([...fillers, driver], a4988, 10), [
      'a4988-driver',
    ]);
  });

  test('match hints keep compatibility reasons and omit logistics reasons', () => {
    const driver = buildMaterial({
      id: 'a4988-driver',
      title: 'A4988 Stepper Motor Driver',
      materialType: 'A4988 Stepper Motor Driver',
    });
    const score = scoreBuildMaterialCandidate(driver, a4988, learnerRamallah);
    const hints = buildCandidateMatchHints({
      material: driver,
      component: a4988,
      learner: learnerRamallah,
      score,
    });

    assert.ok(hints.some((hint) => /match/i.test(hint)));
    assert.equal(hints.includes('Free'), false);
    assert.equal(hints.includes('Same city'), false);
    assert.equal(hints.includes('Pickup available'), false);
    assert.equal(hints.includes('Delivery available'), false);
  });
});
