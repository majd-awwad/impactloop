import { AppError } from '../../../utils/app-error.js';
import type { AiContentBlock } from '../ai.content-blocks.js';
import type { AiLocale } from '../ai.types.js';
import type { AiPendingActionType } from '../../../generated/prisma/client.js';
import { getOwnedProjectBuildByBuildId } from '../../learning-projects/learning-projects.service.js';
import {
  detectBuildGapIntent,
  detectComponentMaterialMatchingIntent,
  normalizeArabicVariants,
} from './ai-agent-filter-extractor.service.js';
import { detectBuildGuideLinkAction } from './ai-agent-reference-resolver.service.js';
import type { AiAgentRouteType } from './ai-agent.types.js';
import { AiToolExecutor } from './ai-tool-executor.service.js';
import {
  buildComponentMatchesIntro,
  filterGenuinelyMissingBuildItems,
  isGenuinelyReadyForStepUnlock,
  mergeAgentBlocks,
  toMissingBuildChecklistBlock,
} from './ai-tool-mappers.js';

export type BuildGuideMaterialTurnResult = {
  blocks: AiContentBlock[];
  usedProvider: boolean;
  providerName: string;
  model: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  route: AiAgentRouteType;
};

type ActionRequestHandler = (input: {
  userMessage: string;
  locale: AiLocale;
  conversationId: string;
  authenticatedUserId: string;
  clientMessageId: string;
  trustedProjectBuildId?: string;
}) => Promise<BuildGuideMaterialTurnResult | null>;

const textBlock = (
  text: string,
  purpose: 'answer' | 'clarification' = 'answer',
): AiContentBlock => ({
  type: 'text',
  text,
  purpose,
});

const detectBuildGuideUnlinkIntent = (text: string): boolean =>
  /(فك الربط|فك ربط|الغ.? الربط|شيل المادة المربوطة|افصل المادة عن المكون|unlink it|remove the linked material)/i.test(
    text,
  ) ||
  (/(فك الربط|فك ربط|unlink)/i.test(text) &&
    /(مكون|component|مادة|material)/i.test(text)) ||
  (/\bunlink\b/i.test(text) && /\b(material|component)\b/i.test(text));

const resolveBuildGuideActionFromMessage = (
  userMessage: string,
): AiPendingActionType | null => {
  const text = userMessage.toLowerCase();
  if (/(احجز|reserve|book)/i.test(text)) {
    return 'PREPARE_MATERIAL_RESERVATION';
  }
  if (detectBuildGuideUnlinkIntent(text)) {
    return 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT';
  }
  if (detectBuildGuideLinkAction(userMessage) && !/\bunlink\b/i.test(text)) {
    return 'LINK_MATERIAL_TO_BUILD_COMPONENT';
  }
  return null;
};

const normalizeMessage = (text: string) =>
  normalizeArabicVariants(text)
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const detectMissingOverviewIntent = (message: string): boolean => {
  if (detectSearchAllMissingIntent(message)) {
    return false;
  }

  const normalized = normalizeMessage(message);
  if (
    /(لاقي|لاقيلي|دور|find|search|match|show matches).*(مواد|materials|ماده|مادة|material)/i.test(
      normalized,
    )
  ) {
    return false;
  }

  if (detectBuildGapIntent(message)) {
    return true;
  }

  return (
    /(شو ناقصني|شو المواد اللي ضايله|اعرض المكونات الناقصه|اي مواد لسا ناقصتني)/i.test(
      normalized,
    ) ||
    /(what materials am i missing|show my missing components)/i.test(normalized)
  );
};

const detectSearchAllMissingIntent = (message: string): boolean => {
  const normalized = normalizeMessage(message);
  return (
    /(لاقيلي مواد للمكونات الناقصه|دورلي على كل المواد|find materials for all missing)/i.test(
      normalized,
    ) ||
    (detectComponentMaterialMatchingIntent(message) &&
      /(الناقصه|الناقص|missing|كل المواد|all missing)/i.test(normalized))
  );
};

