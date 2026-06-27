import { z } from 'zod';

import { materialImageUrlSchema } from '../../utils/material-image-url.js';
import { paginationQuerySchema } from '../../utils/zod-helpers.js';

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
const materialConditions = [
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'USED',
  'NEEDS_REPAIR',
] as const;
const materialSourceTypes = [
  'STUDENT_LEFTOVER',
  'WORKSHOP_SURPLUS',
  'FACTORY_SURPLUS',
  'EDUCATIONAL_INSTITUTION',
] as const;

const locationSchema = z
  .object({
    country: z.string().trim().max(100),
    city: z.string().trim().max(100),
    area: z.string().trim().max(120).optional().nullable(),
    addressLine: z.string().trim().max(250).optional().nullable(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    visibility: z.enum(visibilityValues),
    isApproximate: z.boolean(),
    locationType: z.string().trim().min(1).max(80).optional().nullable(),
  })
  .superRefine((location, ctx) => {
    const hasCoordinates =
      location.latitude != null && location.longitude != null;

    if (hasCoordinates) {
      return;
    }

    if (!location.city) {
      ctx.addIssue({
        code: 'custom',
        path: ['city'],
        message: 'city is required when coordinates are not provided',
      });
    }
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

export const createSupplierMaterialSchema = z
  .object({
    materialName: z.string().trim().min(1).max(120),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(2000),
    categoryId: z.string().trim().min(1),
    quantity: z.number().positive(),
    unit: z.string().trim().min(1).max(40),
    condition: z.enum(materialConditions),
    sourceType: z.enum(materialSourceTypes).optional(),
    isFree: z.boolean(),
    price: z.number().nonnegative().optional().nullable(),
    currency: z.literal('NIS').default('NIS'),
    pickupAllowed: z.boolean().default(true),
    deliveryAllowed: z.boolean().default(false),
    pickupNotes: z.string().trim().max(500).optional().nullable(),
    suggestedUses: z.string().trim().max(1000).optional().nullable(),
    imageUrls: z.array(materialImageUrlSchema).min(1).max(5),
    sourceCategoryRequestId: z.string().trim().min(1).optional(),
    sourcePriceRuleRequestId: z.string().trim().min(1).optional(),
    useDefaultPickupLocation: z.boolean().default(true),
    pickupLocation: locationSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.useDefaultPickupLocation && !data.pickupLocation) {
      ctx.addIssue({
        code: 'custom',
        path: ['pickupLocation'],
        message:
          'pickupLocation is required when useDefaultPickupLocation is false',
      });
    }
  });

export type CreateSupplierMaterialInput = z.infer<
  typeof createSupplierMaterialSchema
>;

const SUPPLIER_MATERIAL_STATUSES = [
  'AVAILABLE',
  'PENDING_RESERVATION',
  'RESERVED',
  'REUSED',
  'UNAVAILABLE',
] as const;

const optionalBooleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((value): boolean | undefined =>
      value === undefined ? undefined : value === 'true');

export const supplierMaterialsQuerySchema = paginationQuerySchema
  .extend({
    limit: z.coerce.number().int().min(1).max(100).default(9),
    search: z.string().trim().min(1).max(120).optional(),
    status: z.enum(SUPPLIER_MATERIAL_STATUSES).optional(),
    isFree: optionalBooleanQuery,
    categoryId: z.string().trim().min(1).optional(),
    condition: z.enum(materialConditions).optional(),
  });

export type SupplierMaterialsQuery = z.infer<
  typeof supplierMaterialsQuerySchema
>;

export const supplierMaterialIdParamSchema = z.object({
  id: z.string().trim().min(1),
});

export const updateSupplierMaterialSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).max(50),
  condition: z.enum(materialConditions),
  pickupAllowed: z.boolean(),
  deliveryAllowed: z.boolean(),
  pickupNotes: z.string().trim().max(500).optional().nullable(),
  suggestedUses: z.string().trim().max(1000).optional().nullable(),
});

export type UpdateSupplierMaterialInput = z.infer<
  typeof updateSupplierMaterialSchema
>;
