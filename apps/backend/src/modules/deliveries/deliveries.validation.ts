import { z } from 'zod';

const locationSchema = z.object({
  country: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  area: z.string().trim().max(120).optional().nullable(),
  addressLine: z.string().trim().max(250).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  visibility: z.enum(['PUBLIC', 'ORDER_ONLY', 'PRIVATE']).default('PRIVATE'),
  isApproximate: z.boolean().default(false),
});

export const requestDeliverySchema = z.object({
  dropoffLocation: locationSchema,
  learnerNote: z.string().trim().max(1000).optional().nullable(),
});

export type RequestDeliveryInput = z.infer<typeof requestDeliverySchema>;

export const reservationIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type ReservationIdParams = z.infer<typeof reservationIdParamsSchema>;

export const deliveryIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type DeliveryIdParams = z.infer<typeof deliveryIdParamsSchema>;
