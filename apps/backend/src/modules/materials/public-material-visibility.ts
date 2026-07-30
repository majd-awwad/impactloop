import type {
  MaterialStatus,
  Prisma,
} from '../../generated/prisma/client.js';

export const PUBLIC_MATERIAL_STATUSES = [
  'AVAILABLE',
  'PENDING_RESERVATION',
  'RESERVED',
] as const satisfies readonly MaterialStatus[];

export const buildPublicMaterialWhere = (
  status?: MaterialStatus,
): Prisma.MaterialWhereInput => ({
  status: status ?? { in: [...PUBLIC_MATERIAL_STATUSES] },
  category: {
    isActive: true,
    categoryType: { in: ['MATERIAL', 'BOTH'] },
  },
});
