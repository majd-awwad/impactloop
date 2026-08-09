import { ORGANIZATION_SUPPLIER_TYPES } from '../supplier/supplier-verification.status.js';

export const ADMIN_SUPPLIER_VERIFICATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
] as const;

export type AdminSupplierVerificationStatus =
  (typeof ADMIN_SUPPLIER_VERIFICATION_STATUSES)[number];

export const OFFICIAL_SUPPLIER_TYPES = ORGANIZATION_SUPPLIER_TYPES;

export type OfficialSupplierType = (typeof OFFICIAL_SUPPLIER_TYPES)[number];

export const mapDbVerificationStatusToAdmin = (
  status: string,
): AdminSupplierVerificationStatus => {
  const normalized = status.trim().toUpperCase();

  if (normalized === 'VERIFIED' || normalized === 'APPROVED') {
    return 'APPROVED';
  }

  if (normalized === 'REJECTED') {
    return 'REJECTED';
  }

  if (normalized === 'CHANGES_REQUESTED') {
    return 'CHANGES_REQUESTED';
  }

  return 'PENDING';
};

export const mapAdminVerificationStatusToDb = (
  status: AdminSupplierVerificationStatus,
): string => {
  switch (status) {
    case 'APPROVED':
      return 'APPROVED';
    case 'REJECTED':
      return 'REJECTED';
    case 'CHANGES_REQUESTED':
      return 'CHANGES_REQUESTED';
    default:
      return 'PENDING';
  }
};

export const mapAdminStatusToDocumentStatus = (
  status: AdminSupplierVerificationStatus,
): 'PENDING' | 'VERIFIED' | 'REJECTED' | 'CHANGES_REQUESTED' => {
  switch (status) {
    case 'APPROVED':
      return 'VERIFIED';
    case 'REJECTED':
      return 'REJECTED';
    case 'CHANGES_REQUESTED':
      return 'CHANGES_REQUESTED';
    default:
      return 'PENDING';
  }
};
