import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  getConfiguredGeminiApiKey,
  isAiChatProviderOperational,
} from '../../../config/env.js';
import { resolveAgentExecutionPlan } from './ai-agent-plan-resolver.service.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';

const UNSEEN_SMOKE_CASES = [
  {
    label: 'dialectal free material',
    message: 'هاتلي شوية مواد ببلاش لو سمحت',
    locale: 'ar' as const,
    expectRoute: 'MATERIAL_SEARCH',
    assertPlan: (plan: Record<string, unknown>) => assert.equal(plan.isFree, true),
  },
  {
    label: 'code-switched electronics',
    message: 'بدي حاجات electronics تكون free',
    locale: 'ar' as const,
    expectRoute: 'MATERIAL_SEARCH',
    assertPlan: (plan: Record<string, unknown>) => {
      assert.equal(plan.isFree, true);
      assert.equal(plan.categoryText, 'electronics');
    },
  },
  {
    label: 'shortened project components',
    message: 'Obstacle Robot شو مكونات مشروع ال',
    locale: 'ar' as const,
    expectRoute: 'PROJECT_COMPONENTS',
    assertPlan: () => undefined,
  },
  {
    label: 'build gap',
    message: 'شو ظل علي للمشروع؟',
    locale: 'ar' as const,
    expectRoute: 'BUILD_GAP_ANALYSIS',
    assertPlan: () => undefined,
  },
  {
    label: 'out of scope unseen',
    message: 'احكيلي عن عاصمة فرنسا',
    locale: 'ar' as const,
    expectRoute: 'OUT_OF_SCOPE',
    assertPlan: () => undefined,
  },
];

const canRunLiveGeminiSmoke = () => {
  const previousProvider = process.env.AI_CHAT_PROVIDER;
  process.env.AI_CHAT_PROVIDER = 'gemini';
  const operational = isAiChatProviderOperational() && Boolean(getConfiguredGeminiApiKey());
  process.env.AI_CHAT_PROVIDER = previousProvider;
  return operational;
};

describe('ai agent gemini unseen semantic smoke', { skip: !canRunLiveGeminiSmoke() }, () => {
  test('live semantic planner handles unseen natural phrasing', async () => {
    const previousProvider = process.env.AI_CHAT_PROVIDER;
    process.env.AI_CHAT_PROVIDER = 'gemini';

    try {
      for (const sample of UNSEEN_SMOKE_CASES) {
        const deterministic = resolveAgentRoute({
          userMessage: sample.message,
          locale: sample.locale,
        });
        const plan = await resolveAgentExecutionPlan({
          userMessage: sample.message,
          locale: sample.locale,
        });

        assert.equal(
          plan.route,
          sample.expectRoute,
          `${sample.label}: expected ${sample.expectRoute}, got ${plan.route}`,
        );
        sample.assertPlan(plan.toolInput);

        console.log(
          JSON.stringify({
            label: sample.label,
            deterministicRoute: deterministic.route,
            semanticRoute: plan.diagnostics.semanticRoute,
            validatedRoute: plan.route,
            semanticPlannerUsed: plan.diagnostics.semanticPlannerUsed,
            normalizedFilters: plan.diagnostics.normalizedFilters,
            toolName: plan.toolName,
          }),
        );
      }
    } finally {
      if (previousProvider == null) {
        delete process.env.AI_CHAT_PROVIDER;
      } else {
        process.env.AI_CHAT_PROVIDER = previousProvider;
      }
    }
  });
});
