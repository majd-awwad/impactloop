import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { AiContentBlock } from '../ai.content-blocks.js';
import {
  buildComparisonFollowUpAnswer,
  detectComparisonCriterion,
} from './ai-agent-comparison-followup.service.js';
import {
  detectComparisonFollowUpIntent,
  detectMaterialDetailsIntent,
  detectActiveProjectBuildsIntent,
  detectMaterialSearchIntent,
  detectComponentMaterialMatchingIntent,
  extractProjectTitleQuery,
} from './ai-agent-filter-extractor.service.js';
import { extractRecentEntitiesFromBlock } from './ai-agent-recent-entities.service.js';
import { classifyScopeDeterministic } from '../ai-scope-guard.js';
import { preserveDeterministicDomainLearning } from './ai-agent-plan-resolver.service.js';
import {
  buildComponentMatchesIntro,
  isReservationContinuationMessage,
} from './ai-agent-turn.service.js';
import { extractRequestedResultCount } from './ai-agent-number-parser.service.js';

describe('phase 2 intent guards', () => {
  test('comparison follow-ups are not treated as material search', () => {
    assert.equal(detectComparisonFollowUpIntent('أي واحدة أقرب؟'), true);
    assert.equal(detectComparisonFollowUpIntent('أي واحدة أرخص؟'), true);
    assert.equal(detectMaterialSearchIntent('أي واحدة أقرب؟').detected, false);
    assert.equal(detectMaterialSearchIntent('أي واحدة أرخص؟').detected, false);
  });

  test('material details intent is detected for ordinal material references', () => {
    assert.equal(detectMaterialDetailsIntent('احكيلي عن أول مادة'), true);
    assert.equal(detectMaterialSearchIntent('احكيلي عن أول مادة').detected, false);
  });

  test('active builds intent is detected for Arabic started-projects phrases', () => {
    assert.equal(
      detectActiveProjectBuildsIntent('اعرضلي المشاريع اللي بلشت فيها'),
      true,
    );
  });
});

describe('comparison follow-up answers', () => {
  const materialComparison: Extract<AiContentBlock, { type: 'comparison' }> = {
    type: 'comparison',
    subject: 'MATERIAL',
    items: [
      {
        id: 'material-a',
        title: 'Breadboard A',
        facts: ['₪10', 'Condition: GOOD', 'Location: Nablus', 'Quantity: 1', 'Distance: 12.0 km'],
      },
      {
        id: 'material-b',
        title: 'Breadboard B',
        facts: ['₪5', 'Condition: GOOD', 'Location: Nablus', 'Quantity: 1', 'Distance: 4.5 km'],
      },
    ],
  };

  test('picks cheaper material from trusted comparison facts', () => {
    const answer = buildComparisonFollowUpAnswer({
      userMessage: 'أي واحدة أرخص؟',
      locale: 'ar',
      block: materialComparison,
    });
    assert.ok(answer);
    assert.equal(answer.winnerId, 'material-b');
  });

  test('picks closer material from trusted comparison facts', () => {
    const answer = buildComparisonFollowUpAnswer({
      userMessage: 'أي واحدة أقرب؟',
      locale: 'ar',
      block: materialComparison,
    });
    assert.ok(answer);
    assert.equal(answer.winnerId, 'material-b');
  });
});

