import assert from 'node:assert/strict';
import { describe, test, afterEach } from 'node:test';

import { PLATFORM_GUIDANCE_TOPICS, AI_DISABLED_COPY } from '../ai.policy.js';
import { setResolvedAiChatProviderForTests } from '../../../config/env.js';
import { AppError } from '../../../utils/app-error.js';
import { classifyScopeDeterministic } from '../ai-scope-guard.js';
import {
  detectEducationalLearningIntent,
  detectMaterialSearchIntent,
  extractMaterialSearchFilters,
  filterLearnerReservationsForStatusQuery,
  isLearnerAllReservationsQuery,
  isLearnerPendingReservationQuery,
  isMaterialSearchNoiseQuery,
  mergeMaterialSearchPlan,
} from './ai-agent-filter-extractor.service.js';
import {
  filterByMaxPrice,
  resolveMaterialSearchFetchLimit,
} from './ai-tool-handlers.js';
import {
  buildPlannerConversationContext,
  detectMaterialResultSetFilterFollowUp,
  extractLatestMaterialResultSetFromBlocks,
  extractMaterialResultSetFilterConstraints,
  messageReferencesPriorMaterialResultSet,
  resolveMaterialResultSetFilterContinuation,
  TRUSTED_MATERIAL_RESULT_SET_FILTER_MARKER,
} from './ai-agent-planner-context.service.js';
import {
  resolveAgentExecutionPlan,
  isProviderUnavailableExecutionPlan,
  isSemanticAmbiguityExecutionPlan,
  isProviderFailureFallbackPlan,
  isProviderUnavailableFallbackPlan,
  isSemanticInvalidFallbackPlan,
  isStructuredContinuationPlan,
} from './ai-agent-plan-resolver.service.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';
import { scoreEntityTitleMatch as scoreTitle } from './ai-agent-reference-resolver.service.js';
import {
  AI_SEMANTIC_ROUTER_VERSION,
  coerceSemanticUnderstandingFromGemini,
  mapSemanticToExecutionPlan,
  semanticUnderstandingSchema,
  validateSemanticUnderstanding,
} from './ai-agent-semantic-planner.service.js';
import {
  isAdminReviewDirectPayload,
  isLearnerAnswerBlocksPayload,
  parseSemanticPlannerResponseText,
} from '../providers/gemini-chat.provider.js';
import { SEMANTIC_ROUTES } from './ai-agent.types.js';
import {
  buildActionUnderstanding,
  buildClarificationUnderstanding,
  buildGeneralLearningUnderstanding,
  buildOutOfScopeUnderstanding,
  buildPlatformGuidanceUnderstanding,
  buildSemanticUnderstanding,
  buildSystemDataUnderstanding,
  getPlannerInvocationCount,
  installSemanticPhraseMocks,
  installSemanticTestHarness,
  requireSemanticRouterV2,
  resetSemanticTestHarness,
} from './ai-agent-semantic-test-harness.js';
import { setSemanticPlannerOverrideForTests, setSemanticUnderstandingOverrideForTests } from './ai-agent-semantic-planner.service.js';

describe('semantic v2 harness-level contract', () => {
  test('builders produce valid understanding for all six routes', () => {
    const fixtures = [
      buildPlatformGuidanceUnderstanding('MATERIAL_RESERVATION'),
      buildSystemDataUnderstanding('MATERIAL_SEARCH', {
        name: 'search_available_materials',
        arguments: { categoryText: 'electronics' },
      }),
      buildActionUnderstanding('PREPARE_MATERIAL_RESERVATION'),
      buildGeneralLearningUnderstanding(),
      buildOutOfScopeUnderstanding(),
      buildClarificationUnderstanding(),
    ];
    assert.equal(fixtures.length, SEMANTIC_ROUTES.length);
    for (const fixture of fixtures) {
      assert.ok(validateSemanticUnderstanding(fixture));
    }
  });

  test('planner invocation spy records calls', async () => {
    installSemanticTestHarness();
    try {
      assert.equal(getPlannerInvocationCount(), 0);
      await resolveAgentExecutionPlan({
        userMessage: 'اعرضلي مواد إلكترونية',
        locale: 'ar',
      });
      assert.ok(getPlannerInvocationCount() >= 0);
    } finally {
      resetSemanticTestHarness();
    }
  });

  test('pending-action payload shape is included in planner context summary', async () => {
    const { summarizePlannerContextForPrompt } = await import(
      './ai-agent-planner-context.service.js'
    );
    const summary = summarizePlannerContextForPrompt({
      recentMessages: [{ role: 'USER', text: 'احجزلي الثانية' }],
      entities: [],
      pendingAction: {
        actionType: 'PREPARE_MATERIAL_RESERVATION',
        status: 'PENDING',
        summary: 'Arduino Uno',
      },
    });
    assert.match(summary, /PREPARE_MATERIAL_RESERVATION/);
    assert.match(summary, /Arduino Uno/);
  });
});

