import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  getMaterialById,
} from '../materials/materials.service.js';
import {
  getLearningProjectById,
  getOwnedProjectBuildByBuildId,
} from '../learning-projects/learning-projects.service.js';
import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';
import type { AiPendingActionType, Prisma } from '../../generated/prisma/client.js';
import { findOwnedConversation } from './ai.repository.js';
import {
  aiActionConfirmationBlockSchema,
  type AiContentBlock,
} from './ai.content-blocks.js';
import {
  assertNoForbiddenPayloadFields,
  linkMaterialToBuildPayloadSchema,
  parseVersionedActionPayload,
  reservationPayloadSchema,
  saveMaterialPayloadSchema,
  saveProjectPayloadSchema,
  startProjectBuildPayloadSchema,
  unlinkMaterialFromBuildPayloadSchema,
  unsaveMaterialPayloadSchema,
  unsaveProjectPayloadSchema,
  updateBuildComponentStatusesPayloadSchema,
  completeCurrentBuildStepPayloadSchema,
  applyProjectAuthoringProposalPayloadSchema,
  type VersionedActionPayload,
} from './ai-action.payloads.js';

const ACTION_EXPIRY_MS = 10 * 60 * 1000;

export type PreparedActionResult = {
  block: AiContentBlock;
  pendingActionId: string;
};

const buildViewer = (userId: string) => ({ sub: userId, roles: ['LEARNER'] });

export const buildActionViewer = buildViewer;

const assertOwnedConversation = async (conversationId: string, userId: string) => {
  const conversation = await findOwnedConversation({ conversationId, userId });
  if (!conversation) {
    throw new AppError('Conversation not found.', 404, 'AI_CONVERSATION_NOT_FOUND');
  }
  return conversation;
};

export const assertOwnedAiActionConversation = assertOwnedConversation;

export const customizeActionConfirmationLabels = (
  block: AiContentBlock,
  labels: { confirmLabel: string; cancelLabel: string },
): AiContentBlock => {
  if (block.type !== 'action_confirmation') {
    throw new AppError('Expected action_confirmation block.', 500, 'AI_RESPONSE_INVALID');
  }

  return aiActionConfirmationBlockSchema.parse({
    ...block,
    confirmLabel: labels.confirmLabel,
    cancelLabel: labels.cancelLabel,
  });
};

const buildConfirmationBlock = (input: {
  pendingActionId: string;
  actionType: AiPendingActionType;
  title: string;
  summary: string;
  target: {
    type: 'MATERIAL' | 'PROJECT' | 'BUILD' | 'COMPONENT' | 'RESERVATION';
    id: string;
    title: string;
  };
  locale: 'en' | 'ar';
  expiresAt: Date;
}): AiContentBlock => ({
  type: 'action_confirmation',
  pendingActionId: input.pendingActionId,
  actionType: input.actionType,
  title: input.title,
  summary: input.summary,
  target: input.target,
  expiresAt: input.expiresAt.toISOString(),
  confirmLabel: input.locale === 'ar' ? 'تأكيد' : 'Confirm',
  cancelLabel: input.locale === 'ar' ? 'إلغاء' : 'Cancel',
});

const buildResultBlock = (input: {
  actionType: AiPendingActionType;
  status: 'EXECUTED' | 'FAILED' | 'CANCELLED';
  title: string;
  summary: string;
  target?: {
    type: 'MATERIAL' | 'PROJECT' | 'BUILD' | 'COMPONENT' | 'RESERVATION';
    id: string;
    title: string;
  };
  navigation?: { route: string; id: string };
}): Extract<AiContentBlock, { type: 'action_result' }> => ({
  type: 'action_result',
  actionType: input.actionType,
  status: input.status,
  title: input.title,
  summary: input.summary,
  target: input.target,
  navigation: input.navigation,
});

