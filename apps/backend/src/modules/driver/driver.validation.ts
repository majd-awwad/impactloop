import { z } from 'zod';

export const deliveryIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type DeliveryIdParams = z.infer<typeof deliveryIdParamsSchema>;

export const updateDriverDeliveryStatusSchema = z
  .object({
    status: z.enum([
      'ARRIVED_PICKUP',
      'PICKED_UP',
      'ON_THE_WAY',
      'ARRIVED_DROPOFF',
      'DELIVERED',
    ]),
    note: z.string().trim().max(1000).optional().nullable(),
    confirmationCode: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.status === 'PICKED_UP' || value.status === 'DELIVERED') &&
      !value.confirmationCode?.trim()
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Confirmation code is required for this status update.',
        path: ['confirmationCode'],
      });
    }

    if (
      value.confirmationCode != null &&
      value.confirmationCode.trim() !== '' &&
      !/^\d{6}$/.test(value.confirmationCode.trim())
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Confirmation code must be a 6-digit number.',
        path: ['confirmationCode'],
      });
    }
  });

export type UpdateDriverDeliveryStatusInput = z.infer<
  typeof updateDriverDeliveryStatusSchema
>;

export const createDeliveryLocationPingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyMeters: z.number().nonnegative().optional().nullable(),
  heading: z.number().min(0).max(360).optional().nullable(),
  speed: z.number().nonnegative().optional().nullable(),
  capturedAt: z.iso.datetime().optional(),
});

export type CreateDeliveryLocationPingInput = z.infer<
  typeof createDeliveryLocationPingSchema
>;

export const listAvailableDeliveriesQuerySchema = z.object({
  city: z.string().trim().min(1).max(100).optional(),
  area: z.string().trim().min(1).max(100).optional(),
  maxDistanceKm: z.coerce.number().positive().max(500).optional(),
  sortBy: z.enum(['nearest', 'newest']).optional(),
});

export type ListAvailableDeliveriesQuery = z.infer<
  typeof listAvailableDeliveriesQuerySchema
>;