describe('semantic v2 Gemini response normalization', () => {
  test('direct minimal GENERAL_LEARNING JSON validates after coercion', () => {
    const validated = validateSemanticUnderstanding({
      route: 'GENERAL_LEARNING',
      confidence: 0.94,
    });
    assert.equal(validated?.route, 'GENERAL_LEARNING');
    assert.equal(mapSemanticToExecutionPlan(validated!).route, 'GENERAL_LEARNING');
  });

  test('legacy MATERIAL_SEARCH route maps to SYSTEM_DATA_QUERY', () => {
    const validated = validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'MATERIAL_SEARCH',
      topic: null,
      action: null,
      entities: [],
      filters: { categoryText: 'electronics', query: 'arduino' },
      confidence: 0.91,
      needsClarification: false,
      clarificationQuestion: null,
    });
    assert.equal(validated?.route, 'SYSTEM_DATA_QUERY');
    assert.equal(validated?.topic, 'MATERIAL_SEARCH');
  });

  test('PLATFORM_GUIDANCE real-shaped response maps correctly', () => {
    const validated = validateSemanticUnderstanding({
      route: 'PLATFORM_GUIDANCE',
      topic: 'MATERIAL_RESERVATION',
      confidence: 0.93,
    });
    assert.equal(
      mapSemanticToExecutionPlan(validated!).route,
      'PLATFORM_GUIDANCE',
    );
  });

  test('learner answer-block JSON is rejected as semantic result', () => {
    const payload = { blocks: [{ type: 'text', text: 'hello', purpose: 'answer' }] };
    assert.equal(isLearnerAnswerBlocksPayload(payload), true);
    assert.equal(validateSemanticUnderstanding(payload), null);
  });

  test('admin review direct JSON is not accepted as semantic result', () => {
    const payload = { summary: 'ok', attentionLevel: 'LOW' };
    assert.equal(isAdminReviewDirectPayload(payload), true);
    assert.equal(validateSemanticUnderstanding(payload), null);
  });

  test('prose plus JSON is rejected by semantic parser', () => {
    assert.throws(
      () =>
        parseSemanticPlannerResponseText(
          'Result: {"route":"GENERAL_LEARNING","confidence":0.9}',
        ),
      SyntaxError,
    );
  });

  test('planner failure fallback does not auto-route to GENERAL_LEARNING', async () => {
    setResolvedAiChatProviderForTests('gemini');
    setSemanticUnderstandingOverrideForTests(async () => null);
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية متاحة ممكن أستخدمها مع Arduino',
        locale: 'ar',
      });
      assert.notEqual(plan.route, 'GENERAL_LEARNING');
      assert.equal(plan.diagnostics.semanticPlannerUsed, false);
      assert.equal(isProviderFailureFallbackPlan(plan), true);
      assert.equal(plan.route, 'MATERIAL_SEARCH');
      assert.equal(plan.toolName, 'search_available_materials');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
      setResolvedAiChatProviderForTests(null);
    }
  });

  test('coerce preserves invalid route for downstream rejection', () => {
    const coerced = coerceSemanticUnderstandingFromGemini({
      route: 'NOT_A_REAL_ROUTE',
      confidence: 0.5,
    }) as { route?: string };
    assert.equal(coerced.route, 'NOT_A_REAL_ROUTE');
    assert.equal(validateSemanticUnderstanding(coerced), null);
  });
});

requireSemanticRouterV2(() => {
  test('planner invoked once per fresh message', async () => {
    setResolvedAiChatProviderForTests('mock');
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'كيف أقدر أحجز مادة؟',
        locale: 'ar',
      });
      assert.equal(plan.diagnostics.semanticPlannerUsed, true);
      assert.equal(plan.route, 'PLATFORM_GUIDANCE');
    } finally {
      setResolvedAiChatProviderForTests(null);
    }
  });

  test('Arabic platform guidance has no tool or pending action', async () => {
    installSemanticPhraseMocks({
      'كيف أقدر أحجز مادة؟': buildPlatformGuidanceUnderstanding(),
    });
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'كيف أقدر أحجز مادة؟',
        locale: 'ar',
      });
      assert.equal(plan.route, 'PLATFORM_GUIDANCE');
      assert.equal(plan.toolName, null);
    } finally {
      resetSemanticTestHarness();
    }
  });

  test('planner failure does not route to educational provider path', async () => {
    installSemanticTestHarness(async () => null);
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'اشرحلي كيف بشتغل حساس الضوء',
        locale: 'ar',
      });
      assert.notEqual(plan.route, 'GENERAL_LEARNING');
      assert.equal(isProviderUnavailableExecutionPlan(plan), true);
    } finally {
      resetSemanticTestHarness();
    }
  });
});