const detectSearchOneComponentIntent = (message: string): boolean => {
  if (detectMissingOverviewIntent(message) || detectSearchAllMissingIntent(message)) {
    return false;
  }

  const normalized = normalizeMessage(message);
  return (
    /(دورلي|لاقيلي|لاقي|find|show matches).*(على|for|ماده|مادة|material)/i.test(
      normalized,
    ) || detectComponentMaterialMatchingIntent(message)
  );
};

const buildMissingOverviewIntro = (locale: AiLocale, count: number): string => {
  if (count === 0) {
    return locale === 'ar'
      ? 'جميع المكونات المطلوبة جاهزة أو قيد الاستلام.'
      : 'All required components are ready or awaiting acquisition.';
  }

  return locale === 'ar'
    ? `هذه المكونات ما زالت غير جاهزة للتنفيذ (${count}):`
    : `These components are not ready for build yet (${count}):`;
};

const normalizeComponentToken = (value: string) =>
  normalizeMessage(value)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type OwnedBuild = NonNullable<Awaited<ReturnType<typeof getOwnedProjectBuildByBuildId>>>;

const noCompatibleMaterialsResult = (
  locale: AiLocale,
  route: AiAgentRouteType,
  durationMs: number | null = null,
): BuildGuideMaterialTurnResult => ({
  blocks: [
    textBlock(
      locale === 'ar'
        ? 'لم أجد مواد متوافقة حالياً على ImpactLoop.'
        : 'I could not find compatible materials on ImpactLoop right now.',
    ),
  ],
  usedProvider: false,
  providerName: 'system',
  model: null,
  latencyMs: durationMs,
  inputTokens: null,
  outputTokens: null,
  route,
});

const findGenuinelyMissingComponentItem = (build: OwnedBuild, userMessage: string) => {
  const normalizedMessage = normalizeComponentToken(userMessage);
  const candidates = filterGenuinelyMissingBuildItems(build.items);

  let best: (typeof candidates)[number] | null = null;
  let bestScore = 0;

  for (const item of candidates) {
    const names = [
      item.component.componentName,
      item.component.materialType,
    ]
      .map((entry) => normalizeComponentToken(entry))
      .filter((entry) => entry.length >= 2);

    for (const name of names) {
      if (normalizedMessage.includes(name)) {
        const score = name.length;
        if (score > bestScore) {
          best = item;
          bestScore = score;
        }
      }
    }
  }

  return best;
};

const findReferencedGenuinelyReadyItem = (build: OwnedBuild, userMessage: string) => {
  const normalizedMessage = normalizeComponentToken(userMessage);

  for (const item of build.items) {
    if (!isGenuinelyReadyForStepUnlock(item)) {
      continue;
    }

    const names = [
      item.component.componentName,
      item.component.materialType,
    ]
      .map((entry) => normalizeComponentToken(entry))
      .filter((entry) => entry.length >= 2);

    if (names.some((name) => normalizedMessage.includes(name))) {
      return item;
    }
  }

  return null;
};

