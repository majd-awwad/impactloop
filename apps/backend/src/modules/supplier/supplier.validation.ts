import { z } from 'zod';

const supplierTypes = [
  'STUDENT_SUPPLIER',
  'INDIVIDUAL_SUPPLIER',
  'WORKSHOP',
  'FACTORY',
  'EDUCATIONAL_INSTITUTION',
] as const;

const organizationTypes = [
  'WORKSHOP',
  'FACTORY',
  'EDUCATIONAL_INSTITUTION',
] as const;

const visibilityValues = ['PUBLIC', 'ORDER_ONLY', 'PRIVATE'] as const;

const locationSchema = z.object({
  country: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  area: z.string().trim().max(120).optional().nullable(),
  addressLine: z.string().trim().max(250).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  visibility: z.enum(visibilityValues),
  isApproximate: z.boolean(),
  locationType: z.string().trim().min(1).max(80).optional().nullable(),
});

const organizationProfileSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  organizationType: z.enum(organizationTypes),
  contactPersonName: z.string().trim().max(100).optional().nullable(),
  workingDays: z.array(z.string().trim().min(1).max(30)).optional().nullable(),
  workingHours: z
    .object({
      from: z.string().trim().max(20).optional(),
      to: z.string().trim().max(20).optional(),
    })
    .optional()
    .nullable(),
  businessLocation: locationSchema.optional().nullable(),
});

export const updateSupplierProfileSchema = z
  .object({
    publicName: z.string().trim().min(2).max(80),
    supplierType: z.enum(supplierTypes),
    description: z.string().trim().max(500).optional().nullable(),
    defaultPickupLocation: locationSchema,
    organizationProfile: organizationProfileSchema.optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const isOrganizationLike = organizationTypes.includes(
      data.supplierType as (typeof organizationTypes)[number],
    );

    if (!isOrganizationLike) {
      return;
    }

    if (!data.organizationProfile) {
      ctx.addIssue({
        code: 'custom',
        path: ['organizationProfile'],
        message: 'organizationProfile is required for organization suppliers',
      });
      return;
    }

    if (data.organizationProfile.organizationType !== data.supplierType) {
      ctx.addIssue({
        code: 'custom',
        path: ['organizationProfile', 'organizationType'],
        message: 'organizationType must match supplierType',
      });
    }
  });

export type UpdateSupplierProfileInput = z.infer<
  typeof updateSupplierProfileSchema
>;