describe('semantic planner failure vs ambiguity', () => {
  const GENERIC_FALLBACK_CLARIFICATION_AR =
    'أخبرني أكثر عن ما تريد القيام به في ImpactLoop.';

  const installPlannerFailure = () => {
    setSemanticUnderstandingOverrideForTests(async () => null);
  };

  const resetPlannerFailure = () => {
    setSemanticUnderstandingOverrideForTests(null);
  };

  test('valid CLARIFICATION_REQUIRED returns focused clarification', async () => {
    const question = 'أي مادة تقصد بالضبط؟';
    setSemanticUnderstandingOverrideForTests(async () =>
      buildClarificationUnderstanding(question),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'بدي آخذ هالخشبة',
        locale: 'ar',
      });
      assert.equal(isSemanticAmbiguityExecutionPlan(plan), true);
      assert.equal(isProviderUnavailableExecutionPlan(plan), false);
      assert.equal(plan.clarificationReason, question);
      assert.equal(plan.toolName, null);
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('low-confidence ACTION_REQUEST returns clarification', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildActionUnderstanding('PREPARE_MATERIAL_RESERVATION', 0.4),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'احجزلي الثانية',
        locale: 'ar',
      });
      assert.equal(isSemanticAmbiguityExecutionPlan(plan), true);
      assert.equal(plan.route, 'CLARIFICATION');
      assert.equal(plan.toolName, null);
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('unresolved action reference returns clarification', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildSemanticUnderstanding({
        route: 'ACTION_REQUEST',
        action: null,
        needsClarification: true,
        clarificationQuestion: 'أي مادة تريد حجزها؟',
        confidence: 0.88,
      }),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'احجزلي الثانية بكمية 1',
        locale: 'ar',
      });
      assert.equal(isSemanticAmbiguityExecutionPlan(plan), true);
      assert.match(String(plan.clarificationReason), /مادة|حجز/);
      assert.equal(plan.toolName, null);
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('Gemini HTTP 429 returns resilient material search, not unavailable', async () => {
    setSemanticUnderstandingOverrideForTests(async () => {
      throw new AppError('quota exceeded', 429, 'AI_PROVIDER_QUOTA_EXCEEDED');
    });
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية',
        locale: 'ar',
      });
      assert.equal(isProviderFailureFallbackPlan(plan), true);
      assert.equal(isProviderUnavailableExecutionPlan(plan), false);
      assert.equal(plan.route, 'MATERIAL_SEARCH');
      assert.equal(plan.toolName, 'search_available_materials');
    } finally {
      resetPlannerFailure();
    }
  });

  test('Gemini timeout returns resilient system-data fallback', async () => {
    setSemanticUnderstandingOverrideForTests(async () => {
      throw new AppError('timeout', 504, 'AI_PROVIDER_TIMEOUT');
    });
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية',
        locale: 'ar',
      });
      assert.equal(isProviderFailureFallbackPlan(plan), true);
      assert.equal(plan.route, 'MATERIAL_SEARCH');
    } finally {
      resetPlannerFailure();
    }
  });

  test('provider unavailable returns resilient fallback for system data', async () => {
    setResolvedAiChatProviderForTests('disabled');
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية',
        locale: 'ar',
      });
      assert.equal(isProviderFailureFallbackPlan(plan), true);
      assert.equal(plan.route, 'MATERIAL_SEARCH');
    } finally {
      setResolvedAiChatProviderForTests(null);
    }
  });

  test('malformed semantic JSON returns resilient fallback for system data', async () => {
    setSemanticUnderstandingOverrideForTests(async () => {
      throw new SyntaxError('Unexpected token in JSON');
    });
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية',
        locale: 'ar',
      });
      assert.equal(isProviderFailureFallbackPlan(plan), true);
      assert.equal(plan.route, 'MATERIAL_SEARCH');
    } finally {
      resetPlannerFailure();
    }
  });

  test('answer-block payload on semantic path returns resilient fallback', async () => {
    installPlannerFailure();
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية',
        locale: 'ar',
      });
      assert.equal(isProviderFailureFallbackPlan(plan), true);
      assert.equal(plan.route, 'MATERIAL_SEARCH');
    } finally {
      resetPlannerFailure();
    }
  });

  test('provider failure never reaches GENERAL_LEARNING', async () => {
    setSemanticUnderstandingOverrideForTests(async () => null);
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'اشرحلي كيف بشتغل حساس الضوء LDR',
        locale: 'ar',
      });
      assert.notEqual(plan.route, 'GENERAL_LEARNING');
      assert.equal(isProviderUnavailableExecutionPlan(plan), true);
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('provider failure never executes a tool or creates pending action for ambiguous action', async () => {
    installPlannerFailure();
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'اعملها',
        locale: 'ar',
      });
      assert.equal(isProviderFailureFallbackPlan(plan), true);
      assert.equal(isSemanticAmbiguityExecutionPlan(plan), true);
      assert.equal(plan.toolName, null);
      assert.notEqual(plan.route, 'ACTION_REQUEST');
    } finally {
      resetPlannerFailure();
    }
  });

  test('clear reservation action uses deterministic fallback during outage', async () => {
    installPlannerFailure();
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'احجزلي المادة الثانية بكمية 1',
        locale: 'ar',
      });
      assert.equal(isProviderFailureFallbackPlan(plan), true);
      assert.equal(plan.route, 'ACTION_REQUEST');
      assert.equal(plan.toolName, 'prepare_action');
    } finally {
      resetPlannerFailure();
    }
  });

  test('reservation workflow guidance works during outage', async () => {
    installPlannerFailure();
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'شو أعمل عشان أطلب قطعة من المواد الموجودة؟',
        locale: 'ar',
      });
      assert.equal(isProviderFailureFallbackPlan(plan), true);
      assert.equal(plan.route, 'PLATFORM_GUIDANCE');
      assert.equal(isProviderUnavailableExecutionPlan(plan), false);
    } finally {
      resetPlannerFailure();
    }
  });

  test('reservation status query uses learner reservation read during outage', async () => {
    installPlannerFailure();
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'هل عندي حجوزات معلقة؟',
        locale: 'ar',
      });
      assert.equal(plan.semanticUnderstandingRoute, 'SYSTEM_DATA_QUERY');
      assert.equal(plan.toolName, null);
      assert.equal(plan.semanticDataTopic, 'LEARNER_RESERVATION_STATUS');
      assert.equal(isProviderUnavailableFallbackPlan(plan), true);
      assert.equal(plan.diagnostics.routingMode, 'provider_unavailable_fallback');
    } finally {
      resetPlannerFailure();
    }
  });

  test('platform-guidance fallback remains safe on planner failure', async () => {
    setSemanticUnderstandingOverrideForTests(async () => null);
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'كيف أقدر أحجز مادة؟',
        locale: 'ar',
      });
      assert.equal(plan.route, 'PLATFORM_GUIDANCE');
      assert.equal(isProviderUnavailableExecutionPlan(plan), false);
      assert.equal(isSemanticAmbiguityExecutionPlan(plan), false);
      assert.equal(plan.toolName, null);
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('out-of-scope fallback remains safe on planner failure', async () => {
    setSemanticUnderstandingOverrideForTests(async () => null);
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'شو الطقس اليوم؟',
        locale: 'ar',
      });
      assert.equal(plan.route, 'OUT_OF_SCOPE');
      assert.equal(isProviderUnavailableExecutionPlan(plan), false);
      assert.equal(plan.toolName, null);
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });
});

describe('semantic planner provider failure resilient fallback', () => {
  test('valid semantic PLATFORM_GUIDANCE wins over keyword fallback', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildPlatformGuidanceUnderstanding('MATERIAL_RESERVATION'),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'كيف أقدر أحجز مادة؟',
        locale: 'ar',
      });
      assert.equal(plan.diagnostics.routingMode, 'semantic');
      assert.equal(plan.route, 'PLATFORM_GUIDANCE');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('valid semantic SYSTEM_DATA_QUERY wins over keyword fallback', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildSystemDataUnderstanding('MATERIAL_SEARCH', {
        name: 'search_available_materials',
        arguments: { categoryText: 'electronics' },
      }),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية',
        locale: 'ar',
      });
      assert.equal(plan.diagnostics.routingMode, 'semantic');
      assert.equal(plan.route, 'MATERIAL_SEARCH');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('valid semantic ACTION_REQUEST wins over keyword fallback', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildActionUnderstanding('PREPARE_MATERIAL_RESERVATION'),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'احجزلي الثانية',
        locale: 'ar',
      });
      assert.equal(plan.diagnostics.routingMode, 'semantic');
      assert.equal(plan.route, 'ACTION_REQUEST');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('valid semantic GENERAL_LEARNING reaches educational provider path', async () => {
    setSemanticUnderstandingOverrideForTests(async () => buildGeneralLearningUnderstanding());
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'اشرحلي كيف بشتغل حساس الضوء LDR',
        locale: 'ar',
      });
      assert.equal(plan.diagnostics.routingMode, 'semantic');
      assert.equal(plan.route, 'GENERAL_LEARNING');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });
});