describe('project comparison follow-up answers', () => {
  const projectComparison: Extract<AiContentBlock, { type: 'comparison' }> = {
    type: 'comparison',
    subject: 'PROJECT',
    items: [
      {
        id: 'project-beginner',
        title: 'Simple LED Circuit',
        facts: [
          'Difficulty: BEGINNER',
          'Estimated time: 30 min',
          'Components: 3',
          'Steps: 4',
        ],
      },
      {
        id: 'project-advanced',
        title: 'Line Follower Robot',
        facts: [
          'Difficulty: INTERMEDIATE',
          'Estimated time: 120 min',
          'Components: 8',
          'Steps: 10',
        ],
      },
    ],
  };

  test('picks easier project from trusted comparison facts', () => {
    const answer = buildComparisonFollowUpAnswer({
      userMessage: 'أي واحد أسهل؟',
      locale: 'ar',
      block: projectComparison,
    });
    assert.ok(answer);
    assert.equal(answer.winnerId, 'project-beginner');
  });

  test('picks shorter project from trusted comparison facts', () => {
    const answer = buildComparisonFollowUpAnswer({
      userMessage: 'أي واحد وقته أقل؟',
      locale: 'ar',
      block: projectComparison,
    });
    assert.ok(answer);
    assert.equal(answer.winnerId, 'project-beginner');
  });

  test('picks beginner-suitable project from trusted comparison facts', () => {
    const answer = buildComparisonFollowUpAnswer({
      userMessage: 'أي واحد أنسب للمبتدئ؟',
      locale: 'ar',
      block: projectComparison,
    });
    assert.ok(answer);
    assert.equal(answer.winnerId, 'project-beginner');
  });

  test('picks project with more components from trusted comparison facts', () => {
    const answer = buildComparisonFollowUpAnswer({
      userMessage: 'أي واحد مكوناته متوفرة أكثر؟',
      locale: 'ar',
      block: projectComparison,
    });
    assert.ok(answer);
    assert.equal(answer.winnerId, 'project-advanced');
  });

  test('detects project comparison criteria', () => {
    assert.equal(detectComparisonCriterion('أي واحد أسهل؟'), 'easier');
    assert.equal(detectComparisonCriterion('أي واحد وقته أقل؟'), 'shorter');
    assert.equal(detectComparisonCriterion('أي واحد أنسب للمبتدئ؟'), 'beginner');
    assert.equal(
      detectComparisonCriterion('أي واحد مكوناته متوفرة أكثر؟'),
      'moreComponents',
    );
  });
});

describe('recent entity index', () => {
  test('indexes component_matches and action_confirmation materials', () => {
    const componentMatches = extractRecentEntitiesFromBlock(
      {
        type: 'component_matches',
        buildId: 'build-1',
        groups: [
          {
            componentId: 'comp-1',
            componentName: 'Breadboard',
            materials: [
              {
                materialId: 'mat-1',
                title: 'Seed Breadboard',
                priceLabel: '₪5',
                condition: 'GOOD',
                locationLabel: 'Nablus',
                quantityLabel: '1',
                pickupAllowed: true,
                deliveryAllowed: false,
              },
            ],
          },
        ],
      },
      'msg-1',
      0,
    );

    assert.ok(
      componentMatches.some(
        (entity) => entity.type === 'COMPONENT' && entity.id === 'comp-1',
      ),
    );
    assert.ok(
      componentMatches.some(
        (entity) => entity.type === 'MATERIAL' && entity.id === 'mat-1',
      ),
    );

    const confirmation = extractRecentEntitiesFromBlock(
      {
        type: 'action_confirmation',
        pendingActionId: 'pending-1',
        actionType: 'SAVE_MATERIAL',
        title: 'Save material',
        summary: 'Save Seed Breadboard',
        target: {
          type: 'MATERIAL',
          id: 'mat-1',
          title: 'Seed Breadboard',
        },
        expiresAt: new Date().toISOString(),
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
      },
      'msg-2',
      1,
    );

    assert.equal(confirmation[0]?.type, 'MATERIAL');
    assert.equal(confirmation[0]?.id, 'mat-1');
  });
});

