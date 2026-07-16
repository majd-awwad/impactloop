import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AI_AGENT_LIMITS } from './ai-agent.types.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';
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
});

describe('ai tool registry and executor', () => {
  test('registers required read tools', () => {
    for (const toolName of [
      'get_learner_context',
      'search_available_materials',
      'search_learning_projects',
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
