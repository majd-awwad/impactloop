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

export const requestDeliverySchema = z
  .object({
    dropoffLocation: locationSchema.optional(),
    savedDropoffAddressId: z.string().trim().min(1).optional(),
    saveDropoffAddressLabel: z.string().trim().min(1).max(80).optional().nullable(),
    learnerNote: z.string().trim().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasInline = Boolean(data.dropoffLocation);
    const hasSaved = Boolean(data.savedDropoffAddressId);

    if (hasInline === hasSaved) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either dropoffLocation or savedDropoffAddressId.',
        path: ['dropoffLocation'],
      });
    }

    if (data.saveDropoffAddressLabel && !data.dropoffLocation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'saveDropoffAddressLabel requires dropoffLocation.',
        path: ['saveDropoffAddressLabel'],
      });
    }
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