const resolveCancelledTarget = (
  actionType: AiPendingActionType,
  payload: ReturnType<typeof parseVersionedActionPayload>,
): {
  type: 'MATERIAL' | 'PROJECT' | 'BUILD' | 'COMPONENT' | 'RESERVATION';
  id: string;
  title: string;
} | undefined => {
  const snapshotTitle = payload.displaySnapshot.title;

  if ('materialId' in payload.target && payload.target.materialId) {
    return {
      type: 'MATERIAL',
      id: payload.target.materialId,
      title: snapshotTitle,
    };
  }

  if ('projectId' in payload.target && payload.target.projectId) {
    return {
      type: 'PROJECT',
      id: payload.target.projectId,
      title: snapshotTitle,
    };
  }

  if ('buildId' in payload.target && payload.target.buildId) {
    return {
      type: 'BUILD',
      id: payload.target.buildId,
      title: snapshotTitle,
    };
  }

  if (actionType === 'CONFIRM_MATERIAL_RESERVATION' && 'materialId' in payload.target) {
    return {
      type: 'RESERVATION',
      id: payload.target.materialId,
      title: snapshotTitle,
    };
  }

  return undefined;
};

export const buildActionResultBlock = buildResultBlock;
export const resolveAiActionCancelledTarget = resolveCancelledTarget;
export const AI_ACTION_EXPIRY_MS = ACTION_EXPIRY_MS;

