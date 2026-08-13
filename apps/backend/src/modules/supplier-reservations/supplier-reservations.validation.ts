import { z } from 'zod';

import {
  validatePickupWindow,
} from '../reservations/pickup-window-validation.js';

export const listSupplierReservationsQuerySchema = z.object({
  status: z
    .enum([
      'PENDING',
      'AWAITING_LEARNER_CONFIRMATION',
      'AWAITING_SUPPLIER_CONFIRMATION',
      'ACCEPTED',
      'REJECTED',
      'CANCELLED',
      'COMPLETED',
      'EXPIRED',
      'NO_SHOW',
      'FULFILLMENT_FAILED',
      'AWAITING_RESOLUTION',
      'all',
      'pending',
      'needs_learner',
      'needs_supplier',
      'accepted',
      'declined',
      'completed',
      'cancelled',
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).max(120).optional(),
  attentionState: z
    .enum([
      'SUPPLIER_ACTION_REQUIRED',
      'WAITING_FOR_LEARNER',
      'FULFILLMENT_IN_PROGRESS',
      'ADMIN_REVIEW_REQUIRED',
      'TERMINAL',
    ])
    .optional(),
  fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY']).optional(),
  historyScope: z.enum(['ACTIVE', 'TERMINAL', 'ALL']).default('ALL'),
  materialId: z.string().trim().min(1).max(191).optional(),
  dateFrom: z.iso.datetime().optional(),
  dateTo: z.iso.datetime().optional(),
}).superRefine((value, ctx) => {
  if (
    value.dateFrom &&
    value.dateTo &&
    new Date(value.dateFrom).getTime() > new Date(value.dateTo).getTime()
  ) {
    ctx.addIssue({
      code: 'custom',
      message: 'dateFrom must be before or equal to dateTo.',
      path: ['dateTo'],
    });
  }
});

export type ListSupplierReservationsQuery = z.infer<
  typeof listSupplierReservationsQuerySchema
>;

const validateSupplierPickupProposal = (
  value: {
    pickupWindowStart: string;
    pickupWindowEnd: string;
    selectedPreferredWindowIndex?: number;
  },
  ctx: z.RefinementCtx,
) => {
  const mode =
    value.selectedPreferredWindowIndex != null
      ? 'supplier_selected_preferred'
      : 'supplier_custom_proposal';

  const failure = validatePickupWindow(
    {
      start: new Date(value.pickupWindowStart),
      end: new Date(value.pickupWindowEnd),
    },
    mode,
  );

  if (failure) {
    ctx.addIssue({
      code: 'custom',
      message: failure.message,
      path:
        failure.field === 'start'
          ? ['pickupWindowStart']
          : ['pickupWindowEnd'],
    });
  }
};

const pickupWindowSchema = z
  .object({
    pickupWindowStart: z.iso.datetime(),
    pickupWindowEnd: z.iso.datetime(),
    supplierNote: z.string().trim().max(1000).optional(),
    selectedPreferredWindowIndex: z.number().int().min(0).optional(),
    proposedDeliveryWindowStart: z.iso.datetime().optional(),
    proposedDeliveryWindowEnd: z.iso.datetime().optional(),
  })
  .superRefine((value, ctx) => {
    validateSupplierPickupProposal(value, ctx);

    const proposedStartRaw = value.proposedDeliveryWindowStart;
    const proposedEndRaw = value.proposedDeliveryWindowEnd;
    const hasProposedStart = proposedStartRaw != null;
    const hasProposedEnd = proposedEndRaw != null;

    if (hasProposedStart !== hasProposedEnd) {
      ctx.addIssue({
        code: 'custom',
        message: 'Proposed delivery window requires both start and end.',
        path: ['proposedDeliveryWindowEnd'],
      });
      return;
    }

    if (hasProposedStart && hasProposedEnd) {
      const proposedStart = new Date(proposedStartRaw);
      const proposedEnd = new Date(proposedEndRaw);

      if (
        !Number.isFinite(proposedStart.getTime()) ||
        !Number.isFinite(proposedEnd.getTime())
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'Proposed delivery window dates must be valid.',
          path: ['proposedDeliveryWindowEnd'],
        });
        return;
      }

      if (proposedEnd <= proposedStart) {
        ctx.addIssue({
          code: 'custom',
          message: 'Proposed delivery end time must be after start time.',
          path: ['proposedDeliveryWindowEnd'],
        });
        return;
      }

      if (proposedStart.getTime() <= Date.now()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Proposed delivery window start must be in the future.',
          path: ['proposedDeliveryWindowStart'],
        });
      }
    }
  });

