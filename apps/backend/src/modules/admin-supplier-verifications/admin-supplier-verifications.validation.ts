import { z } from 'zod';

import {
  ADMIN_SUPPLIER_VERIFICATION_STATUSES,
  OFFICIAL_SUPPLIER_TYPES,
} from './admin-supplier-verifications.status.js';

export const supplierVerificationIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listSupplierVerificationsQuerySchema = z.object({
  status: z.enum(ADMIN_SUPPLIER_VERIFICATION_STATUSES).optional(),
  search: z.string().trim().max(200).optional(),
  supplierType: z.enum(OFFICIAL_SUPPLIER_TYPES).optional(),
  city: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const approveSupplierVerificationSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    adminNote: z.string().trim().max(1000).optional(),
  }),
);

export const rejectSupplierVerificationSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    adminNote: z.string().trim().min(3, 'Reason is required').max(1000),
  }),
);

export const requestChangesSupplierVerificationSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    adminNote: z.string().trim().min(3, 'Reason is required').max(1000),
  }),
);

export type ListSupplierVerificationsQuery = z.infer<
  typeof listSupplierVerificationsQuerySchema
>;
export type ApproveSupplierVerificationInput = z.infer<
  typeof approveSupplierVerificationSchema
>;
export type RejectSupplierVerificationInput = z.infer<
  typeof rejectSupplierVerificationSchema
>;
export type RequestChangesSupplierVerificationInput = z.infer<
  typeof requestChangesSupplierVerificationSchema
>;
