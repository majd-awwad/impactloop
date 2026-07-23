import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AI_AGENT_LIMITS } from './ai-agent.types.js';
import { resolveAgentExecutionPlan } from './ai-agent-plan-resolver.service.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';
import {
  detectMaterialSearchIntent,
  isExplicitMaterialSearchCommand,
  shouldDeferMaterialSearchForOwnedMaterialsProjectUse,
} from './ai-agent-filter-extractor.service.js';
import { setSemanticPlannerOverrideForTests } from './ai-agent-semantic-planner.service.js';
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
      route: 'OWNED_MATERIALS_PROJECT_MATCH',
      confidence: 0.9,
      entities: [],
      toolCall: {
        name: 'match_projects_by_owned_materials',
        arguments: { materials: ['Arduino'] },
      },
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

  test('general learning remains GENERAL_LEARNING with planner override blocked', async () => {
    setSemanticPlannerOverrideForTests(async () => ({
      route: 'OWNED_MATERIALS_PROJECT_MATCH',
      confidence: 0.9,
      entities: [],
      toolCall: {
        name: 'match_projects_by_owned_materials',
        arguments: { materials: ['Arduino'] },
      },
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
