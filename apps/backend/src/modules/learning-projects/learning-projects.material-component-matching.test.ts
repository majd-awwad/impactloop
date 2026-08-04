import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  classifyLearnerMaterialMatchType,
  compareScoredMaterialComponentMatches,
  scoreMaterialAgainstComponent,
} from './learning-projects.material-component-matching.js';

describe('learning-projects.material-component-matching', () => {
  const material = {
    id: 'mat-1',
    title: 'Arduino Uno',
    description: 'Microcontroller board',
    materialType: 'Arduino board',
    categoryId: 'cat-electronics',
    tags: [{ tag: 'arduino' }],
  };

  test('classifies exact name matches as EXACT', () => {
    const scored = scoreMaterialAgainstComponent({
      material,
      component: {
        id: 'comp-exact',
        categoryId: 'cat-electronics',
        componentName: 'Arduino Uno',
        materialType: 'Arduino board',
        searchKeywords: [],
        alternativeKeywords: [],
        componentRole: 'REQUIRED_MATERIAL',
        quantity: { toNumber: () => 1 } as never,
        unit: 'piece',
        canBeSubstituted: false,
        isRequired: true,
        componentPosition: 0,
        projectId: 'proj-1',
      },
    });

    assert.equal(scored?.matchType, 'EXACT');
    assert.equal(scored?.matchReasonCodes[0], 'EXACT_NAME');
  });

  test('classifies alternative keyword matches only when substitution is allowed', () => {
    const scored = scoreMaterialAgainstComponent({
      material,
      component: {
        id: 'comp-alt',
        categoryId: 'cat-electronics',
        componentName: 'Microcontroller board',
        materialType: 'Microcontroller',
        searchKeywords: [],
        alternativeKeywords: ['arduino uno'],
        componentRole: 'REQUIRED_MATERIAL',
        quantity: { toNumber: () => 1 } as never,
        unit: 'piece',
        canBeSubstituted: true,
        isRequired: true,
        componentPosition: 0,
        projectId: 'proj-1',
      },
    });

    assert.equal(scored?.matchType, 'ALTERNATIVE');
  });

  test('does not classify alternative when substitution is disallowed', () => {
    const matchType = classifyLearnerMaterialMatchType({
      matchReasonCodes: ['KEYWORD_MATCH'],
      canBeSubstituted: false,
      alternativeKeywordMatched: true,
    });

    assert.equal(matchType, 'COMPATIBLE');
  });

  test('compareScoredMaterialComponentMatches prefers higher score and required components', () => {
    const left = {
      projectId: 'proj-1',
      componentId: 'comp-a',
      componentName: 'A',
      componentRole: 'REQUIRED_MATERIAL' as const,
      requiredQuantity: 1,
      unit: 'piece',
      canBeSubstituted: false,
      isRequired: true,
      componentPosition: 0,
      matchReasonCodes: ['CATEGORY_MATCH'] as const,
      matchReasonCode: 'CATEGORY_MATCH' as const,
      matchType: 'COMPATIBLE' as const,
      compatibilityScore: 150,
    } satisfies Parameters<typeof compareScoredMaterialComponentMatches>[0];
    const right = {
      ...left,
      componentId: 'comp-b',
      isRequired: false,
      componentPosition: 1,
    };

    assert.ok(compareScoredMaterialComponentMatches(left, right) < 0);
  });
});
