import { z } from 'zod';

import type { AiPendingActionType } from '../../generated/prisma/client.js';

const cuidLike = z.string().trim().min(8).max(64);
const boundedText = z.string().trim().min(1).max(500);
const boundedOptionalText = z.string().trim().max(500).optional();

const pickupWindowSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
});

const displaySnapshotSchema = z.object({
  title: boundedText,
  summary: boundedOptionalText,
  priceLabel: boundedOptionalText,
  locationLabel: boundedOptionalText,
  quantityLabel: boundedOptionalText,
});

const targetSchema = z.object({
  materialId: cuidLike.optional(),
  projectId: cuidLike.optional(),
  buildId: cuidLike.optional(),
  buildItemId: cuidLike.optional(),
  componentId: cuidLike.optional(),
});

const basePayloadSchema = z.object({
  schemaVersion: z.literal(1),
  actionType: z.string(),
  target: targetSchema,
  parameters: z.record(z.string(), z.unknown()).default({}),
  displaySnapshot: displaySnapshotSchema,
});

export const saveMaterialPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('SAVE_MATERIAL'),
  target: z.object({ materialId: cuidLike }),
  parameters: z.object({}).strict(),
});

export const unsaveMaterialPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('UNSAVE_MATERIAL'),
  target: z.object({ materialId: cuidLike }),
  parameters: z.object({}).strict(),
});

export const saveProjectPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('SAVE_PROJECT'),
  target: z.object({ projectId: cuidLike }),
  parameters: z.object({}).strict(),
});

export const unsaveProjectPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('UNSAVE_PROJECT'),
  target: z.object({ projectId: cuidLike }),
  parameters: z.object({}).strict(),
});

export const startProjectBuildPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('START_PROJECT_BUILD'),
  target: z.object({ projectId: cuidLike }),
  parameters: z.object({}).strict(),
});

export const linkMaterialToBuildPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('LINK_MATERIAL_TO_BUILD_COMPONENT'),
  target: z.object({
    projectId: cuidLike,
    buildId: cuidLike,
    buildItemId: cuidLike,
    materialId: cuidLike,
    componentId: cuidLike.optional(),
  }),
  parameters: z.object({}).strict(),
});

export const unlinkMaterialFromBuildPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('UNLINK_MATERIAL_FROM_BUILD_COMPONENT'),
  target: z.object({
    projectId: cuidLike,
    buildId: cuidLike,
    buildItemId: cuidLike,
  }),
  parameters: z.object({}).strict(),
});

export const reservationPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('CONFIRM_MATERIAL_RESERVATION'),
  target: z.object({
    materialId: cuidLike,
    buildItemId: cuidLike.optional(),
  }),
  parameters: z.object({
    quantityRequested: z.number().positive().max(10_000),
    fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY']),
    message: boundedOptionalText,
    learnerPreferredPickupWindows: z.array(pickupWindowSchema).max(3).optional(),
    learnerPreferredDeliveryWindows: z.array(pickupWindowSchema).max(3).optional(),
    deliveryAddressText: boundedOptionalText,
    dropoffCity: boundedOptionalText,
    dropoffArea: boundedOptionalText,
    safeDropoffAllowed: z.boolean().optional(),
    deliveryNote: boundedOptionalText,
  }),
});

const buildComponentStatusItemSchema = z.object({
  buildItemId: cuidLike,
  requiredComponentId: cuidLike,
  componentName: boundedText,
  previousStatus: z.enum([
    'MISSING',
    'ALREADY_OWNED',
    'AVAILABLE',
    'RESERVED',
    'ALTERNATIVE',
  ]),
});

export const updateBuildComponentStatusesPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('UPDATE_BUILD_COMPONENT_STATUSES'),
  target: z.object({
    projectId: cuidLike,
    buildId: cuidLike,
  }),
  parameters: z.object({
    targetStatus: z.enum(['ALREADY_OWNED', 'MISSING']),
    items: z.array(buildComponentStatusItemSchema).min(1).max(50),
  }),
});

export const completeCurrentBuildStepPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('COMPLETE_CURRENT_BUILD_STEP'),
  target: z.object({
    projectId: cuidLike,
    buildId: cuidLike,
    projectStepId: cuidLike,
  }),
  parameters: z.object({
    stepNumber: z.number().int().positive(),
    stepTitle: boundedText,
    expectedBuildStatus: z.literal('IN_PROGRESS'),
  }),
});

const finalProjectStepSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
});

const finalProjectComponentSchema = z.object({
  componentName: z.string().trim().min(1).max(200),
  materialType: z.string().trim().min(1).max(200),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).max(50),
  componentRole: z.string().trim().min(1).max(80),
  isRequired: z.boolean(),
  canBeSubstituted: z.boolean(),
  searchKeywords: z.array(z.string().trim().min(1).max(80)),
  notes: z.string().nullable(),
});

export const applyProjectAuthoringProposalPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('APPLY_PROJECT_AUTHORING_PROPOSAL'),
  target: z.object({
    projectId: cuidLike,
  }),
  parameters: z.object({
    conversationId: cuidLike,
    proposalId: z.string().trim().min(1).max(80),
    reviewStateId: z.string().trim().min(1).max(80),
    expectedUpdatedAt: z.string().datetime(),
    acceptedSections: z.array(z.string().trim().min(1).max(80)),
    keptCurrentSections: z.array(z.string().trim().min(1).max(80)),
    finalProject: z.object({
      title: z.string().trim().min(3).max(200),
      shortDescription: z.string().trim().min(10).max(500),
      description: z.string().trim().min(10).max(10000),
      difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
      estimatedDurationMinutes: z.number().int().positive().max(10000).optional(),
      requiredComponents: z.array(finalProjectComponentSchema),
      steps: z.array(finalProjectStepSchema).min(3).max(20),
    }),
  }),
});

export const prepareMaterialReservationPayloadSchema = basePayloadSchema.extend({
  actionType: z.literal('PREPARE_MATERIAL_RESERVATION'),
  target: z.object({ materialId: cuidLike }),
  parameters: z
    .object({
      quantityRequested: z.number().positive().max(10_000).optional(),
      fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY']).optional(),
      message: boundedOptionalText,
      pickupDate: z.string().trim().min(8).max(10).optional(),
      pickupStartTime: z.string().trim().min(4).max(5).optional(),
      pickupEndTime: z.string().trim().min(4).max(5).optional(),
      learnerPreferredPickupWindows: z.array(pickupWindowSchema).max(3).optional(),
      learnerPreferredDeliveryWindows: z.array(pickupWindowSchema).max(3).optional(),
      deliveryAddressText: boundedOptionalText,
      dropoffCity: boundedOptionalText,
      dropoffArea: boundedOptionalText,
      safeDropoffAllowed: z.boolean().optional(),
      deliveryNote: boundedOptionalText,
    })
    .default({}),
});

export type VersionedActionPayload =
  | z.infer<typeof saveMaterialPayloadSchema>
  | z.infer<typeof unsaveMaterialPayloadSchema>
  | z.infer<typeof saveProjectPayloadSchema>
  | z.infer<typeof unsaveProjectPayloadSchema>
  | z.infer<typeof startProjectBuildPayloadSchema>
  | z.infer<typeof linkMaterialToBuildPayloadSchema>
  | z.infer<typeof unlinkMaterialFromBuildPayloadSchema>
  | z.infer<typeof prepareMaterialReservationPayloadSchema>
  | z.infer<typeof reservationPayloadSchema>
  | z.infer<typeof updateBuildComponentStatusesPayloadSchema>
  | z.infer<typeof completeCurrentBuildStepPayloadSchema>
  | z.infer<typeof applyProjectAuthoringProposalPayloadSchema>;

const payloadSchemaByType: Record<
  AiPendingActionType,
  z.ZodTypeAny | null
> = {
  SAVE_MATERIAL: saveMaterialPayloadSchema,
  UNSAVE_MATERIAL: unsaveMaterialPayloadSchema,
  SAVE_PROJECT: saveProjectPayloadSchema,
  UNSAVE_PROJECT: unsaveProjectPayloadSchema,
  START_PROJECT_BUILD: startProjectBuildPayloadSchema,
  LINK_MATERIAL_TO_BUILD_COMPONENT: linkMaterialToBuildPayloadSchema,
  UNLINK_MATERIAL_FROM_BUILD_COMPONENT: unlinkMaterialFromBuildPayloadSchema,
  PREPARE_MATERIAL_RESERVATION: prepareMaterialReservationPayloadSchema,
  CONFIRM_MATERIAL_RESERVATION: reservationPayloadSchema,
  UPDATE_BUILD_COMPONENT_STATUSES: updateBuildComponentStatusesPayloadSchema,
  COMPLETE_CURRENT_BUILD_STEP: completeCurrentBuildStepPayloadSchema,
  APPLY_PROJECT_AUTHORING_PROPOSAL: applyProjectAuthoringProposalPayloadSchema,
  CANCEL_PENDING_AI_ACTION: null,
};

export const parseVersionedActionPayload = (
  actionType: AiPendingActionType,
  payload: unknown,
): VersionedActionPayload => {
  const schema = payloadSchemaByType[actionType];
  if (!schema) {
    throw new Error(`No versioned payload schema for ${actionType}`);
  }

  return schema.parse(payload) as VersionedActionPayload;
};

export const assertNoForbiddenPayloadFields = (payload: Record<string, unknown>) => {
  for (const key of ['userId', 'conversationId', 'authenticatedUserId', 'sub']) {
    if (key in payload) {
      throw new Error(`Forbidden payload field: ${key}`);
    }
  }
};
