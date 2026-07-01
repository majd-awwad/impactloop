import type { UserRole } from '../../generated/prisma/client.js';

import {
  isIndividualSupplierType,
  isOrganizationSupplierType,
  INDIVIDUAL_SUPPLIER_TYPES,
} from '../supplier/supplier-verification.status.js';
import { normalizeSupplierTypeInput } from './supplier-type.js';

export const PORTAL_ROLES = ['LEARNER', 'SUPPLIER'] as const;

export type PortalRole = (typeof PORTAL_ROLES)[number];

export type PersonalBecomeSupplierType =
  (typeof INDIVIDUAL_SUPPLIER_TYPES)[number];

export const BECOME_SUPPLIER_BLOCKED_TYPES = [
  'WORKSHOP',
  'STORE',
  'FACTORY',
  'UNIVERSITY_LAB',
  'EDUCATIONAL_INSTITUTION',
] as const;

export type RoleCapabilityInput = {
  roles: UserRole[];
  supplierType: string | null | undefined;
  hasSupplierProfile: boolean;
};

export const userHasRole = (
  roles: UserRole[],
  role: UserRole,
): boolean => roles.includes(role);

export const normalizeBecomeSupplierType = (
  supplierType: string,
): string => normalizeSupplierTypeInput(supplierType);

export const isAllowedBecomeSupplierType = (
  supplierType: string,
): supplierType is PersonalBecomeSupplierType => {
  const normalized = normalizeBecomeSupplierType(supplierType);
  return INDIVIDUAL_SUPPLIER_TYPES.includes(
    normalized as PersonalBecomeSupplierType,
  );
};

export const isBlockedBecomeSupplierType = (supplierType: string): boolean => {
  const normalized = normalizeBecomeSupplierType(supplierType);
  return (
    isOrganizationSupplierType(normalized) ||
    BECOME_SUPPLIER_BLOCKED_TYPES.includes(
      normalized as (typeof BECOME_SUPPLIER_BLOCKED_TYPES)[number],
    )
  );
};

export const isBlockedLearnerPortalSwitch = (
  supplierType: string | null | undefined,
): boolean => {
  if (!supplierType) {
    return false;
  }

  return isBlockedBecomeSupplierType(supplierType);
};

export const canSwitchToSupplier = (input: RoleCapabilityInput): boolean =>
  userHasRole(input.roles, 'SUPPLIER') && input.hasSupplierProfile;

export const canSwitchToLearner = (input: RoleCapabilityInput): boolean => {
  if (
    input.hasSupplierProfile &&
    isBlockedLearnerPortalSwitch(input.supplierType)
  ) {
    return false;
  }

  if (userHasRole(input.roles, 'LEARNER')) {
    return true;
  }

  if (!input.hasSupplierProfile) {
    return false;
  }

  return isIndividualSupplierType(input.supplierType);
};

export const canGrantLearnerRoleOnSwitch = (
  input: RoleCapabilityInput,
): boolean => {
  if (userHasRole(input.roles, 'LEARNER')) {
    return false;
  }

  if (isBlockedLearnerPortalSwitch(input.supplierType)) {
    return false;
  }

  return (
    input.hasSupplierProfile && isIndividualSupplierType(input.supplierType)
  );
};

export const isOrganizationSupplierBlockedFromLearner = (
  supplierType: string | null | undefined,
): boolean => isOrganizationSupplierType(supplierType);

export const resolveDefaultActiveRole = (input: {
  roles: UserRole[];
  storedActiveRole: UserRole | null;
}): UserRole => {
  if (
    input.storedActiveRole &&
    input.roles.includes(input.storedActiveRole)
  ) {
    return input.storedActiveRole;
  }

  if (input.roles.includes('ADMIN')) {
    return 'ADMIN';
  }

  if (input.roles.includes('DRIVER')) {
    return 'DRIVER';
  }

  if (input.roles.includes('MODERATOR')) {
    return 'MODERATOR';
  }

  if (input.roles.includes('SUPPLIER') && !input.roles.includes('LEARNER')) {
    return 'SUPPLIER';
  }

  return 'LEARNER';
};

export const resolveDefaultPortalRoute = (activeRole: UserRole): string => {
  switch (activeRole) {
    case 'ADMIN':
      return '/admin';
    case 'DRIVER':
      return '/driver/jobs';
    case 'SUPPLIER':
      return '/supplier/overview';
    default:
      return '/home';
  }
};

export const resolveActiveRoleAfterBecomeSupplier = (): PortalRole =>
  'SUPPLIER';

export const resolveActiveRoleForRegistration = (roles: UserRole[]): UserRole => {
  if (roles.includes('LEARNER')) {
    return 'LEARNER';
  }

  if (roles.includes('SUPPLIER')) {
    return 'SUPPLIER';
  }

  return roles[0] ?? 'LEARNER';
};
