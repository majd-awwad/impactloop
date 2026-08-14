import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  likeMaterialById,
  unlikeMaterialById,
  getMaterialById,
} from '../materials/materials.service.js';
import {
  getLearningProjectById,
  linkBuildItemMaterialById,
  saveLearningProjectById,
  startProjectBuildById,
  unlinkBuildItemMaterialById,
  unsaveLearningProjectById,
  getOwnedProjectBuildByBuildId,
  completeProjectBuildStepById,
  applyReviewedAuthoringProposalToMyDraft,
} from '../learning-projects/learning-projects.service.js';
import { invalidateLearnerHomeCache } from '../learner-home/learner-home.service.js';
import { createReservation } from '../reservations/reservations.service.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';
import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';
import {
  aiActionConfirmationBlockSchema,
  type AiContentBlock,
} from './ai.content-blocks.js';
import { z } from 'zod';
import type { AiPendingActionType, Prisma } from '../../generated/prisma/client.js';
import {
  appendActionResultToAssistantMessage,
  findOwnedConversation,
} from './ai.repository.js';
import {
  customizeActionConfirmationLabels,
  prepareAiPendingAction,
  buildActionResultBlock,
  buildActionViewer,
  assertOwnedAiActionConversation,
  resolveAiActionCancelledTarget,
  AI_ACTION_EXPIRY_MS,
  type PreparedActionResult,
} from './ai-action.pending.js';
import { persistAppliedReviewStateAfterConfirm } from './ai-project-authoring-review.persistence.js';
import {
  applyProjectAuthoringProposalPayloadSchema,
  completeCurrentBuildStepPayloadSchema,
  linkMaterialToBuildPayloadSchema,
  parseVersionedActionPayload,
  prepareMaterialReservationPayloadSchema,
  reservationPayloadSchema,
  saveMaterialPayloadSchema,
  saveProjectPayloadSchema,
  startProjectBuildPayloadSchema,
  unlinkMaterialFromBuildPayloadSchema,
  unsaveMaterialPayloadSchema,
  unsaveProjectPayloadSchema,
  updateBuildComponentStatusesPayloadSchema,
  type VersionedActionPayload,
} from './ai-action.payloads.js';

const buildResultBlock = buildActionResultBlock;
const buildViewer = buildActionViewer;
const assertOwnedConversation = assertOwnedAiActionConversation;
const resolveCancelledTarget = resolveAiActionCancelledTarget;
const ACTION_EXPIRY_MS = AI_ACTION_EXPIRY_MS;

export { customizeActionConfirmationLabels, prepareAiPendingAction } from './ai-action.pending.js';
export type { PreparedActionResult } from './ai-action.pending.js';

