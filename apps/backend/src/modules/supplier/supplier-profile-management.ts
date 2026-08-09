import {
  isSupplierVerificationRevisionRequired,
  normalizeSupplierVerificationStatus,
  resolveSupplierVerificationEligibility,
  type SupplierVerificationStatus,
} from './supplier-verification.status.js';

export const SUPPLIER_ESSENTIAL_KEYS = [
  'PUBLIC_NAME',
  'SUPPLIER_TYPE',
  'DESCRIPTION',
  'PICKUP_LOCATION',
  'LOCATION_VISIBILITY',
] as const;

export type SupplierEssentialKey = (typeof SUPPLIER_ESSENTIAL_KEYS)[number];

export type SupplierEssentialsInput = {
  publicName: string | null | undefined;
  supplierType: string | null | undefined;
  description: string | null | undefined;
  pickupLocation: {
    country: string | null | undefined;
    city: string | null | undefined;
    visibility: string | null | undefined;
  } | null | undefined;
};

export type SupplierEssentialsCompletion = {
  completedCount: number;
  totalCount: number;
  percentage: number;
  missingFields: SupplierEssentialKey[];
};

export const calculateSupplierEssentialsCompletion = (
  input: SupplierEssentialsInput,
): SupplierEssentialsCompletion => {
  const missingFields: SupplierEssentialKey[] = [];

  if (!input.publicName?.trim()) missingFields.push('PUBLIC_NAME');
  if (!input.supplierType?.trim()) missingFields.push('SUPPLIER_TYPE');
  if (!input.description?.trim()) missingFields.push('DESCRIPTION');

  const hasPickupLocation = Boolean(
    input.pickupLocation?.country?.trim() && input.pickupLocation.city?.trim(),
  );
  if (!hasPickupLocation) missingFields.push('PICKUP_LOCATION');
  if (!input.pickupLocation?.visibility?.trim()) {
    missingFields.push('LOCATION_VISIBILITY');
  }

  const totalCount = SUPPLIER_ESSENTIAL_KEYS.length;
  const completedCount = totalCount - missingFields.length;

  return {
    completedCount,
    totalCount,
    percentage: Math.round((completedCount / totalCount) * 100),
    missingFields,
  };
};

export const normalizeWorkingDays = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;

  const days = value.map((item) => (typeof item === 'string' ? item.trim() : ''));
  return days.every(Boolean) ? days : null;
};

export const normalizeWorkingHours = (
  value: unknown,
): Record<string, string> | null => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, string> = {};

  for (const key of ['from', 'to', 'start', 'end']) {
    if (!(key in source)) continue;
    if (typeof source[key] !== 'string') return null;

    const normalized = source[key].trim();
    if (normalized) result[key] = normalized;
  }

  return Object.keys(result).length > 0 ? result : null;
};

export type SupplierManagementVerification = {
  rawStatus: string;
  status: SupplierVerificationStatus;
  isVerified: boolean;
  canSubmit: boolean;
  canResubmit: boolean;
  adminNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
};

export const buildSupplierManagementVerification = (input: {
  rawStatus: string | null | undefined;
  supplierType: string | null | undefined;
  adminNote?: string | null;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
}): SupplierManagementVerification => {
  const rawStatus = input.rawStatus?.trim() || 'UNKNOWN';
  const status = normalizeSupplierVerificationStatus(rawStatus);
  const eligibility = resolveSupplierVerificationEligibility({
    supplierType: input.supplierType,
    verificationStatus: status,
  });

  return {
    rawStatus,
    status,
    isVerified: status === 'APPROVED' || status === 'NOT_REQUIRED',
    canSubmit: eligibility.canSubmit,
    canResubmit: eligibility.canResubmit,
    adminNote: isSupplierVerificationRevisionRequired(status)
      ? input.adminNote?.trim() || null
      : null,
    submittedAt: input.submittedAt?.toISOString() ?? null,
    reviewedAt: input.reviewedAt?.toISOString() ?? null,
  };
};
