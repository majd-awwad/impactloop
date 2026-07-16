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
  | z.infer<typeof reservationPayloadSchema>;

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
