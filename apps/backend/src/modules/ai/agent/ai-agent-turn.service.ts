import { env, isAiChatProviderOperational } from '../../../config/env.js';
import { AppError } from '../../../utils/app-error.js';
import { logger } from '../../../observability/logger.js';
import {
  buildBoundedConversationHistory,
  parseStoredContentBlocks,
} from '../ai-context-builder.js';
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
} from '../ai.policy.js';
import {
  assessDangerousRequest,
  DANGEROUS_SAFETY_COPY,
} from './ai-agent-safety-guard.service.js';
import { getAiChatProvider } from '../providers/ai-chat-provider.factory.js';
import type { AiLocale } from '../ai.types.js';
import { prepareAiPendingAction, buildMaterialSavePayload, buildProjectSavePayload, buildStartBuildPayload, buildLinkMaterialPayload, buildUnsaveMaterialPayload, buildUnsaveProjectPayload, buildUnlinkMaterialPayload, buildReservationPayload, saveReservationDraft, cancelReservationDraft, findActiveReservationDraft } from '../ai-action.service.js';
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
import { detectComparisonFollowUpIntent, extractProjectTitleQuery } from './ai-agent-filter-extractor.service.js';
import type { AiAgentRouteType, AiToolExecutionContext } from './ai-agent.types.js';
import { AiToolExecutor } from './ai-tool-executor.service.js';
import { mergeAgentBlocks } from './ai-tool-mappers.js';
import {
  buildExternalSourcesBlock,
  searchExternalDomainKnowledge,
} from '../ai-external-knowledge.service.js';

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
    (/(فك الربط|فك ربط|unlink)/i.test(text) && /(مكون|component|هالمكون|هالكومبوننت)/i.test(text)) ||
    (/(الغ|إلغاء|unlink).*(ربط|link)/i.test(text) && /(مادة|material|مكون|component)/i.test(text))
  ) {
    return 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT';
  }
  if (/\bunlink\b/i.test(text) && /\b(material|component)\b/i.test(text)) {
    return 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT';
  }
  if (/(اربط|link).*(مادة|material)/i.test(text) && !/\bunlink\b/i.test(text)) {
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

const parseReservationParameters = (userMessage: string) => {
  const trimmed = userMessage.trim();
  const quantityMatch =
    userMessage.match(/(?:كمية|quantity)\s*[:：]?\s*(\d+(?:\.\d+)?)/i) ??
    userMessage.match(/(\d+(?:\.\d+)?)\s*(?:قطعة|piece|units?)/i);
  let quantity = quantityMatch ? Number(quantityMatch[1]) : null;
  if (quantity == null) {
    if (/^(\d+(?:\.\d+)?)$/.test(trimmed)) {
      quantity = Number(trimmed);
    } else if (/^(واحد|واحدة|قطعة واحدة)$/i.test(trimmed)) {
      quantity = 1;
    } else if (/^بدي\s+(?:قطعة|وحدة)$/i.test(trimmed)) {
      quantity = 1;
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
  const trimmed = userMessage.trim();
  if (/^(\d+(?:\.\d+)?)$/.test(trimmed)) {
    return true;
  }
  if (/^(واحد|واحدة|قطعة واحدة)$/i.test(trimmed)) {
    return true;
  }
  if (/^بدي\s+(?:قطعة|وحدة)$/i.test(trimmed)) {
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
}) => {
  const viewer = { sub: input.authenticatedUserId, roles: ['LEARNER'] as const };

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
    let buildId = await resolveLatestBuildId(input.conversationId);
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
    await cancelReservationDraft({
      conversationId: input.conversationId,
      userId: input.authenticatedUserId,
    });
    return null;
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

  const viewer = { sub: input.authenticatedUserId, roles: ['LEARNER'] as const };
  const material = await getMaterialById(draftPayload.target.materialId, viewer);
  const prepared = await prepareAiPendingAction({
    userId: input.authenticatedUserId,
    conversationId: input.conversationId,
    actionType: 'CONFIRM_MATERIAL_RESERVATION',
    payload: buildReservationPayload({
      materialId: material.id,
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

const handleActionRequestTurn = async (input: {
  userMessage: string;
  locale: AiLocale;
  conversationId: string;
  authenticatedUserId: string;
  clientMessageId: string;
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

  if (actionType === 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT') {
    const built = await buildActionPayload({
      actionType,
      targetId: '',
      referenceKind: 'COMPONENT',
      userMessage: input.userMessage,
      conversationId: input.conversationId,
      authenticatedUserId: input.authenticatedUserId,
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

    if (built && !('error' in built)) {
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
      (
        await resolveBuildIdForUserMessage({
          conversationId: input.conversationId,
          userMessage: input.userMessage,
          userId: input.authenticatedUserId,
        })
      )?.buildId ??
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
      blocks: [textBlock(reservationClarification(input.locale, built.missing), 'clarification')],
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
            ? 'لم أجد مصادر خارجية موثوقة لهذا السؤال.'
            : 'I could not find trustworthy external references for this question.',
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
  const trustedSummary = JSON.stringify({
    query: input.userMessage,
    externalReferences: search.results,
  }).slice(0, 4_000);

  const synthesis = await provider.generateGeneralLearningAnswer({
    locale: input.locale,
    userMessage: [
      input.userMessage,
      '',
      'Use only the external references below. Do not invent citations or URLs.',
      'Distinguish external references from ImpactLoop inventory or platform data.',
      'If the references are insufficient, say so clearly.',
      trustedSummary,
    ].join('\n'),
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

const PLATFORM_ROUTES = new Set<AiAgentRouteType>([
  'MATERIAL_SEARCH',
  'MATERIAL_DETAILS',
  'PROJECT_SEARCH',
  'PROJECT_DETAILS',
  'PROJECT_COMPONENTS',
  'SAVED_PROJECTS',
  'ACTIVE_PROJECT_BUILDS',
  'BUILD_CHECKLIST',
  'BUILD_GAP_ANALYSIS',
  'COMPONENT_MATERIAL_MATCHING',
  'PROJECT_MATERIAL_MATCHING',
  'MATERIAL_COMPARISON',
  'PROJECT_COMPARISON',
  'PERSONALIZED_RECOMMENDATION',
]);

const textBlock = (
  text: string,
  purpose: 'answer' | 'refusal' | 'clarification' | 'safety' = 'answer',
): AiContentBlock => ({
  type: 'text',
  text,
  purpose,
});

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
            ? 'حدّث موقعك المحفوظ في الملف الشخصي للبحث عن مواد قريبة منك.'
            : 'Update your saved location in profile settings to search nearby materials.',
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

const buildProjectResultsIntro = (
  block: Extract<AiContentBlock, { type: 'project_results' }>,
  locale: AiLocale,
): string => {
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

const formatComponentNameList = (names: string[], locale: AiLocale): string => {
  if (names.length <= 1) {
    return names[0] ?? '';
  }

  if (locale === 'ar') {
    return `${names.slice(0, -1).join(' و')}${names.length > 1 ? ' و' : ''}${names[names.length - 1]}`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};

export const buildComponentMatchesIntro = (
  trustedBlocks: AiContentBlock[],
  locale: AiLocale,
): string => {
  const matchBlock = trustedBlocks.find((block) => block.type === 'component_matches');
  if (matchBlock?.type !== 'component_matches') {
    return locale === 'ar'
      ? 'هذه مواد مطابقة من ImpactLoop:'
      : 'Here are matching materials from ImpactLoop:';
  }

  const componentNames = matchBlock.groups.map((group) => group.componentName).filter(Boolean);
  const joined = formatComponentNameList(componentNames, locale);
  return locale === 'ar'
    ? `وجدت مواد مطابقة للمكونات الناقصة: ${joined}.`
    : `I found matching materials for missing components: ${joined}.`;
};

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
      const localeHint = input.explanationBlocks[0]?.text ?? '';
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

    const viewer = { sub: input.userId, roles: ['LEARNER'] as const };
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

  const initialRoute = resolveAgentRoute({
    userMessage: input.userMessage,
    locale: responseLocale,
  });

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

  if (initialRoute.route === 'ACTION_REQUEST') {
    return handleActionRequestTurn({
      userMessage: input.userMessage,
      locale: responseLocale,
      conversationId: input.conversationId,
      authenticatedUserId: input.authenticatedUserId,
      clientMessageId: input.clientMessageId,
    });
  }

  if (initialRoute.route === 'EXTERNAL_DOMAIN_KNOWLEDGE') {
    return handleExternalDomainKnowledgeTurn({
      userMessage: input.userMessage,
      locale: responseLocale,
      requestId: input.requestId,
      history: input.history,
    });
  }

  const executionPlan = await resolveAgentExecutionPlan({
    userMessage: input.userMessage,
    locale: responseLocale,
    conversationId: input.conversationId,
  });
  const routeDecision = {
    route: executionPlan.route,
    confidence: executionPlan.diagnostics.deterministicConfidence,
    source: executionPlan.diagnostics.semanticPlannerUsed
      ? ('planner' as const)
      : ('deterministic' as const),
  };

  if (executionPlan.route === 'OUT_OF_SCOPE') {
    const deterministicScope = classifyScopeDeterministic(input.userMessage);
    if (deterministicScope.classification === 'DOMAIN_KNOWLEDGE') {
      return null;
    }

    return {
      blocks: [textBlock(REFUSAL_COPY[responseLocale], 'refusal')],
      usedProvider: false,
      providerName: 'system',
      model: null,
      latencyMs: null,
      inputTokens: null,
      outputTokens: null,
      route: 'OUT_OF_SCOPE',
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

  if (executionPlan.route === 'GENERAL_LEARNING') {
    return null;
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
    const mustResolveToolInput =
      routeDecision.route === 'COMPONENT_MATERIAL_MATCHING' ||
      routeDecision.route === 'PROJECT_MATERIAL_MATCHING';

    toolInput =
      !mustResolveToolInput &&
      (routeDecision.route === 'MATERIAL_SEARCH' || planHasTrustedIds)
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
      normalizedFilters: executionPlan.diagnostics.normalizedFilters,
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

  const conversationalIntent = detectConversationalIntent(userMessage);
  if (route.route === 'CONVERSATIONAL_STATIC' && conversationalIntent !== 'NONE') {
    return [
      textBlock(buildConversationalResponseText(conversationalIntent, locale)),
    ];
  }

  return null;
};
