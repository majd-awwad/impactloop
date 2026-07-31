import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { createNotification } from '../notifications/notifications.repository.js';
import type {
  AdminMaterialReportsListQuery,
  AdminMaterialsExportFilters,
  AdminMaterialsListQuery,
} from './admin-materials.validation.js';

const materialListInclude = {
  category: { select: { id: true, nameEn: true, nameAr: true } },
  location: { select: { city: true, area: true } },
  images: {
    orderBy: [{ isCover: 'desc' as const }, { sortOrder: 'asc' as const }],
    take: 1,
  },
  owner: { select: { id: true, email: true, displayName: true } },
  supplierProfile: {
    select: {
      publicName: true,
      verificationStatus: true,
      organizationProfile: {
        select: { organizationName: true },
      },
    },
  },
  _count: { select: { reports: true } },
} satisfies Prisma.MaterialInclude;

const materialExportInclude = {
  category: { select: { id: true, nameEn: true, nameAr: true } },
  location: { select: { city: true, area: true } },
  owner: { select: { id: true, email: true, displayName: true } },
  supplierProfile: {
    select: {
      publicName: true,
      verificationStatus: true,
      organizationProfile: {
        select: { organizationName: true },
      },
    },
  },
  _count: { select: { reports: true } },
} satisfies Prisma.MaterialInclude;

export const buildMaterialsWhere = (
  query: AdminMaterialsListQuery | AdminMaterialsExportFilters,
): Prisma.MaterialWhereInput => {
  const where: Prisma.MaterialWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.supplierId) {
    where.ownerId = query.supplierId;
  }

  if (query.isFree !== undefined) {
    where.isFree = query.isFree;
  }

  if (query.city) {
    where.location = {
      city: { contains: query.city, mode: 'insensitive' },
    };
  }

  if (query.verificationStatus) {
    where.supplierProfile = {
      verificationStatus: query.verificationStatus,
    };
  }

  if (query.reportStatus === 'PENDING') {
    where.reports = { some: { status: 'PENDING' } };
  } else if (query.reportStatus === 'HAS_REPORTS') {
    where.reports = { some: {} };
  } else if (query.reportStatus === 'NONE') {
    where.reports = { none: {} };
  }

  if (query.search) {
    const search = query.search.trim();
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { materialType: { contains: search, mode: 'insensitive' } },
      { owner: { displayName: { contains: search, mode: 'insensitive' } } },
      { owner: { email: { contains: search, mode: 'insensitive' } } },
      { category: { nameEn: { contains: search, mode: 'insensitive' } } },
      { category: { nameAr: { contains: search, mode: 'insensitive' } } },
      { location: { city: { contains: search, mode: 'insensitive' } } },
    ];
  }

  return where;
};

export const countMaterialsSummary = async () => {
  const [total, available, paid, unavailable, reported] = await Promise.all([
    prisma.material.count(),
    prisma.material.count({ where: { status: 'AVAILABLE' } }),
    prisma.material.count({ where: { isFree: false } }),
    prisma.material.count({ where: { status: 'UNAVAILABLE' } }),
    prisma.material.count({
      where: { reports: { some: { status: 'PENDING' } } },
    }),
  ]);

  return { total, available, paid, unavailable, reported };
};

export const listMaterialsForAdmin = async (query: AdminMaterialsListQuery) => {
  const where = buildMaterialsWhere(query);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.material.findMany({
      where,
      include: materialListInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.material.count({ where }),
  ]);

  const materialIds = items.map((item) => item.id);
  const pendingCounts =
    materialIds.length === 0
      ? []
      : await prisma.materialReport.groupBy({
          by: ['materialId'],
          where: {
            materialId: { in: materialIds },
            status: 'PENDING',
          },
          _count: { _all: true },
        });

  const pendingByMaterial = new Map(
    pendingCounts.map((row) => [row.materialId, row._count._all]),
  );

  return { items, total, pendingByMaterial };
};

export type AdminMaterialExportKeysetCursor = {
  createdAt: Date;
  id: string;
};

export type AdminMaterialExportRecord = Prisma.MaterialGetPayload<{
  include: typeof materialExportInclude;
}>;

export const countAdminMaterialsForExport = async (
  query: AdminMaterialsExportFilters,
) => prisma.material.count({ where: buildMaterialsWhere(query) });

