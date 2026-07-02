export const ORGANIZATION_SUPPLIER_TYPES = [
  'WORKSHOP',
  'FACTORY',
  'EDUCATIONAL_INSTITUTION',
] as const;

export const INDIVIDUAL_SUPPLIER_TYPES = [
  'STUDENT_SUPPLIER',
  'INDIVIDUAL_SUPPLIER',
] as const;

export type OrganizationSupplierType =
  (typeof ORGANIZATION_SUPPLIER_TYPES)[number];

export const SUPPLIER_VERIFICATION_STATUSES = [
  'NOT_REQUIRED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
] as const;

export type SupplierVerificationStatus =
  (typeof SUPPLIER_VERIFICATION_STATUSES)[number];

export const isOrganizationSupplierType = (
  supplierType: string | null | undefined,
): supplierType is OrganizationSupplierType => {
  if (!supplierType) {
    return false;
  }

  return ORGANIZATION_SUPPLIER_TYPES.includes(
    supplierType.trim().toUpperCase() as OrganizationSupplierType,
  );
};

export const isIndividualSupplierType = (
  supplierType: string | null | undefined,
): boolean => {
  if (!supplierType) {
    return false;
  }

  return INDIVIDUAL_SUPPLIER_TYPES.includes(
    supplierType.trim().toUpperCase() as (typeof INDIVIDUAL_SUPPLIER_TYPES)[number],
  );
};

export const normalizeSupplierVerificationStatus = (
  status: string,
): SupplierVerificationStatus => {
  const normalized = status.trim().toUpperCase();

  if (normalized === 'VERIFIED') {
    return 'APPROVED';
  }

  if (
    normalized === 'NOT_REQUIRED' ||
    normalized === 'PENDING' ||
    normalized === 'APPROVED' ||
    normalized === 'REJECTED' ||
    normalized === 'CHANGES_REQUESTED'
  ) {
    return normalized;
  }

  if (normalized === 'UNVERIFIED') {
    return 'PENDING';
  }

  return 'PENDING';
};

export const requiresOrganizationVerification = (
  supplierType: string | null | undefined,
): boolean => isOrganizationSupplierType(supplierType);

export const canSupplierPublishMaterials = (input: {
  supplierType: string | null | undefined;
  verificationStatus: string;
}): boolean => {
  if (!requiresOrganizationVerification(input.supplierType)) {
    return true;
  }

  return normalizeSupplierVerificationStatus(input.verificationStatus) === 'APPROVED';
};

export const initialVerificationStatusForSupplierType = (
  supplierType: string,
): string => {
  if (isIndividualSupplierType(supplierType)) {
    return 'NOT_REQUIRED';
  }

  if (isOrganizationSupplierType(supplierType)) {
    return 'UNVERIFIED';
  }

  return 'NOT_REQUIRED';
};

export const supplierVerificationGateRoute = (input: {
  supplierType: string | null | undefined;
  verificationStatus: string;
}): '/supplier/verification-pending' | '/supplier/verification-status' | null => {
  if (!requiresOrganizationVerification(input.supplierType)) {
    return null;
  }

  const status = normalizeSupplierVerificationStatus(input.verificationStatus);

  if (status === 'APPROVED' || status === 'NOT_REQUIRED') {
    return null;
  }

  if (status === 'REJECTED' || status === 'CHANGES_REQUESTED') {
    return '/supplier/verification-status';
  }

  return '/supplier/verification-pending';
};
