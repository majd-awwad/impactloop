import { z } from 'zod';

export const savedDropoffLocationSchema = z.object({
  country: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  area: z.string().trim().max(120).optional().nullable(),
  addressLine: z.string().trim().max(250).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  isApproximate: z.boolean().default(false),
});

export const createSavedDropoffAddressSchema = z.object({
  label: z.string().trim().min(1).max(80),
  location: savedDropoffLocationSchema,
  isDefault: z.boolean().optional().default(false),
});

export const updateSavedDropoffAddressSchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    location: savedDropoffLocationSchema.optional(),
    isDefault: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.label !== undefined ||
      value.location !== undefined ||
      value.isDefault !== undefined,
    {
      message: 'At least one field must be provided.',
    },
  );

export const savedDropoffAddressIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type CreateSavedDropoffAddressInput = z.infer<
  typeof createSavedDropoffAddressSchema
>;
export type UpdateSavedDropoffAddressInput = z.infer<
  typeof updateSavedDropoffAddressSchema
>;
export type SavedDropoffLocationInput = z.infer<
  typeof savedDropoffLocationSchema
>;