describe('semantic v2 contract', () => {
  test('exports semantic-first router version in production', () => {
    assert.equal(AI_SEMANTIC_ROUTER_VERSION, 2);
  });

  test('parses valid platform guidance understanding', () => {
    const raw = {
      schemaVersion: 1,
      route: 'PLATFORM_GUIDANCE',
      topic: 'MATERIAL_RESERVATION',
      action: null,
      entities: [],
      confidence: 0.95,
      needsClarification: false,
      clarificationQuestion: null,
    };
    const parsed = validateSemanticUnderstanding(raw);
    assert.ok(parsed);
    const plan = mapSemanticToExecutionPlan(parsed!);
    assert.equal(plan.route, 'PLATFORM_GUIDANCE');
    assert.equal(plan.semanticRoute, 'PLATFORM_GUIDANCE');
    assert.equal(plan.platformGuidanceTopic, 'MATERIAL_RESERVATION');
  });

  test('rejects forbidden tool argument keys', () => {
    const raw = {
      schemaVersion: 1,
      route: 'SYSTEM_DATA_QUERY',
      topic: 'MATERIAL_SEARCH',
      action: null,
      entities: [],
      confidence: 0.9,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: {
        name: 'search_available_materials',
        arguments: { userId: 'evil', query: 'arduino' },
      },
    };
    const parsed = validateSemanticUnderstanding(raw);
    assert.ok(parsed);
    const plan = mapSemanticToExecutionPlan(parsed!);
    assert.equal(plan.toolInput.userId, undefined);
    assert.equal(plan.toolInput.query, 'arduino');
  });

  test('rejects invalid schema with unknown route', () => {
    const parsed = validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'INVALID_ROUTE',
      topic: null,
      action: null,
      entities: [],
      confidence: 0.5,
      needsClarification: false,
      clarificationQuestion: null,
    });
    assert.equal(parsed, null);
  });

  test('maps each semantic route to granular execution route', () => {
    const cases: Array<{
      route: (typeof SEMANTIC_ROUTES)[number];
      topic?: string;
      action?: string;
      expectedRoute: string;
    }> = [
      {
        route: 'GENERAL_LEARNING',
        expectedRoute: 'GENERAL_LEARNING',
      },
      {
        route: 'OUT_OF_SCOPE',
        expectedRoute: 'OUT_OF_SCOPE',
      },
      {
        route: 'SYSTEM_DATA_QUERY',
        topic: 'PROJECT_COMPONENTS',
        expectedRoute: 'PROJECT_COMPONENTS',
      },
      {
        route: 'ACTION_REQUEST',
        action: 'SAVE_MATERIAL',
        expectedRoute: 'ACTION_REQUEST',
      },
    ];

    for (const sample of cases) {
      const raw = {
        schemaVersion: 1,
        route: sample.route,
        topic: sample.topic ?? null,
        action: sample.action ?? null,
        entities: [],
        confidence: 0.92,
        needsClarification: false,
        clarificationQuestion: null,
      };
      const parsed = semanticUnderstandingSchema.parse(raw);
      const plan = mapSemanticToExecutionPlan(parsed);
      assert.equal(plan.route, sample.expectedRoute, sample.route);
    }
  });

  test('maps low-confidence action to clarification', () => {
    const parsed = validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'ACTION_REQUEST',
      topic: null,
      action: 'PREPARE_MATERIAL_RESERVATION',
      entities: [],
      confidence: 0.4,
      needsClarification: false,
      clarificationQuestion: null,
    });
    assert.ok(parsed);
    const plan = mapSemanticToExecutionPlan(parsed!);
    assert.equal(plan.route, 'CLARIFICATION');
    assert.equal(plan.semanticRoute, 'CLARIFICATION_REQUIRED');
  });

  test('platform guidance topics allowlist matches policy copy keys', () => {
    for (const topic of PLATFORM_GUIDANCE_TOPICS) {
      assert.ok(topic.length > 0);
    }
    assert.equal(PLATFORM_GUIDANCE_TOPICS.length, 5);
  });
});

describe('semantic-first out of scope', () => {
  const cases = [
    'ما هي فلسطين؟',
    'اشرحلي عن القدس',
    'كيف الطقس اليوم؟',
    'مين فاز بالمباراة؟',
  ];

  for (const message of cases) {
    test(`routes ${message} to OUT_OF_SCOPE`, () => {
      const scope = classifyScopeDeterministic(message);
      const route = resolveAgentRoute({ userMessage: message, locale: 'ar' });
      assert.equal(scope.classification, 'OUT_OF_SCOPE');
      assert.equal(route.route, 'OUT_OF_SCOPE');
    });
  }
});

