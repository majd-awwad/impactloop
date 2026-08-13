import { z } from 'zod';

export const reservationIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const deliveryIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const markLearnerNoShowSchema = z.object({
  reason: z.enum(['LEARNER_DID_NOT_ARRIVE', 'OTHER']),
  note: z.string().trim().max(1000).optional(),
});

export const markDriverPickupFailedSchema = z.object({
  reason: z.enum([
    'SUPPLIER_UNAVAILABLE',
    'MATERIAL_NOT_READY',
    'LOCATION_ISSUE',
    'OTHER',
  ]),
  note: z.string().trim().min(1, 'Note is required.').max(1000),
});

export const markDriverDeliveryFailedSchema = z
  .object({
    reason: z.enum([
      'LEARNER_UNREACHABLE',
      'LEARNER_REQUESTED_RESCHEDULE',
      'ADDRESS_OR_ACCESS_ISSUE',
      'OTHER_RETRYABLE',
      // Backward-compatible transport values from the pre-Slice 3 client.
      'LEARNER_UNAVAILABLE',
      'ADDRESS_ISSUE',
      'ACCESS_ISSUE',
      'OTHER',
    ]),
    learnerContactAttempted: z.boolean().default(false),
    note: z.string().trim().max(1000).optional().nullable(),
    retryWindowStart: z.iso.datetime().optional(),
    retryWindowEnd: z.iso.datetime().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.retryWindowStart == null) !== (value.retryWindowEnd == null)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Retry window start and end are required together.',
        path: ['retryWindowEnd'],
      });
    }
  });

export const markDriverNoShowSchema = z.object({
  note: z.string().trim().min(1, 'Note is required.').max(1000),
});

export const markDriverIssueAfterPickupSchema = z.object({
  note: z.string().trim().min(1, 'Note is required.').max(1000),
});

export type ReservationIdParams = z.infer<typeof reservationIdParamsSchema>;
export type DeliveryIdParams = z.infer<typeof deliveryIdParamsSchema>;
export type MarkLearnerNoShowInput = z.infer<typeof markLearnerNoShowSchema>;
export type MarkDriverPickupFailedInput = z.infer<
  typeof markDriverPickupFailedSchema
>;
export type MarkDriverDeliveryFailedInput = z.infer<
  typeof markDriverDeliveryFailedSchema
>;
export type MarkDriverNoShowInput = z.infer<typeof markDriverNoShowSchema>;
export type MarkDriverIssueAfterPickupInput = z.infer<
  typeof markDriverIssueAfterPickupSchema
>;
