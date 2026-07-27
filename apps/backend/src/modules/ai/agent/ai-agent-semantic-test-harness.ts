import { describe, type SuiteContext } from 'node:test';

import type {
  PlatformGuidanceTopic,
  SemanticActionType,
  SemanticRoute,
  SystemDataTopic,
} from './ai-agent.types.js';
import {
  AI_SEMANTIC_ROUTER_VERSION,
  setSemanticPlannerOverrideForTests,
  setSemanticUnderstandingOverrideForTests,
  validateSemanticUnderstanding,
  type AgentPlannerOutput,
  type SemanticUnderstanding,
} from './ai-agent-semantic-planner.service.js';
import type { PlannerConversationContext } from './ai-agent-planner-context.service.js';
import type { AiAgentRouteType } from './ai-agent.types.js';
import type { AiLocale } from '../ai.types.js';

export const SEMANTIC_ROUTER_INACTIVE_SKIP_REASON =
  'Semantic router v2 is not active in production yet.';

export const isSemanticRouterV2Active = (): boolean =>
  AI_SEMANTIC_ROUTER_VERSION === 2;

let plannerInvocationCount = 0;
let harnessInstalled = false;

type PlannerOverrideInput = {
  userMessage: string;
  locale: AiLocale;
  deterministicRoute: AiAgentRouteType;
  deterministicArguments: Record<string, unknown>;
  conversationContext?: PlannerConversationContext;
};

type PlannerOverrideFn = (
  input: PlannerOverrideInput,
) => Promise<AgentPlannerOutput | null>;

let customPlannerOverride: PlannerOverrideFn | null = null;

const countingPlannerWrapper = async (
  input: PlannerOverrideInput,
): Promise<AgentPlannerOutput | null> => {
  plannerInvocationCount += 1;
  if (customPlannerOverride) {
    return customPlannerOverride(input);
  }
  return null;
};

export const getPlannerInvocationCount = (): number => plannerInvocationCount;

export const resetPlannerInvocationCount = (): void => {
  plannerInvocationCount = 0;
};

export const installSemanticTestHarness = (
  override?: PlannerOverrideFn | null,
): void => {
  customPlannerOverride = override ?? null;
  resetPlannerInvocationCount();
  if (isSemanticRouterV2Active()) {
    if (customPlannerOverride) {
      setSemanticUnderstandingOverrideForTests(async (input) => {
        plannerInvocationCount += 1;
        const v1 = await customPlannerOverride({
          userMessage: input.userMessage,
          locale: input.locale,
          deterministicRoute: 'GENERAL_LEARNING',
          deterministicArguments: {},
          conversationContext: input.conversationContext,
        });
        if (!v1) {
          return null;
        }
        if (v1.route === 'CLARIFICATION') {
          return buildSemanticUnderstanding({
            route: 'CLARIFICATION_REQUIRED',
            needsClarification: true,
            clarificationQuestion: v1.clarificationReason ?? 'Please clarify.',
            confidence: v1.confidence,
          });
        }
        if (v1.route === 'GENERAL_LEARNING') {
          return buildGeneralLearningUnderstanding();
        }
        if (v1.route === 'OUT_OF_SCOPE') {
          return buildOutOfScopeUnderstanding();
        }
        if (v1.route === 'ACTION_REQUEST') {
          return buildActionUnderstanding('PREPARE_MATERIAL_RESERVATION', v1.confidence);
        }
        return buildSystemDataUnderstanding(
          v1.route as SystemDataTopic,
          v1.toolCall
            ? { name: v1.toolCall.name, arguments: v1.toolCall.arguments }
            : null,
        );
      });
    } else {
      setSemanticUnderstandingOverrideForTests(null);
    }
    return;
  }
  setSemanticPlannerOverrideForTests(countingPlannerWrapper);
  harnessInstalled = true;
};

export const resetSemanticTestHarness = (): void => {
  customPlannerOverride = null;
  resetPlannerInvocationCount();
  setSemanticPlannerOverrideForTests(null);
  setSemanticUnderstandingOverrideForTests(null);
  harnessInstalled = false;
};

export const isSemanticTestHarnessInstalled = (): boolean => harnessInstalled;

export const buildSemanticUnderstanding = (
  overrides: Partial<SemanticUnderstanding> & Pick<SemanticUnderstanding, 'route'>,
): SemanticUnderstanding => {
  const base: SemanticUnderstanding = {
    schemaVersion: 1,
    route: overrides.route,
    topic: overrides.topic ?? null,
    action: overrides.action ?? null,
    entities: overrides.entities ?? [],
    filters: overrides.filters,
    confidence: overrides.confidence ?? 0.92,
    needsClarification: overrides.needsClarification ?? false,
    clarificationQuestion: overrides.clarificationQuestion ?? null,
    toolCall: overrides.toolCall ?? null,
  };
  const validated = validateSemanticUnderstanding(base);
  if (!validated) {
    throw new Error(`Invalid semantic understanding fixture for route ${overrides.route}`);
  }
  return validated;
};