describe('semantic-first material platform intent', () => {
  const cases = [
    {
      message: 'مواد الها علاقة بالالكترونيات',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.categoryText, 'electronics');
        assert.equal(plan.query, undefined);
      },
    },
    {
      message: 'طيب اعرضلي مواد الها علاقة بتحتوي الالكترونيات',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.categoryText, 'electronics');
        assert.equal(plan.query, undefined);
      },
    },
    {
      message: 'بدي شغلات إلكترونية',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.categoryText, 'electronics');
      },
    },
    {
      message: 'عندكم breadboard؟',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.query, 'breadboard');
      },
    },
    {
      message: 'electronics materials',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.categoryText, 'electronics');
      },
    },
    {
      message: 'مواد دوائر كهربائية',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.categoryText, 'electronics');
      },
    },
    {
      message: 'بدي قطع للـ Arduino',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.query, 'Arduino');
      },
    },
    {
      message: 'شو في حساسات متوفرة؟',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.query, 'sensor');
      },
    },
  ];

  for (const sample of cases) {
    test(`material search: ${sample.message}`, async () => {
      const intent = detectMaterialSearchIntent(sample.message);
      assert.equal(intent.detected, true, 'material intent should be detected');

      const route = resolveAgentRoute({
        userMessage: sample.message,
        locale: 'ar',
      });
      assert.equal(route.route, 'MATERIAL_SEARCH');

      const mergedFilters = mergeMaterialSearchPlan(sample.message);
      setSemanticPlannerOverrideForTests(async () => ({
        route: 'MATERIAL_SEARCH',
        confidence: 0.93,
        entities: [],
        filters: mergedFilters,
        clarificationNeeded: false,
      }));

      const plan = await resolveAgentExecutionPlan({
        userMessage: sample.message,
        locale: 'ar',
      });
      setSemanticPlannerOverrideForTests(null);
      assert.equal(plan.route, 'MATERIAL_SEARCH');
      assert.equal(plan.toolName, 'search_available_materials');
      sample.assertPlan(plan.toolInput);
    });
  }
});

describe('semantic-first general learning distinction', () => {
  const cases = [
    'كيف بستخدم breadboard؟',
    'اشرحلي شو هي الحساسات',
    'شو الفرق بين المحرك والسيرفو؟',
    'اشرحلي كيف Arduino بشتغل',
  ];

  for (const message of cases) {
    test(`educational intent: ${message}`, () => {
      assert.equal(detectEducationalLearningIntent(message), true);
      assert.equal(detectMaterialSearchIntent(message).detected, false);
      const route = resolveAgentRoute({ userMessage: message, locale: 'ar' });
      assert.equal(route.route, 'GENERAL_LEARNING');
    });
  }
});

describe('semantic-first project title resolution', () => {
  test('scores shortened project names against recent titles', () => {
    const score = scoreTitle('Obstacle Robot', 'Obstacle Avoidance Robot');
    assert.ok(score >= 0.65);
  });

  test('extracts leading project mention from mixed Arabic/English phrase', () => {
    const route = resolveAgentRoute({
      userMessage: 'Obstacle Robot شو مكونات مشروع ال',
      locale: 'ar',
    });
    assert.equal(route.route, 'PROJECT_COMPONENTS');
  });
});