/**
 * Keyset pagination: createdAt DESC, id DESC.
 * Predicate: createdAt < cursor.createdAt OR (createdAt = cursor.createdAt AND id < cursor.id)
 */
export const listAdminMaterialsExportBatch = async (input: {
  query: AdminMaterialsExportFilters;
  cursor?: AdminMaterialExportKeysetCursor;
  take: number;
}): Promise<AdminMaterialExportRecord[]> => {
  const baseWhere = buildMaterialsWhere(input.query);
  const where: Prisma.MaterialWhereInput = input.cursor
    ? {
        AND: [
          baseWhere,
          {
            OR: [
              { createdAt: { lt: input.cursor.createdAt } },
              {
                AND: [
                  { createdAt: input.cursor.createdAt },
                  { id: { lt: input.cursor.id } },
                ],
              },
            ],
          },
        ],
      }
    : baseWhere;

  return prisma.material.findMany({
    where,
    include: materialExportInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: input.take,
  });
};

export const countPendingReportsByMaterialIds = async (
  materialIds: string[],
): Promise<Map<string, number>> => {
  if (materialIds.length === 0) {
    return new Map();
  }

  const pendingCounts = await prisma.materialReport.groupBy({
    by: ['materialId'],
    where: {
      materialId: { in: materialIds },
      status: 'PENDING',
    },
    _count: { _all: true },
  });

  return new Map(
    pendingCounts.map((row) => [row.materialId, row._count._all]),
  );
};

const materialDetailInclude = {
  category: { select: { id: true, nameEn: true, nameAr: true, categoryType: true } },
  location: true,
  images: { orderBy: { sortOrder: 'asc' as const } },
  owner: {
    select: {
      id: true,
      email: true,
      displayName: true,
      phone: true,
    },
  },
  supplierProfile: {
    include: {
      organizationProfile: true,
      defaultPickupLocation: {
        select: { city: true, area: true, country: true },
      },
    },
  },
  moderatedBy: { select: { id: true, displayName: true } },
  reports: {
    orderBy: { createdAt: 'desc' as const },
    take: 10,
    include: {
      reporter: { select: { id: true, displayName: true, email: true } },
      reviewedBy: { select: { id: true, displayName: true } },
    },
  },
  _count: {
    select: {
      reports: true,
      reservations: true,
    },
  },
} satisfies Prisma.MaterialInclude;

export const findMaterialByIdForAdmin = async (id: string) => {
  return prisma.material.findUnique({
    where: { id },
    include: materialDetailInclude,
  });
};

export const findMaterialById = async (id: string) => {
  return prisma.material.findUnique({ where: { id } });
};

export const countActiveReservations = async (materialId: string) => {
  return prisma.reservation.count({
    where: {
      materialId,
      status: { in: ['PENDING', 'ACCEPTED'] },
    },
  });
};

export const hideMaterial = async (input: {
  materialId: string;
  reason: string;
  adminUserId: string;
}) => {
  return prisma.material.update({
    where: { id: input.materialId },
    data: {
      status: 'UNAVAILABLE',
      moderationReason: input.reason,
      moderatedAt: new Date(),
      moderatedById: input.adminUserId,
    },
  });
};

export const markMaterialUnavailable = async (input: {
  materialId: string;
  reason?: string;
  adminUserId: string;
}) => {
  return prisma.material.update({
    where: { id: input.materialId },
    data: {
      status: 'UNAVAILABLE',
      moderationReason: input.reason ?? null,
      moderatedAt: new Date(),
      moderatedById: input.adminUserId,
    },
  });
};

export const restoreMaterial = async (materialId: string) => {
  return prisma.material.update({
    where: { id: materialId },
    data: {
      status: 'AVAILABLE',
      moderationReason: null,
      moderatedAt: null,
      moderatedById: null,
    },
  });
};

export const createMaterialModerationNotification = async (input: {
  userId: string;
  title: string;
  body: string;
  materialId: string;
  eventKey?: string;
  actorId?: string | null;
}) => {
  return createNotification({
      userId: input.userId,
      notificationType: 'MATERIAL_MODERATION_UPDATE',
      title: input.title,
      body: input.body,
      relatedEntityType: 'MATERIAL',
      relatedEntityId: input.materialId,
      eventKey: input.eventKey ?? `material-moderation:${input.materialId}:${input.title.trim()}`,
      entityType: 'MATERIAL',
      entityId: input.materialId,
      actionType: 'OPEN_MATERIAL',
      actorId: input.actorId ?? null,
  });
};

