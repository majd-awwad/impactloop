import { z } from 'zod';

export const createReservationSchema = z.object({
  materialId: z.string().trim().min(1),
  quantityRequested: z.number().positive(),
  message: z.string().trim().max(1000).optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

export const reservationIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type ReservationIdParams = z.infer<typeof reservationIdParamsSchema>;