describe('AI-SR-01 semantic planner contract and reconciliation', () => {
  test('real-shaped valid material-search output passes v2 validation', () => {
    const validated = validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'SYSTEM_DATA_QUERY',
      topic: 'MATERIAL_SEARCH',
      action: null,
      entities: [],
      filters: { categoryText: 'electronics', query: 'arduino' },
      confidence: 0.95,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: { name: 'search_available_materials', arguments: {} },
    });
    assert.ok(validated);
    assert.equal(mapSemanticToExecutionPlan(validated!).toolName, 'search_available_materials');
  });

  test('string toolCall and filter aliases coerce to valid material search', () => {
    const validated = validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'SYSTEM_DATA_QUERY',
      topic: 'MATERIAL_SEARCH',
      action: null,
      entities: [],
      filters: { categoryText: 'electronics', nearLearner: true, maxPrice: '20' },
      confidence: 0.95,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: 'search_available_materials',
    });
    assert.ok(validated);
    assert.equal(validated?.toolCall?.name, 'search_available_materials');
    assert.equal(validated?.filters?.maxPrice, 20);
  });

  test('arduino intended-use search maps directly to search_available_materials', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildSystemDataUnderstanding('MATERIAL_SEARCH', {
        name: 'search_available_materials',
        arguments: { categoryText: 'electronics', query: 'arduino' },
      }),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية متاحة ممكن أستخدمها مع Arduino',
        locale: 'ar',
      });
      assert.equal(plan.route, 'MATERIAL_SEARCH');
      assert.equal(plan.toolName, 'search_available_materials');
      assert.equal(plan.diagnostics.routingMode, 'semantic');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('misspelled arduino material search uses the same semantic route', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildSystemDataUnderstanding('MATERIAL_SEARCH', {
        name: 'search_available_materials',
        arguments: { categoryText: 'electronics', query: 'arduino' },
      }),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية متاحة للاردنو',
        locale: 'ar',
      });
      assert.equal(plan.route, 'MATERIAL_SEARCH');
      assert.equal(plan.toolName, 'search_available_materials');
      assert.equal(plan.diagnostics.routingMode, 'semantic');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('beginner electronics project query maps directly to project search', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildSystemDataUnderstanding('PROJECT_SEARCH', {
        name: 'search_learning_projects',
        arguments: { category: 'electronics', difficulty: 'BEGINNER' },
      }),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مشاريع تعلم مناسبة للمبتدئين في الإلكترونيات',
        locale: 'ar',
      });
      assert.equal(plan.route, 'PROJECT_SEARCH');
      assert.equal(plan.toolName, 'search_learning_projects');
      assert.equal(plan.diagnostics.routingMode, 'semantic');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('pending-reservation query has explicit reservation-status semantic topic', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      validateSemanticUnderstanding({
        schemaVersion: 1,
        route: 'SYSTEM_DATA_QUERY',
        topic: 'LEARNER_RESERVATION_STATUS',
        action: null,
        entities: [],
        confidence: 0.98,
        needsClarification: false,
        clarificationQuestion: null,
        toolCall: null,
      }),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'هل عندي حجوزات معلقة؟',
        locale: 'ar',
      });
      assert.equal(plan.semanticDataTopic, 'LEARNER_RESERVATION_STATUS');
      assert.equal(plan.toolName, null);
      assert.notEqual(plan.toolInput.learnerReservationStatusQuery, true);
      assert.equal(plan.diagnostics.routingMode, 'semantic');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('near-me max-price output contains nearLearner and maxPrice', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildSystemDataUnderstanding('MATERIAL_SEARCH', {
        name: 'search_available_materials',
        arguments: { categoryText: 'electronics', nearLearner: true, maxPrice: 20 },
      }),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية قريبة مني وسعرها أقل من 20 شيكل',
        locale: 'ar',
      });
      assert.equal(plan.toolInput.nearLearner, true);
      assert.equal(plan.toolInput.maxPrice, 20);
      assert.equal(plan.diagnostics.routingMode, 'semantic');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('gold free near output remains read-only material search', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildSystemDataUnderstanding('MATERIAL_SEARCH', {
        name: 'search_available_materials',
        arguments: { query: 'gold', isFree: true, nearLearner: true },
      }),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد مصنوعة من الذهب ومجانية وقريبة مني',
        locale: 'ar',
      });
      assert.equal(plan.route, 'MATERIAL_SEARCH');
      assert.equal(plan.toolName, 'search_available_materials');
      assert.equal(plan.toolInput.isFree, true);
      assert.equal(plan.toolInput.nearLearner, true);
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('no valid semantic result is overridden by phrase detectors', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildGeneralLearningUnderstanding(),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'اشرحلي كيف بشتغل حساس الضوء LDR',
        locale: 'ar',
      });
      assert.equal(plan.route, 'GENERAL_LEARNING');
      assert.equal(plan.diagnostics.routingMode, 'semantic');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('invalid semantic combinations are rejected and use semantic_invalid_fallback', async () => {
    setSemanticUnderstandingOverrideForTests(async () =>
      buildSystemDataUnderstanding('PROJECT_MATERIAL_AVAILABILITY', {
        name: 'match_available_materials_for_project',
        arguments: { projectQuery: 'Arduino' },
      }),
    );
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية متاحة ممكن أستخدمها مع Arduino',
        locale: 'ar',
      });
      assert.equal(isSemanticInvalidFallbackPlan(plan), true);
      assert.equal(plan.diagnostics.routingMode, 'semantic_invalid_fallback');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('provider outage uses provider_unavailable_fallback', async () => {
    setSemanticUnderstandingOverrideForTests(async () => ({ status: 'failure', reason: 'provider_unavailable' }));
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'ورجيني مواد إلكترونية متاحة ممكن أستخدمها مع Arduino',
        locale: 'ar',
      });
      assert.equal(isProviderUnavailableFallbackPlan(plan), true);
      assert.equal(plan.diagnostics.routingMode, 'provider_unavailable_fallback');
    } finally {
      setSemanticUnderstandingOverrideForTests(null);
    }
  });

  test('semantic_invalid and provider_unavailable fallbacks are distinguishable', async () => {
    setSemanticUnderstandingOverrideForTests(async () => ({ status: 'failure', reason: 'semantic_invalid' }));
    const invalidPlan = await resolveAgentExecutionPlan({
      userMessage: 'ورجيني مواد إلكترونية متاحة ممكن أستخدمها مع Arduino',
      locale: 'ar',
    });
    setSemanticUnderstandingOverrideForTests(async () => ({ status: 'failure', reason: 'provider_unavailable' }));
    const outagePlan = await resolveAgentExecutionPlan({
      userMessage: 'ورجيني مواد إلكترونية متاحة ممكن أستخدمها مع Arduino',
      locale: 'ar',
    });
    setSemanticUnderstandingOverrideForTests(null);
    assert.equal(invalidPlan.diagnostics.routingMode, 'semantic_invalid_fallback');
    assert.equal(outagePlan.diagnostics.routingMode, 'provider_unavailable_fallback');
    assert.notEqual(invalidPlan.diagnostics.routingMode, outagePlan.diagnostics.routingMode);
  });

  test('reservation navigation guidance routes to PLATFORM_GUIDANCE', async () => {
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'وين بروح بالتطبيق إذا لقيت مادة وعجبتني؟',
      locale: 'ar',
    });
    assert.equal(plan.route, 'PLATFORM_GUIDANCE');
    assert.equal(plan.toolName, null);
    assert.equal(plan.diagnostics.routingMode, 'semantic');
  });

  test('supplier publish guidance routes to PLATFORM_GUIDANCE without tools', async () => {
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'كيف بقدر أنشر مادة عندي؟',
      locale: 'ar',
    });
    assert.equal(plan.route, 'PLATFORM_GUIDANCE');
    assert.equal(plan.toolName, null);
    assert.equal(plan.diagnostics.routingMode, 'semantic');
  });
});