const executeSearchAllGenuinelyMissing = async (input: {
  build: OwnedBuild;
  locale: AiLocale;
  conversationId: string;
  authenticatedUserId: string;
  clientMessageId: string;
  nearLearner: boolean;
}): Promise<BuildGuideMaterialTurnResult> => {
  const missingItems = filterGenuinelyMissingBuildItems(input.build.items);
  if (missingItems.length === 0) {
    return noCompatibleMaterialsResult(input.locale, 'PROJECT_MATERIAL_MATCHING');
  }

  const executor = new AiToolExecutor();
  const context = {
    authenticatedUserId: input.authenticatedUserId,
    conversationId: input.conversationId,
    locale: input.locale,
    requestId: null,
    clientMessageId: input.clientMessageId,
  };

  const groups: Array<{
    componentId: string;
    componentName: string;
    materials: Array<Record<string, unknown>>;
  }> = [];
  let totalDurationMs = 0;

  for (const item of missingItems.slice(0, 8)) {
    const toolResult = await executor.execute(
      {
        name: 'find_materials_for_component',
        input: {
          componentId: item.requiredComponentId,
          buildId: input.build.id,
          nearLearner: input.nearLearner,
        },
      },
      context,
    );
    totalDurationMs += toolResult.durationMs;

    if (!toolResult.ok) {
      continue;
    }

    const block = (toolResult.data as { block?: AiContentBlock } | undefined)?.block;
    if (block && block.type === 'component_matches' && block.groups.length > 0) {
      groups.push(...block.groups);
    }
  }

  if (groups.length === 0) {
    return noCompatibleMaterialsResult(
      input.locale,
      'PROJECT_MATERIAL_MATCHING',
      totalDurationMs,
    );
  }

  const matchesBlock: AiContentBlock = {
    type: 'component_matches',
    buildId: input.build.id,
    groups: groups as Extract<AiContentBlock, { type: 'component_matches' }>['groups'],
  };

  return {
    blocks: mergeAgentBlocks(
      buildComponentMatchesIntro([matchesBlock], input.locale),
      [matchesBlock],
    ),
    usedProvider: false,
    providerName: 'system',
    model: null,
    latencyMs: totalDurationMs,
    inputTokens: null,
    outputTokens: null,
    route: 'PROJECT_MATERIAL_MATCHING',
  };
};

const inaccessibleBuildResult = (
  locale: AiLocale,
): BuildGuideMaterialTurnResult => ({
  blocks: [
    textBlock(
      locale === 'ar'
        ? 'لا يمكن الوصول إلى مشروع البناء المرتبط بهذه المحادثة.'
        : 'The build linked to this conversation is not accessible.',
      'clarification',
    ),
  ],
  usedProvider: false,
  providerName: 'system',
  model: null,
  latencyMs: null,
  inputTokens: null,
  outputTokens: null,
  route: 'BUILD_GAP_ANALYSIS',
});

const archivedBuildResult = (locale: AiLocale): BuildGuideMaterialTurnResult => ({
  blocks: [
    textBlock(
      locale === 'ar'
        ? 'لا يمكن تعديل قائمة مواد هذا البناء.'
        : 'This build checklist can no longer be edited.',
      'clarification',
    ),
  ],
  usedProvider: false,
  providerName: 'system',
  model: null,
  latencyMs: null,
  inputTokens: null,
  outputTokens: null,
  route: 'BUILD_GAP_ANALYSIS',
});

const executeTool = async (input: {
  toolName: string;
  toolInput: Record<string, unknown>;
  locale: AiLocale;
  conversationId: string;
  authenticatedUserId: string;
  clientMessageId: string;
  requestId: string | null;
  route: AiAgentRouteType;
}): Promise<BuildGuideMaterialTurnResult> => {
  const executor = new AiToolExecutor();
  const toolResult = await executor.execute(
    { name: input.toolName, input: input.toolInput },
    {
      authenticatedUserId: input.authenticatedUserId,
      conversationId: input.conversationId,
      locale: input.locale,
      requestId: input.requestId,
      clientMessageId: input.clientMessageId,
    },
  );

  if (!toolResult.ok) {
    if (toolResult.errorCode === 'NO_MATCHING_RESULTS') {
      return noCompatibleMaterialsResult(
        input.locale,
        input.route,
        toolResult.durationMs,
      );
    }

    throw new AppError(
      toolResult.errorMessage ?? 'The assistant tool failed.',
      502,
      toolResult.errorCode ?? 'AI_TOOL_EXECUTION_FAILED',
    );
  }

  const data = toolResult.data as {
    block?: AiContentBlock;
    blocks?: AiContentBlock[];
  };
  const trustedBlocks = data.blocks ?? (data.block ? [data.block] : []);

  return {
    blocks: mergeAgentBlocks(
      buildComponentMatchesIntro(trustedBlocks, input.locale),
      trustedBlocks,
    ),
    usedProvider: false,
    providerName: 'system',
    model: null,
    latencyMs: toolResult.durationMs,
    inputTokens: null,
    outputTokens: null,
    route: input.route,
  };
};

