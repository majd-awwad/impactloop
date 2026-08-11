import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  deriveMaterialComponentMatchReasonCodes,
  primaryMaterialComponentMatchReasonCode,
  rankBuildMaterialCandidates,
  scoreMaterialComponentRelevance,
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

  test('better condition ranks higher when relevance location and price match', () => {
    const likeNew = buildMaterial({
      id: 'like-new',
      condition: 'LIKE_NEW',
      isFree: false,
      price: 40,
    });
    const needsRepair = buildMaterial({
      id: 'needs-repair',
      condition: 'NEEDS_REPAIR',
      isFree: false,
      price: 40,
    });

    const ranked = rankBuildMaterialCandidates(
      [needsRepair, likeNew],
      baseComponent,
      learnerRamallah,
      2,
    );

    assert.equal(ranked[0]?.material.id, 'like-new');
  });

  test('createdAt is tie-breaker only when score buckets are equal', () => {
    const older = buildMaterial({
      id: 'older',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    const newer = buildMaterial({
      id: 'newer',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    const ranked = rankBuildMaterialCandidates(
      [older, newer],
      baseComponent,
      learnerRamallah,
      2,
    );

    assert.equal(ranked[0]?.material.id, 'newer');
    assert.equal(ranked[1]?.material.id, 'older');
  });

  test('pluralized listing titles still tie on relevance so free ranks above paid', () => {
    const freeBoard = buildMaterial({
      id: 'free-board',
      title: 'Free Arduino Uno Board',
      isFree: true,
      city: 'Nablus',
      area: 'Old City',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    const paidBoards = buildMaterial({
      id: 'paid-boards',
      title: 'Paid Arduino Uno Boards',
      isFree: false,
      price: 45,
      city: 'Nablus',
      area: 'Old City',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    });

    const ranked = rankBuildMaterialCandidates(
      [paidBoards, freeBoard],
      {
        ...baseComponent,
        componentName: 'Arduino Uno Boards',
      },
      { city: 'Nablus', area: 'Old City' },
      2,
    );

    assert.equal(ranked[0]?.material.id, 'free-board');
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

describe('material component match reason codes', () => {
  test('exact name yields EXACT_NAME as primary code', () => {
    const material = buildMaterial({ title: 'Arduino Uno board' });
    const relevance = scoreMaterialComponentRelevance(material, baseComponent);
    const codes = deriveMaterialComponentMatchReasonCodes({
      material,
      component: baseComponent,
      relevance,
    });

    assert.ok(
      primaryMaterialComponentMatchReasonCode(codes) === 'EXACT_NAME' ||
        primaryMaterialComponentMatchReasonCode(codes) === 'TYPE_EXACT',
    );
    assert.ok(codes.includes('EXACT_NAME'));
    assert.ok(codes.includes('CATEGORY_MATCH'));
    assert.ok(codes.includes('MATERIAL_TYPE_MATCH') || codes.includes('TYPE_EXACT'));
  });

  test('category-only match yields CATEGORY_MATCH', () => {
    const material = buildMaterial({
      title: 'Unrelated scrap wood',
      materialType: 'Wood',
      tags: [],
      categoryId: 'cat-electronics',
    });
    const component: BuildCandidateComponentInput = {
      categoryId: 'cat-electronics',
      componentName: 'LED strip',
      materialType: 'LED',
      searchKeywords: [],
      alternativeKeywords: [],
      searchTerms: [],
    };
    const relevance = scoreMaterialComponentRelevance(material, component);
    assert.ok(relevance > 0);
    const codes = deriveMaterialComponentMatchReasonCodes({
      material,
      component,
      relevance,
    });
    assert.equal(primaryMaterialComponentMatchReasonCode(codes), 'CATEGORY_MATCH');
  });

  test('keyword-only match yields KEYWORD_MATCH', () => {
    const material = buildMaterial({
      title: 'Spare microcontroller pack',
      materialType: 'Electronics',
      tags: [],
      categoryId: 'cat-other',
      description: 'Includes a spare microcontroller for labs',
    });
    const component: BuildCandidateComponentInput = {
      categoryId: 'cat-unrelated',
      componentName: 'Control unit',
      materialType: 'general',
      searchKeywords: ['microcontroller'],
      alternativeKeywords: [],
      searchTerms: [],
    };
    const relevance = scoreMaterialComponentRelevance(material, component);
    assert.ok(relevance > 0);
    const codes = deriveMaterialComponentMatchReasonCodes({
      material,
      component,
      relevance,
    });
    assert.equal(primaryMaterialComponentMatchReasonCode(codes), 'KEYWORD_MATCH');
  });

  test('unrelated material scores zero relevance', () => {
    const material = buildMaterial({
      title: 'Cardboard box',
      materialType: 'Packaging',
      tags: [],
      categoryId: 'cat-packaging',
      description: 'Empty shipping box',
    });
    const component: BuildCandidateComponentInput = {
      categoryId: 'cat-electronics',
      componentName: 'Arduino Uno board',
      materialType: 'Arduino board',
      searchKeywords: ['arduino'],
      alternativeKeywords: [],
      searchTerms: [],
    };
    assert.equal(scoreMaterialComponentRelevance(material, component), 0);
  });
});
