import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AI_AGENT_LIMITS } from './ai-agent.types.js';
import { resolveAgentExecutionPlan } from './ai-agent-plan-resolver.service.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';
import {
  detectMaterialSearchIntent,
  detectPlatformGuidanceIntent,
  detectEducationalLearningIntent,
  extractBudgetBound,
  detectProjectsWithinBudgetIntent,
  isExplicitMaterialSearchCommand,
  parseProjectsWithinBudgetInput,
  resolveProjectsWithinBudgetNumericContinuation,
  shouldDeferMaterialSearchForOwnedMaterialsProjectUse,
} from './ai-agent-filter-extractor.service.js';
import { resolveStaticAgentResponse } from './ai-agent-turn.service.js';
import { buildPlatformGuidanceResponse } from '../ai.policy.js';
import { setSemanticPlannerOverrideForTests, setSemanticUnderstandingOverrideForTests } from './ai-agent-semantic-planner.service.js';
import { isProviderFailureFallbackPlan } from './ai-agent-plan-resolver.service.js';
import {
  installSemanticPhraseMocks,
  requireSemanticRouterV2,
  resetSemanticTestHarness,
  buildPlatformGuidanceUnderstanding,
  buildSystemDataUnderstanding,
} from './ai-agent-semantic-test-harness.js';
import { AiToolExecutor } from './ai-tool-executor.service.js';
import { isRegisteredToolName } from './ai-tool-registry.js';