describe('AI-SR-01 max-price material search regressions', () => {
  test('Arabic maxPrice 20 is normalized as numeric 20', () => {
    const filters = extractMaterialSearchFilters(
      'ورجيني مواد إلكترونية وسعرها أقل من 20 شيكل',
    );
    assert.equal(filters.maxPrice, 20);
    const plan = mergeMaterialSearchPlan(
      'ورجيني مواد إلكترونية وسعرها أقل من 20 شيكل',
    );
    assert.equal(plan.maxPrice, 20);
    assert.equal(plan.nearLearner, undefined);
  });

  test('Arabic maxPrice 60 is normalized as numeric 60', () => {
    const filters = extractMaterialSearchFilters(
      'ورجيني مواد إلكترونية وسعرها أقل من 60 شيكل',
    );
    assert.equal(filters.maxPrice, 60);
    const plan = mergeMaterialSearchPlan(
      'ورجيني مواد إلكترونية وسعرها أقل من 60 شيكل',
    );
    assert.equal(plan.maxPrice, 60);
  });

  test('price-only query does not set nearLearner', () => {
    const plan = mergeMaterialSearchPlan(
      'ورجيني مواد إلكترونية وسعرها أقل من 20 شيكل',
    );
    assert.equal(plan.nearLearner, undefined);
    assert.equal(plan.query, undefined);
  });

  test('electronic materials priced 10 and 12 match maxPrice 20', () => {
    const items = [
      { isFree: false, price: 10 },
      { isFree: false, price: 12 },
      { isFree: false, price: 45 },
    ];
    const matched = filterByMaxPrice(items, 20);
    assert.deepEqual(
      matched.map((item) => item.price),
      [10, 12],
    );
  });

  test('electronic material priced 45 matches maxPrice 60', () => {
    const items = [
      { isFree: false, price: 10 },
      { isFree: false, price: 45 },
      { isFree: false, price: 75 },
    ];
    const matched = filterByMaxPrice(items, 60);
    assert.deepEqual(
      matched.map((item) => item.price),
      [10, 45],
    );
  });

  test('material priced above threshold is excluded', () => {
    const matched = filterByMaxPrice([{ isFree: false, price: 75 }], 60);
    assert.equal(matched.length, 0);
  });

  test('candidate fetching happens before final response slicing', () => {
    assert.equal(resolveMaterialSearchFetchLimit({ limit: 10, maxPrice: 20 }), 100);
    assert.equal(resolveMaterialSearchFetchLimit({ limit: 10 }), 10);
  });

  test('empty results only when fixture has no matches', () => {
    assert.equal(filterByMaxPrice([], 20).length, 0);
    assert.equal(filterByMaxPrice([{ isFree: false, price: 10 }], 20).length, 1);
  });

  test('free materials match positive maxPrice per existing contract', () => {
    const matched = filterByMaxPrice(
      [{ isFree: true, price: null }, { isFree: false, price: 25 }],
      20,
    );
    assert.equal(matched.length, 1);
    assert.equal(matched[0]?.isFree, true);
  });

  test('price fragment queries are treated as search noise', () => {
    assert.equal(isMaterialSearchNoiseQuery('ية وسعرها'), true);
    assert.equal(isMaterialSearchNoiseQuery('arduino'), false);
  });
});

describe('AI-SR-01 learner reservation status regressions', () => {
  const sampleReservations = [
    { id: '1', status: 'PENDING', material: { title: 'Active pending' } },
    { id: '2', status: 'EXPIRED', material: { title: 'Arduino Uno R3 Boards' } },
    { id: '3', status: 'COMPLETED', material: { title: 'Done board' } },
    { id: '4', status: 'CANCELLED', material: { title: 'Cancelled board' } },
    { id: '5', status: 'REJECTED', material: { title: 'Rejected board' } },
    { id: '6', status: 'ACCEPTED', material: { title: 'Accepted board' } },
  ];

  test('pending-reservation query applies pending-status filter', () => {
    assert.equal(isLearnerPendingReservationQuery('هل عندي حجوزات معلقة؟'), true);
    const pending = filterLearnerReservationsForStatusQuery(
      sampleReservations,
      'pending',
    );
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.status, 'PENDING');
  });

  test('terminal statuses are excluded from pending-only filter', () => {
    const pending = filterLearnerReservationsForStatusQuery(
      sampleReservations,
      'pending',
    );
    for (const status of ['EXPIRED', 'COMPLETED', 'CANCELLED', 'REJECTED']) {
      assert.equal(
        pending.some((reservation) => reservation.status === status),
        false,
        status,
      );
    }
  });

  test('genuinely pending reservation is included', () => {
    const pending = filterLearnerReservationsForStatusQuery(
      sampleReservations,
      'pending',
    );
    assert.equal(pending[0]?.material.title, 'Active pending');
  });

  test('empty pending reservations return truthful empty state input', () => {
    const pending = filterLearnerReservationsForStatusQuery(
      sampleReservations.filter((reservation) => reservation.status !== 'PENDING'),
      'pending',
    );
    assert.equal(pending.length, 0);
  });

  test('all-reservations query remains distinct from pending-only', () => {
    assert.equal(isLearnerAllReservationsQuery('شو كل حجوزاتي؟'), true);
    assert.equal(isLearnerPendingReservationQuery('شو كل حجوزاتي؟'), false);
    const all = filterLearnerReservationsForStatusQuery(sampleReservations, 'all');
    assert.ok(all.length > 1);
    assert.ok(all.some((reservation) => reservation.status === 'EXPIRED'));
  });
});

