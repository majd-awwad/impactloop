import { z } from 'zod';

const preferredWindowSchema = z
  .object({
    start: z.iso.datetime(),
    end: z.iso.datetime(),
  })
  .superRefine((value, ctx) => {
    const start = new Date(value.start);
    const end = new Date(value.end);

    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      ctx.addIssue({
        code: 'custom',
        message: 'Preferred window dates must be valid.',
        path: ['end'],
      });
      return;
    }

    if (end <= start) {
      ctx.addIssue({
        code: 'custom',
        message: 'Preferred window end must be after start.',
        path: ['end'],
      });
      return;
    }

    if (end.getTime() <= Date.now()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Preferred window must be in the future.',
        path: ['end'],
      });
    }
  });

export const createReservationSchema = z
  .object({
    materialId: z.string().trim().min(1),
    quantityRequested: z.number().positive(),
    message: z.string().trim().max(1000).optional(),
    fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY']),
    learnerPreferredPickupWindows: z.array(preferredWindowSchema).optional(),
    learnerPreferredDeliveryWindows: z.array(preferredWindowSchema).optional(),
    deliveryAddressText: z.string().trim().min(1).max(500).optional(),
    safeDropoffAllowed: z.boolean().optional(),
    deliveryNote: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.fulfillmentMethod === 'PICKUP') {
      if (!value.learnerPreferredPickupWindows?.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'At least one preferred pickup window is required.',
          path: ['learnerPreferredPickupWindows'],
        });
      }
      return;
    }

    if (!value.learnerPreferredDeliveryWindows?.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one preferred delivery window is required.',
        path: ['learnerPreferredDeliveryWindows'],
      });
    }

    if (!value.deliveryAddressText?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Delivery address is required.',
        path: ['deliveryAddressText'],
      });
    }

    if (value.safeDropoffAllowed === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'Safe drop-off preference is required.',
        path: ['safeDropoffAllowed'],
      });
    }
  });

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const reservationIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type ReservationIdParams = z.infer<typeof reservationIdParamsSchema>;

export const createReservationMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

export type CreateReservationMessageInput = z.infer<
  typeof createReservationMessageSchema
>;

export const learnerConfirmationSchema = z
  .object({
    action: z.enum([
      'ACCEPT_PROPOSED_PICKUP',
      'SUBMIT_DELIVERY_WINDOW',
      'CANCEL',
    ]),
    deliveryWindow: preferredWindowSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.action === 'SUBMIT_DELIVERY_WINDOW' &&
      !value.deliveryWindow
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Delivery window is required for this action.',
        path: ['deliveryWindow'],
      });
    }
  });

export type LearnerConfirmationInput = z.infer<typeof learnerConfirmationSchema>;

export const requestPickupRescheduleSchema = z
  .object({
    pickupWindowStart: z.iso.datetime(),
    pickupWindowEnd: z.iso.datetime(),
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
        message: 'Pickup window must be in the future.',
        path: ['pickupWindowEnd'],
      });
    }
  });

export type RequestPickupRescheduleInput = z.infer<
  typeof requestPickupRescheduleSchema
>;

export const reportSupplierIssueSchema = z.object({
  reason: z.enum([
    'SUPPLIER_UNAVAILABLE',
    'SUPPLIER_MATERIAL_NOT_READY',
    'WRONG_PICKUP_INFO',
    'OTHER',
  ]),
  note: z.string().trim().max(1000).optional(),
});

export type ReportSupplierIssueInput = z.infer<typeof reportSupplierIssueSchema>;

export const reportNoDriverSchema = z.object({
  note: z.string().trim().min(1, 'Note is required.').max(1000),
});

export type ReportNoDriverInput = z.infer<typeof reportNoDriverSchema>;