describe('ai agent router', () => {
  test('routes Arabic material inventory request to MATERIAL_SEARCH', () => {
    const decision = resolveAgentRoute({
      userMessage: 'اعرضلي مواد إلكترونيات متوفرة',
      locale: 'ar',
    });

    assert.equal(decision.route, 'MATERIAL_SEARCH');
    assert.equal(decision.suggestedTool, 'search_available_materials');
    assert.equal(decision.source, 'deterministic');
  });

  test('routes greeting to CONVERSATIONAL_STATIC', () => {
    const decision = resolveAgentRoute({
      userMessage: 'hi',
      locale: 'en',
    });

    assert.equal(decision.route, 'CONVERSATIONAL_STATIC');
  });

  test('routes Arduino explanation to GENERAL_LEARNING', () => {
    const decision = resolveAgentRoute({
      userMessage: 'Explain Arduino Uno simply',
      locale: 'en',
    });

    assert.equal(decision.route, 'GENERAL_LEARNING');
  });

  test('routes weather to OUT_OF_SCOPE', () => {
    const decision = resolveAgentRoute({
      userMessage: 'كيف الطقس اليوم؟',
      locale: 'ar',
    });

    assert.equal(decision.route, 'OUT_OF_SCOPE');
  });

  test('routes Arabic owned materials project match intent', () => {
    const decision = resolveAgentRoute({
      userMessage: 'عندي Arduino Uno، شو أقدر أعمل فيه؟',
      locale: 'ar',
    });

    assert.equal(decision.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.equal(decision.suggestedTool, 'match_projects_by_owned_materials');
  });

  test('routes English owned materials project match intent', () => {
    const decision = resolveAgentRoute({
      userMessage: 'I have an Arduino and jumper wires. What can I build?',
      locale: 'en',
    });

    assert.equal(decision.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.equal(decision.suggestedTool, 'match_projects_by_owned_materials');
  });

  test('routes Arabic project material availability intent', () => {
    const decision = resolveAgentRoute({
      userMessage: 'بدي أعمل Obstacle Avoidance Robot، شو المواد المتوفرة؟',
      locale: 'ar',
    });

    assert.equal(decision.route, 'PROJECT_MATERIAL_AVAILABILITY');
    assert.equal(decision.suggestedTool, 'match_available_materials_for_project');
  });

  test('routes English project material availability intent', () => {
    const decision = resolveAgentRoute({
      userMessage:
        'What available materials can help me build the Line Follower Robot?',
      locale: 'en',
    });

    assert.equal(decision.route, 'PROJECT_MATERIAL_AVAILABILITY');
    assert.equal(decision.suggestedTool, 'match_available_materials_for_project');
  });

  test('routes Arabic project budget estimation intent', () => {
    const decision = resolveAgentRoute({
      userMessage: 'كم بكلفني مشروع Obstacle Avoidance Robot؟',
      locale: 'ar',
    });

    assert.equal(decision.route, 'PROJECT_BUDGET_ESTIMATION');
    assert.equal(decision.suggestedTool, 'estimate_project_material_budget');
  });

  test('routes English project budget estimation intent', () => {
    const decision = resolveAgentRoute({
      userMessage:
        'How much would the available materials for the Obstacle Avoidance Robot cost?',
      locale: 'en',
    });

    assert.equal(decision.route, 'PROJECT_BUDGET_ESTIMATION');
    assert.equal(decision.suggestedTool, 'estimate_project_material_budget');
  });

  test('routes Arabic projects within budget intent', () => {
    const decision = resolveAgentRoute({
      userMessage: 'بدي مشروع إلكترونيات بحد أقصى 60 شيكل',
      locale: 'ar',
    });

    assert.equal(decision.route, 'PROJECTS_WITHIN_BUDGET');
    assert.equal(decision.suggestedTool, 'find_projects_within_budget');
  });

  test('extractBudgetBound distinguishes LT and LTE', () => {
    assert.deepEqual(extractBudgetBound('under 56 NIS'), {
      maxBudgetNis: 56,
      comparisonMode: 'LT',
    });
    assert.deepEqual(extractBudgetBound('up to 56 NIS'), {
      maxBudgetNis: 56,
      comparisonMode: 'LTE',
    });
  });

  test('numeric budget follow-up resolves from clarification context', () => {
    const continuation = resolveProjectsWithinBudgetNumericContinuation('60', {
      recentMessages: [
        { role: 'USER', text: 'بدي مشروع إلكترونيات بحد أقصى' },
        { role: 'ASSISTANT', text: 'What is your maximum budget in NIS?' },
      ],
    });
    assert.equal(continuation?.maxBudgetNis, 60);
    assert.equal(continuation?.comparisonMode, 'LTE');
  });

  test('Arabic within-budget clarification input does not treat category as title query', () => {
    const parsed = parseProjectsWithinBudgetInput('بدي مشروع إلكترونيات ضمن ميزانيتي');
    assert.equal(parsed.category, 'electronics');
    assert.equal(parsed.query, undefined);
    assert.equal(parsed.maxBudgetNis, 0);

    const continuation = resolveProjectsWithinBudgetNumericContinuation('60', {
      recentMessages: [
        { role: 'USER', text: 'بدي مشروع إلكترونيات ضمن ميزانيتي' },
        { role: 'ASSISTANT', text: 'ما الحد الأقصى لميزانيتك بالشيكل؟' },
      ],
    });
    assert.equal(continuation?.maxBudgetNis, 60);
    assert.equal(continuation?.category, 'electronics');
    assert.equal(continuation?.query, undefined);
  });

  test('bare numeric reply is not a standalone projects-within-budget route', () => {
    assert.equal(detectProjectsWithinBudgetIntent('60'), false);
  });

  test('registers estimate_project_material_budget tool', () => {
    assert.equal(isRegisteredToolName('estimate_project_material_budget'), true);
  });

  test('registers find_projects_within_budget tool', () => {
    assert.equal(isRegisteredToolName('find_projects_within_budget'), true);
  });
});

describe('semantic owned materials route precedence', () => {
  test('material search remains MATERIAL_SEARCH', () => {
    const decision = resolveAgentRoute({
      userMessage: 'اعرضلي مواد Arduino المتوفرة',
      locale: 'ar',
    });
    assert.equal(decision.route, 'MATERIAL_SEARCH');
  });

  test('project search remains PROJECT_SEARCH', () => {
    const decision = resolveAgentRoute({
      userMessage: 'اعرضلي مشاريع الروبوت',
      locale: 'ar',
    });
    assert.equal(decision.route, 'PROJECT_SEARCH');
  });

  test('reservation intent remains ACTION_REQUEST', () => {
    const decision = resolveAgentRoute({
      userMessage: 'احجزلي أول Arduino',
      locale: 'ar',
    });
    assert.equal(decision.route, 'ACTION_REQUEST');
  });

  test('general educational questions remain GENERAL_LEARNING', async () => {
    setSemanticPlannerOverrideForTests(async () => ({
      route: 'GENERAL_LEARNING',
      confidence: 0.9,
      entities: [],
      clarificationNeeded: false,
    }));
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'اشرحلي كيف Arduino بشتغل',
      locale: 'ar',
    });
    setSemanticPlannerOverrideForTests(null);
    assert.equal(plan.route, 'GENERAL_LEARNING');
    assert.equal(plan.toolName, null);
  });

  test('out-of-scope requests remain refused', () => {
    const decision = resolveAgentRoute({
      userMessage: 'كيف الطقس اليوم؟',
      locale: 'ar',
    });
    assert.equal(decision.route, 'OUT_OF_SCOPE');
  });

  test('project-use message defers weak material search inference', () => {
    const message =
      'لقيت Arduino وشوية أسلاك، بنفع أستفيد منهم بمشروع موجود عندكم؟';
    assert.equal(shouldDeferMaterialSearchForOwnedMaterialsProjectUse(message), true);
    assert.equal(isExplicitMaterialSearchCommand(message), false);
    assert.equal(detectMaterialSearchIntent(message).detected, false);
    const decision = resolveAgentRoute({ userMessage: message, locale: 'ar' });
    assert.notEqual(decision.route, 'MATERIAL_SEARCH');
  });

  test('explicit material search remains high-confidence', () => {
    const message = 'اعرضلي مواد Arduino المتوفرة';
    assert.equal(isExplicitMaterialSearchCommand(message), true);
    assert.equal(shouldDeferMaterialSearchForOwnedMaterialsProjectUse(message), false);
    const decision = resolveAgentRoute({ userMessage: message, locale: 'ar' });
    assert.equal(decision.route, 'MATERIAL_SEARCH');
  });

  test('project search remains PROJECT_SEARCH', () => {
    const decision = resolveAgentRoute({
      userMessage: 'اعرضلي مشاريع Arduino',
      locale: 'ar',
    });
    assert.equal(decision.route, 'PROJECT_SEARCH');
  });

  test('valid semantic GENERAL_LEARNING is not overridden by keyword detectors', async () => {
    setSemanticPlannerOverrideForTests(async () => ({
      route: 'GENERAL_LEARNING',
      confidence: 0.9,
      entities: [],
      clarificationNeeded: false,
    }));
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'اشرحلي كيف Arduino بشتغل',
      locale: 'ar',
    });
    setSemanticPlannerOverrideForTests(null);
    assert.equal(plan.route, 'GENERAL_LEARNING');
    assert.equal(plan.toolName, null);
  });
});