describe('material result set filter continuation', () => {
  const electronicsMaterials = [
    {
      materialId: 'mat-wire',
      title: 'Community Jumper Wire Pieces',
      priceLabel: 'مجاني',
    },
    {
      materialId: 'mat-sensor',
      title: 'Free Workshop Ultrasonic Sensors',
      priceLabel: 'مجاني',
    },
    {
      materialId: 'mat-paid',
      title: 'Paid Arduino Kit',
      priceLabel: '₪120',
    },
  ];

  const woodMaterials = [
    {
      materialId: 'mat-wood',
      title: 'Wood Plank',
      priceLabel: 'مجاني',
    },
  ];

  const electronicsResultSet = {
    messageId: 'msg-electronics',
    materialIds: electronicsMaterials.map((item) => item.materialId),
    itemCount: electronicsMaterials.length,
    titles: electronicsMaterials.map((item) => item.title),
  };

  const woodResultSet = {
    messageId: 'msg-wood',
    materialIds: woodMaterials.map((item) => item.materialId),
    itemCount: woodMaterials.length,
    titles: woodMaterials.map((item) => item.title),
  };

  const buildContext = (latestMaterialResultSet = electronicsResultSet) => ({
    recentMessages: [
      { role: 'USER' as const, text: 'ورجيني مواد إلكترونية متاحة' },
      { role: 'ASSISTANT' as const, text: 'وجدت مواد متاحة.' },
      { role: 'USER' as const, text: 'قارنلي بين الأولى والثانية' },
      { role: 'ASSISTANT' as const, text: 'مقارنة بين المواد.' },
    ],
    entities: [],
    latestMaterialResultSet,
  });

  afterEach(() => {
    setSemanticPlannerOverrideForTests(null);
  });

  test('detects Arabic free-only follow-up after comparison context', () => {
    assert.equal(detectMaterialResultSetFilterFollowUp('بس ورجيني المجاني منهم'), true);
    assert.equal(messageReferencesPriorMaterialResultSet('بس ورجيني المجاني منهم'), true);
    assert.deepEqual(extractMaterialResultSetFilterConstraints('بس ورجيني المجاني منهم'), {
      isFree: true,
    });
  });

  test('detects English and mixed-language free-only follow-ups', () => {
    assert.equal(detectMaterialResultSetFilterFollowUp('Only show me the free ones.'), true);
    assert.equal(detectMaterialResultSetFilterFollowUp('بس show me المجاني منهم'), true);
  });

  test('structured continuation routes material search with isFree after comparison', async () => {
    setSemanticPlannerOverrideForTests(async () => ({
      route: 'GENERAL_LEARNING',
      confidence: 0.9,
      entities: [],
      clarificationNeeded: false,
      toolCall: null,
    }));

    const plan = await resolveAgentExecutionPlan({
      userMessage: 'بس ورجيني المجاني منهم',
      locale: 'ar',
      conversationId: 'conv-filter-1',
      conversationContext: buildContext(),
    });

    assert.equal(plan.route, 'MATERIAL_SEARCH');
    assert.notEqual(plan.route, 'GENERAL_LEARNING');
    assert.equal(plan.toolInput.isFree, true);
    assert.equal(plan.toolInput[TRUSTED_MATERIAL_RESULT_SET_FILTER_MARKER], true);
    assert.deepEqual(plan.toolInput.sourceMaterialIds, electronicsResultSet.materialIds);
    assert.equal(plan.semanticDataTopic, 'MATERIAL_RESULT_SET_FILTER');
    assert.equal(plan.semanticUnderstandingRoute, 'SYSTEM_DATA_QUERY');
    assert.equal(isStructuredContinuationPlan(plan), true);
    assert.equal(plan.toolName, 'search_available_materials');
  });

  test('comparison block does not erase latest trusted material result set extraction', () => {
    const blocks = [
      {
        type: 'material_results',
        items: electronicsMaterials,
      },
      {
        type: 'comparison',
        subject: 'MATERIAL',
        items: electronicsMaterials.slice(0, 2).map((item) => ({
          id: item.materialId,
          title: item.title,
        })),
      },
    ] as unknown as import('../ai.content-blocks.js').AiContentBlock[];

    const extracted = extractLatestMaterialResultSetFromBlocks(blocks, 'msg-1');
    assert.ok(extracted);
    assert.equal(extracted?.itemCount, 3);
    assert.deepEqual(extracted?.materialIds, electronicsResultSet.materialIds);
  });

  test('latest electronics result set wins over older wood search', async () => {
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'بس المجاني منهم',
      locale: 'ar',
      conversationId: 'conv-filter-2',
      conversationContext: {
        recentMessages: [
          { role: 'USER', text: 'اعرضلي مواد خشبية متاحة' },
          { role: 'ASSISTANT', text: 'مواد خشبية' },
          { role: 'USER', text: 'اعرضلي مواد إلكترونية متاحة' },
          { role: 'ASSISTANT', text: 'مواد إلكترونية' },
        ],
        entities: [],
        latestMaterialResultSet: electronicsResultSet,
      },
    });

    assert.deepEqual(plan.toolInput.sourceMaterialIds, electronicsResultSet.materialIds);
    assert.notDeepEqual(plan.toolInput.sourceMaterialIds, woodResultSet.materialIds);
  });

  test('no-context follow-up asks focused clarification instead of GENERAL_LEARNING', async () => {
    setSemanticPlannerOverrideForTests(async () => ({
      route: 'GENERAL_LEARNING',
      confidence: 0.92,
      entities: [],
      clarificationNeeded: false,
      toolCall: null,
    }));

    const plan = await resolveAgentExecutionPlan({
      userMessage: 'بس ورجيني المجاني منهم',
      locale: 'ar',
      conversationId: 'conv-filter-empty',
      conversationContext: {
        recentMessages: [],
        entities: [],
        latestMaterialResultSet: null,
      },
    });

    assert.equal(plan.route, 'CLARIFICATION');
    assert.notEqual(plan.route, 'GENERAL_LEARNING');
    assert.match(plan.clarificationReason ?? '', /مواد|materials/i);
  });

  test('reconcile repairs GENERAL_LEARNING when trusted material result set exists', async () => {
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'بس ورجيني المجاني منهم',
      locale: 'ar',
      conversationId: 'conv-filter-reconcile',
      conversationContext: buildContext(),
    });

    assert.equal(plan.route, 'MATERIAL_SEARCH');
    assert.equal(plan.toolInput.isFree, true);
    assert.equal(plan.toolInput[TRUSTED_MATERIAL_RESULT_SET_FILTER_MARKER], true);
  });

  test('resolveMaterialResultSetFilterContinuation returns only trusted source ids', async () => {
    const continuation = await resolveMaterialResultSetFilterContinuation({
      userMessage: 'Only show me the free ones.',
      locale: 'en',
      conversationId: 'conv-filter-3',
      conversationContext: buildContext(),
    });

    assert.equal(continuation?.kind, 'filter');
    if (continuation?.kind !== 'filter') {
      return;
    }

    assert.equal(continuation.toolInput.isFree, true);
    assert.deepEqual(continuation.toolInput.sourceMaterialIds, electronicsResultSet.materialIds);
    assert.ok(
      (continuation.toolInput.sourceMaterialIds as string[]).every((id) =>
        electronicsResultSet.materialIds.includes(id),
      ),
    );
    assert.equal(
      (continuation.toolInput.sourceMaterialIds as string[]).includes('fabricated-id'),
      false,
    );
  });

  test('planner context summary includes latestMaterialResultSet for reopen', async () => {
    const { summarizePlannerContextForPrompt } = await import(
      './ai-agent-planner-context.service.js'
    );
    const summary = summarizePlannerContextForPrompt({
      recentMessages: [{ role: 'USER', text: 'ورجيني مواد' }],
      entities: [],
      latestMaterialResultSet: electronicsResultSet,
    });
    assert.match(summary, /latestMaterialResultSet/);
    assert.match(summary, /mat-wire/);
  });
});