describe('stabilization regressions', () => {
  test('requested project count extracts Arabic dual form', () => {
    assert.equal(extractRequestedResultCount('اعرضي مشروعين'), 2);
    assert.equal(extractRequestedResultCount('show me two projects'), 2);
  });

  const craftPhrases = [
    'كيف اصنع الشمع',
    'كيف أصنع شمعة بطريقة آمنة؟',
    'كيفية صناعة الشمع للقوالب وباقات الورد',
    'اشرحلي عن الشمع',
  ];

  for (const phrase of craftPhrases) {
    test(`${phrase} is deterministic DOMAIN_KNOWLEDGE`, () => {
      const result = classifyScopeDeterministic(phrase);
      assert.equal(result.classification, 'DOMAIN_KNOWLEDGE');
      assert.ok(result.matchedRules.includes('art_crafts'));
    });
  }

  test('deterministic craft scope is not downgraded by planner OUT_OF_SCOPE', () => {
    const preserved = preserveDeterministicDomainLearning({
      userMessage: 'كيف اصنع الشمع',
      plan: {
        route: 'OUT_OF_SCOPE',
        toolName: null,
        toolInput: {},
        diagnostics: {
          deterministicRoute: 'OUT_OF_SCOPE',
          deterministicConfidence: 0.9,
          semanticPlannerUsed: true,
          semanticRoute: 'OUT_OF_SCOPE',
          validatedRoute: 'OUT_OF_SCOPE',
          normalizedFilters: null,
          toolName: null,
          plannerConfidence: 0.95,
          resolvedEntityTitle: null,
        },
      },
    });
    assert.equal(preserved.route, 'GENERAL_LEARNING');
  });

  const projectComparison: Extract<AiContentBlock, { type: 'comparison' }> = {
    type: 'comparison',
    subject: 'PROJECT',
    items: [
      {
        id: 'project-fast',
        title: 'Mini Wooden Phone Stand',
        facts: [
          'Difficulty: BEGINNER',
          'Estimated time: 1 ساعة',
          'Components: 4',
          'Steps: 5',
        ],
      },
      {
        id: 'project-slow',
        title: 'Recycled Cardboard Organizer',
        facts: [
          'Difficulty: BEGINNER',
          'Estimated time: 2 ساعة',
          'Components: 3',
          'Steps: 6',
        ],
      },
    ],
  };

  test('Arabic hour labels resolve duration follow-up winner', () => {
    const answer = buildComparisonFollowUpAnswer({
      userMessage: 'أي واحد وقته أقل؟',
      locale: 'ar',
      block: projectComparison,
    });
    assert.ok(answer);
    assert.equal(answer!.winnerTitle, 'Mini Wooden Phone Stand');
  });

  test('component match intro mentions only trusted components', () => {
    const block: Extract<AiContentBlock, { type: 'component_matches' }> = {
      type: 'component_matches',
      buildId: 'build-1',
      groups: [
        {
          componentId: 'component-breadboard',
          componentName: 'Breadboard',
          materials: [
            {
              materialId: 'material-breadboard',
              title: 'Half-size Breadboards',
              priceLabel: '₪10',
            },
          ],
        },
        {
          componentId: 'component-wires',
          componentName: 'Jumper wires',
          materials: [
            {
              materialId: 'material-wires',
              title: 'Jumper Wire Kit',
              priceLabel: '₪5',
            },
          ],
        },
      ],
    };
    const intro = buildComponentMatchesIntro([block], 'ar');
    assert.doesNotMatch(intro, /Arduino Nano/i);
  });

  test('reservation continuation helper ignores craft follow-up', () => {
    assert.equal(isReservationContinuationMessage('1'), true);
    assert.equal(isReservationContinuationMessage('كيف اصنع الشمع'), false);
  });

  test('numbered list prefix does not break component match parsing', () => {
    assert.equal(
      detectComponentMaterialMatchingIntent(
        '3) Simple LED Circuit: لاقيلي مواد للمكونات الناقصة',
      ),
      true,
    );
    assert.equal(
      extractProjectTitleQuery('3) Simple LED Circuit: لاقيلي مواد للمكونات الناقصة'),
      'Simple LED Circuit',
    );
    assert.equal(
      extractProjectTitleQuery('Simple LED Circuit: لاقيلي مواد للمكونات الناقصة'),
      'Simple LED Circuit',
    );
  });
});
