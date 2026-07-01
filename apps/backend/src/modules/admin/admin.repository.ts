import type { ReservationStatus } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

export const countUsers = async (): Promise<number> => {
  return prisma.user.count();
};

export const countSuppliersByRole = async (): Promise<number> => {
  return prisma.userRoleAssignment.count({ where: { role: 'SUPPLIER' } });
};

export const countActiveDriversByRole = async (): Promise<number> => {
  // No driver_profiles table currently exists in schema; count DRIVER role assignments.
  return prisma.userRoleAssignment.count({ where: { role: 'DRIVER' } });
};

export const countMaterials = async (): Promise<number> => {
  return prisma.material.count();
};

export const countAvailableMaterials = async (): Promise<number> => {
  return prisma.material.count({ where: { status: 'AVAILABLE' } });
};

export const countReusedMaterials = async (): Promise<number> => {
  return prisma.material.count({ where: { status: 'REUSED' } });
};

export const countCompletedReservations = async (): Promise<number> => {
  return prisma.reservation.count({ where: { status: 'COMPLETED' } });
};

export const countLearnersBenefited = async (): Promise<number> => {
  const result = await prisma.reservation.groupBy({
    by: ['requesterId'],
    where: { status: 'COMPLETED' },
    _count: { _all: true },
  });

  return result.length;
};

export const countSuppliersContributed = async (): Promise<number> => {
  const result = await prisma.reservation.groupBy({
    by: ['ownerId'],
    where: { status: 'COMPLETED' },
    _count: { _all: true },
  });

  return result.length;
};

export const countActiveInvitations = async (): Promise<number> => {
  return prisma.roleInvitation.count({
    where: {
      status: 'PENDING',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
};

export const countPendingCategoryRequests = async (): Promise<number> => {
  return prisma.categoryRequest.count({ where: { status: 'PENDING' } });
};

export const countPendingPriceRequests = async (): Promise<number> => {
  return prisma.priceRuleRequest.count({ where: { status: 'PENDING' } });
};

export const countPendingMaterialReports = async (): Promise<number> => {
  return prisma.materialReport.count({ where: { status: 'PENDING' } });
};

export const countTotalReservations = async (): Promise<number> => {
  return prisma.reservation.count();
};

export const listReusedMaterialsForCo2Estimate = async () => {
  const rows = await prisma.material.findMany({
    where: { status: 'REUSED' },
    select: {
      quantity: true,
      unit: true,
      category: {
        select: { nameEn: true },
      },
    },
  });

  return rows.map((row) => ({
    quantity: Number(row.quantity),
    unit: row.unit,
    categoryNameEn: row.category.nameEn,
  }));
};

export const listRecentInvitations = async (limit: number) => {
  const rows = await prisma.roleInvitation.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      targetEmail: true,
      targetRole: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    targetEmail: row.targetEmail,
    targetRole: row.targetRole,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  }));
};

export const groupMaterialsByCategory = async () => {
  const grouped = await prisma.material.groupBy({
    by: ['categoryId'],
    _count: { _all: true },
  });

  const ids = grouped.map((row) => row.categoryId);
  const categories = await prisma.category.findMany({
    where: { id: { in: ids } },
    select: { id: true, nameEn: true, nameAr: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return grouped
    .map((row) => {
      const category = categoryMap.get(row.categoryId);
      return {
        id: row.categoryId,
        nameEn: category?.nameEn ?? 'Unknown',
        nameAr: category?.nameAr ?? 'غير معروف',
        count: row._count._all,
      };
    })
    .sort((a, b) => b.count - a.count);
};

export const groupReservationsByStatus = async (): Promise<
  { status: ReservationStatus; count: number }[]
> => {
  const grouped = await prisma.reservation.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  return grouped
    .map((row) => ({ status: row.status, count: row._count._all }))
    .sort((a, b) => b.count - a.count);
};

export const findTopReuseCategory = async () => {
  const grouped = await prisma.material.groupBy({
    by: ['categoryId'],
    where: { status: 'REUSED' },
    _count: { _all: true },
    orderBy: { _count: { categoryId: 'desc' } },
    take: 1,
  });

  const top = grouped[0];
  if (!top) return null;

  const category = await prisma.category.findUnique({
    where: { id: top.categoryId },
    select: { id: true, nameEn: true, nameAr: true },
  });

  if (!category) return null;

  return {
    id: category.id,
    nameEn: category.nameEn,
    nameAr: category.nameAr,
    reusedCount: top._count._all,
  };
};

export const groupReuseByMonth = async (fromInclusive: Date) => {
  // Uses materials.reused_at as the month source.
  const rows = await prisma.material.findMany({
    where: { status: 'REUSED', reusedAt: { gte: fromInclusive } },
    select: { reusedAt: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (!row.reusedAt) continue;
    const year = row.reusedAt.getUTCFullYear();
    const month = String(row.reusedAt.getUTCMonth() + 1).padStart(2, '0');
    const key = `${year}-${month}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

