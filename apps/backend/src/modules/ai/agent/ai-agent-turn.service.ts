import { env, isAiChatProviderOperational } from '../../../config/env.js';
import { prisma } from '../../../database/prisma.js';
import { AppError } from '../../../utils/app-error.js';
import type { AccessTokenPayload } from '../../../utils/jwt.js';
import { logger } from '../../../observability/logger.js';
import type { SafeLogValue } from '../../../observability/log-types.js';
import {
  buildBoundedConversationHistory,
  parseStoredContentBlocks,
} from '../ai-context-builder.js';
import { listMessagesForConversation } from '../ai.repository.js';
import type { AiContentBlock } from '../ai.content-blocks.js';
import { aiContentBlocksSchema } from '../ai.content-blocks.js';
import {
  buildConversationalResponseText,
  detectConversationalIntent,
  detectResponseLocale,
} from '../ai-conversational-intent.js';
import {
  CLARIFICATION_COPY,
  REFUSAL_COPY,
  buildPlatformGuidanceResponse,
  buildSupplierPublishGuidanceResponse,
} from '../ai.policy.js';
import {
  assessDangerousRequest,
  DANGEROUS_SAFETY_COPY,
} from './ai-agent-safety-guard.service.js';
import { getAiChatProvider } from '../providers/ai-chat-provider.factory.js';
import type { AiLocale } from '../ai.types.js';
import { prepareAiPendingAction, buildMaterialSavePayload, buildProjectSavePayload, buildStartBuildPayload, buildLinkMaterialPayload, buildUnsaveMaterialPayload, buildUnsaveProjectPayload, buildUnlinkMaterialPayload, buildReservationPayload, buildUpdateBuildComponentStatusesPayload, saveReservationDraft, cancelReservationDraft, findActiveReservationDraft } from '../ai-action.service.js';
import * as learningProjectsRepository from '../../learning-projects/learning-projects.repository.js';
import {
  detectMaterialSearchIntent,
  detectPlatformGuidanceIntent,
  detectSupplierPublishGuidanceIntent,
  detectCurrentInProgressProjectWording,
  filterLearnerReservationsForStatusQuery,
  isLearnerAllReservationsQuery,
  isLearnerPendingReservationQuery,
  normalizeArabicVariants,
} from './ai-agent-filter-extractor.service.js';
import { listMyReservations } from '../../reservations/reservations.service.js';
import { prepareMaterialReservationPayloadSchema } from '../ai-action.payloads.js';
import { classifyScopeDeterministic } from '../ai-scope-guard.js';
import type { AiPendingActionType } from '../../../generated/prisma/client.js';
import { listActiveProjectBuildsForLearner, getOwnedProjectBuildByBuildId, getLearningProjectById } from '../../learning-projects/learning-projects.service.js';
import { getMaterialById, getMaterials } from '../../materials/materials.service.js';
import { getLearningProjects } from '../../learning-projects/learning-projects.service.js';

import { buildToolInputForRoute, parseComparisonFromContext, parseFindMaterialsForProjectInput, parseProjectComponentsInput } from './ai-agent-input-parser.service.js';
import { routeToToolName } from './ai-agent-route-mapping.js';
import { resolveAgentExecutionPlan } from './ai-agent-plan-resolver.service.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';
import {
  resolveConversationReferences,
  resolveBuildGuideReservationTarget,
  resolveBuildGuideUnlinkTarget,
  resolveBuildItemIdForLinkedMaterial,
  detectBuildGuideLinkAction,
  resolveBuildIdForUserMessage,
  resolveLatestBuildId,
  resolveLinkActionTargets,
  resolveOwnedBuildForProjectTitle,
  resolveProjectFromMessage,
} from './ai-agent-reference-resolver.service.js';
import {
  buildComparisonFollowUpAnswer,
  findLatestComparisonBlock,
} from './ai-agent-comparison-followup.service.js';
import {
  TRUSTED_MATERIAL_RESULT_SET_FILTER_MARKER,
} from './ai-agent-planner-context.service.js';
import { detectComparisonFollowUpIntent, extractProjectTitleQuery } from './ai-agent-filter-extractor.service.js';
import {
  AI_AGENT_PLATFORM_ROUTES,
  type AiAgentRouteType,
  type AiToolExecutionContext,
} from './ai-agent.types.js';
import { AiToolExecutor } from './ai-tool-executor.service.js';
import {
  mergeAgentBlocks,
  buildComponentMatchesIntro,
  buildProjectMaterialAvailabilityIntro,
  buildProjectBudgetEstimationIntro,
} from './ai-tool-mappers.js';
import {
  buildExternalRetrievalSynthesisUserMessage,
  buildExternalSourcesBlock,
  searchExternalDomainKnowledge,
} from '../ai-external-knowledge.service.js';
import { tryHandleBuildGuideMaterialTurn } from './ai-build-guide-material-turn.service.js';
import { tryHandleBuildGuideStepTurn } from './ai-build-guide-step-turn.service.js';
import { preferLinkedBuildGuideLearning } from './ai-build-guide-routing.js';

const resolveActionFromMessage = (
  userMessage: string,
): AiPendingActionType | null => {
  const text = userMessage.toLowerCase();
  if (/(احفظ|save)/i.test(text) && (/(مادة|material)/i.test(text) || /(أرخص|ارخص|cheaper)/i.test(text))) {
    return 'SAVE_MATERIAL';
  }
  if (
    (/(شيل|remove|الغ|إلغاء|unsave)/i.test(text) &&
      /(المحفوظات|من المحفوظ|saved)/i.test(text) &&
      !/(مشروع|project)/i.test(text)) ||
    (/(الغ|إلغاء|unsave|remove).*(حفظ|save)/i.test(text) && /(مادة|material)/i.test(text))
  ) {
    return 'UNSAVE_MATERIAL';
  }
  if (/(احجز|reserve|book)/i.test(text)) {
    return 'PREPARE_MATERIAL_RESERVATION';
  }
  if (/(ابدأ|start)/i.test(text) && (/(مشروع|project|build)/i.test(text) || /(أسهل|اسهل|easier)/i.test(text))) {
    return 'START_PROJECT_BUILD';
  }
  if (
    /(فك الربط|فك ربط|الغ.? الربط|شيل المادة المربوطة|افصل المادة عن المكون|unlink it|remove the linked material)/i.test(
      text,
    )
  ) {
    return 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT';
  }
  if (
    (/(فك الربط|فك ربط|unlink)/i.test(text) && /(مكون|component|هالمكون|هالكومبوننت)/i.test(text)) ||
    (/(الغ|إلغاء|unlink).*(ربط|link)/i.test(text) && /(مادة|material|مكون|component)/i.test(text))
  ) {
    return 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT';
  }
  if (/\bunlink\b/i.test(text) && /\b(material|component)\b/i.test(text)) {
    return 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT';
  }
  if (detectBuildGuideLinkAction(userMessage) && !/\bunlink\b/i.test(text)) {
    return 'LINK_MATERIAL_TO_BUILD_COMPONENT';
  }
  if (/(احفظ|save)/i.test(text) && (/(مشروع|project)/i.test(text) || /(أسهل|اسهل|easier)/i.test(text))) {
    return 'SAVE_PROJECT';
  }
  if (
    /(احفظ|save)/i.test(text) &&
    /(أول|الاول|ثاني|الثاني|third|ثالث)/i.test(text) &&
    !/(مادة|material|أرخص|ارخص|cheaper)/i.test(text)
  ) {
    return 'SAVE_PROJECT';
  }
  if (
    (/(شيل|remove|الغ|إلغاء|unsave)/i.test(text) &&
      /(المشاريع المحفوظة|من المحفوظ|saved project)/i.test(text)) ||
    (/(الغ|إلغاء|unsave|remove).*(حفظ|save)/i.test(text) && /(مشروع|project)/i.test(text))
  ) {
    return 'UNSAVE_PROJECT';
  }
  return null;
};

type BuildComponentOwnershipDirection = 'ALREADY_OWNED' | 'MISSING';

const normalizeComponentReference = (value: string) =>
  normalizeArabicVariants(
    value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

const parseSearchKeywords = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => normalizeComponentReference(entry))
    .filter((entry) => entry.length > 0);
};

const detectBuildComponentOwnershipDirection = (
  message: string,
): BuildComponentOwnershipDirection | null => {
  const text = message.trim();
  if (
    /(?:فكرت|thought).*(?:مش\s+موجود|not\s+(?:there|available)|missing)/i.test(text) ||
    /(?:مش\s+موجود|not\s+(?:there|available)).*(?:بس|but)/i.test(text)
  ) {
    return 'MISSING';
  }

  if (
    /(?:ما\s+عندي|مش\s+عندي|مش\s+موجودة?\s+عندي|طلع\s+ما\s+عندي|don't\s+have|do\s+not\s+have|i\s+don't\s+have|mark.*missing)/i.test(
      text,
    )
  ) {
    return 'MISSING';
  }

  if (
    /(?:عندي|موجود\s+عندي|بملك|already\s+have|i\s+have|already\s+owned|mark.*already\s+owned)/i.test(
      text,
    )
  ) {
    return 'ALREADY_OWNED';
  }

  return null;
};

const isAllMaterialsPhrase = (message: string) =>
  /(?:كل\s*المواد|all\s+(?:the\s+)?materials)/i.test(message);

// Safe explicit separators only — Arabic و after whitespace requires candidate-aware validation.
const EXPLICIT_COMPONENT_REFERENCE_SEPARATORS =
  /\s+and\s+|,\s*|،\s*|\s+و\s+|(?<=[A-Za-z0-9])(?:\s*)و(?=\S)/iu;

const getUniqueComponentMatch = (
  reference: string,
  candidates: BuildComponentReferenceCandidate[],
): BuildComponentReferenceCandidate | null => {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      score: scoreComponentReferenceMatch(reference, candidate),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return null;
  }

  const topScore = scored[0]!.score;
  const topMatches = scored.filter((entry) => entry.score === topScore);
  if (topMatches.length > 1) {
    return null;
  }

  return scored[0]!.candidate;
};

const splitSegmentWithCandidateAwareness = (
  segment: string,
  candidates: BuildComponentReferenceCandidate[],
): string[] => {
  const trimmed = segment.trim();
  if (!trimmed) {
    return [];
  }

  if (getUniqueComponentMatch(trimmed, candidates)) {
    return [trimmed];
  }

  const positions: number[] = [];
  const conjunctionPattern = /\s+و(?=\S)/gu;
  let match: RegExpExecArray | null;
  while ((match = conjunctionPattern.exec(trimmed)) !== null) {
    positions.push(match.index);
  }

  const validSplits: string[][] = [];
  for (const position of positions) {
    const left = trimmed.slice(0, position).trim();
    const rightPart = trimmed.slice(position).trim();
    const right = rightPart.replace(/^و\s*/, '').trim();
    if (!left || !right) {
      continue;
    }

    const leftMatch = getUniqueComponentMatch(left, candidates);
    const rightMatch = getUniqueComponentMatch(right, candidates);
    if (
      leftMatch &&
      rightMatch &&
      leftMatch.buildItemId !== rightMatch.buildItemId
    ) {
      validSplits.push([left, right]);
    }
  }

  if (validSplits.length === 1) {
    return validSplits[0]!;
  }

  return [trimmed];
};

export type BuildComponentReferenceCandidate = {
  buildItemId: string;
  requiredComponentId: string;
  componentName: string;
  status: string;
  aliases: string[];
};

export const extractComponentReferencePhrases = (
  message: string,
  candidates: BuildComponentReferenceCandidate[] = [],
) => {
  let text = message.trim();
  text = text
    .replace(
      /^(?:please\s+)?(?:mark\s+(?:the\s+)?|سجل\s+|حدّد\s+)/i,
      '',
    )
    .replace(/(?:as\s+)?(?:already\s+owned|missing)\.?$/i, '')
    .replace(
      /(?:ما\s+عندي|مش\s+عندي|مش\s+موجودة?\s+عندي|طلع\s+ما\s+عندي|don't\s+have|do\s+not\s+have|i\s+don't\s+have|already\s+have|i\s+have|already\s+owned|عندي|موجود\s+عندي|بملك)/gi,
      ' ',
    )
    .replace(/(?:كل\s*المواد|all\s+(?:the\s+)?materials)/gi, ' ')
    .trim();

  if (!text) {
    return [] as string[];
  }

  const explicitSegments = text
    .split(EXPLICIT_COMPONENT_REFERENCE_SEPARATORS)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (candidates.length === 0) {
    return explicitSegments;
  }

  return explicitSegments.flatMap((segment) =>
    splitSegmentWithCandidateAwareness(segment, candidates),
  );
};