describe('unified chat platform guidance routing', () => {
  test('Arabic reservation how-to routes to PLATFORM_GUIDANCE', () => {
    const message = 'كيف أقدر أحجز مادة من التطبيق؟';
    const decision = resolveAgentRoute({ userMessage: message, locale: 'ar' });

    assert.equal(decision.route, 'PLATFORM_GUIDANCE');
    assert.equal(decision.reason, 'MATERIAL_RESERVATION');
    assert.equal(detectPlatformGuidanceIntent(message), 'MATERIAL_RESERVATION');

    const blocks = resolveStaticAgentResponse(message, 'ar');
    assert.ok(blocks);
    const firstBlock = blocks![0];
    assert.equal(firstBlock?.type, 'text');
    if (firstBlock?.type === 'text') {
      assert.match(firstBlock.text, /لحجز مادة على ImpactLoop/);
      assert.doesNotMatch(
        firstBlock.text,
        /لا أستطيع|لا يمكنني الوصول|educational assistant/i,
      );
    }
  });

  test('English reservation how-to routes to PLATFORM_GUIDANCE', () => {
    const message = 'How can I reserve a material in the app?';
    const decision = resolveAgentRoute({ userMessage: message, locale: 'en' });

    assert.equal(decision.route, 'PLATFORM_GUIDANCE');
    assert.equal(decision.reason, 'MATERIAL_RESERVATION');
    assert.match(
      buildPlatformGuidanceResponse('MATERIAL_RESERVATION', 'en'),
      /To reserve a material on ImpactLoop/,
    );
  });

  test('Arabic system-data query routes to agent data path', () => {
    const message = 'اعرضلي مواد متاحة لمشروع Arduino';
    const decision = resolveAgentRoute({ userMessage: message, locale: 'ar' });

    assert.equal(decision.route, 'PROJECT_MATERIAL_AVAILABILITY');
    assert.equal(
      decision.suggestedTool,
      'match_available_materials_for_project',
    );
    assert.equal(detectPlatformGuidanceIntent(message), null);
  });

  test('Arabic reservation action remains ACTION_REQUEST', () => {
    const message = 'احجز لي هذه المادة';
    const decision = resolveAgentRoute({ userMessage: message, locale: 'ar' });

    assert.equal(decision.route, 'ACTION_REQUEST');
    assert.equal(detectPlatformGuidanceIntent(message), null);
  });

  test('educational LDR question remains GENERAL_LEARNING', () => {
    const message = 'اشرحلي كيف يعمل حساس LDR';
    const decision = resolveAgentRoute({ userMessage: message, locale: 'ar' });

    assert.equal(decision.route, 'GENERAL_LEARNING');
    assert.equal(detectEducationalLearningIntent(message), true);
    assert.equal(detectPlatformGuidanceIntent(message), null);
  });

  test('weather question remains OUT_OF_SCOPE', () => {
    const message = 'شو حالة الطقس اليوم؟';
    const decision = resolveAgentRoute({ userMessage: message, locale: 'ar' });

    assert.equal(decision.route, 'OUT_OF_SCOPE');
    assert.equal(detectPlatformGuidanceIntent(message), null);
  });

  test('ambiguous educational material question is not platform guidance', () => {
    const message = 'اشرحلي ما هي مادة الخشب';
    const decision = resolveAgentRoute({ userMessage: message, locale: 'ar' });

    assert.equal(decision.route, 'GENERAL_LEARNING');
    assert.equal(detectPlatformGuidanceIntent(message), null);
  });

  test('platform guidance execution plan stays static without tools', async () => {
    const message = 'كيف أقدر أحجز مادة من التطبيق؟';
    installSemanticPhraseMocks({
      [message]: buildPlatformGuidanceUnderstanding('MATERIAL_RESERVATION'),
    });
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: message,
        locale: 'ar',
      });

      assert.equal(plan.route, 'PLATFORM_GUIDANCE');
      assert.equal(plan.toolName, null);
    } finally {
      resetSemanticTestHarness();
    }
  });
});

