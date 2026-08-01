import { z } from 'zod';
import { PARTIAL_PICKUP_UNPICKED_REASONS } from './driver-partial-pickup.js';

export const deliveryIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type DeliveryIdParams = z.infer<typeof deliveryIdParamsSchema>;

const partialPickupUnpickedSchema = z.object({
  reservationId: z.string().trim().min(1),
  reason: z.enum(
    PARTIAL_PICKUP_UNPICKED_REASONS as unknown as [
      (typeof PARTIAL_PICKUP_UNPICKED_REASONS)[number],
      ...(typeof PARTIAL_PICKUP_UNPICKED_REASONS)[number][],
    ],
  ),
  note: z.string().trim().max(1000).optional().nullable(),
});

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
    pickedReservationIds: z.array(z.string().trim().min(1)).optional(),
    unpicked: z.array(partialPickupUnpickedSchema).optional(),
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

    const hasPicked = value.pickedReservationIds != null;
    const hasUnpicked = value.unpicked != null;

    if (value.status !== 'PICKED_UP' && (hasPicked || hasUnpicked)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Partial pickup selection is only allowed for PICKED_UP.',
        path: ['pickedReservationIds'],
      });
    }

    if (value.status === 'PICKED_UP' && hasPicked !== hasUnpicked) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Partial pickup requires both pickedReservationIds and unpicked.',
        path: hasPicked ? ['unpicked'] : ['pickedReservationIds'],
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
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().trim().min(1).optional(),
});

export type ListAvailableDeliveriesQuery = {
  city?: string;
  area?: string;
  maxDistanceKm?: number;
  sortBy?: 'nearest' | 'newest';
  limit?: number;
  cursor?: string;
};