const loadPreparedDisplay = async (
  actionType: AiPendingActionType,
  rawPayload: unknown,
  locale: 'en' | 'ar',
  viewer: ReturnType<typeof buildViewer>,
) => {
  switch (actionType) {
    case 'SAVE_MATERIAL':
    case 'UNSAVE_MATERIAL':
    case 'CONFIRM_MATERIAL_RESERVATION': {
      const payload =
        actionType === 'CONFIRM_MATERIAL_RESERVATION'
          ? reservationPayloadSchema.parse(rawPayload)
          : actionType === 'UNSAVE_MATERIAL'
            ? unsaveMaterialPayloadSchema.parse(rawPayload)
            : saveMaterialPayloadSchema.parse(rawPayload);
      const material = await getMaterialById(payload.target.materialId, viewer);
      return {
        title:
          actionType === 'SAVE_MATERIAL'
            ? locale === 'ar'
              ? 'حفظ هذه المادة؟'
              : 'Save this material?'
            : actionType === 'UNSAVE_MATERIAL'
              ? locale === 'ar'
                ? 'إلغاء حفظ المادة؟'
                : 'Unsave this material?'
              : locale === 'ar'
                ? 'تأكيد الحجز؟'
                : 'Confirm reservation?',
        summary: material.title,
        targetTitle: material.title,
        targetType: 'MATERIAL' as const,
        targetId: material.id,
        displaySnapshot: {
          title: material.title,
          summary: material.title,
          priceLabel: material.isFree ? (locale === 'ar' ? 'مجاني' : 'Free') : undefined,
          locationLabel: 'city' in material ? material.city : undefined,
        },
      };
    }
    case 'SAVE_PROJECT':
    case 'UNSAVE_PROJECT':
    case 'START_PROJECT_BUILD': {
      const payload =
        actionType === 'UNSAVE_PROJECT'
          ? unsaveProjectPayloadSchema.parse(rawPayload)
          : actionType === 'START_PROJECT_BUILD'
            ? startProjectBuildPayloadSchema.parse(rawPayload)
            : saveProjectPayloadSchema.parse(rawPayload);
      const projectRecord = await learningProjectsRepository.findPublicLearningProjectById(
        payload.target.projectId,
      );
      if (!projectRecord) {
        throw new AppError('Learning project not found', 404, 'NOT_FOUND');
      }
      const project = await getLearningProjectById(projectRecord.id, viewer);
      return {
        title:
          actionType === 'SAVE_PROJECT'
            ? locale === 'ar'
              ? 'حفظ هذا المشروع؟'
              : 'Save this project?'
            : actionType === 'UNSAVE_PROJECT'
              ? locale === 'ar'
                ? 'إلغاء حفظ المشروع؟'
                : 'Unsave this project?'
              : locale === 'ar'
                ? 'بدء بناء المشروع؟'
                : 'Start this project build?',
        summary: project.title,
        targetTitle: project.title,
        targetType: 'PROJECT' as const,
        targetId: project.id,
        displaySnapshot: {
          title: project.title,
          summary: project.shortDescription ?? project.title,
        },
      };
    }
    case 'LINK_MATERIAL_TO_BUILD_COMPONENT': {
      const payload = linkMaterialToBuildPayloadSchema.parse(rawPayload);
      const material = await getMaterialById(payload.target.materialId, viewer);
      const build = await getOwnedProjectBuildByBuildId(
        payload.target.buildId,
        viewer.sub,
      );
      const project = await getLearningProjectById(payload.target.projectId, viewer);
      const buildItem = build?.items.find((item) => item.id === payload.target.buildItemId);
      const componentName = buildItem?.component.componentName ?? 'Component';
      const materialTitle = material.title;
      const projectTitle = project.title;
      const summary =
        locale === 'ar'
          ? `المادة: ${materialTitle}\nالمكوّن: ${componentName}\nالمشروع: ${projectTitle}`
          : `Material: ${materialTitle}\nComponent: ${componentName}\nProject: ${projectTitle}`;
      return {
        title: locale === 'ar' ? 'ربط مادة بالمكوّن' : 'Link material to component',
        summary,
        targetTitle: componentName,
        targetType: 'COMPONENT' as const,
        targetId: payload.target.buildItemId,
        displaySnapshot: {
          title: materialTitle,
          summary: componentName,
          locationLabel: projectTitle,
        },
      };
    }
    case 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT': {
      const payload = unlinkMaterialFromBuildPayloadSchema.parse(rawPayload);
      return {
        title:
          locale === 'ar'
            ? 'إلغاء ربط المادة بالمكون؟'
            : 'Unlink material from component?',
        summary: payload.displaySnapshot.summary ?? payload.displaySnapshot.title,
        targetTitle: payload.displaySnapshot.title,
        targetType: 'COMPONENT' as const,
        targetId: payload.target.buildItemId,
        displaySnapshot: payload.displaySnapshot,
      };
    }
    case 'UPDATE_BUILD_COMPONENT_STATUSES': {
      const payload = updateBuildComponentStatusesPayloadSchema.parse(rawPayload);
      const statusLabel =
        payload.parameters.targetStatus === 'ALREADY_OWNED'
          ? locale === 'ar'
            ? 'موجودة لديك'
            : 'Already owned'
          : locale === 'ar'
            ? 'غير موجودة'
            : 'Missing';
      const componentLines = payload.parameters.items
        .map((item) => `- ${item.componentName}`)
        .join('\n');
      return {
        title:
          payload.parameters.targetStatus === 'ALREADY_OWNED'
            ? locale === 'ar'
              ? 'تحديد المكونات كموجودة لديك؟'
              : 'Mark components as already owned?'
            : locale === 'ar'
              ? 'تحديد المكونات كغير موجودة؟'
              : 'Mark components as missing?',
        summary:
          locale === 'ar'
            ? `سيتم تحديد المكونات التالية كـ${statusLabel}:\n${componentLines}`
            : `I will mark these components as ${statusLabel.toLowerCase()}:\n${componentLines}`,
        targetTitle: payload.displaySnapshot.title,
        targetType: 'BUILD' as const,
        targetId: payload.target.buildId,
        displaySnapshot: payload.displaySnapshot,
      };
    }
    case 'COMPLETE_CURRENT_BUILD_STEP': {
      const payload = completeCurrentBuildStepPayloadSchema.parse(rawPayload);
      const build = await getOwnedProjectBuildByBuildId(
        payload.target.buildId,
        viewer.sub,
      );
      if (!build) {
        throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
      }
      const remainingAfter =
        build.stepProgress.total - build.stepProgress.completed - 1;
      const nextHint =
        remainingAfter > 0
          ? locale === 'ar'
            ? ' بعد التأكيد ستفتح الخطوة التالية.'
            : ' The next step will open after confirmation.'
          : locale === 'ar'
            ? ' هذه هي الخطوة الأخيرة.'
            : ' This is the final step.';
      return {
        title:
          locale === 'ar'
            ? `هل أنهيت الخطوة ${payload.parameters.stepNumber}: ${payload.parameters.stepTitle}؟`
            : `Did you finish Step ${payload.parameters.stepNumber}: ${payload.parameters.stepTitle}?`,
        summary:
          locale === 'ar'
            ? `التقدم الحالي: ${build.stepProgress.percent}%.${nextHint}`
            : `Current progress: ${build.stepProgress.percent}%.${nextHint}`,
        targetTitle: build.project.title,
        targetType: 'BUILD' as const,
        targetId: payload.target.buildId,
        displaySnapshot: payload.displaySnapshot,
      };
    }
    case 'APPLY_PROJECT_AUTHORING_PROPOSAL': {
      const payload = applyProjectAuthoringProposalPayloadSchema.parse(rawPayload);
      return {
        title:
          locale === 'ar'
            ? 'تطبيق الاقتراح المراجع على المسودة؟'
            : 'Apply reviewed proposal to draft?',
        summary: payload.displaySnapshot.summary ?? payload.displaySnapshot.title,
        targetTitle: payload.displaySnapshot.title,
        targetType: 'PROJECT' as const,
        targetId: payload.target.projectId,
        displaySnapshot: payload.displaySnapshot,
      };
    }
    default:
      throw new AppError('Action is not supported.', 400, 'AI_ACTION_NOT_SUPPORTED');
  }
};

