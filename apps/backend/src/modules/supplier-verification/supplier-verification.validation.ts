import { z } from 'zod';

import { ORGANIZATION_SUPPLIER_TYPES } from '../supplier/supplier-verification.status.js';

const locationSchema = z.object({
  country: z.string().trim().max(100).default('Palestine'),
  city: z.string().trim().min(2).max(100),
  area: z.string().trim().min(2).max(120),
  addressLine: z.string().trim().max(250).optional().nullable(),
});

export const submitSupplierVerificationSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  supplierType: z.enum(ORGANIZATION_SUPPLIER_TYPES),
  description: z.string().trim().max(500).optional().nullable(),
  contactPersonName: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().min(5).max(30).optional().nullable(),
  defaultPickupLocation: locationSchema,
  businessLocation: locationSchema,
  verificationDocumentUrl: z.string().trim().min(1).max(500),
  verificationDocumentName: z.string().trim().min(1).max(255),
});

export const resubmitSupplierVerificationSchema = z.object({
  verificationDocumentUrl: z.string().trim().min(1).max(500),
  verificationDocumentName: z.string().trim().min(1).max(255),
  organizationName: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  contactPersonName: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().min(5).max(30).optional().nullable(),
  defaultPickupLocation: locationSchema.optional(),
  businessLocation: locationSchema.optional(),
});

export type SubmitSupplierVerificationInput = z.infer<
  typeof submitSupplierVerificationSchema
>;
export type ResubmitSupplierVerificationInput = z.infer<
  typeof resubmitSupplierVerificationSchema
>;
