import type {
  MaterialStatus,
  ReservationStatus,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

const decimalToNumber = (value: { toNumber(): number } | number): number => {
  if (typeof value === 'number') {
    return value;
  }

  return value.toNumber();
};

export const findSupplierProfileForDashboard = async (userId: string) => {
  return prisma.supplierProfile.findUnique({
    where: { userId },
    include: {
      defaultPickupLocation: true,
      organizationProfile: true,
    },
  });
};

export const countMaterialsByStatus = async (ownerId: string) => {
  return prisma.material.groupBy({
    by: ['status'],
    where: { ownerId },
    _count: { _all: true },
  });
};

export const countReservationsByStatus = async (ownerId: string) => {
  return prisma.reservation.groupBy({
    by: ['status'],
    where: { ownerId },
    _count: { _all: true },
  });
};

export const aggregateReusedMaterials = async (ownerId: string) => {
  return prisma.material.aggregate({
    where: { ownerId, status: 'REUSED' },
    _count: { _all: true },
    _sum: { quantity: true },
  });
};

export const aggregateSupplierReviews = async (reviewedUserId: string) => {
  return prisma.review.aggregate({
    where: {
      reviewedUserId,
      targetType: 'SUPPLIER',
    },
    _avg: { rating: true },
    _count: { _all: true },
  });
};

export const countUnreadNotifications = async (userId: string) => {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
};

export const findRecentMaterials = async (ownerId: string, limit = 3) => {
  return prisma.material.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      category: { select: { nameEn: true } },
      images: {
        where: { isCover: true },
        take: 1,
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
};

export const findUpcomingPickups = async (ownerId: string, limit = 3) => {
  const now = new Date();

  return prisma.reservation.findMany({
    where: {
      ownerId,
      status: 'ACCEPTED',
      pickupWindowStart: { gte: now },
    },
    orderBy: { pickupWindowStart: 'asc' },
    take: limit,
    include: {
      material: { select: { title: true } },
      requester: { select: { displayName: true } },
    },
  });
};

export const findRecentNotifications = async (userId: string, limit = 3) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
};

export const findRecentReservationsForActivity = async (
  ownerId: string,
  limit = 3,
) => {
  return prisma.reservation.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      material: { select: { title: true } },
    },
  });
};

export const foldMaterialStatusCounts = (
  rows: { status: MaterialStatus; _count: { _all: number } }[],
) => {
  const stats = {
    total: 0,
    available: 0,
    pendingReservation: 0,
    reserved: 0,
    reused: 0,
    unavailable: 0,
  };

  for (const row of rows) {
    const count = row._count._all;
    stats.total += count;

    switch (row.status) {
      case 'AVAILABLE':
        stats.available = count;
        break;
      case 'PENDING_RESERVATION':
        stats.pendingReservation = count;
        break;
      case 'RESERVED':
        stats.reserved = count;
        break;
      case 'REUSED':
        stats.reused = count;
        break;
      case 'UNAVAILABLE':
        stats.unavailable = count;
        break;
      default:
        break;
    }
  }

  return stats;
};

export const foldReservationStatusCounts = (
  rows: { status: ReservationStatus; _count: { _all: number } }[],
) => {
  const stats = {
    pending: 0,
    accepted: 0,
    completed: 0,
    rejected: 0,
    cancelled: 0,
    expired: 0,
  };

  for (const row of rows) {
    const count = row._count._all;

    switch (row.status) {
      case 'PENDING':
        stats.pending = count;
        break;
      case 'ACCEPTED':
        stats.accepted = count;
        break;
      case 'COMPLETED':
        stats.completed = count;
        break;
      case 'REJECTED':
        stats.rejected = count;
        break;
      case 'CANCELLED':
        stats.cancelled = count;
        break;
      case 'EXPIRED':
        stats.expired = count;
        break;
      default:
        break;
    }
  }

  return stats;
};

export const sumReusedQuantity = (
  aggregate: Awaited<ReturnType<typeof aggregateReusedMaterials>>,
) => {
  if (!aggregate._sum.quantity) {
    return 0;
  }

  return decimalToNumber(aggregate._sum.quantity);
};