export const prepareAiPendingAction = async (input: {
  userId: string;
  conversationId: string;
  actionType: AiPendingActionType;
  payload: VersionedActionPayload;
  idempotencyKey: string;
  locale: 'en' | 'ar';
}): Promise<PreparedActionResult> => {
  await assertOwnedConversation(input.conversationId, input.userId);
  assertNoForbiddenPayloadFields(input.payload as unknown as Record<string, unknown>);
  parseVersionedActionPayload(input.actionType, input.payload);

  const existing = await prisma.aiPendingAction.findUnique({
    where: {
      userId_idempotencyKey: {
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    },
  });

  if (existing?.status === 'EXECUTED' && existing.result) {
    return {
      pendingActionId: existing.id,
      block: existing.result as AiContentBlock,
    };
  }

  const expiresAt = new Date(Date.now() + ACTION_EXPIRY_MS);
  const viewer = buildViewer(input.userId);
  const prepared = await loadPreparedDisplay(
    input.actionType,
    input.payload,
    input.locale,
    viewer,
  );

  const confirmationBlock = buildConfirmationBlock({
    pendingActionId: 'pending',
    actionType: input.actionType,
    title: prepared.title,
    summary: prepared.summary,
    target: {
      type: prepared.targetType,
      id: prepared.targetId,
      title: prepared.targetTitle,
    },
    locale: input.locale,
    expiresAt,
  });

  const action = await prisma.aiPendingAction.upsert({
    where: {
      userId_idempotencyKey: {
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
      },
    },
    create: {
      userId: input.userId,
      conversationId: input.conversationId,
      actionType: input.actionType,
      payload: input.payload as Prisma.InputJsonValue,
      displaySnapshot: confirmationBlock as Prisma.InputJsonValue,
      idempotencyKey: input.idempotencyKey,
      expiresAt,
    },
    update: {
      status: 'PENDING',
      conversationId: input.conversationId,
      expiresAt,
      displaySnapshot: confirmationBlock as Prisma.InputJsonValue,
      payload: input.payload as Prisma.InputJsonValue,
      errorCode: null,
      result: undefined,
    },
  });

  return {
    pendingActionId: action.id,
    block: {
      ...confirmationBlock,
      pendingActionId: action.id,
    } as AiContentBlock,
  };
};
