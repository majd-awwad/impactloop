import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import * as supplierReservationsRepository from '../supplier-reservations/supplier-reservations.repository.js';

const supplierNotificationWhere = (input: {
  userId: string;
  isRead?: boolean;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  entityType?: string;
}): Prisma.NotificationWhereInput => {
  const and: Prisma.NotificationWhereInput[] = [
    { userId: input.userId },
    {
      OR: [
        { notificationType: { not: { startsWith: 'DRIVER_' } } },
        { notificationType: { in: ['DRIVER_ASSIGNMENT_AVAILABLE', 'DRIVER_TIME_REMINDER'] } },
      ],
    },
  ];

  if (input.isRead !== undefined) and.push({ isRead: input.isRead });
  if (input.entityType) {
    and.push({
      OR: [
        { entityType: input.entityType },
        { entityType: null, relatedEntityType: input.entityType },
      ],
    });
  }
  if (input.dateFrom || input.dateTo) {
    and.push({
      createdAt: {
        ...(input.dateFrom ? { gte: input.dateFrom } : {}),
        ...(input.dateTo ? { lte: input.dateTo } : {}),
      },
    });
  }
  if (input.search) {
    and.push({
      OR: [
        { title: { contains: input.search, mode: 'insensitive' } },
        { body: { contains: input.search, mode: 'insensitive' } },
      ],
    });
  }

  return { AND: and };
};

export const supplierNotificationSelect = {
  id: true,
  userId: true,
  notificationType: true,
  title: true,
  body: true,
  relatedEntityType: true,
  relatedEntityId: true,
  readAt: true,
  eventKey: true,
  entityType: true,
  entityId: true,
  actionType: true,
  metadata: true,
  resolvedAt: true,
  actorId: true,
  isRead: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

export type SupplierNotificationRow = Prisma.NotificationGetPayload<{
  select: typeof supplierNotificationSelect;
}>;

export const forEachSupplierNotificationBatch = async (input: {
  filter: Parameters<typeof supplierNotificationWhere>[0];
  batchSize: number;
  onBatch: (items: SupplierNotificationRow[]) => Promise<void> | void;
}) => {
  let skip = 0;
  while (true) {
    const items = await prisma.notification.findMany({
      where: supplierNotificationWhere(input.filter),
      select: supplierNotificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip,
      take: input.batchSize,
    });
    if (items.length === 0) return;
    await input.onBatch(items);
    if (items.length < input.batchSize) return;
    skip += items.length;
  }
};

export const countSupplierNotifications = async (input: Parameters<typeof supplierNotificationWhere>[0]) =>
  prisma.notification.count({ where: supplierNotificationWhere(input) });

export const countUnreadSupplierNotifications = async (userId: string) =>
  prisma.notification.count({ where: supplierNotificationWhere({ userId, isRead: false }) });

export const markSupplierNotificationRead = async (input: { userId: string; notificationId: string }) => {
  const result = await prisma.notification.updateMany({
    where: {
      AND: [supplierNotificationWhere({ userId: input.userId }), { id: input.notificationId }],
    },
    data: { isRead: true, readAt: new Date() },
  });
  return result.count > 0;
};

export const markAllSupplierNotificationsRead = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: supplierNotificationWhere({ userId, isRead: false }),
    data: { isRead: true, readAt: new Date() },
  });
  return result.count;
};

export const findSupplierNotificationTargets = async (input: {
  userId: string;
  reservationIds: string[];
  categoryRequestIds: string[];
  priceRuleRequestIds: string[];
  materialIds: string[];
  supplierProfileIds: string[];
}) => {
  const [reservations, categories, prices, materials, profiles] = await Promise.all([
    supplierReservationsRepository.findSupplierReservationsByIds(
      input.userId,
      input.reservationIds,
    ),
    prisma.categoryRequest.findMany({
      where: { id: { in: input.categoryRequestIds }, requestedByUserId: input.userId },
      select: {
        id: true,
        requestedName: true,
        status: true,
        approvedCategoryId: true,
        approvedCategory: { select: { nameEn: true } },
        moderatorNote: true,
        listingDraftJson: true,
        publishedMaterialId: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.priceRuleRequest.findMany({
      where: { id: { in: input.priceRuleRequestIds }, requestedByUserId: input.userId },
      select: {
        id: true,
        materialName: true,
        status: true,
        moderatorNote: true,
        listingDraftJson: true,
        publishedMaterialId: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { nameEn: true } },
      },
    }),
    prisma.material.findMany({
      where: { id: { in: input.materialIds }, ownerId: input.userId },
      select: { id: true, title: true, status: true, updatedAt: true },
    }),
    prisma.supplierProfile.findMany({
      where: { id: { in: input.supplierProfileIds }, userId: input.userId },
      select: { id: true, verificationStatus: true, verificationAdminNote: true, updatedAt: true },
    }),
  ]);

  return { reservations, categories, prices, materials, profiles };
};
