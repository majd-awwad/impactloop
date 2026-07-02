import { z } from 'zod';

export const listSupplierReservationsQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'declined', 'completed']).optional(),
});

export type ListSupplierReservationsQuery = z.infer<
  typeof listSupplierReservationsQuerySchema
>;

const pickupWindowSchema = z
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

export const acceptSupplierReservationSchema = pickupWindowSchema;

export type AcceptSupplierReservationInput = z.infer<
  typeof acceptSupplierReservationSchema
>;

export const rescheduleSupplierReservationSchema = pickupWindowSchema.extend({
  messageToLearner: z.string().trim().max(1000).optional(),
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
    'OTHER',
  ]),
  note: z.string().trim().max(1000).optional(),
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
