import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  rankBuildMaterialCandidates,
  type BuildCandidateComponentInput,
  type BuildCandidateLearnerContext,
  type BuildCandidateMaterialInput,
} from './learning-projects.build-candidate-ranking.js';

const baseComponent: BuildCandidateComponentInput = {
  categoryId: 'cat-electronics',
  componentName: 'Arduino Uno board',
  materialType: 'Arduino board',
  searchKeywords: ['arduino', 'microcontroller'],
  alternativeKeywords: [],
  searchTerms: ['Arduino Uno board', 'arduino', 'microcontroller', 'Arduino board'],
};

const learnerRamallah: BuildCandidateLearnerContext = {
  city: 'Ramallah',
  area: 'Al Bireh',
};

const buildMaterial = (
  overrides: Partial<BuildCandidateMaterialInput> = {},
): BuildCandidateMaterialInput => ({
  id: overrides.id ?? 'material-1',
  title: overrides.title ?? 'Arduino Uno board',
  description: overrides.description ?? 'Board for learners',
  materialType: overrides.materialType ?? 'Arduino board',
  condition: overrides.condition ?? 'GOOD',
  isFree: overrides.isFree ?? true,
  price: overrides.price ?? null,
  pickupAllowed: overrides.pickupAllowed ?? true,
  deliveryAllowed: overrides.deliveryAllowed ?? false,
  createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
  categoryId: overrides.categoryId ?? 'cat-electronics',
  city: overrides.city ?? 'Ramallah',
  area: overrides.area ?? 'Al Bireh',
  tags: overrides.tags ?? ['arduino'],
  supplierVerified: overrides.supplierVerified ?? true,
  ownerCompletedHandovers: overrides.ownerCompletedHandovers ?? 2,
});

describe('learning project build candidate ranking', () => {
  test('free same-city exact match ranks above paid same-city exact match', () => {
    const freeOlder = buildMaterial({
      id: 'free',
      isFree: true,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    const paidNewer = buildMaterial({
      id: 'paid',
      isFree: false,
      price: 45,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
    });

    const ranked = rankBuildMaterialCandidates(
      [paidNewer, freeOlder],
      baseComponent,
      learnerRamallah,
      2,
    );

    assert.equal(ranked[0]?.material.id, 'free');
    assert.equal(ranked[1]?.material.id, 'paid');
  });

  test('exact paid match ranks above weak free mismatch', () => {
    const exactPaid = buildMaterial({
      id: 'paid-exact',
      isFree: false,
      price: 30,
      title: 'Arduino Uno board',
    });
    const weakFree = buildMaterial({
      id: 'free-weak',
      isFree: true,
      title: 'Random plastic box',
      materialType: 'Container',
      tags: [],
      categoryId: 'cat-other',
    });

    const ranked = rankBuildMaterialCandidates(
      [weakFree, exactPaid],
      baseComponent,
      learnerRamallah,
      2,
    );

    assert.equal(ranked[0]?.material.id, 'paid-exact');
    assert.equal(ranked[1]?.material.id, 'free-weak');
  });

  test('nearby relevant option ranks above distant similar option', () => {
    const nearby = buildMaterial({
      id: 'nearby',
      city: 'Ramallah',
      area: 'Al Bireh',
    });
    const distant = buildMaterial({
      id: 'distant',
      city: 'Gaza',
      area: 'City Center',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    const ranked = rankBuildMaterialCandidates(
      [distant, nearby],
      baseComponent,
      learnerRamallah,
      2,
    );

    assert.equal(ranked[0]?.material.id, 'nearby');
  });

  test('supplier trust does not overpower weak relevance', () => {
    const trustedWeak = buildMaterial({
      id: 'trusted-weak',
      title: 'Miscellaneous parts bin',
      materialType: 'Mixed',
      tags: [],
      categoryId: 'cat-other',
      supplierVerified: true,
      ownerCompletedHandovers: 5,
    });
    const newStrong = buildMaterial({
      id: 'new-strong',
      title: 'Arduino Uno board',
      supplierVerified: false,
      ownerCompletedHandovers: 0,
    });

    const ranked = rankBuildMaterialCandidates(
      [trustedWeak, newStrong],
      baseComponent,
      learnerRamallah,
      2,
    );

    assert.equal(ranked[0]?.material.id, 'new-strong');
  });
});
