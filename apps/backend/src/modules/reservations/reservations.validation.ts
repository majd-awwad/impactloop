import { z } from 'zod';

import {
  mapPickupValidationFailureToZodIssue,
  validatePickupWindow,
} from './pickup-window-validation.js';

const preferredWindowSchema = z
  .object({
    start: z.iso.datetime(),
    end: z.iso.datetime(),
  })
  .superRefine((value, ctx) => {
    const failure = validatePickupWindow(
      {
        start: new Date(value.start),
        end: new Date(value.end),
      },
      'learner_preferred',
    );

    if (failure) {
      ctx.addIssue(mapPickupValidationFailureToZodIssue(failure));
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
    dropoffCity: z.string().trim().min(1).max(120).optional(),
    dropoffArea: z.string().trim().max(120).optional(),
    safeDropoffAllowed: z.boolean().optional(),
    deliveryNote: z.string().trim().max(1000).optional(),
    buildItemId: z.string().trim().min(1).optional(),
    materialRequestMatchId: z.string().trim().min(1).optional(),
    combineWithDeliveryGroupId: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.fulfillmentMethod === 'PICKUP') {
      return;
    }

    if (!value.deliveryAddressText?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Delivery address is required.',
        path: ['deliveryAddressText'],
      });
    }

    if (!value.dropoffCity?.trim()) {
      ctx.addIssue({
        code: 'custom',
        message: 'Drop-off city is required for delivery.',
        path: ['dropoffCity'],
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

export const reservationQuoteSchema = z
  .object({
    materialId: z.string().trim().min(1),
    quantity: z.number().positive(),
    fulfillmentMethod: z.enum(['PICKUP', 'DELIVERY']),
    dropoffCity: z.string().trim().min(1).max(120).optional(),
    dropoffArea: z.string().trim().max(120).optional(),
    learnerPreferredDeliveryWindows: z.array(preferredWindowSchema).optional(),
    combineWithDeliveryGroupId: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.fulfillmentMethod === 'DELIVERY') {
      if (!value.dropoffCity?.trim()) {
        ctx.addIssue({
          code: 'custom',
          message: 'Drop-off city is required for delivery pricing.',
          path: ['dropoffCity'],
        });
      }
    }
  });

export type ReservationQuoteInput = z.infer<typeof reservationQuoteSchema>;

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
    pickupWindowStart: z.string().optional(),
    pickupWindowEnd: z.string().optional(),
    reason: z.string().trim().min(1).max(500),
    note: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    const startRaw = value.pickupWindowStart?.trim();
    const endRaw = value.pickupWindowEnd?.trim();

    if (!startRaw || !endRaw) {
      ctx.addIssue({
        code: 'custom',
        message: 'A new pickup window is required for reschedule requests.',
        path: ['pickupWindowStart'],
      });
      return;
    }

    const start = new Date(startRaw);
    const end = new Date(endRaw);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Pickup window dates must be valid.',
        path: ['pickupWindowStart'],
      });
      return;
    }

    const failure = validatePickupWindow(
      { start, end },
      'learner_preferred',
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
