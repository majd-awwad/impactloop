import { z } from 'zod';

const materialConditionSchema = z.enum([
  'NEW',
  'LIKE_NEW',
  'GOOD',
  'USED',
  'NEEDS_REPAIR',
]);

const materialSourceTypeSchema = z.enum([
  'STUDENT_LEFTOVER',
  'WORKSHOP_SURPLUS',
  'FACTORY_SURPLUS',
  'EDUCATIONAL_INSTITUTION',
]);

export const listingDraftJsonSchema = z.object({
  materialName: z.string().trim().max(200).default(''),
  title: z.string().trim().max(200).default(''),
  description: z.string().trim().max(5000).default(''),
  requestedCategoryName: z.string().trim().min(1).max(200),
  categoryId: z.string().trim().min(1).nullable().optional(),
  condition: materialConditionSchema,
  sourceType: materialSourceTypeSchema.optional(),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).max(40),
  isFree: z.boolean(),
  price: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().min(1).max(10).default('NIS'),
  pickupAllowed: z.boolean().default(true),
  deliveryAllowed: z.boolean().default(false),
  pickupNotes: z.string().trim().max(2000).nullable().optional(),
  suggestedUses: z.string().trim().max(2000).nullable().optional(),
  imageUrls: z.array(z.string()).max(20).default([]),
});

export const createCategoryRequestSchema = z.object({
  requestedName: z.string().trim().min(1).max(200),
  listingDraftJson: listingDraftJsonSchema,
});

export type CreateCategoryRequestInput = z.infer<typeof createCategoryRequestSchema>;
export type ListingDraftJson = z.infer<typeof listingDraftJsonSchema>;