export const acceptSupplierReservationSchema = pickupWindowSchema;

export type AcceptSupplierReservationInput = z.infer<
  typeof acceptSupplierReservationSchema
>;

export const rescheduleSupplierReservationSchema = z
  .object({
    pickupWindowStart: z.iso.datetime(),
    pickupWindowEnd: z.iso.datetime(),
    supplierNote: z.string().trim().max(1000).optional(),
    messageToLearner: z.string().trim().max(1000).optional(),
    reason: z.string().trim().min(1).max(500),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    validateSupplierPickupProposal(value, ctx);
  });

export type RescheduleSupplierReservationInput = z.infer<
  typeof rescheduleSupplierReservationSchema
>;

export const submitNoDriverPickupWindowSchema = z
  .object({
    pickupWindowStart: z.iso.datetime(),
    pickupWindowEnd: z.iso.datetime(),
    supplierNote: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    validateSupplierPickupProposal(value, ctx);
  });

export type SubmitNoDriverPickupWindowInput = z.infer<
  typeof submitNoDriverPickupWindowSchema
>;

export const cancelSupplierReservationSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export type CancelSupplierReservationInput = z.infer<
  typeof cancelSupplierReservationSchema
>;

export const SUPPLIER_NO_SHOW_REPORT_REASON_CODES = [
  'LEARNER_DID_NOT_ARRIVE',
  'DRIVER_DID_NOT_ARRIVE',
  'NO_RESPONSE_AFTER_PICKUP_WINDOW',
  'REPEATED_DELAY',
  'WRONG_INFORMATION',
  'SAFETY_OR_TRUST_CONCERN',
  'OTHER',
] as const;

export type SupplierNoShowReportReasonCode =
  (typeof SUPPLIER_NO_SHOW_REPORT_REASON_CODES)[number];

export const SUPPLIER_GENERAL_INCIDENT_REASON_CODES = [
  'REPEATED_DELAY',
  'WRONG_INFORMATION',
  'SAFETY_OR_TRUST_CONCERN',
] as const satisfies readonly SupplierNoShowReportReasonCode[];

export type SupplierGeneralIncidentReasonCode =
  (typeof SUPPLIER_GENERAL_INCIDENT_REASON_CODES)[number];

export const isSupplierGeneralIncidentReasonCode = (
  reasonCode: SupplierNoShowReportReasonCode,
): reasonCode is SupplierGeneralIncidentReasonCode =>
  (SUPPLIER_GENERAL_INCIDENT_REASON_CODES as readonly string[]).includes(
    reasonCode,
  );

export const submitNoShowReportSchema = z.object({
  reasonCode: z.enum(SUPPLIER_NO_SHOW_REPORT_REASON_CODES),
  note: z.string().trim().min(1).max(1000),
});

export type SubmitNoShowReportInput = z.infer<typeof submitNoShowReportSchema>;

export const createReservationMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export type CreateReservationMessageInput = z.infer<
  typeof createReservationMessageSchema
>;

export const declineSupplierReservationSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export type DeclineSupplierReservationInput = z.infer<
  typeof declineSupplierReservationSchema
>;

export const reservationIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type ReservationIdParams = z.infer<typeof reservationIdParamsSchema>;

export const completeSupplierReservationSchema = z.object({
  confirmationCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Confirmation code must be a 6-digit number.'),
  cashReceivedConfirmed: z.boolean().optional(),
});

export type CompleteSupplierReservationInput = z.infer<
  typeof completeSupplierReservationSchema
>;

export const reportSupplierNoDriverSchema = z.object({
  note: z.string().trim().min(1, 'Note is required.').max(1000),
});

export type ReportSupplierNoDriverInput = z.infer<
  typeof reportSupplierNoDriverSchema
>;