export const buildPlatformGuidanceUnderstanding = (
  topic: PlatformGuidanceTopic = 'MATERIAL_RESERVATION',
) =>
  buildSemanticUnderstanding({
    route: 'PLATFORM_GUIDANCE',
    topic,
  });

export const buildSystemDataUnderstanding = (
  topic: SystemDataTopic,
  toolCall?: SemanticUnderstanding['toolCall'],
) =>
  buildSemanticUnderstanding({
    route: 'SYSTEM_DATA_QUERY',
    topic,
    toolCall: toolCall ?? null,
  });

export const buildGeneralLearningUnderstanding = () =>
  buildSemanticUnderstanding({ route: 'GENERAL_LEARNING' });

export const buildOutOfScopeUnderstanding = () =>
  buildSemanticUnderstanding({ route: 'OUT_OF_SCOPE' });

export const buildClarificationUnderstanding = (
  question = 'ما الذي تريد أن أفعله بالضبط؟',
) =>
  buildSemanticUnderstanding({
    route: 'CLARIFICATION_REQUIRED',
    needsClarification: true,
    clarificationQuestion: question,
    confidence: 0.55,
  });

export const buildActionUnderstanding = (
  action: SemanticActionType,
  confidence = 0.94,
) =>
  buildSemanticUnderstanding({
    route: 'ACTION_REQUEST',
    action,
    confidence,
  });

export const semanticRouteToV1PlannerOutput = (
  understanding: SemanticUnderstanding,
): AgentPlannerOutput | null => {
  if (understanding.route === 'PLATFORM_GUIDANCE') {
    return {
      route: 'GENERAL_LEARNING',
      confidence: understanding.confidence,
      entities: [],
      clarificationNeeded: false,
    };
  }
  if (understanding.route === 'GENERAL_LEARNING') {
    return {
      route: 'GENERAL_LEARNING',
      confidence: understanding.confidence,
      entities: [],
      clarificationNeeded: false,
    };
  }
  if (understanding.route === 'OUT_OF_SCOPE') {
    return {
      route: 'OUT_OF_SCOPE',
      confidence: understanding.confidence,
      entities: [],
      clarificationNeeded: false,
    };
  }
  if (
    understanding.route === 'CLARIFICATION_REQUIRED' ||
    understanding.needsClarification
  ) {
    return {
      route: 'CLARIFICATION',
      confidence: understanding.confidence,
      entities: [],
      clarificationNeeded: true,
      clarificationReason:
        understanding.clarificationQuestion ?? 'Please clarify your request.',
    };
  }
  if (understanding.route === 'SYSTEM_DATA_QUERY' && understanding.topic) {
    return {
      route: understanding.topic as AgentPlannerOutput['route'],
      confidence: understanding.confidence,
      entities: understanding.entities,
      filters: understanding.filters,
      toolCall: understanding.toolCall ?? undefined,
      clarificationNeeded: false,
    };
  }
  if (understanding.route === 'ACTION_REQUEST') {
    return {
      route: 'ACTION_REQUEST',
      confidence: understanding.confidence,
      entities: understanding.entities,
      clarificationNeeded: false,
    };
  }
  return null;
};

export const installSemanticPhraseMocks = (
  phraseMap: Record<string, SemanticUnderstanding>,
): void => {
  if (isSemanticRouterV2Active()) {
    installSemanticTestHarness(async (input) => {
      const understanding = phraseMap[input.userMessage.trim()];
      if (!understanding) {
        return null;
      }
      return semanticRouteToV1PlannerOutput(understanding);
    });
    setSemanticUnderstandingOverrideForTests(async (input) => {
      plannerInvocationCount += 1;
      return phraseMap[input.userMessage.trim()] ?? null;
    });
    return;
  }
  installSemanticTestHarness(async (input) => {
    const understanding = phraseMap[input.userMessage.trim()];
    if (!understanding) {
      return null;
    }
    return semanticRouteToV1PlannerOutput(understanding);
  });
};

export const requireSemanticRouterV2 = (
  suiteFn: (ctx: SuiteContext) => void,
): void => {
  if (!isSemanticRouterV2Active()) {
    describe(
      'semantic router v2 integration (inactive)',
      { skip: SEMANTIC_ROUTER_INACTIVE_SKIP_REASON },
      suiteFn,
    );
    return;
  }
  describe('semantic router v2 integration', suiteFn);
};
