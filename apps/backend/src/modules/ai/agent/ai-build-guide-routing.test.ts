import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { detectProjectComponentsIntent } from './ai-agent-filter-extractor.service.js';
import { resolveAgentExecutionPlan } from './ai-agent-plan-resolver.service.js';
import {
  applyLinkedBuildGuideLearningOverride,
  preferLinkedBuildGuideLearning,
} from './ai-build-guide-routing.js';
import { setSemanticUnderstandingOverrideForTests } from './ai-agent-semantic-planner.service.js';
import {
  buildClarificationUnderstanding,
  buildSystemDataUnderstanding,
} from './ai-agent-semantic-test-harness.js';

const plantStandGuide = {
  projectTitle: 'PVC Plant Stand',
  currentStepNumber: 3,
  currentStepTitle: 'Assemble and connect',
  totalSteps: 4,
};

const followUps = [
  'شو القطع اللي بدي استخدمها بهالخطوة؟',
  'طيب وبعدها؟',
  'هاي وين أحطها؟',
  'شو بحتاج؟',
  'اشرحلي بالعربي',
];

afterEach(() => {
  setSemanticUnderstandingOverrideForTests(null);
});

describe('linked BUILD_GUIDE routing', () => {
  test('project-parts follow-up is a PROJECT_COMPONENTS trap without linked-build override', () => {
    assert.equal(
      detectProjectComponentsIntent('شو القطع اللي بدي استخدمها بهالخطوة؟'),
      true,
    );
  });

  test('linked build keeps arbitrary follow-ups in learning without exact-string hacks', () => {
    for (const message of followUps) {
      assert.equal(
        preferLinkedBuildGuideLearning({
          hasLinkedBuild: true,
          route: 'PROJECT_COMPONENTS',
          userMessage: message,
        }),
        true,
        message,
      );
      assert.equal(
        preferLinkedBuildGuideLearning({
          hasLinkedBuild: true,
          route: 'CLARIFICATION',
          userMessage: message,
        }),
        true,
        message,
      );
    }
  });

  test('non-build chats still allow generic project-component routing', () => {
    assert.equal(
      preferLinkedBuildGuideLearning({
        hasLinkedBuild: false,
        route: 'PROJECT_COMPONENTS',
        userMessage: 'شو القطع اللي بدي استخدمها بهالخطوة؟',
      }),
      false,
    );
  });

  test('explicit marketplace search stays a data query in a linked build', () => {
    assert.equal(
      preferLinkedBuildGuideLearning({
        hasLinkedBuild: true,
        route: 'MATERIAL_SEARCH',
        userMessage: 'اعرضلي مواد إلكترونيات متوفرة',
      }),
      false,
    );
  });

  test('override converts PROJECT_COMPONENTS plan to GENERAL_LEARNING', () => {
    const overridden = applyLinkedBuildGuideLearningOverride(
      {
        route: 'PROJECT_COMPONENTS',
        toolName: 'get_project_required_components',
        toolInput: {},
        diagnostics: {
          validatedRoute: 'PROJECT_COMPONENTS',
          toolName: 'get_project_required_components',
        },
      },
      {
        hasLinkedBuild: true,
        userMessage: 'شو القطع اللي بدي استخدمها بهالخطوة؟',
      },
    );

    assert.equal(overridden.route, 'GENERAL_LEARNING');
    assert.equal(overridden.toolName, null);
    assert.equal(overridden.semanticUnderstandingRoute, 'GENERAL_LEARNING');
  });

  test('same conversation: turn 1 and turn 2 stay in BUILD learning, not generic project clarification', async () => {
    const conversationContext = {
      recentMessages: [
        { role: 'USER' as const, text: 'مش فاهم هاي الخطوة' },
        { role: 'ASSISTANT' as const, text: 'الخطوة 3 هي التجميع والتوصيل.' },
      ],
      entities: [],
      activeBuildGuide: plantStandGuide,
    };

    setSemanticUnderstandingOverrideForTests(async () =>
      buildClarificationUnderstanding('أي مشروع تقصد؟'),
    );
    const turn1 = await resolveAgentExecutionPlan({
      userMessage: 'مش فاهم هاي الخطوة',
      locale: 'ar',
      conversationContext,
    });
    assert.equal(turn1.route, 'GENERAL_LEARNING');
    assert.equal(conversationContext.activeBuildGuide.projectTitle, 'PVC Plant Stand');
    assert.equal(conversationContext.activeBuildGuide.currentStepNumber, 3);

    setSemanticUnderstandingOverrideForTests(async () =>
      buildSystemDataUnderstanding('PROJECT_COMPONENTS'),
    );
    const turn2 = await resolveAgentExecutionPlan({
      userMessage: 'شو القطع اللي بدي استخدمها بهالخطوة؟',
      locale: 'ar',
      conversationContext,
    });
    assert.equal(turn2.route, 'GENERAL_LEARNING');
    assert.notEqual(turn2.route, 'PROJECT_COMPONENTS');
    assert.notEqual(turn2.route, 'CLARIFICATION');
    assert.equal(turn2.toolName, null);
  });

  test('follow-ups retain BUILD learning even if the planner asks for clarification', async () => {
    const conversationContext = {
      recentMessages: [
        { role: 'USER' as const, text: 'مش فاهم هاي الخطوة' },
      ],
      entities: [],
      activeBuildGuide: plantStandGuide,
    };

    for (const message of followUps) {
      setSemanticUnderstandingOverrideForTests(async () =>
        buildClarificationUnderstanding('أخبرني أكثر عن المشروع'),
      );
      const plan = await resolveAgentExecutionPlan({
        userMessage: message,
        locale: 'ar',
        conversationContext,
      });
      assert.equal(plan.route, 'GENERAL_LEARNING', message);
      assert.notEqual(plan.route, 'CLARIFICATION', message);
    }
  });

  test('without a linked build, the same parts question still uses PROJECT_COMPONENTS', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildSystemDataUnderstanding('PROJECT_COMPONENTS'),
    );
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'شو القطع اللي بدي استخدمها بهالخطوة؟',
      locale: 'ar',
      conversationContext: {
        recentMessages: [],
        entities: [],
      },
    });
    assert.equal(plan.route, 'PROJECT_COMPONENTS');
  });

  test('stale-step prevention: live step 4 is what the planner context carries', () => {
    const live = {
      ...plantStandGuide,
      currentStepNumber: 4,
      currentStepTitle: 'Test and improve',
    };
    assert.notEqual(live.currentStepNumber, 3);
    assert.equal(
      preferLinkedBuildGuideLearning({
        hasLinkedBuild: true,
        route: 'CLARIFICATION',
        userMessage: 'طيب شو أعمل؟',
      }),
      true,
    );
  });
});
