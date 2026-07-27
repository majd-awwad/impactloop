import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { AiContentBlock } from '../ai.content-blocks.js';
import {
  detectProjectComponentsIntent,
  classifyRecommendationSubtype,
} from './ai-agent-filter-extractor.service.js';
import {
  extractRecentEntitiesFromBlock,
  type RecentEntityRecord,
} from './ai-agent-recent-entities.service.js';
import {
  extractLatestMaterialResultSetFromBlocks,
} from './ai-agent-planner-context.service.js';
import {
  resolveProjectFromRecentEntities,
  scoreEntityTitleMatch,
} from './ai-agent-reference-resolver.service.js';
import { parseRecommendationInput } from './ai-agent-input-parser.service.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';

const LED_ID = 'proj-led';
const OBSTACLE_ID = 'proj-obstacle';
const LED_TITLE = 'Simple LED Circuit';
const OBSTACLE_TITLE = 'Obstacle Avoidance Robot';

const buildRecentProjects = (
  entries: Array<{
    id: string;
    title: string;
    blockType: string;
    resultIndex: number;
    recencyOrder: number;
  }>,
): RecentEntityRecord[] =>
  entries.map((entry) => ({
    id: entry.id,
    type: 'PROJECT' as const,
    title: entry.title,
    normalizedTitle: entry.title.toLowerCase(),
    blockType: entry.blockType,
    resultIndex: entry.resultIndex,
    messageId: `msg-${entry.recencyOrder}`,
    recencyOrder: entry.recencyOrder,
  }));

const projectResultsBlock = (items: Array<{ id: string; title: string }>) =>
  ({
    type: 'project_results',
    items: items.map((item, index) => ({
      projectId: item.id,
      title: item.title,
      resultIndex: index,
    })),
  }) as unknown as AiContentBlock;

const recommendationsBlock = (items: Array<{ id: string; title: string }>) =>
  ({
    type: 'recommendations',
    recommendationType: 'PROJECTS',
    items: items.map((item, index) => ({
      itemType: 'PROJECT',
      itemId: item.id,
      title: item.title,
      reasons: ['Matches your Robotics interest'],
      resultIndex: index,
    })),
  }) as unknown as AiContentBlock;

const projectDetailsBlock = (item: { id: string; title: string }) =>
  ({
    type: 'project_details',
    item: {
      projectId: item.id,
      title: item.title,
    },
  }) as unknown as AiContentBlock;

const comparisonBlock = (items: Array<{ id: string; title: string }>) =>
  ({
    type: 'comparison',
    subject: 'PROJECT',
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      facts: ['fact'],
    })),
  }) as unknown as AiContentBlock;

const defaultRecent = buildRecentProjects([
  {
    id: LED_ID,
    title: LED_TITLE,
    blockType: 'project_results',
    resultIndex: 0,
    recencyOrder: 0,
  },
  {
    id: OBSTACLE_ID,
    title: OBSTACLE_TITLE,
    blockType: 'project_results',
    resultIndex: 1,
    recencyOrder: 1,
  },
]);

