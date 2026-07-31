import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { auditSuggestedMaterialScore } from './learner-home.scoring-debug.js';
import {
  compareRankedMaterialItems,
  selectTieredSuggestedMaterials,
  sortAllRankedMaterials,
  SUGGESTED_MATERIAL_TIERS,
} from './learner-home.ranking.js';
import { scoreSuggestedMaterial } from './learner-home.scoring.js';
import {
  matchInterestKeyAgainstMaterial,
  matchLearnerInterestsAgainstMaterial,
  buildMaterialMatchHaystack,
} from './learner-interest-taxonomy.js';
import type { LearnerHomeMaterialCandidate } from './learner-home.types.js';

const baseMaterial = (
  overrides: Partial<LearnerHomeMaterialCandidate> = {},
): LearnerHomeMaterialCandidate => ({
  id: 'material-1',
  ownerId: 'owner-1',
  title: 'Material',
  description: 'Description',
  materialType: 'General',
  categoryId: 'cat-1',
  categoryNameEn: 'General',
  categoryNameAr: 'General',
  status: 'AVAILABLE',
  isFree: false,
  deliveryAllowed: false,
  pickupAllowed: true,
  viewsCount: 1,
  likesCount: 0,
  city: 'Ramallah',
  area: null,
  tags: [],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  availableQuantity: 2,
  mapped: {},
  ...overrides,
});

