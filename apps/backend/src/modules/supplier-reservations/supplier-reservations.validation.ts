import { z } from 'zod';

export const listSupplierReservationsQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'declined', 'completed']).optional(),
});

export type ListSupplierReservationsQuery = z.infer<
  typeof listSupplierReservationsQuerySchema
>;

export const acceptSupplierReservationSchema = z
  .object({
    pickupWindowStart: z.iso.datetime(),
    pickupWindowEnd: z.iso.datetime(),
    supplierNote: z.string().trim().max(1000).optional(),
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
    }
  });

export type AcceptSupplierReservationInput = z.infer<
  typeof acceptSupplierReservationSchema
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
