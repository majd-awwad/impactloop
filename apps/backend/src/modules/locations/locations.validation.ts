import { z } from 'zod';

export const reverseGeocodeSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const forwardGeocodeSchema = z.object({
  country: z.string().trim().min(1).max(120).default('Palestine'),
  city: z.string().trim().min(1).max(120),
  area: z
    .string()
    .trim()
    .max(120)
    .optional()
    .nullable()
    .transform((value) => (value?.trim() ? value.trim() : null)),
  addressLine: z
    .string()
    .trim()
    .max(240)
    .optional()
    .nullable()
    .transform((value) => (value?.trim() ? value.trim() : null)),
});

const optionalTrimmedString = (max = 160) =>
  z.string().trim().min(1).max(max).optional();

const nullableTrimmedString = (max = 240) =>
  z.preprocess(
    (value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const normalized = String(value).trim();
      return normalized.length === 0 ? null : normalized;
    },
    z.string().max(max).nullable().optional(),
  );

const locationCoordinateFields = {
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
};

const requireCoordinatePair = <T extends { latitude?: number | null; longitude?: number | null }>(
  value: T,
  ctx: z.RefinementCtx,
) => {
  const hasLatitude = value.latitude != null;
  const hasLongitude = value.longitude != null;

  if (hasLatitude !== hasLongitude) {
    ctx.addIssue({
      code: 'custom',
      path: hasLatitude ? ['longitude'] : ['latitude'],
      message: 'latitude and longitude must be provided together',
    });
  }
};

export const savedLocationSchema = z
  .object({
    label: z.string().trim().min(1).max(80),
    country: z.string().trim().min(1).max(120).default('Palestine'),
    city: z.string().trim().min(1).max(120),
    area: nullableTrimmedString(120),
    addressLine: nullableTrimmedString(240),
    ...locationCoordinateFields,
    isDefault: z.boolean().optional().default(false),
  })
  .superRefine(requireCoordinatePair);

export const updateSavedLocationSchema = z
  .object({
    label: optionalTrimmedString(80),
    country: optionalTrimmedString(120),
    city: optionalTrimmedString(120),
    area: nullableTrimmedString(120),
    addressLine: nullableTrimmedString(240),
    ...locationCoordinateFields,
    isDefault: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    requireCoordinatePair(value, ctx);

    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'At least one field must be provided',
      });
    }
  });

export const savedLocationIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export type ReverseGeocodeInput = z.infer<typeof reverseGeocodeSchema>;
export type ForwardGeocodeInput = z.infer<typeof forwardGeocodeSchema>;
export type SavedLocationInput = z.infer<typeof savedLocationSchema>;
export type UpdateSavedLocationInput = z.infer<typeof updateSavedLocationSchema>;
