import { decimalToNumber } from '../../utils/decimal.js';

import type { AdminMaterialExportRecord } from './admin-materials.repository.js';

export type MaterialExportRecord = {
  materialId: string;
  title: string;
  categoryNameEn: string;
  categoryNameAr: string;
  supplierName: string;
  supplierEmail: string;
  supplierVerificationStatus: string;
  city: string;
  area: string;
  quantity: number;
  unit: string;
  condition: string;
  freeOrPaid: string;
  price: number | null;
  currency: string;
  materialStatus: string;
  reportCount: number;
  pendingReportCount: number;
  createdAt: Date;
  updatedAt: Date;
};

const resolveSupplierName = (material: AdminMaterialExportRecord): string =>
  material.supplierProfile?.organizationProfile?.organizationName?.trim() ||
  material.supplierProfile?.publicName?.trim() ||
  material.owner.displayName ||
  'Unknown supplier';

/**
 * Explicit safe mapper — never pass Prisma records to writers.
 * Omits secrets, phones, addresses, coordinates, images, descriptions,
 * moderation internals, and report notes.
 */
export const toMaterialExportRecord = (
  material: AdminMaterialExportRecord,
  pendingReportCount: number,
): MaterialExportRecord => ({
  materialId: material.id,
  title: material.title,
  categoryNameEn: material.category.nameEn,
  categoryNameAr: material.category.nameAr,
  supplierName: resolveSupplierName(material),
  supplierEmail: material.owner.email,
  supplierVerificationStatus:
    material.supplierProfile?.verificationStatus ?? 'NOT_REQUIRED',
  city: material.location.city,
  area: material.location.area ?? '',
  quantity: decimalToNumber(material.quantity) ?? 0,
  unit: material.unit,
  condition: material.condition,
  freeOrPaid: material.isFree ? 'Free' : 'Paid',
  price: material.price == null ? null : decimalToNumber(material.price),
  currency: material.currency,
  materialStatus: material.status,
  reportCount: material._count.reports,
  pendingReportCount,
  createdAt: material.createdAt,
  updatedAt: material.updatedAt,
});

export const MATERIAL_EXPORT_HEADERS = [
  'Material ID',
  'Title',
  'Category',
  'Category (AR)',
  'Supplier name',
  'Supplier email',
  'Supplier verification status',
  'City',
  'Area',
  'Quantity',
  'Unit',
  'Condition',
  'Free or Paid',
  'Price',
  'Currency',
  'Material status',
  'Report count',
  'Pending reports',
  'Created At',
  'Updated At',
] as const;

/** 1-based Excel date column indexes for Created At / Updated At. */
export const MATERIAL_EXPORT_CREATED_AT_COLUMN = 19;
export const MATERIAL_EXPORT_UPDATED_AT_COLUMN = 20;

export const materialExportRecordToDetailedCells = (
  record: MaterialExportRecord,
): unknown[] => [
  record.materialId,
  record.title,
  record.categoryNameEn,
  record.categoryNameAr,
  record.supplierName,
  record.supplierEmail,
  record.supplierVerificationStatus,
  record.city,
  record.area,
  record.quantity,
  record.unit,
  record.condition,
  record.freeOrPaid,
  record.price ?? '',
  record.currency,
  record.materialStatus,
  record.reportCount,
  record.pendingReportCount,
  record.createdAt,
  record.updatedAt,
];

export const materialExportRecordToCsvCells = (
  record: MaterialExportRecord,
): unknown[] => {
  const cells = materialExportRecordToDetailedCells(record);
  cells[18] = record.createdAt.toISOString();
  cells[19] = record.updatedAt.toISOString();
  return cells;
};
