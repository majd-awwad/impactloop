import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  getConfiguredGeminiApiKey,
  isAiChatProviderOperational,
} from '../../../config/env.js';
import { resolveAgentExecutionPlan } from './ai-agent-plan-resolver.service.js';

const SMOKE_PARAPHRASES = [
  {
    message: 'اعرضلي مواد متوفرة وتكون فري',
    assertPlan: (plan: Record<string, unknown>) => {
      assert.equal(plan.isFree, true);
      assert.equal(plan.query, undefined);
    },
  },
  {
    message: 'بدي أشياء ببلاش',
    assertPlan: (plan: Record<string, unknown>) => {
      assert.equal(plan.isFree, true);
    },
  },
  {
    message: 'شو في مواد ما عليها سعر؟',
    assertPlan: (plan: Record<string, unknown>) => {
      assert.equal(plan.isFree, true);
    },
  },
  {
    message: 'show me free electronics near me',
    assertPlan: (plan: Record<string, unknown>) => {
      assert.equal(plan.isFree, true);
      assert.equal(plan.nearLearner, true);
    },
  },
];

const canRunLiveGeminiSmoke = () => {
  const previousProvider = process.env.AI_CHAT_PROVIDER;
  process.env.AI_CHAT_PROVIDER = 'gemini';
  const operational = isAiChatProviderOperational() && Boolean(getConfiguredGeminiApiKey());
  process.env.AI_CHAT_PROVIDER = previousProvider;
  return operational;
};

describe('ai agent gemini paraphrase smoke', { skip: !canRunLiveGeminiSmoke() }, () => {
  test('live semantic planner resolves unseen free-material paraphrases', async () => {
    const previousProvider = process.env.AI_CHAT_PROVIDER;
    process.env.AI_CHAT_PROVIDER = 'gemini';

    try {
      for (const sample of SMOKE_PARAPHRASES) {
        const plan = await resolveAgentExecutionPlan({
          userMessage: sample.message,
          locale: sample.message.match(/[\u0600-\u06FF]/) ? 'ar' : 'en',
        });

        assert.equal(plan.route, 'MATERIAL_SEARCH');
        assert.equal(plan.toolName, 'search_available_materials');
        sample.assertPlan(plan.toolInput);
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