describe('learner-home relevance correctness', () => {
  test('Art & Crafts does not match Fabric Scraps without craft-specific terms', () => {
    const match = matchLearnerInterestsAgainstMaterial(
      {
        title: 'Fabric Scraps',
        description:
          'Sorted fabric scraps in mixed colors for fashion, textile, and sewing experiments.',
        materialType: 'Fabric remnants',
        categoryNameEn: 'Fabric & Textiles',
        tags: ['fabric', 'textiles', 'sewing'],
      },
      ['art_crafts'],
    );

    assert.equal(match, null);
  });

  test('Fabric Scraps matches Fabric & Textiles interest', () => {
    const match = matchLearnerInterestsAgainstMaterial(
      {
        title: 'Fabric Scraps',
        description: 'Sorted fabric scraps for sewing experiments.',
        materialType: 'Fabric remnants',
        categoryNameEn: 'Fabric & Textile',
        tags: ['fabric', 'textiles'],
      },
      ['fabric_textiles'],
    );

    assert.ok(match);
    assert.equal(match?.strength, 'strong');
    assert.equal(match?.labelEn, 'Fabric & Textiles');
  });

  test('Art & Crafts matches Wax Molds and craft cardboard with tags', () => {
    const waxMatch = matchLearnerInterestsAgainstMaterial(
      {
        title: 'Wax Molds Set',
        description: 'Reusable wax molds for craft workshops.',
        materialType: 'Wax molds',
        categoryNameEn: 'Art, Craft & Molding',
        tags: ['wax mold', 'handmade'],
      },
      ['art_crafts'],
    );
    assert.ok(waxMatch);
    assert.equal(waxMatch?.strength, 'strong');

    const cardboardMatch = matchLearnerInterestsAgainstMaterial(
      {
        title: 'Cardboard Sheets',
        description: 'Packaging surplus for model making.',
        materialType: 'Craft boards',
        categoryNameEn: 'Art, Craft & Molding',
        tags: ['cardboard', 'art project', 'craft project'],
      },
      ['art_crafts'],
    );
    assert.ok(cardboardMatch);
    assert.equal(cardboardMatch?.strength, 'strong');
  });

  test('Cardboard boxes in Packaging category does not strongly match Art & Crafts without craft tags', () => {
    const parts = buildMaterialMatchHaystack({
      title: 'Cardboard boxes',
      description: 'Seed cardboard boxes for completed pickup tests.',
      materialType: 'Packaging',
      categoryNameEn: 'Packaging',
      tags: [],
    });

    const match = matchInterestKeyAgainstMaterial(parts, 'art_crafts');
    assert.equal(match, null);
  });

  test('strong interest match outranks free unrelated material in tier selection', () => {
    const waxStrong = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'wax-strong',
        title: 'Wax Molds Set',
        description: 'Reusable wax molds for handmade craft projects.',
        materialType: 'Wax molds',
        categoryNameEn: 'Art, Craft & Molding',
        tags: ['wax mold', 'craft project'],
        isFree: false,
      }),
      interests: ['art_crafts'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
    });

    const fabricUnrelated = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'free-fabric',
        title: 'Fabric Scraps',
        description: 'Sorted fabric scraps for fashion and textile experiments.',
        materialType: 'Fabric remnants',
        categoryNameEn: 'Fabric & Textile',
        tags: ['fabric', 'textiles'],
        isFree: true,
        deliveryAllowed: true,
      }),
      interests: ['art_crafts'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
    });

    assert.ok(waxStrong.score > 0);
    assert.equal(waxStrong.tier, SUGGESTED_MATERIAL_TIERS.interestStrong);
    assert.equal(fabricUnrelated.score, 0);

    const ranked = selectTieredSuggestedMaterials(
      [
        {
          item: 'free',
          score: 120,
          tier: SUGGESTED_MATERIAL_TIERS.fallback,
          reasons: ['Free material'],
          hasPrimaryRelevance: false,
          fallbackOnly: true,
        },
        {
          item: 'wax',
          score: waxStrong.score,
          tier: waxStrong.tier,
          reasons: waxStrong.reasons,
          hasPrimaryRelevance: true,
          fallbackOnly: false,
        },
      ],
      4,
    );

    assert.deepEqual(
      ranked.map((entry) => entry.item),
      ['wax'],
    );
  });

  test('auditSuggestedMaterialScore exposes match strength and sources', () => {
    const audited = auditSuggestedMaterialScore({
      material: baseMaterial({
        title: 'Wax Molds Set',
        description: 'Reusable wax molds for handmade craft projects.',
        materialType: 'Wax molds',
        categoryNameEn: 'Art, Craft & Molding',
        tags: ['wax mold', 'craft project'],
      }),
      interests: ['art_crafts'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
    });

    assert.equal(audited.audit.matchStrength, 'strong');
    assert.equal(audited.audit.matchedInterestKey, 'art_crafts');
    assert.ok(audited.audit.matchedSources.length > 0);
    assert.equal(audited.audit.passedRelevanceGate, true);
  });

  test('compareRankedMaterialItems sorts by tier before score', () => {
    assert.ok(
      compareRankedMaterialItems(
        {
          item: 'strong',
          score: 10,
          tier: SUGGESTED_MATERIAL_TIERS.interestStrong,
          reasons: [],
          hasPrimaryRelevance: true,
          fallbackOnly: false,
        },
        {
          item: 'free',
          score: 100,
          tier: SUGGESTED_MATERIAL_TIERS.fallback,
          reasons: [],
          hasPrimaryRelevance: false,
          fallbackOnly: true,
        },
      ) < 0,
    );
  });

  test('suggested_materials ranks direct interest above saved-project-only match', () => {
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

    const interestMatch = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'wax-1',
        title: 'Wax Molds Set',
        description: 'Reusable wax molds for handmade craft projects.',
        materialType: 'Wax molds',
        categoryNameEn: 'Art, Craft & Molding',
        tags: ['wax mold', 'craft project'],
      }),
      interests: ['art_crafts'],
      savedComponents,
      savedLocation: { city: null, area: null },
    });

    const savedProjectOnly = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'arduino-1',
        title: 'Arduino Uno Board',
        description: 'Microcontroller board for robotics builds.',
        materialType: 'Electronics',
        categoryNameEn: 'Electronics',
        tags: ['arduino', 'robotics'],
      }),
      interests: ['art_crafts'],
      savedComponents,
      savedLocation: { city: null, area: null },
    });

    assert.equal(interestMatch.tier, SUGGESTED_MATERIAL_TIERS.interestStrong);
    assert.equal(
      savedProjectOnly.tier,
      SUGGESTED_MATERIAL_TIERS.savedProjectComponent,
    );
    assert.ok(interestMatch.tier < savedProjectOnly.tier);

    const ranked = sortAllRankedMaterials([
      {
        item: 'saved-only',
        score: savedProjectOnly.score,
        tier: savedProjectOnly.tier,
        reasons: savedProjectOnly.reasons,
        hasPrimaryRelevance: true,
        fallbackOnly: false,
      },
      {
        item: 'interest',
        score: interestMatch.score,
        tier: interestMatch.tier,
        reasons: interestMatch.reasons,
        hasPrimaryRelevance: true,
        fallbackOnly: false,
      },
    ]);

    assert.equal(ranked[0]?.item, 'interest');
  });

  test('suggested_materials primary reason prefers interest over saved project', () => {
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

    const scored = scoreSuggestedMaterial({
      material: baseMaterial({
        id: 'arduino-1',
        title: 'Arduino Uno Board',
        description: 'Microcontroller board for craft and robotics builds.',
        materialType: 'Electronics',
        categoryNameEn: 'Electronics',
        tags: ['arduino'],
      }),
      interests: ['arduino'],
      savedComponents,
      savedLocation: { city: null, area: null },
    });

    assert.ok(scored.reasons[0]?.toLowerCase().includes('arduino'));
    assert.equal(
      scored.reasons[0]?.toLowerCase().includes('useful for your saved'),
      false,
    );
  });
});