type BuildComponentCandidate = BuildComponentReferenceCandidate;

export const toBuildComponentCandidates = (
  build: NonNullable<
    Awaited<ReturnType<typeof learningProjectsRepository.findOwnedProjectBuildByBuildId>>
  >,
): BuildComponentCandidate[] =>
  build.items.map((item) => ({
    buildItemId: item.id,
    requiredComponentId: item.requiredComponentId,
    componentName: item.requiredComponent.componentName,
    status: item.status,
    aliases: [
      normalizeComponentReference(item.requiredComponent.componentName),
      normalizeComponentReference(item.requiredComponent.materialType),
      ...parseSearchKeywords(item.requiredComponent.searchKeywords),
      ...parseSearchKeywords(item.requiredComponent.alternativeKeywords),
    ].filter((alias, index, all) => alias.length > 0 && all.indexOf(alias) === index),
  }));

const scoreComponentReferenceMatch = (
  reference: string,
  candidate: BuildComponentCandidate,
) => {
  const normalizedReference = normalizeComponentReference(reference);
  if (!normalizedReference) {
    return 0;
  }

  if (candidate.aliases.includes(normalizedReference)) {
    return 100;
  }

  const exactName = normalizeComponentReference(candidate.componentName);
  if (
    exactName === normalizedReference ||
    exactName.includes(normalizedReference) ||
    normalizedReference.includes(exactName)
  ) {
    return 90;
  }

  for (const alias of candidate.aliases) {
    if (alias.includes(normalizedReference) || normalizedReference.includes(alias)) {
      return 75;
    }
  }

  return 0;
};

