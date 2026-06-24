import { initialVerificationStatusForSupplierType } from '../supplier/supplier-verification.status.js';

const SUPPLIER_TYPE_ALIASES: Record<string, string> = {
  'student supplier': 'STUDENT_SUPPLIER',
  'individual supplier': 'INDIVIDUAL_SUPPLIER',
  workshop: 'WORKSHOP',
  factory: 'FACTORY',
  'educational institution': 'EDUCATIONAL_INSTITUTION',
};

export const normalizeSupplierTypeInput = (value: string): string => {
  const trimmed = value.trim();
  const alias = SUPPLIER_TYPE_ALIASES[trimmed.toLowerCase()];

  if (alias) {
    return alias;
  }

  return trimmed.toUpperCase().replace(/\s+/g, '_');
};

export const resolveInitialVerificationStatus = (supplierType: string): string => {
  const normalizedType = normalizeSupplierTypeInput(supplierType);
  return initialVerificationStatusForSupplierType(normalizedType);
};
