import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  aiBuildStepGuideBlockSchema,
  aiComponentListBlockSchema,
  aiExternalSourcesBlockSchema,
  aiMaterialResultsBlockSchema,
  aiMediaUrlSchema,
  aiProjectBudgetEstimateBlockSchema,
  aiProjectResultsBlockSchema,
  aiRecommendationsBlockSchema,
} from './ai.content-blocks.js';
import { mapMaterialToCard } from './agent/ai-tool-mappers.js';

describe('AI media URL contract', () => {
  test('accepts HTTP(S) URLs and safe origin-relative media paths', () => {
    for (const value of [
      'http://localhost:4000/uploads/material.jpg',
      'https://cdn.example.com/material.jpg?width=640',
      '/demo-assets/community-materials/materials/MAT-036_01.jpg',
      '/uploads/materials/photo%201.jpg',
    ]) {
      assert.equal(aiMediaUrlSchema.safeParse(value).success, true, value);
    }
  });

  test('rejects unsafe schemes, protocol-relative URLs, and malformed paths', () => {
    for (const value of [
      '',
      '   ',
      'javascript:alert(1)',
      'data:image/png;base64,abc',
      'ftp://example.com/file.jpg',
      '//evil.example/image.jpg',
      '/',
      '/uploads/../secret.jpg',
      '/uploads//image.jpg',
      '/uploads/image name.jpg',
      '/uploads/%ZZ.jpg',
      '\\evil.example\image.jpg',
    ]) {
      assert.equal(aiMediaUrlSchema.safeParse(value).success, false, value);
    }
  });

  test('uses the media URL schema for every AI image-bearing block', () => {
    const relativeUrl = '/demo-assets/community-materials/materials/MAT-036_01.jpg';

    const blocks = [
      aiMaterialResultsBlockSchema.safeParse({
        type: 'material_results',
        items: [
          {
            materialId: 'mat-1',
            title: 'DC motor',
            thumbnailUrl: relativeUrl,
            priceLabel: 'Free',
          },
        ],
      }),
      aiProjectResultsBlockSchema.safeParse({
        type: 'project_results',
        items: [{ projectId: 'project-1', title: 'Robot', thumbnailUrl: relativeUrl }],
      }),
      aiComponentListBlockSchema.safeParse({
        type: 'component_list',
        projectId: 'project-1',
        projectImageUrl: relativeUrl,
        items: [
          {
            componentId: 'component-1',
            name: 'Motor',
            quantity: 1,
            required: true,
          },
        ],
      }),
      aiProjectBudgetEstimateBlockSchema.safeParse({
        type: 'project_budget_estimate',
        projectId: 'project-1',
        projectTitle: 'Robot',
        projectImageUrl: relativeUrl,
        estimateStatus: 'COMPLETE',
        estimatedSubtotalNis: 0,
        currency: 'NIS',
        requiredComponentCount: 0,
        pricedComponentCount: 0,
        missingComponentCount: 0,
        unpricedComponentCount: 0,
        deliveryExcludedNotice: 'Delivery excluded.',
        components: [],
      }),
      aiRecommendationsBlockSchema.safeParse({
        type: 'recommendations',
        recommendationType: 'MATERIALS',
        items: [
          {
            itemType: 'MATERIAL',
            itemId: 'mat-1',
            title: 'DC motor',
            reasons: ['Available now'],
            thumbnailUrl: relativeUrl,
          },
        ],
      }),
      aiBuildStepGuideBlockSchema.safeParse({
        type: 'build_step_guide',
        projectBuildId: 'build-1',
        projectId: 'project-1',
        projectTitle: 'Robot',
        projectStepId: 'step-1',
        stepNumber: 1,
        totalSteps: 1,
        title: 'Connect the motor',
        description: 'Connect the motor to the controller.',
        imageUrl: relativeUrl,
        progressPercent: 0,
        completedSteps: 0,
        materialReadiness: {
          ready: 0,
          linked: 0,
          reserved: 0,
          missing: 1,
          total: 1,
        },
        stepStatus: 'CURRENT',
      }),
    ];

    for (const result of blocks) {
      assert.equal(
        result.success,
        true,
        result.success ? undefined : JSON.stringify(result.error.issues),
      );
    }
  });

  test('keeps external source URLs restricted to absolute URLs', () => {
    const parsed = aiExternalSourcesBlockSchema.safeParse({
      type: 'external_sources',
      items: [{ title: 'Local path', url: '/uploads/source.html' }],
    });

    assert.equal(parsed.success, false);
  });

  test('material mapper preserves safe relative and HTTP image URLs', () => {
    const material = {
      id: 'mat-1',
      title: 'DC motor',
      isFree: true,
    };

    assert.equal(
      mapMaterialToCard(
        {
          ...material,
          imageUrl:
            '/demo-assets/community-materials/materials/MAT-036_01.jpg',
        },
        'ar',
      ).thumbnailUrl,
      '/demo-assets/community-materials/materials/MAT-036_01.jpg',
    );
    assert.equal(
      mapMaterialToCard(
        { ...material, imageUrl: 'https://cdn.example.com/material.jpg' },
        'en',
      ).thumbnailUrl,
      'https://cdn.example.com/material.jpg',
    );
    assert.equal(
      mapMaterialToCard(
        { ...material, imageUrl: 'javascript:alert(1)' },
        'en',
      ).thumbnailUrl,
      null,
    );
  });
});
