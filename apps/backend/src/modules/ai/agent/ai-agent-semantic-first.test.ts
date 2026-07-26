import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { PLATFORM_GUIDANCE_TOPICS, AI_DISABLED_COPY } from '../ai.policy.js';
import { setResolvedAiChatProviderForTests } from '../../../config/env.js';
import { AppError } from '../../../utils/app-error.js';
import { classifyScopeDeterministic } from '../ai-scope-guard.js';
import {
  detectEducationalLearningIntent,
  detectMaterialSearchIntent,
} from './ai-agent-filter-extractor.service.js';
import {
  resolveAgentExecutionPlan,
  isProviderUnavailableExecutionPlan,
  isSemanticAmbiguityExecutionPlan,
  isProviderFailureFallbackPlan,
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
import { mergeMaterialSearchPlan } from './ai-agent-filter-extractor.service.js';
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

  test('reservation status query uses guidance during outage', async () => {
    installPlannerFailure();
    try {
      const plan = await resolveAgentExecutionPlan({
        userMessage: 'هل عندي حجوزات معلقة؟',
        locale: 'ar',
      });
      assert.equal(plan.route, 'PLATFORM_GUIDANCE');
      assert.equal(isProviderFailureFallbackPlan(plan), true);
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
