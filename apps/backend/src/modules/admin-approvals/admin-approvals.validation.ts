import { z } from 'zod';

export const approvalsStatusSchema = z
  .enum(['PENDING', 'APPROVED', 'REJECTED'])
  .optional();

export const approvalsListQuerySchema = z.object({
  status: approvalsStatusSchema,
  search: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ApprovalsListQuery = z.infer<typeof approvalsListQuerySchema>;

export const approvalIdParamSchema = z.object({
  id: z.string().min(1),
});

export type ApprovalIdParams = z.infer<typeof approvalIdParamSchema>;

export const approveCategoryRequestSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    finalName: z.string().trim().min(2).max(120),
    parentCategoryId: z.string().trim().min(1).optional(),
    adminNote: z.string().trim().max(1000).optional(),
  }),
);

export type ApproveCategoryRequestInput = z.infer<
  typeof approveCategoryRequestSchema
>;

export const rejectCategoryRequestSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    adminNote: z.string().trim().min(3, 'Reason is required').max(1000),
    suggestedCategoryId: z.string().trim().min(1).optional(),
  }),
);

export type RejectCategoryRequestInput = z.infer<typeof rejectCategoryRequestSchema>;

export const approvePriceRequestSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    adminNote: z.string().trim().max(1000).optional(),
  }),
);

export type ApprovePriceRequestInput = z.infer<typeof approvePriceRequestSchema>;

export const rejectPriceRequestSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    adminNote: z.string().trim().min(3, 'Reason is required').max(1000),
    maxAllowedPrice: z.coerce.number().finite().positive(),
  }),
);

export type RejectPriceRequestInput = z.infer<typeof rejectPriceRequestSchema>;

