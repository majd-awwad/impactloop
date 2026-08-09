import type {
  CategoryType,
  MaterialStatus,
  Prisma,
} from '../../generated/prisma/client.js';

export const PUBLIC_MATERIAL_STATUSES = [
  'AVAILABLE',
  'PENDING_RESERVATION',
  'RESERVED',
] as const satisfies readonly MaterialStatus[];

export type PublicMaterialStatus = (typeof PUBLIC_MATERIAL_STATUSES)[number];

export const PUBLIC_MATERIAL_CATEGORY_TYPES = [
  'MATERIAL',
  'BOTH',
] as const satisfies readonly CategoryType[];

const publicMaterialStatusSet = new Set<MaterialStatus>(
  PUBLIC_MATERIAL_STATUSES,
);

export const isPublicMaterialStatus = (
  status: MaterialStatus | null | undefined,
): status is PublicMaterialStatus =>
  status != null && publicMaterialStatusSet.has(status);

export const buildPublicMaterialWhere = (
  status?: PublicMaterialStatus,
): Prisma.MaterialWhereInput => ({
  status: status ?? { in: [...PUBLIC_MATERIAL_STATUSES] },
  category: {
    isActive: true,
    categoryType: { in: [...PUBLIC_MATERIAL_CATEGORY_TYPES] },
  },
});