const referenceCases: Array<{
  name: string;
  userMessage: string;
  recentProjects: RecentEntityRecord[];
  expectedProjectId: string | null;
  expectClarification?: boolean;
}> = [
  {
    name: 'project_results contextual obstacle bot',
    userMessage: 'اللي عرضته شو بده؟ الـ obstacle bot',
    recentProjects: defaultRecent,
    expectedProjectId: OBSTACLE_ID,
  },
  {
    name: 'recommendations contextual obstacle bot',
    userMessage: 'اللي عرضته شو بده؟ الـ obstacle bot',
    recentProjects: buildRecentProjects([
      {
        id: OBSTACLE_ID,
        title: OBSTACLE_TITLE,
        blockType: 'recommendations',
        resultIndex: 0,
        recencyOrder: 2,
      },
    ]),
    expectedProjectId: OBSTACLE_ID,
  },
  {
    name: 'project_details previous project',
    userMessage: 'شو محتاج المشروع السابق؟',
    recentProjects: buildRecentProjects([
      {
        id: LED_ID,
        title: LED_TITLE,
        blockType: 'project_details',
        resultIndex: 0,
        recencyOrder: 0,
      },
      {
        id: OBSTACLE_ID,
        title: OBSTACLE_TITLE,
        blockType: 'project_results',
        resultIndex: 0,
        recencyOrder: 1,
      },
    ]),
    expectedProjectId: OBSTACLE_ID,
  },
  {
    name: 'comparison unique robot project',
    userMessage: 'الروبوت شو مكوناته؟',
    recentProjects: buildRecentProjects([
      {
        id: OBSTACLE_ID,
        title: OBSTACLE_TITLE,
        blockType: 'comparison',
        resultIndex: 1,
        recencyOrder: 1,
      },
    ]),
    expectedProjectId: OBSTACLE_ID,
  },
  {
    name: 'mixed word order',
    userMessage: 'شو بده الـ obstacle bot؟',
    recentProjects: defaultRecent,
    expectedProjectId: OBSTACLE_ID,
  },
  {
    name: 'title at end',
    userMessage: 'اللي عرضته شو مكوناته obstacle robot',
    recentProjects: defaultRecent,
    expectedProjectId: OBSTACLE_ID,
  },
  {
    name: 'arabic description',
    userMessage: 'مشروع الروبوت اللي بتجنب العوائق شو بده؟',
    recentProjects: defaultRecent,
    expectedProjectId: OBSTACLE_ID,
  },
  {
    name: 'ordinal second project',
    userMessage: 'الثاني شو مكوناته؟',
    recentProjects: defaultRecent,
    expectedProjectId: OBSTACLE_ID,
  },
  {
    name: 'real ambiguity',
    userMessage: 'obstacle robot شو مكوناته؟',
    recentProjects: buildRecentProjects([
      {
        id: 'proj-obstacle-a',
        title: 'Obstacle Robot Starter',
        blockType: 'project_results',
        resultIndex: 0,
        recencyOrder: 0,
      },
      {
        id: 'proj-obstacle-b',
        title: 'Obstacle Robot Advanced',
        blockType: 'project_results',
        resultIndex: 1,
        recencyOrder: 1,
      },
    ]),
    expectedProjectId: null,
    expectClarification: true,
  },
  {
    name: 'no context pronoun only',
    userMessage: 'اللي عرضته شو بده؟',
    recentProjects: [],
    expectedProjectId: null,
    expectClarification: true,
  },
];

const contextualMaterialAvailabilityCases: Array<{
  name: string;
  userMessage: string;
  recentProjects: RecentEntityRecord[];
  expectedProjectId: string | null;
  expectClarification?: boolean;
}> = [
  {
    name: 'contextual pronoun resolves single latest project result',
    userMessage: 'طيب شو المواد المتوفرة إله؟',
    recentProjects: buildRecentProjects([
      {
        id: 'proj-led-dice',
        title: 'Electronic LED Dice',
        blockType: 'project_results',
        resultIndex: 0,
        recencyOrder: 3,
      },
    ]),
    expectedProjectId: 'proj-led-dice',
  },
  {
    name: 'contextual pronoun resolves single latest component list project',
    userMessage: 'طيب شو المواد المتوفرة إله؟',
    recentProjects: buildRecentProjects([
      {
        id: 'proj-obstacle',
        title: 'Obstacle Avoidance Robot',
        blockType: 'component_list',
        resultIndex: 0,
        recencyOrder: 5,
      },
    ]),
    expectedProjectId: 'proj-obstacle',
  },
  {
    name: 'contextual pronoun stays ambiguous with multiple latest project results',
    userMessage: 'طيب شو المواد المتوفرة إله؟',
    recentProjects: buildRecentProjects([
      {
        id: 'proj-robot-a',
        title: 'Robot Car Explorer',
        blockType: 'project_results',
        resultIndex: 0,
        recencyOrder: 4,
      },
      {
        id: 'proj-robot-b',
        title: 'Robot Car Racer',
        blockType: 'project_results',
        resultIndex: 1,
        recencyOrder: 4,
      },
    ]),
    expectedProjectId: null,
    expectClarification: true,
  },
];