const reportListInclude = {
  material: {
    select: {
      id: true,
      title: true,
      status: true,
      owner: {
        select: {
          displayName: true,
          supplierProfile: {
            select: { publicName: true, verificationStatus: true },
          },
        },
      },
    },
  },
  reporter: { select: { id: true, displayName: true, email: true } },
  reviewedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.MaterialReportInclude;

export const listMaterialReportsForAdmin = async (
  query: AdminMaterialReportsListQuery,
) => {
  const where: Prisma.MaterialReportWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (query.reason) {
    where.reason = query.reason;
  }

  if (query.materialId) {
    where.materialId = query.materialId;
  }

  if (query.search) {
    const search = query.search.trim();
    where.OR = [
      { note: { contains: search, mode: 'insensitive' } },
      { adminNote: { contains: search, mode: 'insensitive' } },
      { material: { title: { contains: search, mode: 'insensitive' } } },
      { reporter: { displayName: { contains: search, mode: 'insensitive' } } },
      { reporter: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.materialReport.findMany({
      where,
      include: reportListInclude,
      orderBy: { createdAt: 'desc' },
      skip,
      take: query.limit,
    }),
    prisma.materialReport.count({ where }),
  ]);

  return { items, total };
};

export const findMaterialReportByIdForAdmin = async (id: string) => {
  return prisma.materialReport.findUnique({
    where: { id },
    include: {
      ...reportListInclude,
      material: {
        include: {
          category: { select: { id: true, nameEn: true, nameAr: true } },
          location: { select: { city: true, area: true } },
          images: { orderBy: { sortOrder: 'asc' }, take: 1 },
          owner: {
            select: {
              id: true,
              displayName: true,
              email: true,
              supplierProfile: {
                select: {
                  publicName: true,
                  verificationStatus: true,
                  organizationProfile: true,
                },
              },
            },
          },
        },
      },
    },
  });
};

export const findPendingReportByReporter = async (input: {
  materialId: string;
  reporterId: string;
}) => {
  return prisma.materialReport.findFirst({
    where: {
      materialId: input.materialId,
      reporterId: input.reporterId,
      status: 'PENDING',
    },
  });
};

export const createMaterialReport = async (input: {
  materialId: string;
  reporterId: string;
  reason: Prisma.MaterialReportCreateInput['reason'];
  note?: string;
}) => {
  return prisma.materialReport.create({
    data: {
      materialId: input.materialId,
      reporterId: input.reporterId,
      reason: input.reason,
      note: input.note ?? null,
      status: 'PENDING',
    },
  });
};

export const resolveMaterialReport = async (input: {
  reportId: string;
  adminUserId: string;
  adminNote?: string;
}) => {
  return prisma.materialReport.update({
    where: { id: input.reportId },
    data: {
      status: 'RESOLVED',
      adminNote: input.adminNote ?? null,
      reviewedById: input.adminUserId,
      reviewedAt: new Date(),
    },
  });
};

export const rejectMaterialReport = async (input: {
  reportId: string;
  adminUserId: string;
  adminNote: string;
}) => {
  return prisma.materialReport.update({
    where: { id: input.reportId },
    data: {
      status: 'REJECTED',
      adminNote: input.adminNote,
      reviewedById: input.adminUserId,
      reviewedAt: new Date(),
    },
  });
};

export const hideMaterialAndResolveReport = async (input: {
  reportId: string;
  materialId: string;
  adminUserId: string;
  adminNote: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const material = await tx.material.update({
      where: { id: input.materialId },
      data: {
        status: 'UNAVAILABLE',
        moderationReason: input.adminNote,
        moderatedAt: new Date(),
        moderatedById: input.adminUserId,
      },
    });

    const report = await tx.materialReport.update({
      where: { id: input.reportId },
      data: {
        status: 'RESOLVED',
        adminNote: input.adminNote,
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
      },
    });

    return { material, report };
  });
};

export const findReportableMaterial = async (id: string) => {
  return prisma.material.findFirst({
    where: {
      id,
      status: { in: ['AVAILABLE', 'PENDING_RESERVATION', 'RESERVED'] },
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
    },
  });
};
