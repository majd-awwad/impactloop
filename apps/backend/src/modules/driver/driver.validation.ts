import { z } from 'zod';

export const deliveryIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type DeliveryIdParams = z.infer<typeof deliveryIdParamsSchema>;

export const updateDriverDeliveryStatusSchema = z.object({
  status: z.enum([
    'ARRIVED_PICKUP',
    'PICKED_UP',
    'ON_THE_WAY',
    'ARRIVED_DROPOFF',
    'DELIVERED',
  ]),
  note: z.string().trim().max(1000).optional().nullable(),
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