describe('reference resolution from trusted blocks', () => {
  test('extracts projects from multiple trusted block types', () => {
    const blocks = [
      projectResultsBlock([{ id: LED_ID, title: LED_TITLE }]),
      recommendationsBlock([{ id: OBSTACLE_ID, title: OBSTACLE_TITLE }]),
      projectDetailsBlock({ id: 'proj-detail', title: 'Detail Project' }),
      comparisonBlock([
        { id: 'proj-a', title: 'Project A' },
        { id: 'proj-b', title: 'Project B' },
      ]),
    ];

    const entities = blocks.flatMap((block, index) =>
      extractRecentEntitiesFromBlock(block, `msg-${index}`, index),
    );

    assert.ok(
      entities.some(
        (entity) =>
          entity.type === 'PROJECT' &&
          entity.blockType === 'recommendations' &&
          entity.title === OBSTACLE_TITLE,
      ),
    );
    assert.ok(
      entities.some(
        (entity) => entity.blockType === 'comparison' && entity.title === 'Project B',
      ),
    );
  });

  test('obstacle bot scores against Obstacle Avoidance Robot', () => {
    const score = scoreEntityTitleMatch('obstacle bot', OBSTACLE_TITLE);
    assert.ok(score >= 0.7, `expected strong score, got ${score}`);
  });

  for (const row of referenceCases) {
    test(row.name, () => {
      assert.equal(
        detectProjectComponentsIntent(row.userMessage),
        true,
        `expected PROJECT_COMPONENTS intent for: ${row.userMessage}`,
      );

      const route = resolveAgentRoute({
        userMessage: row.userMessage,
        locale: 'ar',
      });
      assert.equal(route.route, 'PROJECT_COMPONENTS');

      const resolved = resolveProjectFromRecentEntities({
        userMessage: row.userMessage,
        recentProjects: row.recentProjects,
      });

      if (row.expectClarification) {
        assert.equal(resolved, null);
        return;
      }

      assert.ok(resolved, `expected project resolution for: ${row.userMessage}`);
      assert.equal(resolved.entity.id, row.expectedProjectId);
    });
  }

  for (const row of contextualMaterialAvailabilityCases) {
    test(`contextual material availability: ${row.name}`, () => {
      const resolved = resolveProjectFromRecentEntities({
        userMessage: row.userMessage,
        recentProjects: row.recentProjects,
      });

      if (row.expectClarification) {
        assert.equal(resolved, null);
        return;
      }

      assert.ok(resolved, `expected project resolution for: ${row.userMessage}`);
      assert.equal(resolved.entity.id, row.expectedProjectId);
    });
  }
});

describe('recommendation subtype classification', () => {
  const cases: Array<{
    message: string;
    expected: ReturnType<typeof classifyRecommendationSubtype>;
  }> = [
    {
      message: 'حسب اهتماماتي شو بتنصحني أعمل؟',
      expected: 'PROJECTS',
    },
    { message: 'شو مشروع مناسب إلي؟', expected: 'PROJECTS' },
    { message: 'شو الخطوة الجاية إلي؟', expected: 'NEXT_ACTIONS' },
    {
      message: 'اقترحلي مواد مناسبة لاهتماماتي',
      expected: 'MATERIALS',
    },
    { message: 'شو في اقتراحات إلي؟', expected: 'MIXED' },
  ];

  for (const row of cases) {
    test(row.message, () => {
      assert.equal(classifyRecommendationSubtype(row.message), row.expected);
      assert.equal(parseRecommendationInput(row.message).type, row.expected);
    });
  }
});

describe('material result set context after comparison', () => {
  const materialResultsBlock = {
    type: 'material_results',
    items: [
      { materialId: 'mat-1', title: 'Community Jumper Wire Pieces', priceLabel: 'مجاني' },
      { materialId: 'mat-2', title: 'Free Workshop Ultrasonic Sensors', priceLabel: 'مجاني' },
      { materialId: 'mat-3', title: 'Paid Arduino Kit', priceLabel: '₪120' },
    ],
  } as unknown as AiContentBlock;

  const materialComparisonBlock = {
    type: 'comparison',
    subject: 'MATERIAL',
    items: [
      { id: 'mat-1', title: 'Community Jumper Wire Pieces', facts: ['free'] },
      { id: 'mat-2', title: 'Free Workshop Ultrasonic Sensors', facts: ['free'] },
    ],
  } as unknown as AiContentBlock;

  test('comparison entities coexist with full material_results source set', () => {
    const materialEntities = extractRecentEntitiesFromBlock(
      materialResultsBlock,
      'msg-search',
      0,
    );
    const comparisonEntities = extractRecentEntitiesFromBlock(
      materialComparisonBlock,
      'msg-compare',
      1,
    );

    assert.equal(materialEntities.length, 3);
    assert.equal(comparisonEntities.length, 2);
    assert.ok(
      materialEntities.every((entity) => entity.blockType === 'material_results'),
    );
    assert.ok(
      comparisonEntities.every((entity) => entity.blockType === 'comparison'),
    );
  });

  test('latest material_results block remains extractable when comparison follows', () => {
    const extracted = extractLatestMaterialResultSetFromBlocks(
      [materialResultsBlock, materialComparisonBlock],
      'msg-compare',
    );

    assert.ok(extracted);
    assert.deepEqual(extracted?.materialIds, ['mat-1', 'mat-2', 'mat-3']);
    assert.equal(extracted?.itemCount, 3);
  });
});