export const tryHandleBuildGuideMaterialTurn = async (input: {
  userMessage: string;
  locale: AiLocale;
  conversationId: string;
  authenticatedUserId: string;
  clientMessageId: string;
  projectBuildId: string;
  handleActionRequest: ActionRequestHandler;
}): Promise<BuildGuideMaterialTurnResult | null> => {
  const build = await getOwnedProjectBuildByBuildId(
    input.projectBuildId,
    input.authenticatedUserId,
  );

  if (!build) {
    const actionType = resolveBuildGuideActionFromMessage(input.userMessage);
    if (actionType) {
      return inaccessibleBuildResult(input.locale);
    }
    if (
      detectMissingOverviewIntent(input.userMessage) ||
      detectSearchAllMissingIntent(input.userMessage) ||
      detectSearchOneComponentIntent(input.userMessage)
    ) {
      return inaccessibleBuildResult(input.locale);
    }
    return null;
  }

  if (build.status === 'ARCHIVED') {
    return archivedBuildResult(input.locale);
  }

  const actionType = resolveBuildGuideActionFromMessage(input.userMessage);
  if (actionType) {
    return input.handleActionRequest({
      userMessage: input.userMessage,
      locale: input.locale,
      conversationId: input.conversationId,
      authenticatedUserId: input.authenticatedUserId,
      clientMessageId: input.clientMessageId,
      trustedProjectBuildId: input.projectBuildId,
    });
  }

  const toolContext = {
    authenticatedUserId: input.authenticatedUserId,
    conversationId: input.conversationId,
    locale: input.locale,
    requestId: null,
    clientMessageId: input.clientMessageId,
  };

  if (detectSearchAllMissingIntent(input.userMessage)) {
    return executeSearchAllGenuinelyMissing({
      build,
      locale: input.locale,
      conversationId: input.conversationId,
      authenticatedUserId: input.authenticatedUserId,
      clientMessageId: input.clientMessageId,
      nearLearner: /near|قريب/i.test(input.userMessage),
    });
  }

  if (detectMissingOverviewIntent(input.userMessage)) {
    const checklistBlock = toMissingBuildChecklistBlock(build);
    const notReadyCount = filterGenuinelyMissingBuildItems(build.items).length;

    return {
      blocks: mergeAgentBlocks(
        buildMissingOverviewIntro(input.locale, notReadyCount),
        [checklistBlock],
      ),
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'BUILD_GAP_ANALYSIS',
    };
  }

  if (detectSearchOneComponentIntent(input.userMessage)) {
    const alreadyReady = findReferencedGenuinelyReadyItem(build, input.userMessage);
    if (alreadyReady) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? `${alreadyReady.component.componentName} جاهز بالفعل للتنفيذ وفق حالة البناء الحالية.`
              : `${alreadyReady.component.componentName} is already ready for build under the current build state.`,
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'COMPONENT_MATERIAL_MATCHING',
      };
    }

    const item = findGenuinelyMissingComponentItem(build, input.userMessage);
    if (!item) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'حدّد المكوّن الناقص الذي تريد البحث عن مادة له.'
              : 'Specify which missing component you want to search materials for.',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'COMPONENT_MATERIAL_MATCHING',
      };
    }

    return executeTool({
      toolName: 'find_materials_for_component',
      toolInput: {
        componentId: item.requiredComponentId,
        buildId: build.id,
        nearLearner: /near|قريب/i.test(input.userMessage),
      },
      ...toolContext,
      route: 'COMPONENT_MATERIAL_MATCHING',
    });
  }

  return null;
};
