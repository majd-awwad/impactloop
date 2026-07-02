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