export const resolveBuildComponentReferences = (input: {
  references: string[];
  candidates: BuildComponentCandidate[];
}) => {
  const matched = new Map<string, BuildComponentCandidate>();
  const unknown: string[] = [];
  const ambiguous: Array<{ reference: string; options: string[] }> = [];

  for (const reference of input.references) {
    const scored = input.candidates
      .map((candidate) => ({
        candidate,
        score: scoreComponentReferenceMatch(reference, candidate),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    if (scored.length === 0) {
      unknown.push(reference);
      continue;
    }

    const topScore = scored[0]!.score;
    const topMatches = scored.filter((entry) => entry.score === topScore);
    if (topMatches.length > 1) {
      ambiguous.push({
        reference,
        options: topMatches.map((entry) => entry.candidate.componentName),
      });
      continue;
    }

    matched.set(scored[0]!.candidate.buildItemId, scored[0]!.candidate);
  }

  return {
    matched: [...matched.values()],
    unknown,
    ambiguous,
  };
};

const buildComponentClarificationText = (input: {
  locale: AiLocale;
  unknown: string[];
  ambiguous: Array<{ reference: string; options: string[] }>;
  mixedKnown?: string[];
}) => {
  const lines: string[] = [];

  if (input.unknown.length > 0) {
    lines.push(
      input.locale === 'ar'
        ? `هذه المكونات ليست جزءاً من مشروع البناء الحالي: ${input.unknown.join('، ')}.`
        : `These components are not part of the current build: ${input.unknown.join(', ')}.`,
    );
  }

  if (input.mixedKnown && input.mixedKnown.length > 0) {
    lines.push(
      input.locale === 'ar'
        ? `المكونات المعروفة: ${input.mixedKnown.join('، ')}.`
        : `Recognized components: ${input.mixedKnown.join(', ')}.`,
    );
  }

  for (const entry of input.ambiguous) {
    lines.push(
      input.locale === 'ar'
        ? `"${entry.reference}" يطابق أكثر من مكوّن: ${entry.options.join('، ')}. حدّد الاسم الدقيق.`
        : `"${entry.reference}" matches more than one component: ${entry.options.join(', ')}. Reply with the exact option.`,
    );
  }

  return lines.join('\n');
};

const tryHandleBuildGuideComponentOwnershipTurn = async (input: {
  userMessage: string;
  locale: AiLocale;
  conversationId: string;
  authenticatedUserId: string;
  clientMessageId: string;
  projectBuildId: string;
}): Promise<AgentTurnExecutionResult | null> => {
  const direction = detectBuildComponentOwnershipDirection(input.userMessage);
  if (!direction) {
    return null;
  }

  const rawBuild = await learningProjectsRepository.findOwnedProjectBuildByBuildId(
    input.projectBuildId,
    input.authenticatedUserId,
  );

  if (!rawBuild) {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
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
      route: 'ACTION_REQUEST',
    };
  }

  if (rawBuild.status === 'ARCHIVED') {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
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
      route: 'ACTION_REQUEST',
    };
  }

  const candidates = toBuildComponentCandidates(rawBuild);
  const targetStatus = direction;
  let selectedCandidates: BuildComponentCandidate[] = [];

  if (direction === 'ALREADY_OWNED' && isAllMaterialsPhrase(input.userMessage)) {
    selectedCandidates = candidates.filter(
      (candidate) => candidate.status !== 'ALREADY_OWNED',
    );

    if (selectedCandidates.length === 0) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'جميع المواد المطلوبة محددة مسبقاً كموجودة لديك.'
              : 'All required materials are already marked as already owned.',
            'answer',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }
  } else {
    const references = extractComponentReferencePhrases(input.userMessage, candidates);
    if (references.length === 0) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'حدّد المكوّن أو المكوّنات التي تريد تحديثها.'
              : 'Specify which component or components you want to update.',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    const resolution = resolveBuildComponentReferences({
      references,
      candidates,
    });

    if (resolution.unknown.length > 0 || resolution.ambiguous.length > 0) {
      return {
        blocks: [
          textBlock(
            buildComponentClarificationText({
              locale: input.locale,
              unknown: resolution.unknown,
              ambiguous: resolution.ambiguous,
              mixedKnown: resolution.matched.map((item) => item.componentName),
            }),
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    selectedCandidates = resolution.matched;
  }

  const changingCandidates = selectedCandidates.filter(
    (candidate) => candidate.status !== targetStatus,
  );
  const alreadyCorrect = selectedCandidates.filter(
    (candidate) => candidate.status === targetStatus,
  );

  if (changingCandidates.length === 0) {
    const names = selectedCandidates.map((item) => item.componentName).join(
      input.locale === 'ar' ? '، ' : ', ',
    );
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? `${names} ${targetStatus === 'ALREADY_OWNED' ? 'محددة مسبقاً كموجودة لديك.' : 'محددة مسبقاً كغير موجودة.'}`
            : `${names} ${targetStatus === 'ALREADY_OWNED' ? 'is already marked as already owned.' : 'is already marked as missing.'}`,
          'answer',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  const payload = buildUpdateBuildComponentStatusesPayload({
    projectId: rawBuild.projectId,
    buildId: rawBuild.id,
    projectTitle: rawBuild.project.title,
    targetStatus,
    items: changingCandidates.map((candidate) => ({
      buildItemId: candidate.buildItemId,
      requiredComponentId: candidate.requiredComponentId,
      componentName: candidate.componentName,
      previousStatus: candidate.status as
        | 'MISSING'
        | 'ALREADY_OWNED'
        | 'AVAILABLE'
        | 'RESERVED'
        | 'ALTERNATIVE',
    })),
  });

  const prepared = await prepareAiPendingAction({
    userId: input.authenticatedUserId,
    conversationId: input.conversationId,
    actionType: 'UPDATE_BUILD_COMPONENT_STATUSES',
    payload,
    idempotencyKey: `${input.clientMessageId}:UPDATE_BUILD_COMPONENT_STATUSES:${rawBuild.id}:${changingCandidates
      .map((item) => item.buildItemId)
      .sort()
      .join(',')}:${targetStatus}`,
    locale: input.locale,
  });

  const intro =
    input.locale === 'ar'
      ? alreadyCorrect.length > 0
        ? `سأحدّث المكوّنات التالية. ${alreadyCorrect.map((item) => item.componentName).join('، ')} محددة مسبقاً كما طلبت.\n`
        : 'راجع التفاصيل ثم أكّد التحديث:'
      : alreadyCorrect.length > 0
        ? `I will update the components below. ${alreadyCorrect.map((item) => item.componentName).join(', ')} is already in the requested state.\n`
        : 'Review the details, then confirm the update:';

  return {
    blocks: mergeAgentBlocks(intro, [prepared.block]),
    usedProvider: false,
    providerName: 'system',
    model: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    route: 'ACTION_REQUEST',
  };
};

const futurePickupWindow = (hoursFromNow = 48, durationHours = 2) => {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
};

const parseClockTime = (hour: string, minute = '00') =>
  `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;

const buildPickupWindowFromParts = (input: {
  pickupDate: string;
  pickupStartTime: string;
  pickupEndTime: string;
}) => {
  const start = new Date(`${input.pickupDate}T${input.pickupStartTime}:00`);
  const end = new Date(`${input.pickupDate}T${input.pickupEndTime}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }
  return { start: start.toISOString(), end: end.toISOString() };
};

const normalizeReservationDigits = (text: string) =>
  text
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));

const parseReservationParameters = (userMessage: string) => {
  const trimmed = normalizeReservationDigits(userMessage.trim());
  const quantityMatch =
    trimmed.match(/(?:كمية|quantity)\s*[:：]?\s*(\d+(?:\.\d+)?)/i) ??
    trimmed.match(/(\d+(?:\.\d+)?)\s*(?:قطعة|piece|units?)/i) ??
    trimmed.match(/(?:بدي|بدّي|i need|quantity)\s+(\d+(?:\.\d+)?)/i);
  let quantity = quantityMatch ? Number(quantityMatch[1]) : null;
  if (quantity == null) {
    if (/^(\d+(?:\.\d+)?)$/.test(trimmed)) {
      quantity = Number(trimmed);
    } else if (/^(واحد|واحدة|قطعة واحدة)$/i.test(trimmed)) {
      quantity = 1;
    } else if (/^بدي\s+(?:قطعة|وحدة|\d)/i.test(trimmed)) {
      const embedded = trimmed.match(/(\d+(?:\.\d+)?)/);
      quantity = embedded ? Number(embedded[1]) : 1;
    }
  }

  let fulfillmentMethod: 'PICKUP' | 'DELIVERY' | null = null;
  if (/(توصيل|delivery)/i.test(userMessage)) {
    fulfillmentMethod = 'DELIVERY';
  } else if (/(استلام|pickup|من المورد)/i.test(userMessage)) {
    fulfillmentMethod = 'PICKUP';
  }

  const pickupDateMatch = trimmed.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  const pickupDate = pickupDateMatch?.[1] ?? null;

  const startEndColonMatch = trimmed.match(
    /start\s*:\s*(\d{1,2}):(\d{2})\s*end\s*(\d{1,2}):(\d{2})/i,
  );
  const arabicRangeMatch = trimmed.match(
    /من\s*(\d{1,2})(?::(\d{2}))?\s*(?:إلى|الى|to|-)\s*(\d{1,2})(?::(\d{2}))?/i,
  );

  let pickupStartTime: string | null = null;
  let pickupEndTime: string | null = null;
  if (startEndColonMatch) {
    pickupStartTime = parseClockTime(startEndColonMatch[1]!, startEndColonMatch[2]!);
    pickupEndTime = parseClockTime(startEndColonMatch[3]!, startEndColonMatch[4]!);
  } else if (arabicRangeMatch) {
    pickupStartTime = parseClockTime(
      arabicRangeMatch[1]!,
      arabicRangeMatch[2] ?? '00',
    );
    pickupEndTime = parseClockTime(
      arabicRangeMatch[3]!,
      arabicRangeMatch[4] ?? '00',
    );
  }

  const isoMatches = [...userMessage.matchAll(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/gi)].map(
    (match) => match[0],
  );
  const window =
    isoMatches.length >= 2
      ? { start: isoMatches[0]!, end: isoMatches[1]! }
      : pickupDate && pickupStartTime && pickupEndTime
        ? buildPickupWindowFromParts({
            pickupDate,
            pickupStartTime,
            pickupEndTime,
          })
        : null;

  return {
    quantity,
    fulfillmentMethod,
    pickupDate,
    pickupStartTime,
    pickupEndTime,
    pickupWindows:
      fulfillmentMethod !== 'DELIVERY' && window ? [window] : undefined,
    deliveryWindows:
      fulfillmentMethod === 'DELIVERY' && window ? [window] : undefined,
  };
};

const computeReservationMissing = (params: {
  quantity: number | null;
  fulfillmentMethod: 'PICKUP' | 'DELIVERY' | null;
  pickupDate?: string | null;
  pickupStartTime?: string | null;
  pickupEndTime?: string | null;
  pickupWindows?: Array<{ start: string; end: string }>;
  deliveryWindows?: Array<{ start: string; end: string }>;
}) => {
  const missing: string[] = [];
  if (!params.quantity) {
    missing.push('quantity');
  }
  if (!params.fulfillmentMethod) {
    missing.push('fulfillment');
  }
  if (params.fulfillmentMethod === 'PICKUP') {
    if (params.pickupWindows?.length) {
      return missing;
    }
    if (!params.pickupStartTime || !params.pickupEndTime) {
      missing.push('pickupWindow');
    } else if (!params.pickupDate) {
      missing.push('pickupDate');
    }
  }
  if (params.fulfillmentMethod === 'DELIVERY' && !params.deliveryWindows?.length) {
    missing.push('deliveryWindow');
  }
  return missing;
};

export const isReservationContinuationMessage = (userMessage: string): boolean => {
  const trimmed = normalizeReservationDigits(userMessage.trim());
  if (/^(\d+(?:\.\d+)?)$/.test(trimmed)) {
    return true;
  }
  if (/^(واحد|واحدة|قطعة واحدة)$/i.test(trimmed)) {
    return true;
  }
  if (/^بدي\s+(?:قطعة|وحدة|\d)/i.test(trimmed)) {
    return true;
  }
  if (/(?:بدي|بدّي|i need|quantity|كمية)\s+\d/i.test(trimmed)) {
    return true;
  }
  if (/(توصيل|delivery|استلام|pickup|من المورد)/i.test(userMessage)) {
    return true;
  }
  if (/\d{4}-\d{2}-\d{2}T[\d:.]+Z/i.test(userMessage)) {
    return true;
  }
  if (/\b\d{4}-\d{2}-\d{2}\b/.test(userMessage)) {
    return true;
  }
  if (/start\s*:\s*\d{1,2}:\d{2}/i.test(userMessage)) {
    return true;
  }
  if (/من\s*\d{1,2}/i.test(userMessage)) {
    return true;
  }
  if (/(كمية|quantity)\s*[:：]?\s*\d/i.test(userMessage)) {
    return true;
  }
  if (/(الغ|إلغاء|cancel)/i.test(userMessage) && trimmed.length < 48) {
    return true;
  }
  return false;
};

const buildActionPayload = async (input: {
  actionType: AiPendingActionType;
  targetId: string;
  referenceKind: 'MATERIAL' | 'PROJECT' | 'BUILD' | 'COMPONENT';
  userMessage: string;
  conversationId: string;
  authenticatedUserId: string;
  trustedProjectBuildId?: string;
}) => {
  const viewer: AccessTokenPayload = {
    sub: input.authenticatedUserId,
    roles: ['LEARNER'],
  };

  if (input.actionType === 'PREPARE_MATERIAL_RESERVATION') {
    const params = parseReservationParameters(input.userMessage);
    const missing: string[] = [];
    if (!params.quantity) {
      missing.push('quantity');
    }
    if (!params.fulfillmentMethod) {
      missing.push('fulfillment');
    }
    if (
      params.fulfillmentMethod === 'PICKUP' &&
      !params.pickupWindows?.length
    ) {
      missing.push('pickupWindow');
    }
    if (
      params.fulfillmentMethod === 'DELIVERY' &&
      !params.deliveryWindows?.length
    ) {
      missing.push('deliveryWindow');
    }

    if (missing.length > 0) {
      return { missing } as const;
    }

    const material = await getMaterialById(input.targetId, viewer);
    return {
      actionType: 'CONFIRM_MATERIAL_RESERVATION' as const,
      payload: buildReservationPayload({
        materialId: material.id,
        parameters: {
          quantityRequested: params.quantity!,
          fulfillmentMethod: params.fulfillmentMethod!,
          learnerPreferredPickupWindows: params.pickupWindows,
          learnerPreferredDeliveryWindows: params.deliveryWindows,
          deliveryAddressText:
            params.fulfillmentMethod === 'DELIVERY' ? 'Nablus test address' : undefined,
          dropoffCity: params.fulfillmentMethod === 'DELIVERY' ? 'Nablus' : undefined,
        },
        displaySnapshot: { title: material.title, summary: material.title },
      }),
    } as const;
  }

  if (input.actionType === 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT') {
    let buildId = input.trustedProjectBuildId ?? await resolveLatestBuildId(input.conversationId);
    if (!buildId) {
      const builds = await listActiveProjectBuildsForLearner(input.authenticatedUserId);
      buildId = builds[0]?.id ?? null;
    }
    if (!buildId) {
      return { error: 'NO_BUILD' } as const;
    }
    const build = await getOwnedProjectBuildByBuildId(
      buildId,
      input.authenticatedUserId,
    );
    if (!build) {
      return { error: 'NO_BUILD' } as const;
    }
    const linkedItem = build.items.find((item) => item.linkedMaterial?.id);
    if (!linkedItem?.linkedMaterial?.id) {
      return { error: 'NO_LINK' } as const;
    }
    return {
      actionType: input.actionType,
      payload: buildUnlinkMaterialPayload({
        projectId: build.projectId,
        buildId: build.id,
        buildItemId: linkedItem.id,
        displaySnapshot: {
          title: linkedItem.component.componentName,
          summary: linkedItem.component.componentName,
        },
      }),
    } as const;
  }

  if (
    input.actionType === 'SAVE_MATERIAL' ||
    input.actionType === 'UNSAVE_MATERIAL'
  ) {
    const material = await getMaterialById(input.targetId, viewer);
    return {
      actionType: input.actionType,
      payload:
        input.actionType === 'UNSAVE_MATERIAL'
          ? buildUnsaveMaterialPayload({
              materialId: material.id,
              displaySnapshot: { title: material.title, summary: material.title },
            })
          : buildMaterialSavePayload({
              materialId: material.id,
              displaySnapshot: { title: material.title, summary: material.title },
            }),
    } as const;
  }

  if (
    input.actionType === 'SAVE_PROJECT' ||
    input.actionType === 'UNSAVE_PROJECT' ||
    input.actionType === 'START_PROJECT_BUILD'
  ) {
    const project = await getLearningProjectById(input.targetId, viewer);
    const title = project.title;
    return {
      actionType: input.actionType,
      payload:
        input.actionType === 'UNSAVE_PROJECT'
          ? buildUnsaveProjectPayload({
              projectId: project.id,
              displaySnapshot: { title, summary: title },
            })
          : input.actionType === 'START_PROJECT_BUILD'
            ? buildStartBuildPayload({
                projectId: project.id,
                displaySnapshot: { title, summary: title },
              })
            : buildProjectSavePayload({
                projectId: project.id,
                displaySnapshot: { title, summary: title },
              }),
    } as const;
  }

  return null;
};

const reservationClarification = (
  locale: AiLocale,
  missing: string[],
  options?: { pickupStartTime?: string; pickupEndTime?: string },
): string => {
  if (missing.includes('quantity')) {
    return locale === 'ar' ? 'كم كمية بدك؟' : 'What quantity do you need?';
  }
  if (missing.includes('fulfillment')) {
    return locale === 'ar' ? 'بدك استلام ولا توصيل؟' : 'Pickup or delivery?';
  }
  if (missing.includes('pickupDate') && options?.pickupStartTime && options?.pickupEndTime) {
    return locale === 'ar'
      ? `حددت الوقت من ${options.pickupStartTime} إلى ${options.pickupEndTime}، لكن أحتاج تاريخ الاستلام.`
      : `I noted the time from ${options.pickupStartTime} to ${options.pickupEndTime}, but I still need the pickup date.`;
  }
  if (missing.includes('pickupDate')) {
    return locale === 'ar' ? 'ما تاريخ الاستلام؟' : 'What is the pickup date?';
  }
  if (missing.includes('pickupWindow') || missing.includes('deliveryWindow')) {
    return locale === 'ar'
      ? 'اختاري وقت بداية ونهاية للاستلام.'
      : 'Choose a pickup start and end time.';
  }
  return locale === 'ar'
    ? 'أكمل تفاصيل الحجز قبل التأكيد.'
    : 'Complete the reservation details before confirming.';
};

const reservationPayloadWithBuildItem = (input: {
  materialId: string;
  buildItemId?: string | null;
  parameters: Parameters<typeof buildReservationPayload>[0]['parameters'];
  displaySnapshot: { title: string; summary: string };
}) =>
  buildReservationPayload({
    materialId: input.materialId,
    buildItemId: input.buildItemId ?? undefined,
    parameters: input.parameters,
    displaySnapshot: input.displaySnapshot,
  });

const handleReservationDraftContinuation = async (input: {
  userMessage: string;
  locale: AiLocale;
  conversationId: string;
  authenticatedUserId: string;
  clientMessageId: string;
}): Promise<AgentTurnExecutionResult | null> => {
  const draft = await findActiveReservationDraft({
    conversationId: input.conversationId,
    userId: input.authenticatedUserId,
  });
  if (!draft) {
    return null;
  }

  if (resolveActionFromMessage(input.userMessage) === 'PREPARE_MATERIAL_RESERVATION') {
    await cancelReservationDraft({
      conversationId: input.conversationId,
      userId: input.authenticatedUserId,
    });
    return null;
  }

  if (!isReservationContinuationMessage(input.userMessage)) {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? 'ما زال حجز المادة قيد الإعداد. أرسل الكمية أو اضغط متابعة، أو اكتب إلغاء لإيقاف الحجز.'
            : 'A material reservation is still in progress. Send the quantity or press Continue, or type cancel to stop.',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  if (/(الغ|إلغاء|cancel)/i.test(input.userMessage)) {
    await cancelReservationDraft({
      conversationId: input.conversationId,
      userId: input.authenticatedUserId,
    });
    return {
      blocks: [
        textBlock(
          input.locale === 'ar' ? 'تم إلغاء مسودة الحجز.' : 'The reservation draft was cancelled.',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  const draftPayload = prepareMaterialReservationPayloadSchema.parse(draft.payload);
  const parsed = parseReservationParameters(input.userMessage);
  const existing = draftPayload.parameters;

  if (parsed.quantity != null && parsed.quantity <= 0) {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? 'الكمية يجب أن تكون أكبر من صفر. كم كمية بدك؟'
            : 'Quantity must be greater than zero. What quantity do you need?',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  const merged = {
    quantityRequested:
      parsed.quantity ?? existing.quantityRequested ?? undefined,
    fulfillmentMethod:
      parsed.fulfillmentMethod ?? existing.fulfillmentMethod ?? undefined,
    pickupDate: parsed.pickupDate ?? existing.pickupDate ?? undefined,
    pickupStartTime: parsed.pickupStartTime ?? existing.pickupStartTime ?? undefined,
    pickupEndTime: parsed.pickupEndTime ?? existing.pickupEndTime ?? undefined,
    learnerPreferredPickupWindows:
      parsed.pickupWindows ??
      (existing.pickupDate && existing.pickupStartTime && existing.pickupEndTime
        ? ([
            buildPickupWindowFromParts({
              pickupDate: existing.pickupDate,
              pickupStartTime: existing.pickupStartTime,
              pickupEndTime: existing.pickupEndTime,
            }),
          ].filter(Boolean) as Array<{ start: string; end: string }>)
        : existing.learnerPreferredPickupWindows),
    learnerPreferredDeliveryWindows:
      parsed.deliveryWindows ?? existing.learnerPreferredDeliveryWindows,
    deliveryAddressText:
      parsed.fulfillmentMethod === 'DELIVERY'
        ? existing.deliveryAddressText ?? 'Nablus test address'
        : existing.deliveryAddressText,
    dropoffCity:
      parsed.fulfillmentMethod === 'DELIVERY'
        ? existing.dropoffCity ?? 'Nablus'
        : existing.dropoffCity,
  };

  if (
    !merged.learnerPreferredPickupWindows?.length &&
    merged.pickupDate &&
    merged.pickupStartTime &&
    merged.pickupEndTime
  ) {
    const builtWindow = buildPickupWindowFromParts({
      pickupDate: merged.pickupDate,
      pickupStartTime: merged.pickupStartTime,
      pickupEndTime: merged.pickupEndTime,
    });
    if (builtWindow) {
      merged.learnerPreferredPickupWindows = [builtWindow];
    }
  }

  if (merged.quantityRequested != null) {
    const viewer: AccessTokenPayload = {
      sub: input.authenticatedUserId,
      roles: ['LEARNER'],
    };
    const material = await getMaterialById(draftPayload.target.materialId, viewer);
    if (material.status !== 'AVAILABLE' || material.availableQuantity <= 0) {
      await cancelReservationDraft({
        conversationId: input.conversationId,
        userId: input.authenticatedUserId,
      });
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'المادة لم تعد متاحة للحجز حالياً.'
              : 'This material is no longer available to reserve.',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }
    if (merged.quantityRequested > material.availableQuantity) {
      await saveReservationDraft({
        userId: input.authenticatedUserId,
        conversationId: input.conversationId,
        materialId: draftPayload.target.materialId,
        parameters: merged,
        locale: input.locale,
      });
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? `الكمية المتوفرة حالياً ${material.availableQuantity}. أرسل كمية أقل أو مساوية.`
              : `Only ${material.availableQuantity} is currently available. Send a lower or equal quantity.`,
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }
  }

  const missing = computeReservationMissing({
    quantity: merged.quantityRequested ?? null,
    fulfillmentMethod: merged.fulfillmentMethod ?? null,
    pickupDate: merged.pickupDate ?? null,
    pickupStartTime: merged.pickupStartTime ?? null,
    pickupEndTime: merged.pickupEndTime ?? null,
    pickupWindows: merged.learnerPreferredPickupWindows,
    deliveryWindows: merged.learnerPreferredDeliveryWindows,
  });

  if (missing.length > 0) {
    await saveReservationDraft({
      userId: input.authenticatedUserId,
      conversationId: input.conversationId,
      materialId: draftPayload.target.materialId,
      parameters: merged,
      locale: input.locale,
    });
    return {
      blocks: [
        textBlock(
          reservationClarification(input.locale, missing, {
            pickupStartTime: merged.pickupStartTime,
            pickupEndTime: merged.pickupEndTime,
          }),
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  await cancelReservationDraft({
    conversationId: input.conversationId,
    userId: input.authenticatedUserId,
  });

  const viewer: AccessTokenPayload = {
    sub: input.authenticatedUserId,
    roles: ['LEARNER'],
  };
  const material = await getMaterialById(draftPayload.target.materialId, viewer);
  const conversation = await prisma.aiConversation.findUnique({
    where: { id: input.conversationId },
    select: { projectBuildId: true },
  });
  const buildItemId = conversation?.projectBuildId
    ? await resolveBuildItemIdForLinkedMaterial({
        trustedProjectBuildId: conversation.projectBuildId,
        materialId: material.id,
        authenticatedUserId: input.authenticatedUserId,
      })
    : null;
  const prepared = await prepareAiPendingAction({
    userId: input.authenticatedUserId,
    conversationId: input.conversationId,
    actionType: 'CONFIRM_MATERIAL_RESERVATION',
    payload: reservationPayloadWithBuildItem({
      materialId: material.id,
      buildItemId,
      parameters: {
        quantityRequested: merged.quantityRequested!,
        fulfillmentMethod: merged.fulfillmentMethod!,
        learnerPreferredPickupWindows: merged.learnerPreferredPickupWindows,
        learnerPreferredDeliveryWindows: merged.learnerPreferredDeliveryWindows,
        deliveryAddressText: merged.deliveryAddressText,
        dropoffCity: merged.dropoffCity,
      },
      displaySnapshot: { title: material.title, summary: material.title },
    }),
    idempotencyKey: `${input.clientMessageId}:CONFIRM_MATERIAL_RESERVATION:${material.id}`,
    locale: input.locale,
  });

  return {
    blocks: mergeAgentBlocks(
      input.locale === 'ar'
        ? 'راجع التفاصيل ثم أكّد الحجز:'
        : 'Review the details, then confirm the reservation:',
      [prepared.block],
    ),
    usedProvider: false,
    providerName: 'system',
    model: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    route: 'ACTION_REQUEST',
  };
};

const buildLinkedItemsClarification = (
  locale: AiLocale,
  items: Array<{ componentName: string; materialTitle: string }>,
): string => {
  const lines = items
    .map((item) => `- ${item.componentName}: ${item.materialTitle}`)
    .join('\n');

  return locale === 'ar'
    ? `أي مادة مربوطة تقصد؟\n${lines}`
    : `Which linked material do you mean?\n${lines}`;
};

const buildUnlinkConfirmationSnapshot = (target: {
  projectTitle: string;
  componentName: string;
  materialTitle: string;
}) => ({
  title: target.projectTitle,
  summary: `${target.componentName} — ${target.materialTitle}`,
});

const handleActionRequestTurn = async (input: {
  userMessage: string;
  locale: AiLocale;
  conversationId: string;
  authenticatedUserId: string;
  clientMessageId: string;
  trustedProjectBuildId?: string;
}): Promise<AgentTurnExecutionResult | null> => {
  const actionType = resolveActionFromMessage(input.userMessage);
  if (!actionType) {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? 'حدّد المادة أو المشروع الذي تريد تنفيذ إجراء عليه.'
            : 'Specify which material or project you want to act on.',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  if (
    actionType === 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT'
  ) {
    const built = await buildActionPayload({
      actionType,
      targetId: '',
      referenceKind: 'COMPONENT',
      userMessage: input.userMessage,
      conversationId: input.conversationId,
      authenticatedUserId: input.authenticatedUserId,
    });

    if (built && 'missing' in built) {
      return {
        blocks: [
          textBlock(reservationClarification(input.locale, built.missing ?? []), 'clarification'),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    if (built && 'error' in built) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'لم أجد رابطاً حالياً لإلغائه.'
              : 'I could not find a current link to remove.',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    if (built && !('missing' in built) && !('error' in built)) {
      const prepared = await prepareAiPendingAction({
        userId: input.authenticatedUserId,
        conversationId: input.conversationId,
        actionType: built.actionType,
        payload: built.payload,
        idempotencyKey: `${input.clientMessageId}:${built.actionType}:unlink`,
        locale: input.locale,
      });

      return {
        blocks: mergeAgentBlocks(
          input.locale === 'ar'
            ? 'راجع التفاصيل ثم أكّد الإجراء:'
            : 'Review the details, then confirm:',
          [prepared.block],
        ),
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }
  }

  if (actionType === 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT') {
    if (input.trustedProjectBuildId) {
      const resolution = await resolveBuildGuideUnlinkTarget({
        conversationId: input.conversationId,
        userMessage: input.userMessage,
        trustedProjectBuildId: input.trustedProjectBuildId,
        authenticatedUserId: input.authenticatedUserId,
      });

      if (resolution.kind === 'ambiguous') {
        return {
          blocks: [
            textBlock(
              buildLinkedItemsClarification(input.locale, resolution.items),
              'clarification',
            ),
          ],
          usedProvider: false,
          providerName: 'system',
          model: null,
          latencyMs: null,
          inputTokens: null,
          outputTokens: null,
          route: 'ACTION_REQUEST',
        };
      }

      if (resolution.kind === 'not_found') {
        return {
          blocks: [
            textBlock(
              input.locale === 'ar'
                ? 'لم أجد رابطاً حالياً لإلغائه.'
                : 'I could not find a current link to remove.',
              'clarification',
            ),
          ],
          usedProvider: false,
          providerName: 'system',
          model: null,
          latencyMs: null,
          inputTokens: null,
          outputTokens: null,
          route: 'ACTION_REQUEST',
        };
      }

      const prepared = await prepareAiPendingAction({
        userId: input.authenticatedUserId,
        conversationId: input.conversationId,
        actionType,
        payload: buildUnlinkMaterialPayload({
          projectId: resolution.target.projectId,
          buildId: resolution.target.buildId,
          buildItemId: resolution.target.buildItemId,
          displaySnapshot: buildUnlinkConfirmationSnapshot(resolution.target),
        }),
        idempotencyKey: `${input.clientMessageId}:${actionType}:${resolution.target.buildItemId}`,
        locale: input.locale,
      });

      return {
        blocks: mergeAgentBlocks(
          input.locale === 'ar'
            ? 'راجع التفاصيل ثم أكّد الإجراء:'
            : 'Review the details, then confirm:',
          [prepared.block],
        ),
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    const built = await buildActionPayload({
      actionType,
      targetId: '',
      referenceKind: 'COMPONENT',
      userMessage: input.userMessage,
      conversationId: input.conversationId,
      authenticatedUserId: input.authenticatedUserId,
      trustedProjectBuildId: input.trustedProjectBuildId,
    });

    if (built && 'error' in built) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'لم أجد رابطاً حالياً لإلغائه.'
              : 'I could not find a current link to remove.',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    if (built?.actionType && built.payload) {
      const prepared = await prepareAiPendingAction({
        userId: input.authenticatedUserId,
        conversationId: input.conversationId,
        actionType: built.actionType,
        payload: built.payload,
        idempotencyKey: `${input.clientMessageId}:${built.actionType}:unlink`,
        locale: input.locale,
      });

      return {
        blocks: mergeAgentBlocks(
          input.locale === 'ar'
            ? 'راجع التفاصيل ثم أكّد الإجراء:'
            : 'Review the details, then confirm:',
          [prepared.block],
        ),
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }
  }

  if (actionType === 'LINK_MATERIAL_TO_BUILD_COMPONENT') {
    const linkTargets = await resolveLinkActionTargets({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
    });
    if (!linkTargets) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'لم أتمكن من تحديد المادة والمكون الناقص من النتائج السابقة.'
              : 'I could not determine the material and missing component from previous results.',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    const buildId =
      (await resolveLatestBuildId(input.conversationId)) ??
      (await resolveBuildIdForUserMessage({
        conversationId: input.conversationId,
        userMessage: input.userMessage,
        userId: input.authenticatedUserId,
      }))?.buildId ??
      null;

    if (!buildId) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'لم أجد مشروع بناء نشطاً لربط المادة.'
              : 'I could not find an active build to link the material.',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    const material = await getMaterialById(linkTargets.materialId, {
      sub: input.authenticatedUserId,
      roles: ['LEARNER'],
    });
    const build = await getOwnedProjectBuildByBuildId(buildId, input.authenticatedUserId);
    if (!build) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'لا يمكن الوصول إلى مشروع البناء.'
              : 'The project build is not accessible.',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    const missingItem = build.items.find(
      (item) => item.requiredComponentId === linkTargets.componentId,
    );

    if (!missingItem) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'لم أجد مكوناً ناقصاً لربط المادة.'
              : 'I could not find a missing component to link.',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    const prepared = await prepareAiPendingAction({
      userId: input.authenticatedUserId,
      conversationId: input.conversationId,
      actionType,
      payload: buildLinkMaterialPayload({
        projectId: build.projectId,
        buildId: build.id,
        buildItemId: missingItem.id,
        materialId: material.id,
        componentId: missingItem.requiredComponentId,
        displaySnapshot: { title: material.title, summary: material.title },
      }),
      idempotencyKey: `${input.clientMessageId}:${actionType}:${material.id}:${missingItem.id}`,
      locale: input.locale,
    });

    return {
      blocks: mergeAgentBlocks(
        input.locale === 'ar'
          ? 'راجع التفاصيل ثم أكّد الإجراء:'
          : 'Review the details, then confirm:',
        [prepared.block],
      ),
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  if (
    actionType === 'PREPARE_MATERIAL_RESERVATION' &&
    input.trustedProjectBuildId
  ) {
    const resolution = await resolveBuildGuideReservationTarget({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
      trustedProjectBuildId: input.trustedProjectBuildId,
      authenticatedUserId: input.authenticatedUserId,
    });

    if (resolution.kind === 'ambiguous') {
      return {
        blocks: [
          textBlock(
            buildLinkedItemsClarification(input.locale, resolution.items),
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    if (resolution.kind === 'active_reservation') {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? `يوجد حجز نشط بالفعل لـ ${resolution.target.materialTitle} (${resolution.target.componentName}): ${resolution.reservationStatusLabel}.`
              : `There is already an active reservation for ${resolution.target.materialTitle} (${resolution.target.componentName}): ${resolution.reservationStatusLabel}.`,
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    if (resolution.kind === 'not_eligible') {
      const message =
        resolution.reason === 'material_unavailable'
          ? input.locale === 'ar'
            ? 'المادة المربوطة لم تعد متاحة للحجز.'
            : 'The linked material is no longer available to reserve.'
          : input.locale === 'ar'
            ? 'المادة لم تعد مربوطة بهذا المكوّن.'
            : 'The material is no longer linked to that component.';
      return {
        blocks: [textBlock(message, 'clarification')],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    if (resolution.kind === 'not_found') {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'لم أجد مادة مربوطة يمكن حجزها. اربط مادة أولاً أو حدّد المكوّن.'
              : 'I could not find a linked material to reserve. Link a material first or specify the component.',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    const built = await buildActionPayload({
      actionType,
      targetId: resolution.target.materialId,
      referenceKind: 'MATERIAL',
      userMessage: input.userMessage,
      conversationId: input.conversationId,
      authenticatedUserId: input.authenticatedUserId,
      trustedProjectBuildId: input.trustedProjectBuildId,
    });

    if (built && 'missing' in built) {
      await saveReservationDraft({
        userId: input.authenticatedUserId,
        conversationId: input.conversationId,
        materialId: resolution.target.materialId,
        parameters: {},
        locale: input.locale,
      });

      return {
        blocks: [
          textBlock(reservationClarification(input.locale, built.missing ?? []), 'clarification'),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    if (!built || 'error' in built) {
      return {
        blocks: [
          textBlock(
            input.locale === 'ar'
              ? 'تعذّر تجهيز الحجز للمادة المربوطة.'
              : 'Could not prepare a reservation for the linked material.',
            'clarification',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'ACTION_REQUEST',
      };
    }

    const prepared = await prepareAiPendingAction({
      userId: input.authenticatedUserId,
      conversationId: input.conversationId,
      actionType: built.actionType,
      payload:
        built.actionType === 'CONFIRM_MATERIAL_RESERVATION'
          ? reservationPayloadWithBuildItem({
              materialId: resolution.target.materialId,
              buildItemId: resolution.target.buildItemId,
              parameters: (
                built.payload as {
                  parameters: Parameters<
                    typeof buildReservationPayload
                  >[0]['parameters'];
                  displaySnapshot: { title: string; summary: string };
                }
              ).parameters,
              displaySnapshot: (
                built.payload as {
                  displaySnapshot: { title: string; summary: string };
                }
              ).displaySnapshot,
            })
          : built.payload,
      idempotencyKey: `${input.clientMessageId}:${built.actionType}:${resolution.target.materialId}`,
      locale: input.locale,
    });

    return {
      blocks: mergeAgentBlocks(
        input.locale === 'ar'
          ? 'راجع التفاصيل ثم أكّد الإجراء:'
          : 'Review the details, then confirm:',
        [prepared.block],
      ),
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  const reference = await resolveConversationReferences({
    conversationId: input.conversationId,
    userMessage: input.userMessage,
  });

  if (!reference || reference.ambiguous || reference.ids.length === 0) {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? 'لم أتمكن من تحديد العنصر المقصود. اختر من النتائج السابقة.'
            : 'I could not determine which item you mean. Pick from the previous results.',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  const targetId = reference.ids[0]!;

  const built = await buildActionPayload({
    actionType,
    targetId,
    referenceKind: reference.kind,
    userMessage: input.userMessage,
    conversationId: input.conversationId,
    authenticatedUserId: input.authenticatedUserId,
  });

  if (built && 'missing' in built) {
    if (actionType === 'PREPARE_MATERIAL_RESERVATION') {
      await saveReservationDraft({
        userId: input.authenticatedUserId,
        conversationId: input.conversationId,
        materialId: targetId,
        parameters: {},
        locale: input.locale,
      });
    }

    return {
      blocks: [textBlock(reservationClarification(input.locale, built.missing ?? []), 'clarification')],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  if (built && 'error' in built) {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? 'لم أجد رابطاً حالياً لإلغائه.'
            : 'I could not find a current link to remove.',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'ACTION_REQUEST',
    };
  }

  if (!built) {
    throw new AppError('Action is not supported.', 400, 'AI_ACTION_NOT_SUPPORTED');
  }

  const prepared = await prepareAiPendingAction({
    userId: input.authenticatedUserId,
    conversationId: input.conversationId,
    actionType: built.actionType,
    payload: built.payload,
    idempotencyKey: `${input.clientMessageId}:${built.actionType}:${targetId}`,
    locale: input.locale,
  });

  return {
    blocks: mergeAgentBlocks(
      input.locale === 'ar'
        ? 'راجع التفاصيل ثم أكّد الإجراء:'
        : 'Review the details, then confirm:',
      [prepared.block],
    ),
    usedProvider: false,
    providerName: 'system',
    model: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    route: 'ACTION_REQUEST',
  };
};

const handleExternalDomainKnowledgeTurn = async (input: {
  userMessage: string;
  locale: AiLocale;
  requestId: string | null;
  history: ReturnType<typeof buildBoundedConversationHistory>;
}): Promise<AgentTurnExecutionResult | null> => {
  const search = await searchExternalDomainKnowledge({
    query: input.userMessage,
    locale: input.locale,
    requestId: input.requestId,
  });

  if (!search.enabled) {
    return null;
  }

  if (search.results.length === 0) {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? 'لم أجد مراجع خارجية لهذا السؤال.'
            : 'I could not find external references for this question.',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: search.provider,
      model: null,
      latencyMs: search.latencyMs,
      inputTokens: null,
      outputTokens: null,
      route: 'EXTERNAL_DOMAIN_KNOWLEDGE',
    };
  }

  const sourcesBlock = buildExternalSourcesBlock({
    query: input.userMessage,
    results: search.results,
  });

  const provider = getAiChatProvider();
  const synthesisUserMessage = buildExternalRetrievalSynthesisUserMessage({
    locale: input.locale,
    userMessage: input.userMessage,
    results: search.results,
  });

  const synthesis = await provider.generateGeneralLearningAnswer({
    locale: input.locale,
    userMessage: synthesisUserMessage,
    history: input.history,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
  });

  const textBlocks = synthesis.data.blocks.filter((block) => block.type === 'text');

  return {
    blocks: aiContentBlocksSchema.parse([...textBlocks, sourcesBlock]),
    usedProvider: true,
    providerName: synthesis.provider,
    model: synthesis.model,
    latencyMs: (synthesis.latencyMs ?? 0) + search.latencyMs,
    inputTokens: synthesis.usage.inputTokens,
    outputTokens: synthesis.usage.outputTokens,
    route: 'EXTERNAL_DOMAIN_KNOWLEDGE',
  };
};

const PLATFORM_ROUTES = new Set<AiAgentRouteType>(AI_AGENT_PLATFORM_ROUTES);

const textBlock = (
  text: string,
  purpose: 'answer' | 'refusal' | 'clarification' | 'safety' = 'answer',
): AiContentBlock => ({
  type: 'text',
  text,
  purpose,
});

const handlePlatformGuidanceTurn = (input: {
  userMessage: string;
  locale: AiLocale;
}): AgentTurnExecutionResult => {
  if (detectSupplierPublishGuidanceIntent(input.userMessage)) {
    return {
      blocks: [textBlock(buildSupplierPublishGuidanceResponse(input.locale), 'answer')],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'PLATFORM_GUIDANCE',
    };
  }

  const topic = detectPlatformGuidanceIntent(input.userMessage) ?? 'GENERAL_PLATFORM';

  return {
    blocks: [textBlock(buildPlatformGuidanceResponse(topic, input.locale), 'answer')],
    usedProvider: false,
    providerName: 'system',
    model: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    route: 'PLATFORM_GUIDANCE',
  };
};

const formatReservationStatusLabel = (status: string, locale: AiLocale): string => {
  const labels: Record<string, { en: string; ar: string }> = {
    PENDING: { en: 'Pending', ar: 'معلّق' },
    ACCEPTED: { en: 'Accepted', ar: 'مقبول' },
    REJECTED: { en: 'Rejected', ar: 'مرفوض' },
    CANCELLED: { en: 'Cancelled', ar: 'ملغى' },
    COMPLETED: { en: 'Completed', ar: 'مكتمل' },
    EXPIRED: { en: 'Expired', ar: 'منتهٍ' },
    AWAITING_RESOLUTION: { en: 'Awaiting resolution', ar: 'بانتظار المعالجة' },
  };
  const entry = labels[status];
  return entry ? entry[locale === 'ar' ? 'ar' : 'en'] : status;
};

const handleLearnerReservationStatusTurn = async (input: {
  userMessage: string;
  locale: AiLocale;
  authenticatedUserId: string;
  semanticDataTopic?: string;
}): Promise<AgentTurnExecutionResult> => {
  const reservations = await listMyReservations(input.authenticatedUserId);
  const pendingOnly =
    !isLearnerAllReservationsQuery(input.userMessage) &&
    (input.semanticDataTopic === 'LEARNER_RESERVATION_STATUS' ||
      isLearnerPendingReservationQuery(input.userMessage));
  const filtered = filterLearnerReservationsForStatusQuery(
    reservations,
    pendingOnly ? 'pending' : 'all',
  );

  if (filtered.length === 0) {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? pendingOnly
              ? 'لا توجد لديك حجوزات معلّقة حاليًا.'
              : 'لا توجد لديك حجوزات حاليًا.'
            : pendingOnly
              ? 'You do not have any pending reservations right now.'
              : 'You do not have any reservations right now.',
          'answer',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'MATERIAL_DETAILS',
      semanticRoute: 'SYSTEM_DATA_QUERY',
    };
  }

  const lines = filtered.slice(0, 10).map((reservation) => {
    const statusLabel = formatReservationStatusLabel(reservation.status, input.locale);
    if (input.locale === 'ar') {
      return `• ${reservation.material.title}: ${statusLabel}`;
    }
    return `• ${reservation.material.title}: ${statusLabel}`;
  });

  return {
    blocks: [
      textBlock(
        input.locale === 'ar'
          ? pendingOnly
            ? ['حجوزاتك المعلّقة:', ...lines].join('\n')
            : ['حجوزاتك الحالية:', ...lines].join('\n')
          : pendingOnly
            ? ['Your pending reservations:', ...lines].join('\n')
            : ['Your current reservations:', ...lines].join('\n'),
        'answer',
      ),
    ],
    usedProvider: false,
    providerName: 'system',
    model: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    route: 'MATERIAL_DETAILS',
    semanticRoute: 'SYSTEM_DATA_QUERY',
  };
};

const isPlatformRoute = (route: AiAgentRouteType): boolean =>
  PLATFORM_ROUTES.has(route);

const buildGracefulToolFailureResult = (input: {
  errorCode?: string;
  responseLocale: AiLocale;
  route: AiAgentRouteType;
}): AgentTurnExecutionResult | null => {
  if (input.errorCode === 'LEARNER_LOCATION_REQUIRED') {
    return {
      blocks: [
        textBlock(
          input.responseLocale === 'ar'
            ? 'لا يوجد موقع محفوظ في ملفك الشخصي للبحث عن مواد قريبة. يمكنك إضافته من إعدادات الملف الشخصي—لن أغيّر موقعك نيابةً عنك.'
            : 'There is no saved location on your profile for nearby search. You can add one in profile settings—I will not change your location for you.',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: input.route,
    };
  }

  if (input.errorCode === 'NO_MATCHING_RESULTS') {
    if (input.route === 'OWNED_MATERIALS_PROJECT_MATCH') {
      return {
        blocks: [
          textBlock(
            input.responseLocale === 'ar'
              ? 'لم أجد مشروعاً منشوراً على ImpactLoop يطابق المواد التي ذكرتها. جرّب أسماء مواد أو مكوّنات أوضح أو أكثر تحديداً.'
              : 'I could not find a published ImpactLoop project that matches the materials you listed. Try entering clearer or more specific material or component names.',
            'answer',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: input.route,
      };
    }

    if (
      input.route === 'PROJECT_MATERIAL_AVAILABILITY' ||
      input.route === 'PROJECT_BUDGET_ESTIMATION'
    ) {
      return {
        blocks: [
          textBlock(
            input.responseLocale === 'ar'
              ? 'لم أجد مشروعاً منشوراً على ImpactLoop يطابق الاسم الذي ذكرته.'
              : 'I could not find a published ImpactLoop project matching the name you provided.',
            'answer',
          ),
        ],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: input.route,
      };
    }

    return {
      blocks: [
        textBlock(buildNoResultsIntro(input.responseLocale), 'answer'),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: input.route,
    };
  }

  if (input.errorCode === 'BUILD_NOT_FOUND') {
    return {
      blocks: [
        textBlock(
          input.responseLocale === 'ar'
            ? 'لا يوجد لديك مشروع بناء نشط بعد، لذلك لا يمكن تحديد المكونات الناقصة لك. ابدأ البناء من صفحة المشروع ثم اسألني مرة أخرى.'
            : 'You do not have an active project build yet, so I cannot determine what you are still missing. Start a project build from the project page, then ask me again.',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: input.route,
    };
  }

  return null;
};

const buildMaterialResultsIntro = (count: number, locale: AiLocale): string =>
  locale === 'ar'
    ? `وجدت ${count} مواد متاحة تطابق طلبك على ImpactLoop.`
    : `I found ${count} currently available matching materials on ImpactLoop.`;

const isFreeMaterialCardPriceLabel = (priceLabel: string): boolean => {
  const normalized = priceLabel.trim().toLowerCase();
  return normalized === 'مجاني' || normalized === 'free';
};

const handleMaterialResultSetFilterTurn = async (input: {
  locale: AiLocale;
  conversationId: string;
  toolInput: Record<string, unknown>;
}): Promise<AgentTurnExecutionResult> => {
  const sourceMaterialIds = Array.isArray(input.toolInput.sourceMaterialIds)
    ? input.toolInput.sourceMaterialIds.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];
  const allowedIds = new Set(sourceMaterialIds);
  const isFreeFilter = input.toolInput.isFree === true;

  const { total } = await listMessagesForConversation({
    conversationId: input.conversationId,
    limit: 1,
    offset: 0,
  });
  const { items } = await listMessagesForConversation({
    conversationId: input.conversationId,
    limit: 24,
    offset: Math.max(0, total - 24),
  });

  const sourceMessageId =
    typeof input.toolInput.sourceMessageId === 'string'
      ? input.toolInput.sourceMessageId
      : null;

  let sourceBlock: Extract<AiContentBlock, { type: 'material_results' }> | null = null;

  const findMaterialResultsInMessage = (message: (typeof items)[number]) => {
    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (let blockIndex = blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = blocks[blockIndex];
      if (block.type === 'material_results') {
        return block;
      }
    }
    return null;
  };

  if (sourceMessageId) {
    const targetMessage = items.find((message) => message.id === sourceMessageId);
    if (targetMessage?.role === 'ASSISTANT') {
      sourceBlock = findMaterialResultsInMessage(targetMessage);
    }
  }

  if (!sourceBlock) {
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const message = items[index];
      if (message.role !== 'ASSISTANT') {
        continue;
      }
      sourceBlock = findMaterialResultsInMessage(message);
      if (sourceBlock) {
        break;
      }
    }
  }

  if (!sourceBlock) {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? 'لا أجد نتائج مواد سابقة لتصفيتها. اعرضلي أولاً مواداً متاحة.'
            : 'I cannot find prior material results to filter. Show me available materials first.',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'CLARIFICATION',
      semanticRoute: 'CLARIFICATION_REQUIRED',
    };
  }

  const trustedItems = sourceBlock.items.filter((item) =>
    allowedIds.size > 0 ? allowedIds.has(item.materialId) : true,
  );
  const filteredItems = isFreeFilter
    ? trustedItems.filter((item) => isFreeMaterialCardPriceLabel(item.priceLabel))
    : trustedItems;

  if (filteredItems.length === 0) {
    return {
      blocks: [
        textBlock(
          input.locale === 'ar'
            ? 'لا توجد مواد مطابقة للتصفية ضمن آخر نتائج موثوقة.'
            : 'No materials in the latest trusted results match that filter.',
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'CLARIFICATION',
      semanticRoute: 'CLARIFICATION_REQUIRED',
    };
  }

  const resultBlock: AiContentBlock = {
    type: 'material_results',
    items: filteredItems,
  };

  return {
    blocks: [
      textBlock(buildMaterialResultsIntro(filteredItems.length, input.locale)),
      resultBlock,
    ],
    usedProvider: false,
    providerName: 'system',
    model: null,
    latencyMs: null,
    inputTokens: null,
    outputTokens: null,
    route: 'MATERIAL_SEARCH',
    semanticRoute: 'SYSTEM_DATA_QUERY',
  };
};

const buildProjectResultsIntro = (
  block: Extract<AiContentBlock, { type: 'project_results' }>,
  locale: AiLocale,
): string => {
  const hasCoverageEstimate = block.items.some(
    (item) => item.readinessPercent != null,
  );

  if (hasCoverageEstimate) {
    return locale === 'ar'
      ? 'تقدير تغطية المكونات بناءً على المواد التي ذكرتها.'
      : 'Estimated component coverage based on the materials you listed.';
  }

  const titles = block.items.map((item) => item.title);
  const joined =
    locale === 'ar'
      ? titles.length > 1
        ? `${titles.slice(0, -1).join(' و')} و${titles[titles.length - 1]}`
        : titles[0] ?? ''
      : titles.join(', ');

  if (locale === 'ar') {
    return titles.length === 1
      ? `وجدت مشروعاً واحداً على ImpactLoop: ${joined}.`
      : `وجدت ${titles.length} مشاريع على ImpactLoop: ${joined}.`;
  }

  return titles.length === 1
    ? `I found 1 learning project on ImpactLoop: ${joined}.`
    : `I found ${titles.length} learning projects on ImpactLoop: ${joined}.`;
};

const buildProjectComponentsIntro = (locale: AiLocale, projectTitle?: string): string =>
  locale === 'ar'
    ? projectTitle
      ? `هذه هي المكونات المطلوبة لمشروع ${projectTitle}.`
      : 'هذه هي المكونات المطلوبة للمشروع المحدد.'
    : projectTitle
      ? `Here are the required components for ${projectTitle}.`
      : 'Here are the required components for the selected project.';

const buildPersonalizedRecommendationIntro = (
  trustedBlocks: AiContentBlock[],
  locale: AiLocale,
): string => {
  const primaryBlock = trustedBlocks.find(
    (block) =>
      block.type === 'recommendations' &&
      block.recommendationType !== 'MATERIALS',
  );

  if (primaryBlock?.type !== 'recommendations' || primaryBlock.items.length === 0) {
    return locale === 'ar'
      ? 'هذه توصيات مخصصة من ImpactLoop:'
      : 'Here are personalized ImpactLoop recommendations:';
  }

  const top = primaryBlock.items[0]!;
  const reason = top.reasons[0]?.trim();

  if (locale === 'ar') {
    if (top.itemType === 'ACTION') {
      return `يمكنك متابعة بناء بدأته سابقًا: ${top.title}.`;
    }
    if (reason) {
      return `بناءً على اهتماماتك، أنصحك أن تبدأ بمشروع ${top.title}. ${reason}.`;
    }
    return `بناءً على اهتماماتك، أنصحك أن تبدأ بمشروع ${top.title}.`;
  }

  if (top.itemType === 'ACTION') {
    return `You can continue a build you already started: ${top.title}.`;
  }
  if (reason) {
    return `Based on your interests, I recommend starting with ${top.title}. ${reason}.`;
  }
  return `Based on your interests, I recommend starting with ${top.title}.`;
};

const buildRelatedMaterialsIntro = (locale: AiLocale): string =>
  locale === 'ar'
    ? 'مواد قد تساعدك على تنفيذ المشروع:'
    : 'Materials that may help with the project:';

const assembleTrustedResponseBlocks = (input: {
  explanationBlocks: AiContentBlock[];
  trustedBlocks: AiContentBlock[];
  fallbackText: string;
}): AiContentBlock[] => {
  if (input.explanationBlocks.length === 0) {
    return mergeAgentBlocks(input.fallbackText, input.trustedBlocks);
  }

  const assembled: AiContentBlock[] = [...input.explanationBlocks];
  for (const [index, block] of input.trustedBlocks.entries()) {
    if (
      index > 0 &&
      block.type === 'recommendations' &&
      block.recommendationType === 'MATERIALS' &&
      input.trustedBlocks[index - 1]?.type === 'recommendations'
    ) {
      const firstExplanation = input.explanationBlocks[0];
      const localeHint =
        firstExplanation?.type === 'text' ? firstExplanation.text ?? '' : '';
      const locale: AiLocale = /[\u0600-\u06FF]/.test(localeHint) ? 'ar' : 'en';
      assembled.push(textBlock(buildRelatedMaterialsIntro(locale)));
    }
    assembled.push(block);
  }

  return assembled;
};

const buildNoResultsIntro = (locale: AiLocale): string =>
  locale === 'ar'
    ? 'لم أجد حاليًا نتائج متاحة تطابق طلبك.'
    : "I couldn't find currently available results matching your request.";

const synthesizePlatformAnswer = async (input: {
  locale: AiLocale;
  userMessage: string;
  history: ReturnType<typeof buildBoundedConversationHistory>;
  trustedSummary: string;
}) => {
  const provider = getAiChatProvider();
  const augmentedMessage = [
    input.userMessage,
    '',
    'Trusted platform data (already retrieved from ImpactLoop backend tools):',
    input.trustedSummary,
    '',
    'Write a concise helpful explanation in the user language.',
    'The inventory/project data is already available to the learner in this turn.',
    'Never say you cannot access ImpactLoop inventory, platform data, or current availability.',
    'Do not contradict the trusted data.',
    'Do not list items that are not in the trusted data.',
  ].join('\n');

  const answer = await provider.generateGeneralLearningAnswer({
    locale: input.locale,
    userMessage: augmentedMessage,
    history: input.history,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
  });

  const textBlocks = answer.data.blocks.filter((block) => block.type === 'text');
  return {
    textBlocks,
    provider: answer.provider,
    model: answer.model,
    latencyMs: answer.latencyMs,
    inputTokens: answer.usage.inputTokens,
    outputTokens: answer.usage.outputTokens,
  };
};

const buildTrustedSummary = (toolData: unknown): string => {
  try {
    return JSON.stringify(toolData).slice(0, 4_000);
  } catch {
    return 'Platform data loaded.';
  }
};

const resolveToolInput = async (input: {
  route: AiAgentRouteType;
  userMessage: string;
  conversationId: string;
  userId: string;
}): Promise<Record<string, unknown>> => {
  if (input.route === 'MATERIAL_DETAILS') {
    const reference = await resolveConversationReferences({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
    });

    if (reference?.kind === 'MATERIAL' && reference.ids[0]) {
      return { materialId: reference.ids[0] };
    }

    throw new AppError(
      CLARIFICATION_COPY[detectResponseLocale(input.userMessage, 'en')],
      400,
      'AI_ROUTE_UNCLEAR',
    );
  }

  if (input.route === 'MATERIAL_COMPARISON' || input.route === 'PROJECT_COMPARISON') {
    const reference = await resolveConversationReferences({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
    });

    if (!reference || reference.ambiguous || reference.ids.length < 2) {
      throw new AppError(
        CLARIFICATION_COPY[detectResponseLocale(input.userMessage, 'en')],
        400,
        'AI_ROUTE_UNCLEAR',
      );
    }

    const parsed = parseComparisonFromContext({
      subject: input.route === 'MATERIAL_COMPARISON' ? 'MATERIAL' : 'PROJECT',
      resolvedIds: reference.ids,
    });

    return parsed ?? {};
  }

  if (
    input.route === 'BUILD_CHECKLIST' ||
    input.route === 'BUILD_GAP_ANALYSIS'
  ) {
    const resolvedBuild = await resolveBuildIdForUserMessage({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
      userId: input.userId,
    });
    if (resolvedBuild) {
      return { buildId: resolvedBuild.buildId };
    }

    throw new AppError(
      'Tell me which project build you mean, or start a build first.',
      400,
      'BUILD_NOT_FOUND',
    );
  }

  if (input.route === 'COMPONENT_MATERIAL_MATCHING' || input.route === 'PROJECT_MATERIAL_MATCHING') {
    const explicitTitle = extractProjectTitleQuery(input.userMessage);
    if (explicitTitle) {
      const owned = await resolveOwnedBuildForProjectTitle({
        titleQuery: explicitTitle,
        userId: input.userId,
      });
      if (!owned) {
        throw new AppError('No active project build found.', 404, 'BUILD_NOT_FOUND');
      }
      return parseFindMaterialsForProjectInput({
        projectId: owned.projectId,
        buildId: owned.buildId,
        onlyMissing: true,
        nearLearner: /near|قريب/i.test(input.userMessage),
      });
    }

    const resolvedBuild = await resolveBuildIdForUserMessage({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
      userId: input.userId,
    });
    const reference = await resolveConversationReferences({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
    });

    if (reference?.kind === 'COMPONENT' && reference.ids[0]) {
      return {
        componentId: reference.ids[0],
        buildId: resolvedBuild?.buildId,
      };
    }

    const projectMatch = await resolveProjectFromMessage({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
      explicitQuery: extractProjectTitleQuery(input.userMessage),
    });

    if (projectMatch) {
      const build =
        resolvedBuild?.projectId === projectMatch.entity.id
          ? resolvedBuild
          : await resolveBuildIdForUserMessage({
              conversationId: input.conversationId,
              userMessage: projectMatch.entity.title,
              userId: input.userId,
            });

      if (build?.projectId === projectMatch.entity.id) {
        return parseFindMaterialsForProjectInput({
          projectId: build.projectId,
          buildId: build.buildId,
          onlyMissing: true,
          nearLearner: /near|قريب/i.test(input.userMessage),
        });
      }

      throw new AppError('No active project build found.', 404, 'BUILD_NOT_FOUND');
    }

    if (
      resolvedBuild &&
      /(الناقصة|الناقص|missing components|للمكونات)/i.test(input.userMessage) &&
      reference?.kind !== 'COMPONENT'
    ) {
      return parseFindMaterialsForProjectInput({
        projectId: resolvedBuild.projectId,
        buildId: resolvedBuild.buildId,
        onlyMissing: true,
        nearLearner: /near|قريب/i.test(input.userMessage),
      });
    }

    if (resolvedBuild) {
      return parseFindMaterialsForProjectInput({
        projectId: resolvedBuild.projectId,
        buildId: resolvedBuild.buildId,
        onlyMissing: true,
        nearLearner: /near|قريب/i.test(input.userMessage),
      });
    }

    throw new AppError('No active project build found.', 404, 'BUILD_NOT_FOUND');
  }

  if (input.route === 'PROJECT_MATERIAL_AVAILABILITY') {
    const projectMatch = await resolveProjectFromMessage({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
      explicitQuery: extractProjectTitleQuery(input.userMessage),
    });

    if (projectMatch) {
      return { projectId: projectMatch.entity.id, limitPerComponent: 3 };
    }

    const projectQuery = extractProjectTitleQuery(input.userMessage);
    if (projectQuery) {
      return { projectQuery, limitPerComponent: 3 };
    }

    throw new AppError(
      'Tell me which learning project you mean.',
      400,
      'AI_ROUTE_UNCLEAR',
    );
  }

  if (input.route === 'PROJECT_BUDGET_ESTIMATION') {
    const projectMatch = await resolveProjectFromMessage({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
      explicitQuery: extractProjectTitleQuery(input.userMessage),
    });

    if (projectMatch) {
      return { projectId: projectMatch.entity.id, limitPerComponent: 5 };
    }

    const projectQuery = extractProjectTitleQuery(input.userMessage);
    if (projectQuery) {
      return { projectQuery, limitPerComponent: 5 };
    }

    throw new AppError(
      'Tell me which learning project you mean.',
      400,
      'AI_ROUTE_UNCLEAR',
    );
  }

  if (input.route === 'PROJECT_COMPONENTS') {
    const parsed = parseProjectComponentsInput(input.userMessage);
    const projectMatch = await resolveProjectFromMessage({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
      explicitQuery: parsed.projectQuery,
    });

    if (projectMatch) {
      return { projectId: projectMatch.entity.id };
    }

    const viewer: AccessTokenPayload = { sub: input.userId, roles: ['LEARNER'] };
    if (parsed.projectQuery) {
      const projects = await getLearningProjects(
        { page: 1, limit: 5, q: parsed.projectQuery },
        viewer,
      );
      const exact = projects.items.find(
        (project) =>
          project.title.toLowerCase() === parsed.projectQuery!.toLowerCase(),
      );
      if (exact) {
        return { projectId: exact.id };
      }
      if (projects.items.length === 1) {
        return { projectId: projects.items[0]!.id };
      }
    }

    throw new AppError(
      'Tell me which learning project you mean.',
      400,
      'AI_ROUTE_UNCLEAR',
    );
  }

  if (input.route === 'PROJECT_DETAILS') {
    const explicitQuery = extractProjectTitleQuery(input.userMessage);
    const projectMatch = await resolveProjectFromMessage({
      conversationId: input.conversationId,
      userMessage: input.userMessage,
      explicitQuery,
    });
    if (projectMatch) {
      return { projectId: projectMatch.entity.id };
    }

    // Active builds only when the user explicitly means current/in-progress work.
    if (detectCurrentInProgressProjectWording(input.userMessage)) {
      const builds = await listActiveProjectBuildsForLearner(input.userId);
      const uniqueProjectIds = [
        ...new Set(
          builds
            .map((build) => build.projectId)
            .filter((projectId): projectId is string => Boolean(projectId)),
        ),
      ];
      if (uniqueProjectIds.length === 1) {
        return { projectId: uniqueProjectIds[0]! };
      }
      if (uniqueProjectIds.length > 1) {
        const locale = detectResponseLocale(input.userMessage, 'en');
        throw new AppError(
          locale === 'ar'
            ? 'عندك أكثر من مشروع قيد التنفيذ. حدّد أي واحد تقصد.'
            : 'You have more than one in-progress project. Tell me which one you mean.',
          400,
          'AI_ROUTE_UNCLEAR',
        );
      }
    }

    const locale = detectResponseLocale(input.userMessage, 'en');
    throw new AppError(
      locale === 'ar'
        ? 'حدّد أي مشروع تقصد، أو اعرض المشاريع أولاً ثم اسألني عن آخر واحد.'
        : 'Tell me which learning project you mean, or browse projects first and then ask about the latest one.',
      400,
      'AI_ROUTE_UNCLEAR',
    );
  }

  return buildToolInputForRoute(input.route, input.userMessage);
};

export type AgentTurnExecutionResult = {
  blocks: AiContentBlock[];
  usedProvider: boolean;
  providerName: string;
  model: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  route: AiAgentRouteType;
  semanticRoute?: import('./ai-agent.types.js').SemanticRoute;
};

export const executeLearnerAgentPlatformTurn = async (input: {
  userMessage: string;
  locale: AiLocale;
  conversationId: string;
  authenticatedUserId: string;
  clientMessageId: string;
  requestId: string | null;
  history: ReturnType<typeof buildBoundedConversationHistory>;
}): Promise<AgentTurnExecutionResult | null> => {
  const responseLocale = detectResponseLocale(input.userMessage, input.locale);

  const conversation = await prisma.aiConversation.findFirst({
    where: {
      id: input.conversationId,
      userId: input.authenticatedUserId,
    },
    select: {
      projectBuildId: true,
    },
  });

  if (conversation?.projectBuildId) {
    const ownershipTurn = await tryHandleBuildGuideComponentOwnershipTurn({
      userMessage: input.userMessage,
      locale: responseLocale,
      conversationId: input.conversationId,
      authenticatedUserId: input.authenticatedUserId,
      clientMessageId: input.clientMessageId,
      projectBuildId: conversation.projectBuildId,
    });
    if (ownershipTurn) {
      return ownershipTurn;
    }
  }

  const reservationContinuation = await handleReservationDraftContinuation({
    userMessage: input.userMessage,
    locale: responseLocale,
    conversationId: input.conversationId,
    authenticatedUserId: input.authenticatedUserId,
    clientMessageId: input.clientMessageId,
  });
  if (reservationContinuation) {
    return reservationContinuation;
  }

  if (conversation?.projectBuildId) {
    const materialTurn = await tryHandleBuildGuideMaterialTurn({
      userMessage: input.userMessage,
      locale: responseLocale,
      conversationId: input.conversationId,
      authenticatedUserId: input.authenticatedUserId,
      clientMessageId: input.clientMessageId,
      projectBuildId: conversation.projectBuildId,
      handleActionRequest: handleActionRequestTurn,
    });
    if (materialTurn) {
      return materialTurn;
    }

    const stepTurn = await tryHandleBuildGuideStepTurn({
      userMessage: input.userMessage,
      locale: responseLocale,
      conversationId: input.conversationId,
      authenticatedUserId: input.authenticatedUserId,
      clientMessageId: input.clientMessageId,
      projectBuildId: conversation.projectBuildId,
      history: input.history,
    });
    if (stepTurn) {
      return stepTurn;
    }
  }

  if (detectComparisonFollowUpIntent(input.userMessage)) {
    const comparisonBlock = await findLatestComparisonBlock(input.conversationId);
    if (comparisonBlock) {
      const answer = buildComparisonFollowUpAnswer({
        userMessage: input.userMessage,
        locale: responseLocale,
        block: comparisonBlock,
      });
      if (answer) {
        return {
          blocks: [textBlock(answer.text, 'answer')],
          usedProvider: false,
          providerName: 'system',
          model: null,
          latencyMs: null,
          inputTokens: null,
          outputTokens: null,
          route:
            comparisonBlock.subject === 'MATERIAL'
              ? 'MATERIAL_COMPARISON'
              : 'PROJECT_COMPARISON',
        };
      }
    }
  }

  const executionPlan = await resolveAgentExecutionPlan({
    userMessage: input.userMessage,
    locale: responseLocale,
    conversationId: input.conversationId,
  });
  const linkedBuildLearning =
    Boolean(conversation?.projectBuildId) &&
    preferLinkedBuildGuideLearning({
      hasLinkedBuild: true,
      route: executionPlan.route,
      userMessage: input.userMessage,
    });
  if (linkedBuildLearning) {
    return {
      blocks: [],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'GENERAL_LEARNING',
      semanticRoute: 'GENERAL_LEARNING',
    };
  }
  const routeDecision = {
    route: executionPlan.route,
    confidence: executionPlan.diagnostics.deterministicConfidence,
    source: executionPlan.diagnostics.semanticPlannerUsed
      ? ('planner' as const)
      : ('deterministic' as const),
  };

  const semanticRoute = executionPlan.semanticUnderstandingRoute;

  if (executionPlan.route === 'ACTION_REQUEST') {
    const actionTurn = await handleActionRequestTurn({
      userMessage: input.userMessage,
      locale: responseLocale,
      conversationId: input.conversationId,
      authenticatedUserId: input.authenticatedUserId,
      clientMessageId: input.clientMessageId,
      trustedProjectBuildId: conversation?.projectBuildId ?? undefined,
    });
    if (actionTurn) {
      return { ...actionTurn, semanticRoute };
    }
  }

  if (executionPlan.route === 'OUT_OF_SCOPE') {
    return {
      blocks: [textBlock(REFUSAL_COPY[responseLocale], 'refusal')],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'OUT_OF_SCOPE',
      semanticRoute: semanticRoute ?? 'OUT_OF_SCOPE',
    };
  }

  if (executionPlan.route === 'DANGEROUS_REQUEST') {
    return {
      blocks: [textBlock(DANGEROUS_SAFETY_COPY[responseLocale], 'safety')],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'DANGEROUS_REQUEST',
    };
  }

  if (executionPlan.route === 'CLARIFICATION') {
    if (detectComparisonFollowUpIntent(input.userMessage)) {
      const comparisonBlock = await findLatestComparisonBlock(input.conversationId);
      if (comparisonBlock) {
        const answer = buildComparisonFollowUpAnswer({
          userMessage: input.userMessage,
          locale: responseLocale,
          block: comparisonBlock,
        });
        if (answer) {
          return {
            blocks: [textBlock(answer.text, 'answer')],
            usedProvider: false,
            providerName: 'system',
            model: null,
            latencyMs: null,
            inputTokens: null,
            outputTokens: null,
            route:
              comparisonBlock.subject === 'MATERIAL'
                ? 'MATERIAL_COMPARISON'
                : 'PROJECT_COMPARISON',
          };
        }
      }
    }

    if (conversation?.projectBuildId) {
      return {
        blocks: [],
        usedProvider: false,
        providerName: 'system',
        model: null,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
        route: 'GENERAL_LEARNING',
        semanticRoute: 'GENERAL_LEARNING',
      };
    }

    return {
      blocks: [
        textBlock(
          executionPlan.clarificationReason ?? CLARIFICATION_COPY[responseLocale],
          'clarification',
        ),
      ],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'CLARIFICATION',
    };
  }

  if (executionPlan.route === 'PLATFORM_GUIDANCE') {
    const guidanceTurn = await handlePlatformGuidanceTurn({
      userMessage: input.userMessage,
      locale: responseLocale,
    });
    return { ...guidanceTurn, semanticRoute: semanticRoute ?? 'PLATFORM_GUIDANCE' };
  }

  if (executionPlan.semanticDataTopic === 'LEARNER_RESERVATION_STATUS') {
    return handleLearnerReservationStatusTurn({
      userMessage: input.userMessage,
      locale: responseLocale,
      authenticatedUserId: input.authenticatedUserId,
      semanticDataTopic: executionPlan.semanticDataTopic,
    });
  }

  if (
    executionPlan.semanticDataTopic === 'MATERIAL_RESULT_SET_FILTER' ||
    executionPlan.toolInput[TRUSTED_MATERIAL_RESULT_SET_FILTER_MARKER] === true
  ) {
    return handleMaterialResultSetFilterTurn({
      locale: responseLocale,
      conversationId: input.conversationId,
      toolInput: executionPlan.toolInput,
    });
  }

  if (executionPlan.route === 'GENERAL_LEARNING') {
    return {
      blocks: [],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'GENERAL_LEARNING',
      semanticRoute: 'GENERAL_LEARNING',
    };
  }

  if (!isPlatformRoute(routeDecision.route)) {
    return null;
  }

  const toolName = executionPlan.toolName ?? routeToToolName(routeDecision.route);
  let effectiveToolName = toolName;
  if (
    routeDecision.route === 'COMPONENT_MATERIAL_MATCHING' ||
    routeDecision.route === 'PROJECT_MATERIAL_MATCHING'
  ) {
    effectiveToolName = 'find_materials_for_project';
  }

  if (!effectiveToolName) {
    return {
      blocks: [textBlock(CLARIFICATION_COPY[responseLocale], 'clarification')],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: routeDecision.route,
    };
  }

  const executor = new AiToolExecutor();
  const context: AiToolExecutionContext = {
    authenticatedUserId: input.authenticatedUserId,
    conversationId: input.conversationId,
    locale: responseLocale,
    requestId: input.requestId,
    clientMessageId: input.clientMessageId,
  };

  let toolInput: Record<string, unknown>;
  try {
    const planHasTrustedIds =
      executionPlan.toolInput.projectId != null ||
      executionPlan.toolInput.materialId != null ||
      executionPlan.toolInput.buildId != null ||
      executionPlan.toolInput.componentId != null;
    const planHasBudgetInput =
      routeDecision.route === 'PROJECT_BUDGET_ESTIMATION' &&
      (executionPlan.toolInput.projectId != null ||
        executionPlan.toolInput.projectQuery != null);
    const planHasProjectsWithinBudgetInput =
      routeDecision.route === 'PROJECTS_WITHIN_BUDGET' &&
      typeof executionPlan.toolInput.maxBudgetNis === 'number' &&
      Number(executionPlan.toolInput.maxBudgetNis) > 0;
    const mustResolveToolInput =
      routeDecision.route === 'COMPONENT_MATERIAL_MATCHING' ||
      routeDecision.route === 'PROJECT_MATERIAL_MATCHING' ||
      routeDecision.route === 'PROJECT_MATERIAL_AVAILABILITY' ||
      routeDecision.route === 'PROJECT_BUDGET_ESTIMATION';

    toolInput =
      planHasBudgetInput ||
      planHasProjectsWithinBudgetInput ||
      (!mustResolveToolInput &&
        (routeDecision.route === 'MATERIAL_SEARCH' ||
          routeDecision.route === 'OWNED_MATERIALS_PROJECT_MATCH' ||
          planHasTrustedIds))
        ? executionPlan.toolInput
        : await resolveToolInput({
            route: routeDecision.route,
            userMessage: input.userMessage,
            conversationId: input.conversationId,
            userId: input.authenticatedUserId,
          });
  } catch (error) {
    if (error instanceof AppError) {
      const graceful = buildGracefulToolFailureResult({
        errorCode: error.code,
        responseLocale,
        route: routeDecision.route,
      });
      if (graceful) {
        return {
          ...graceful,
          blocks: aiContentBlocksSchema.parse(graceful.blocks),
        };
      }

      if (error.code === 'AI_ROUTE_UNCLEAR') {
        if (conversation?.projectBuildId) {
          return {
            blocks: [],
            usedProvider: false,
            providerName: 'system',
            model: null,
            latencyMs: null,
            inputTokens: null,
            outputTokens: null,
            route: 'GENERAL_LEARNING',
            semanticRoute: 'GENERAL_LEARNING',
          };
        }
        return {
          blocks: [textBlock(CLARIFICATION_COPY[responseLocale], 'clarification')],
          usedProvider: false,
          providerName: 'system',
          model: null,
          latencyMs: null,
          inputTokens: null,
          outputTokens: null,
          route: routeDecision.route,
        };
      }
    }

    throw error;
  }

  const toolResult = await executor.execute(
    { name: effectiveToolName, input: toolInput },
    context,
  );

  if (!toolResult.ok) {
    const graceful = buildGracefulToolFailureResult({
      errorCode: toolResult.errorCode,
      responseLocale,
      route: routeDecision.route,
    });
    if (graceful) {
      return {
        ...graceful,
        blocks: aiContentBlocksSchema.parse(graceful.blocks),
      };
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
    count?: number;
  };
  const trustedBlocks = data.blocks ?? (data.block ? [data.block] : []);
  const resultCount =
    typeof data.count === 'number'
      ? data.count
      : data.block?.type === 'material_results'
        ? data.block.items.length
        : data.block?.type === 'project_results'
          ? data.block.items.length
          : null;

  let providerName = 'system';
  let model: string | null = null;
  let latencyMs: number | null = toolResult.durationMs;
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let explanationBlocks: AiContentBlock[] = [];

  if (
    trustedBlocks.length > 0 &&
    trustedBlocks[0]?.type === 'material_results' &&
    resultCount != null
  ) {
    explanationBlocks = [textBlock(buildMaterialResultsIntro(resultCount, responseLocale))];
  } else if (
    trustedBlocks.length > 0 &&
    trustedBlocks[0]?.type === 'project_results'
  ) {
    explanationBlocks = [
      textBlock(buildProjectResultsIntro(trustedBlocks[0] as Extract<AiContentBlock, { type: 'project_results' }>, responseLocale)),
    ];
  } else if (
    trustedBlocks.length > 0 &&
    trustedBlocks[0]?.type === 'component_list'
  ) {
    const componentBlock = trustedBlocks[0];
    explanationBlocks = [
      textBlock(
        buildProjectComponentsIntro(
          responseLocale,
          componentBlock.type === 'component_list'
            ? componentBlock.projectTitle
            : undefined,
        ),
      ),
    ];
  } else if (
    routeDecision.route === 'PROJECT_BUDGET_ESTIMATION' &&
    trustedBlocks.some((block) => block.type === 'project_budget_estimate')
  ) {
    const projectBlock = trustedBlocks.find((block) => block.type === 'project_results');
    const budgetBlock = trustedBlocks.find(
      (block) => block.type === 'project_budget_estimate',
    );
    const title =
      projectBlock?.type === 'project_results'
        ? projectBlock.items[0]?.title
        : budgetBlock?.type === 'project_budget_estimate'
          ? budgetBlock.projectTitle
          : undefined;
    const estimateStatus =
      budgetBlock?.type === 'project_budget_estimate'
        ? budgetBlock.estimateStatus
        : undefined;
    explanationBlocks = [
      textBlock(
        buildProjectBudgetEstimationIntro(responseLocale, title, estimateStatus),
      ),
    ];
  } else if (
    routeDecision.route === 'PROJECT_MATERIAL_AVAILABILITY' &&
    trustedBlocks.some((block) => block.type === 'component_matches')
  ) {
    const projectBlock = trustedBlocks.find((block) => block.type === 'project_results');
    const title =
      projectBlock?.type === 'project_results'
        ? projectBlock.items[0]?.title
        : undefined;
    explanationBlocks = [
      textBlock(buildProjectMaterialAvailabilityIntro(responseLocale, title)),
    ];
  } else if (
    trustedBlocks.length > 0 &&
    trustedBlocks.some((block) => block.type === 'component_matches')
  ) {
    explanationBlocks = [
      textBlock(buildComponentMatchesIntro(trustedBlocks, responseLocale)),
    ];
  } else if (
    trustedBlocks.length > 0 &&
    trustedBlocks.some((block) => block.type === 'recommendations')
  ) {
    explanationBlocks = [
      textBlock(buildPersonalizedRecommendationIntro(trustedBlocks, responseLocale)),
    ];
  } else if (
    trustedBlocks.length > 0 &&
    routeDecision.route !== 'PROJECTS_WITHIN_BUDGET' &&
    !trustedBlocks.some((block) => block.type === 'component_matches') &&
    !trustedBlocks.some((block) => block.type === 'project_results') &&
    isAiChatProviderOperational()
  ) {
    try {
      const synthesis = await synthesizePlatformAnswer({
        locale: responseLocale,
        userMessage: input.userMessage,
        history: input.history,
        trustedSummary: buildTrustedSummary(toolResult.data),
      });

      explanationBlocks = synthesis.textBlocks;
      providerName = synthesis.provider;
      model = synthesis.model;
      latencyMs = (latencyMs ?? 0) + (synthesis.latencyMs ?? 0);
      inputTokens = synthesis.inputTokens;
      outputTokens = synthesis.outputTokens;
    } catch (error) {
      logger.warn(
        {
          conversationId: input.conversationId,
          route: routeDecision.route,
          toolName,
          error: error instanceof Error ? error.message : 'unknown',
        },
        'AI platform synthesis failed; returning trusted blocks only',
      );
    }
  }

  const fallbackText =
    responseLocale === 'ar'
      ? 'هذه نتائج موثوقة من ImpactLoop:'
      : 'Here are trusted ImpactLoop results:';

  const blocks = assembleTrustedResponseBlocks({
    explanationBlocks,
    trustedBlocks,
    fallbackText,
  });

  logger.info(
    {
      conversationId: input.conversationId,
      route: routeDecision.route,
      toolName,
      trustedBlockTypes: trustedBlocks.map((block) => block.type),
      synthesisUsed: explanationBlocks.length > 0 && providerName !== 'system',
      semanticPlannerUsed: executionPlan.diagnostics.semanticPlannerUsed,
      normalizedFilters: executionPlan.diagnostics.normalizedFilters as SafeLogValue | null,
      resultCount,
    },
    'learner agent platform turn completed',
  );

  return {
    blocks: aiContentBlocksSchema.parse(blocks),
    usedProvider: explanationBlocks.length > 0,
    providerName,
    model,
    latencyMs,
    inputTokens,
    outputTokens,
    route: routeDecision.route,
  };
};

export const shouldUseAgentRouting = (userMessage: string, locale: AiLocale): boolean => {
  const materialIntent = detectMaterialSearchIntent(userMessage);
  if (materialIntent.detected) {
    return true;
  }
  const route = resolveAgentRoute({ userMessage, locale }).route;
  return isPlatformRoute(route);
};

export const resolveStaticAgentResponse = (
  userMessage: string,
  locale: AiLocale,
): AiContentBlock[] | null => {
  const route = resolveAgentRoute({ userMessage, locale });

  if (route.route === 'OUT_OF_SCOPE') {
    return [textBlock(REFUSAL_COPY[locale], 'refusal')];
  }

  if (route.route === 'PLATFORM_GUIDANCE') {
    const topic = detectPlatformGuidanceIntent(userMessage) ?? 'GENERAL_PLATFORM';
    return [textBlock(buildPlatformGuidanceResponse(topic, locale), 'answer')];
  }

  const conversationalIntent = detectConversationalIntent(userMessage);
  if (route.route === 'CONVERSATIONAL_STATIC' && conversationalIntent !== 'NONE') {
    return [
      textBlock(buildConversationalResponseText(conversationalIntent, locale)),
    ];
  }

  return null;
};