describe('ai tool registry and executor', () => {
  test('registers required read tools', () => {
    for (const toolName of [
      'get_learner_context',
      'search_available_materials',
      'search_learning_projects',
      'match_projects_by_owned_materials',
      'analyze_build_gaps',
      'get_personalized_recommendations',
    ]) {
      assert.equal(isRegisteredToolName(toolName), true);
    }
  });

  test('enforces read tool call limit', async () => {
    const executor = new AiToolExecutor();
    const context = {
      authenticatedUserId: 'user-1',
      conversationId: 'conv-1',
      locale: 'en' as const,
      requestId: 'req-1',
      clientMessageId: 'client-1',
    };

    for (let index = 0; index < AI_AGENT_LIMITS.maxReadToolCalls; index += 1) {
      const result = await executor.execute(
        { name: 'get_learner_context', input: {} },
        context,
      );
      assert.equal(result.ok, true);
    }

    const limited = await executor.execute(
      { name: 'get_learner_context', input: {} },
      context,
    );

    assert.equal(limited.ok, false);
    assert.equal(limited.errorCode, 'AI_TOOL_NOT_ALLOWED');
  });
});

requireSemanticRouterV2(() => {
  test('Arabic guidance routes via semantic planner without keyword override', async () => {
      installSemanticPhraseMocks({
        'كيف أقدر أحجز مادة من التطبيق؟':
          buildPlatformGuidanceUnderstanding('MATERIAL_RESERVATION'),
      });
      try {
        const plan = await resolveAgentExecutionPlan({
          userMessage: 'كيف أقدر أحجز مادة من التطبيق؟',
          locale: 'ar',
        });
        assert.equal(plan.route, 'PLATFORM_GUIDANCE');
        assert.equal(plan.diagnostics.semanticPlannerUsed, true);
      } finally {
        resetSemanticTestHarness();
      }
    });

    test('Arabic system data query uses semantic planner tool path', async () => {
      installSemanticPhraseMocks({
        'اعرضلي مواد إلكترونية': buildSystemDataUnderstanding('MATERIAL_SEARCH', {
          name: 'search_available_materials',
          arguments: { categoryText: 'electronics' },
        }),
      });
      try {
        const plan = await resolveAgentExecutionPlan({
          userMessage: 'اعرضلي مواد إلكترونية',
          locale: 'ar',
        });
        assert.equal(plan.route, 'MATERIAL_SEARCH');
        assert.equal(plan.toolName, 'search_available_materials');
      } finally {
      resetSemanticTestHarness();
    }
  });
});

describe('semantic planner provider failure classification', () => {
  test('English provider failure uses resilient system-data fallback', async () => {
    setSemanticUnderstandingOverrideForTests(async () => null);
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'show me electronics materials',
        locale: 'en',
      });
      assert.equal(isProviderFailureFallbackPlan(plan), true);
      assert.equal(plan.route, 'MATERIAL_SEARCH');
      assert.notEqual(plan.semanticUnderstandingRoute, 'CLARIFICATION_REQUIRED');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });
});
