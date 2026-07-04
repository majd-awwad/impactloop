import { z } from 'zod';

export const listSupplierReservationsQuerySchema = z.object({
  status: z
    .enum([
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
});

export type ListSupplierReservationsQuery = z.infer<
  typeof listSupplierReservationsQuerySchema
>;

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
    const start = new Date(value.pickupWindowStart);
    const end = new Date(value.pickupWindowEnd);

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      ctx.addIssue({
        code: 'custom',
        message: 'Pickup window dates must be valid.',
        path: ['pickupWindowEnd'],
      });
      return;
    }

    if (end <= start) {
      ctx.addIssue({
        code: 'custom',
        message: 'Pickup end time must be after start time.',
        path: ['pickupWindowEnd'],
      });
      return;
    }

    if (end.getTime() <= Date.now()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Supplier window end must be in the future.',
        path: ['pickupWindowEnd'],
      });
    }

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
    const start = new Date(value.pickupWindowStart);
    const end = new Date(value.pickupWindowEnd);

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      ctx.addIssue({
        code: 'custom',
        message: 'Pickup window dates must be valid.',
        path: ['pickupWindowEnd'],
      });
      return;
    }

    if (end <= start) {
      ctx.addIssue({
        code: 'custom',
        message: 'Pickup end time must be after start time.',
        path: ['pickupWindowEnd'],
      });
      return;
    }

    if (end.getTime() <= Date.now()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Supplier window end must be in the future.',
        path: ['pickupWindowEnd'],
      });
    }
  });

export type RescheduleSupplierReservationInput = z.infer<
  typeof rescheduleSupplierReservationSchema
>;

export const cancelSupplierReservationSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

export type CancelSupplierReservationInput = z.infer<
  typeof cancelSupplierReservationSchema
>;

export const submitNoShowReportSchema = z.object({
  reasonCode: z.enum([
    'LEARNER_DID_NOT_ARRIVE',
    'DRIVER_DID_NOT_ARRIVE',
    'NO_RESPONSE_AFTER_PICKUP_WINDOW',
    'REPEATED_DELAY',
    'WRONG_INFORMATION',
    'SAFETY_OR_TRUST_CONCERN',
    'OTHER',
  ]),
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
