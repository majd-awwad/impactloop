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
  'UNVERIFIED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'UNKNOWN',
] as const;

export type SupplierVerificationStatus =
  (typeof SUPPLIER_VERIFICATION_STATUSES)[number];

export const SUPPLIER_VERIFICATION_REVISION_STATUSES = [
  'REJECTED',
  'CHANGES_REQUESTED',
] as const satisfies readonly SupplierVerificationStatus[];

/** Includes legacy UNVERIFIED organization profiles shown in the admin queue. */
export const SUPPLIER_VERIFICATION_ADMIN_PENDING_STATUSES = [
  'PENDING',
  'UNVERIFIED',
] as const satisfies readonly SupplierVerificationStatus[];

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
  status: string | null | undefined,
): SupplierVerificationStatus => {
  const normalized = status?.trim().toUpperCase() ?? '';

  if (normalized === 'VERIFIED') {
    return 'APPROVED';
  }

  if (
    normalized === 'NOT_REQUIRED' ||
    normalized === 'UNVERIFIED' ||
    normalized === 'PENDING' ||
    normalized === 'APPROVED' ||
    normalized === 'REJECTED' ||
    normalized === 'CHANGES_REQUESTED' ||
    normalized === 'UNKNOWN'
  ) {
    return normalized;
  }

  return 'UNKNOWN';
};

export const requiresOrganizationVerification = (
  supplierType: string | null | undefined,
): boolean => isOrganizationSupplierType(supplierType);

export const isSupplierVerificationRevisionRequired = (
  status: string | null | undefined,
): boolean =>
  (
    SUPPLIER_VERIFICATION_REVISION_STATUSES as readonly SupplierVerificationStatus[]
  ).includes(normalizeSupplierVerificationStatus(status));

export const isSupplierVerificationAwaitingAdminReview = (
  status: string | null | undefined,
): boolean =>
  (
    SUPPLIER_VERIFICATION_ADMIN_PENDING_STATUSES as readonly SupplierVerificationStatus[]
  ).includes(normalizeSupplierVerificationStatus(status));

export type SupplierVerificationEligibility = {
  canSubmit: boolean;
  canResubmit: boolean;
};

export const resolveSupplierVerificationEligibility = (input: {
  supplierType: string | null | undefined;
  verificationStatus: string | null | undefined;
}): SupplierVerificationEligibility => {
  const requiresVerification = requiresOrganizationVerification(
    input.supplierType,
  );
  const status = normalizeSupplierVerificationStatus(input.verificationStatus);

  return {
    canSubmit: requiresVerification && status === 'UNVERIFIED',
    canResubmit:
      requiresVerification && isSupplierVerificationRevisionRequired(status),
  };
};

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

  if (isSupplierVerificationRevisionRequired(status)) {
    return '/supplier/verification-status';
  }

  return '/supplier/verification-pending';
};