const acquireActionExecution = async (input: {
  userId: string;
  pendingActionId: string;
}) => {
  const action = await prisma.aiPendingAction.findFirst({
    where: {
      id: input.pendingActionId,
      userId: input.userId,
    },
  });

  if (!action) {
    throw new AppError('Pending action not found.', 404, 'AI_ACTION_NOT_FOUND');
  }

  if (action.status === 'EXECUTED' && action.result) {
    return { action, alreadyExecuted: true as const };
  }

  if (action.status === 'CANCELLED') {
    throw new AppError('Action was cancelled.', 409, 'AI_ACTION_CANCELLED');
  }

  if (action.status === 'FAILED') {
    throw new AppError(
      action.errorCode ?? 'Action failed previously.',
      409,
      action.errorCode ?? 'AI_ACTION_EXECUTION_FAILED',
    );
  }

  if (action.expiresAt.getTime() < Date.now()) {
    await prisma.aiPendingAction.updateMany({
      where: { id: action.id, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });
    throw new AppError('Action expired.', 409, 'AI_ACTION_EXPIRED');
  }

  if (action.status === 'EXECUTING') {
    throw new AppError('Action is already executing.', 409, 'AI_ACTION_EXECUTING');
  }

  const acquired = await prisma.aiPendingAction.updateMany({
    where: {
      id: action.id,
      userId: input.userId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    data: {
      status: 'EXECUTING',
      confirmedAt: new Date(),
    },
  });

  if (acquired.count === 0) {
    const latest = await prisma.aiPendingAction.findUnique({
      where: { id: action.id },
    });
    if (latest?.status === 'EXECUTED' && latest.result) {
      return { action: latest, alreadyExecuted: true as const };
    }
    if (latest?.status === 'EXECUTING') {
      throw new AppError('Action is already executing.', 409, 'AI_ACTION_EXECUTING');
    }
    throw new AppError('Action is no longer pending.', 409, 'AI_ACTION_CONFLICT');
  }

  return {
    action: { ...action, status: 'EXECUTING' as const },
    alreadyExecuted: false as const,
  };
};

const executeConfirmedAction = async (input: {
  userId: string;
  actionType: AiPendingActionType;
  payload: unknown;
  locale: 'en' | 'ar';
}) => {
  const viewer = buildViewer(input.userId);

  switch (input.actionType) {
    case 'SAVE_MATERIAL': {
      const payload = saveMaterialPayloadSchema.parse(input.payload);
      const result = await likeMaterialById(payload.target.materialId, input.userId);
      return buildResultBlock({
        actionType: input.actionType,
        status: 'EXECUTED',
        title: input.locale === 'ar' ? 'تم الحفظ' : 'Saved',
        summary:
          input.locale === 'ar'
            ? 'تم حفظ المادة في موادك المفضلة.'
            : 'Material saved to your liked materials.',
        target: {
          type: 'MATERIAL',
          id: result.materialId,
          title: payload.displaySnapshot.title,
        },
      });
    }
    case 'UNSAVE_MATERIAL': {
      const payload = unsaveMaterialPayloadSchema.parse(input.payload);
      const result = await unlikeMaterialById(payload.target.materialId, input.userId);
      return buildResultBlock({
        actionType: input.actionType,
        status: 'EXECUTED',
        title: input.locale === 'ar' ? 'تم إلغاء الحفظ' : 'Unsaved',
        summary:
          input.locale === 'ar'
            ? 'تم إلغاء حفظ المادة.'
            : 'Material removed from your liked materials.',
        target: {
          type: 'MATERIAL',
          id: result.materialId,
          title: payload.displaySnapshot.title,
        },
      });
    }
    case 'SAVE_PROJECT': {
      const payload = saveProjectPayloadSchema.parse(input.payload);
      await saveLearningProjectById(payload.target.projectId, input.userId);
      return buildResultBlock({
        actionType: input.actionType,
        status: 'EXECUTED',
        title: input.locale === 'ar' ? 'تم حفظ المشروع' : 'Project saved',
        summary:
          input.locale === 'ar'
            ? 'تم حفظ المشروع في قائمتك.'
            : 'Project saved to your list.',
        target: {
          type: 'PROJECT',
          id: payload.target.projectId,
          title: payload.displaySnapshot.title,
        },
      });
    }
    case 'UNSAVE_PROJECT': {
      const payload = unsaveProjectPayloadSchema.parse(input.payload);
      await unsaveLearningProjectById(payload.target.projectId, input.userId);
      return buildResultBlock({
        actionType: input.actionType,
        status: 'EXECUTED',
        title: input.locale === 'ar' ? 'تم إلغاء حفظ المشروع' : 'Project unsaved',
        summary:
          input.locale === 'ar'
            ? 'تم إلغاء حفظ المشروع.'
            : 'Project removed from your saved list.',
        target: {
          type: 'PROJECT',
          id: payload.target.projectId,
          title: payload.displaySnapshot.title,
        },
      });
    }
    case 'START_PROJECT_BUILD': {
      const payload = startProjectBuildPayloadSchema.parse(input.payload);
      const projectRecord = await learningProjectsRepository.findPublicLearningProjectById(
        payload.target.projectId,
      );
      if (!projectRecord) {
        throw new AppError('Project is not published.', 409, 'AI_ACTION_CONFLICT');
      }
      const project = await getLearningProjectById(projectRecord.id, viewer);
      const build = await startProjectBuildById(payload.target.projectId, input.userId);
      return buildResultBlock({
        actionType: input.actionType,
        status: 'EXECUTED',
        title: input.locale === 'ar' ? 'بدأ البناء' : 'Build started',
        summary:
          input.locale === 'ar'
            ? 'تم بدء بناء المشروع.'
            : 'Project build started.',
        target: {
          type: 'BUILD',
          id: build.id,
          title: project.title,
        },
        navigation: { route: 'project_build', id: build.id },
      });
    }
    case 'LINK_MATERIAL_TO_BUILD_COMPONENT': {
      const payload = linkMaterialToBuildPayloadSchema.parse(input.payload);
      const build = await getOwnedProjectBuildByBuildId(payload.target.buildId, input.userId);
      if (!build) {
        throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
      }
      await getMaterialById(payload.target.materialId, viewer);
      const linkedBuild = await linkBuildItemMaterialById(
        payload.target.projectId,
        input.userId,
        payload.target.buildItemId,
        payload.target.materialId,
      );
      return buildResultBlock({
        actionType: input.actionType,
        status: 'EXECUTED',
        title: input.locale === 'ar' ? 'تم الربط' : 'Linked',
        summary:
          input.locale === 'ar'
            ? 'تم ربط المادة بالمكون.'
            : 'Material linked to the component.',
        target: {
          type: 'COMPONENT',
          id: payload.target.buildItemId,
          title: payload.displaySnapshot.title,
        },
        navigation: { route: 'project_build', id: linkedBuild.id },
      });
    }
    case 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT': {
      const payload = unlinkMaterialFromBuildPayloadSchema.parse(input.payload);
      const build = await getOwnedProjectBuildByBuildId(payload.target.buildId, input.userId);
      if (!build) {
        throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
      }
      const linkedBuild = await unlinkBuildItemMaterialById(
        payload.target.projectId,
        input.userId,
        payload.target.buildItemId,
      );
      return buildResultBlock({
        actionType: input.actionType,
        status: 'EXECUTED',
        title: input.locale === 'ar' ? 'تم إلغاء الربط' : 'Unlinked',
        summary:
          input.locale === 'ar'
            ? 'تم إلغاء ربط المادة.'
            : 'Material unlinked from the component.',
        target: {
          type: 'COMPONENT',
          id: payload.target.buildItemId,
          title: payload.displaySnapshot.title,
        },
        navigation: { route: 'project_build', id: linkedBuild.id },
      });
    }
    case 'CONFIRM_MATERIAL_RESERVATION': {
      const payload = reservationPayloadSchema.parse(input.payload);
      const reservationInput: CreateReservationInput = {
        materialId: payload.target.materialId,
        quantityRequested: payload.parameters.quantityRequested,
        fulfillmentMethod: payload.parameters.fulfillmentMethod,
        paymentMethod: 'CARD',
        message: payload.parameters.message,
        learnerPreferredPickupWindows: payload.parameters.learnerPreferredPickupWindows,
        learnerPreferredDeliveryWindows:
          payload.parameters.learnerPreferredDeliveryWindows,
        deliveryAddressText: payload.parameters.deliveryAddressText,
        dropoffCity: payload.parameters.dropoffCity,
        dropoffArea: payload.parameters.dropoffArea,
        safeDropoffAllowed: payload.parameters.safeDropoffAllowed,
        deliveryNote: payload.parameters.deliveryNote,
        buildItemId: payload.target.buildItemId,
      };
      const reservation = await createReservation(input.userId, reservationInput);
      return buildResultBlock({
        actionType: input.actionType,
        status: 'EXECUTED',
        title: input.locale === 'ar' ? 'تم إنشاء الحجز' : 'Reservation created',
        summary:
          input.locale === 'ar'
            ? 'تم إنشاء طلب الحجز بنجاح.'
            : 'Reservation request created successfully.',
        target: {
          type: 'RESERVATION',
          id: reservation.id,
          title: payload.displaySnapshot.title,
        },
        navigation: { route: 'reservation', id: reservation.id },
      });
    }
    case 'UPDATE_BUILD_COMPONENT_STATUSES': {
      const payload = updateBuildComponentStatusesPayloadSchema.parse(input.payload);
      await learningProjectsRepository.updateOwnedProjectBuildItemsStatusBatch({
        projectId: payload.target.projectId,
        buildId: payload.target.buildId,
        learnerId: input.userId,
        targetStatus: payload.parameters.targetStatus,
        items: payload.parameters.items.map((item) => ({
          buildItemId: item.buildItemId,
          previousStatus: item.previousStatus,
        })),
      });
      invalidateLearnerHomeCache(input.userId);
      const build = await getOwnedProjectBuildByBuildId(
        payload.target.buildId,
        input.userId,
      );
      if (!build) {
        throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
      }

      const changedNames = payload.parameters.items.map((item) => item.componentName);
      const changedList = changedNames.join(
        input.locale === 'ar' ? ' و' : ', ',
      );
      const readinessSummary =
        input.locale === 'ar'
          ? `أصبحت جاهزية المواد ${build.progress.ready} من ${build.progress.total}.`
          : `Material readiness is now ${build.progress.ready} of ${build.progress.total}.`;
      let summary =
        payload.parameters.targetStatus === 'ALREADY_OWNED'
          ? input.locale === 'ar'
            ? `تم تحديد ${changedList} كموجودة لديك. ${readinessSummary}`
            : `Marked ${changedList} as already owned. ${readinessSummary}`
          : input.locale === 'ar'
            ? `تم تحديد ${changedList} كغير موجودة. ${readinessSummary}`
            : `Marked ${changedList} as missing. ${readinessSummary}`;

      if (build.stepProgress.nextAction === 'COMPLETE_CURRENT_STEP') {
        summary +=
          input.locale === 'ar'
            ? ' يمكنك الآن بدء الخطوة الأولى.'
            : ' You can now start Step 1.';
      }

      return buildResultBlock({
        actionType: input.actionType,
        status: 'EXECUTED',
        title:
          input.locale === 'ar'
            ? 'تم تحديث حالة المكونات'
            : 'Component status updated',
        summary,
        target: {
          type: 'BUILD',
          id: build.id,
          title: build.project.title,
        },
        navigation: { route: 'project_build', id: payload.target.projectId },
      });
    }
    case 'COMPLETE_CURRENT_BUILD_STEP': {
      const payload = completeCurrentBuildStepPayloadSchema.parse(input.payload);
      const buildBefore = await getOwnedProjectBuildByBuildId(
        payload.target.buildId,
        input.userId,
      );
      if (!buildBefore) {
        throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
      }
      if (buildBefore.status !== 'IN_PROGRESS') {
        throw new AppError('Build is not editable.', 409, 'AI_ACTION_CONFLICT');
      }
      if (
        !buildBefore.stepProgress.currentStep ||
        buildBefore.stepProgress.currentStep.stepId !== payload.target.projectStepId
      ) {
        return buildResultBlock({
          actionType: input.actionType,
          status: 'FAILED',
          title:
            input.locale === 'ar'
              ? 'الخطوة لم تعد حالية'
              : 'Step is no longer current',
          summary:
            input.locale === 'ar'
              ? 'تم تحديث التقدم من مكان آخر. راجع الخطوة الحالية في صفحة البناء.'
              : 'Progress was updated elsewhere. Check the current step on the build page.',
          target: {
            type: 'BUILD',
            id: payload.target.buildId,
            title: buildBefore.project.title,
          },
          navigation: { route: 'project_build', id: payload.target.projectId },
        });
      }

      const updated = await completeProjectBuildStepById(
        payload.target.projectId,
        input.userId,
        payload.target.projectStepId,
      );

      if (
        updated.status === 'COMPLETED' ||
        updated.stepProgress.nextAction === 'BUILD_COMPLETED'
      ) {
        return buildResultBlock({
          actionType: input.actionType,
          status: 'EXECUTED',
          title:
            input.locale === 'ar' ? 'اكتمل المشروع' : 'Project build completed',
          summary:
            input.locale === 'ar'
              ? `تم إكمال الخطوة ${payload.parameters.stepNumber}: ${payload.parameters.stepTitle}. أصبح تقدمك 100%.`
              : `Completed Step ${payload.parameters.stepNumber}: ${payload.parameters.stepTitle}. Progress is now 100%.`,
          target: {
            type: 'BUILD',
            id: updated.id,
            title: updated.project.title,
          },
          navigation: { route: 'project_build', id: payload.target.projectId },
        });
      }

      const nextStep = updated.stepProgress.currentStep;
      return buildResultBlock({
        actionType: input.actionType,
        status: 'EXECUTED',
        title: input.locale === 'ar' ? 'تم إكمال الخطوة' : 'Step completed',
        summary:
          input.locale === 'ar'
            ? `تم إكمال الخطوة ${payload.parameters.stepNumber}: ${payload.parameters.stepTitle}. أصبح تقدمك ${updated.stepProgress.percent}%. الخطوة الحالية الآن: ${nextStep?.title ?? ''}.`
            : `Completed Step ${payload.parameters.stepNumber}: ${payload.parameters.stepTitle}. Progress is now ${updated.stepProgress.percent}%. Current step: ${nextStep?.title ?? ''}.`,
        target: {
          type: 'BUILD',
          id: updated.id,
          title: updated.project.title,
        },
        navigation: { route: 'project_build', id: payload.target.projectId },
      });
    }
    case 'APPLY_PROJECT_AUTHORING_PROPOSAL': {
      const payload = applyProjectAuthoringProposalPayloadSchema.parse(input.payload);
      const updated = await applyReviewedAuthoringProposalToMyDraft({
        userId: input.userId,
        projectId: payload.target.projectId,
        expectedUpdatedAt: payload.parameters.expectedUpdatedAt,
        finalProject: payload.parameters.finalProject,
      });

      return buildResultBlock({
        actionType: input.actionType,
        status: 'EXECUTED',
        title:
          input.locale === 'ar'
            ? 'تم تحديث مسودة المشروع'
            : 'Draft project updated',
        summary:
          input.locale === 'ar'
            ? 'تم تطبيق الاقتراح المراجع على مسودتك. لم يتم إرسال المشروع للمراجعة.'
            : 'Project proposal applied to your draft. The project was not submitted for review.',
        target: {
          type: 'PROJECT',
          id: updated.id,
          title: updated.title,
        },
        navigation: { route: 'learning_project_edit', id: updated.id },
      });
    }
    default:
      throw new AppError('Action is not supported.', 400, 'AI_ACTION_NOT_SUPPORTED');
  }
};

export const confirmAiPendingAction = async (input: {
  userId: string;
  pendingActionId: string;
  idempotencyKey: string;
  locale: 'en' | 'ar';
}): Promise<{ block: AiContentBlock; pendingActionId: string }> => {
  const acquired = await acquireActionExecution({
    userId: input.userId,
    pendingActionId: input.pendingActionId,
  });

  if (acquired.alreadyExecuted) {
    return {
      pendingActionId: acquired.action.id,
      block: acquired.action.result as AiContentBlock,
    };
  }

  const payload = parseVersionedActionPayload(
    acquired.action.actionType,
    acquired.action.payload,
  );

  await assertOwnedConversation(acquired.action.conversationId, input.userId);

  try {
    const resultBlock = await executeConfirmedAction({
      userId: input.userId,
      actionType: acquired.action.actionType,
      payload,
      locale: input.locale,
    });

    await prisma.aiPendingAction.update({
      where: { id: acquired.action.id },
      data: {
        status: 'EXECUTED',
        executedAt: new Date(),
        result: resultBlock as Prisma.InputJsonValue,
        idempotencyKey: input.idempotencyKey,
        errorCode: null,
      },
    });

    await appendActionResultToAssistantMessage({
      conversationId: acquired.action.conversationId,
      pendingActionId: acquired.action.id,
      resultBlock,
    });

    if (acquired.action.actionType === 'APPLY_PROJECT_AUTHORING_PROPOSAL') {
      const applyPayload = applyProjectAuthoringProposalPayloadSchema.parse(payload);
      await persistAppliedReviewStateAfterConfirm({
        userId: input.userId,
        conversationId: applyPayload.parameters.conversationId,
        reviewStateId: applyPayload.parameters.reviewStateId,
        locale: input.locale,
      });
    }

    return {
      pendingActionId: acquired.action.id,
      block: resultBlock,
    };
  } catch (error) {
    const code =
      error instanceof AppError ? error.code : 'AI_ACTION_EXECUTION_FAILED';

    await prisma.aiPendingAction.update({
      where: { id: acquired.action.id },
      data: {
        status: 'FAILED',
        errorCode: code,
      },
    });

    throw error;
  }
};

export const cancelAiPendingAction = async (input: {
  userId: string;
  pendingActionId: string;
}): Promise<{ cancelled: true; block?: AiContentBlock }> => {
  const existing = await prisma.aiPendingAction.findFirst({
    where: { id: input.pendingActionId, userId: input.userId },
  });

  if (!existing) {
    throw new AppError('Pending action not found.', 404, 'AI_ACTION_NOT_FOUND');
  }

  if (existing.status === 'CANCELLED') {
    if (existing.result && typeof existing.result === 'object') {
      return {
        cancelled: true,
        block: existing.result as AiContentBlock,
      };
    }

    return { cancelled: true };
  }

  if (existing.status !== 'PENDING') {
    throw new AppError('Action cannot be cancelled.', 409, 'AI_ACTION_CONFLICT');
  }

  const payload = parseVersionedActionPayload(existing.actionType, existing.payload);
  const cancelledBlock = buildResultBlock({
    actionType: existing.actionType,
    status: 'CANCELLED',
    title: 'Action cancelled',
    summary: payload.displaySnapshot.summary ?? payload.displaySnapshot.title,
    target: resolveCancelledTarget(existing.actionType, payload),
  });

  const updated = await prisma.aiPendingAction.updateMany({
    where: {
      id: input.pendingActionId,
      userId: input.userId,
      status: 'PENDING',
    },
    data: {
      status: 'CANCELLED',
      result: cancelledBlock as Prisma.InputJsonValue,
    },
  });

  if (updated.count === 0) {
    throw new AppError('Action cannot be cancelled.', 409, 'AI_ACTION_CONFLICT');
  }

  await appendActionResultToAssistantMessage({
    conversationId: existing.conversationId,
    pendingActionId: existing.id,
    resultBlock: cancelledBlock,
  });

  return { cancelled: true, block: cancelledBlock };
};

export const buildMaterialSavePayload = (input: {
  materialId: string;
  displaySnapshot: VersionedActionPayload['displaySnapshot'];
}): VersionedActionPayload =>
  ({
    schemaVersion: 1,
    actionType: 'SAVE_MATERIAL',
    target: { materialId: input.materialId },
    parameters: {},
    displaySnapshot: input.displaySnapshot,
  }) as VersionedActionPayload;

const reservationDraftIdempotencyKey = (conversationId: string) =>
  `reservation-draft:${conversationId}`;

export const buildPrepareReservationPayload = (input: {
  materialId: string;
  parameters?: z.infer<typeof prepareMaterialReservationPayloadSchema>['parameters'];
  displaySnapshot: VersionedActionPayload['displaySnapshot'];
}): VersionedActionPayload =>
  ({
    schemaVersion: 1,
    actionType: 'PREPARE_MATERIAL_RESERVATION',
    target: { materialId: input.materialId },
    parameters: input.parameters ?? {},
    displaySnapshot: input.displaySnapshot,
  }) as VersionedActionPayload;

export const findActiveReservationDraft = async (input: {
  conversationId: string;
  userId: string;
}) =>
  prisma.aiPendingAction.findFirst({
    where: {
      conversationId: input.conversationId,
      userId: input.userId,
      actionType: 'PREPARE_MATERIAL_RESERVATION',
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { updatedAt: 'desc' },
  });

export const saveReservationDraft = async (input: {
  userId: string;
  conversationId: string;
  materialId: string;
  parameters: z.infer<typeof prepareMaterialReservationPayloadSchema>['parameters'];
  locale: 'en' | 'ar';
}) => {
  await assertOwnedConversation(input.conversationId, input.userId);
  const viewer = buildViewer(input.userId);
  const material = await getMaterialById(input.materialId, viewer);
  const payload = buildPrepareReservationPayload({
    materialId: material.id,
    parameters: input.parameters,
    displaySnapshot: { title: material.title, summary: material.title },
  });
  parseVersionedActionPayload('PREPARE_MATERIAL_RESERVATION', payload);
  const expiresAt = new Date(Date.now() + ACTION_EXPIRY_MS);

  return prisma.aiPendingAction.upsert({
    where: {
      userId_idempotencyKey: {
        userId: input.userId,
        idempotencyKey: reservationDraftIdempotencyKey(input.conversationId),
      },
    },
    create: {
      userId: input.userId,
      conversationId: input.conversationId,
      actionType: 'PREPARE_MATERIAL_RESERVATION',
      payload: payload as Prisma.InputJsonValue,
      displaySnapshot: { title: material.title } as Prisma.InputJsonValue,
      idempotencyKey: reservationDraftIdempotencyKey(input.conversationId),
      expiresAt,
    },
    update: {
      status: 'PENDING',
      conversationId: input.conversationId,
      payload: payload as Prisma.InputJsonValue,
      expiresAt,
      errorCode: null,
      result: undefined,
    },
  });
};

export const cancelReservationDraft = async (input: {
  conversationId: string;
  userId: string;
}) => {
  const draft = await findActiveReservationDraft(input);
  if (!draft) {
    return null;
  }

  return prisma.aiPendingAction.update({
    where: { id: draft.id },
    data: { status: 'CANCELLED' },
  });
};

export const buildProjectSavePayload = (input: {
  projectId: string;
  displaySnapshot: VersionedActionPayload['displaySnapshot'];
}): VersionedActionPayload =>
  ({
    schemaVersion: 1,
    actionType: 'SAVE_PROJECT',
    target: { projectId: input.projectId },
    parameters: {},
    displaySnapshot: input.displaySnapshot,
  }) as VersionedActionPayload;

export const buildStartBuildPayload = (input: {
  projectId: string;
  displaySnapshot: VersionedActionPayload['displaySnapshot'];
}): VersionedActionPayload =>
  ({
    schemaVersion: 1,
    actionType: 'START_PROJECT_BUILD',
    target: { projectId: input.projectId },
    parameters: {},
    displaySnapshot: input.displaySnapshot,
  }) as VersionedActionPayload;

export const buildLinkMaterialPayload = (input: {
  projectId: string;
  buildId: string;
  buildItemId: string;
  materialId: string;
  componentId?: string;
  displaySnapshot: VersionedActionPayload['displaySnapshot'];
}): VersionedActionPayload =>
  ({
    schemaVersion: 1,
    actionType: 'LINK_MATERIAL_TO_BUILD_COMPONENT',
    target: {
      projectId: input.projectId,
      buildId: input.buildId,
      buildItemId: input.buildItemId,
      materialId: input.materialId,
      componentId: input.componentId,
    },
    parameters: {},
    displaySnapshot: input.displaySnapshot,
  }) as VersionedActionPayload;

export const buildUnsaveMaterialPayload = (input: {
  materialId: string;
  displaySnapshot: VersionedActionPayload['displaySnapshot'];
}): VersionedActionPayload =>
  ({
    schemaVersion: 1,
    actionType: 'UNSAVE_MATERIAL',
    target: { materialId: input.materialId },
    parameters: {},
    displaySnapshot: input.displaySnapshot,
  }) as VersionedActionPayload;

export const buildUnsaveProjectPayload = (input: {
  projectId: string;
  displaySnapshot: VersionedActionPayload['displaySnapshot'];
}): VersionedActionPayload =>
  ({
    schemaVersion: 1,
    actionType: 'UNSAVE_PROJECT',
    target: { projectId: input.projectId },
    parameters: {},
    displaySnapshot: input.displaySnapshot,
  }) as VersionedActionPayload;

export const buildUnlinkMaterialPayload = (input: {
  projectId: string;
  buildId: string;
  buildItemId: string;
  displaySnapshot: VersionedActionPayload['displaySnapshot'];
}): VersionedActionPayload =>
  ({
    schemaVersion: 1,
    actionType: 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT',
    target: {
      projectId: input.projectId,
      buildId: input.buildId,
      buildItemId: input.buildItemId,
    },
    parameters: {},
    displaySnapshot: input.displaySnapshot,
  }) as VersionedActionPayload;

export const buildUpdateBuildComponentStatusesPayload = (input: {
  projectId: string;
  buildId: string;
  projectTitle: string;
  targetStatus: 'ALREADY_OWNED' | 'MISSING';
  items: Array<{
    buildItemId: string;
    requiredComponentId: string;
    componentName: string;
    previousStatus:
      | 'MISSING'
      | 'ALREADY_OWNED'
      | 'AVAILABLE'
      | 'RESERVED'
      | 'ALTERNATIVE';
  }>;
}): VersionedActionPayload => {
  const statusLabel =
    input.targetStatus === 'ALREADY_OWNED' ? 'Already owned' : 'Missing';
  const componentLines = input.items.map((item) => `- ${item.componentName}`).join('\n');

  return {
    schemaVersion: 1,
    actionType: 'UPDATE_BUILD_COMPONENT_STATUSES',
    target: {
      projectId: input.projectId,
      buildId: input.buildId,
    },
    parameters: {
      targetStatus: input.targetStatus,
      items: input.items,
    },
    displaySnapshot: {
      title: input.projectTitle,
      summary: `${statusLabel}\n${componentLines}`,
    },
  } as VersionedActionPayload;
};

export const buildReservationPayload = (input: {
  materialId: string;
  buildItemId?: string;
  parameters: {
    quantityRequested: number;
    fulfillmentMethod: 'PICKUP' | 'DELIVERY';
    message?: string;
    learnerPreferredPickupWindows?: Array<{ start: string; end: string }>;
    learnerPreferredDeliveryWindows?: Array<{ start: string; end: string }>;
    deliveryAddressText?: string;
    dropoffCity?: string;
    dropoffArea?: string;
    safeDropoffAllowed?: boolean;
    deliveryNote?: string;
  };
  displaySnapshot: VersionedActionPayload['displaySnapshot'];
}): VersionedActionPayload =>
  ({
    schemaVersion: 1,
    actionType: 'CONFIRM_MATERIAL_RESERVATION',
    target: {
      materialId: input.materialId,
      buildItemId: input.buildItemId,
    },
    parameters: input.parameters,
    displaySnapshot: input.displaySnapshot,
  }) as VersionedActionPayload;
