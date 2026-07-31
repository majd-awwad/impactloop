import type { Prisma } from '../../generated/prisma/index.js';

import { prisma } from '../../database/prisma.js';
import { createNotification } from '../notifications/notifications.repository.js';

import {
  mapAdminVerificationStatusToDb,
  OFFICIAL_SUPPLIER_TYPES,
} from './admin-supplier-verifications.status.js';
import type { ListSupplierVerificationsQuery } from './admin-supplier-verifications.validation.js';

const organizationSupplierInclude = {
  user: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
    },
  },
  organizationProfile: {
    include: {
      businessLocation: true,
    },
  },
  verificationReviewedBy: {
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  },
} satisfies Prisma.SupplierProfileInclude;

export type SupplierVerificationRecord = Prisma.SupplierProfileGetPayload<{
  include: typeof organizationSupplierInclude;
}>;

const buildListWhere = (
  query: ListSupplierVerificationsQuery,
): Prisma.SupplierProfileWhereInput => {
  const organizationProfileFilter: Prisma.OrganizationProfileWhereInput = {};

  if (query.city?.trim()) {
    organizationProfileFilter.businessLocation = {
      is: {
        city: { contains: query.city.trim(), mode: 'insensitive' },
      },
    };
  }

  const where: Prisma.SupplierProfileWhereInput = {
    supplierType: { in: [...OFFICIAL_SUPPLIER_TYPES] },
    organizationProfile:
      Object.keys(organizationProfileFilter).length > 0
        ? { is: organizationProfileFilter }
        : { isNot: null },
  };

  if (query.supplierType) {
    where.supplierType = query.supplierType;
  }

  if (query.status) {
    const dbStatus = mapAdminVerificationStatusToDb(query.status);
    where.verificationStatus =
      dbStatus === 'PENDING'
        ? { in: ['PENDING', 'UNVERIFIED'] }
        : dbStatus;
  }

  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { publicName: { contains: search, mode: 'insensitive' } },
      { user: { displayName: { contains: search, mode: 'insensitive' } } },
      { user: { email: { contains: search, mode: 'insensitive' } } },
      {
        organizationProfile: {
          is: { organizationName: { contains: search, mode: 'insensitive' } },
        },
      },
    ];
  }

  return where;
};

export const listOrganizationSupplierVerifications = async (
  query: ListSupplierVerificationsQuery,
) => {
  const where = buildListWhere(query);
  const skip = (query.page - 1) * query.limit;

  const items = await prisma.supplierProfile.findMany({
    where,
    include: organizationSupplierInclude,
    orderBy: [
      { verificationSubmittedAt: 'desc' },
      { updatedAt: 'desc' },
    ],
    skip,
    take: query.limit,
  });
  const total = await prisma.supplierProfile.count({ where });

  return { items, total };
};

export const countOrganizationSupplierVerificationsByStatus = async () => {
  const profiles = await prisma.supplierProfile.findMany({
    where: {
      organizationProfile: { isNot: null },
      supplierType: { in: [...OFFICIAL_SUPPLIER_TYPES] },
    },
    select: { verificationStatus: true },
  });

  return profiles;
};

export const countPendingOrganizationSupplierVerifications = async () => {
  return prisma.supplierProfile.count({
    where: {
      supplierType: { in: [...OFFICIAL_SUPPLIER_TYPES] },
      organizationProfile: { isNot: null },
      verificationStatus: { in: ['PENDING', 'UNVERIFIED'] },
    },
  });
};

export const findOrganizationSupplierVerificationById = async (id: string) => {
  return prisma.supplierProfile.findFirst({
    where: {
      id,
      organizationProfile: { isNot: null },
      supplierType: { in: [...OFFICIAL_SUPPLIER_TYPES] },
    },
    include: organizationSupplierInclude,
  });
};

export const updateSupplierVerificationReview = async (input: {
  supplierProfileId: string;
  verificationStatus: string;
  verificationDocumentStatus:
    | 'PENDING'
    | 'VERIFIED'
    | 'REJECTED'
    | 'CHANGES_REQUESTED';
  adminId: string;
  adminNote: string | null;
}) => {
  const reviewedAt = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const profile = await tx.supplierProfile.update({
      where: { id: input.supplierProfileId },
      data: {
        verificationStatus: input.verificationStatus,
        verificationReviewedAt: reviewedAt,
        verificationReviewedById: input.adminId,
        verificationAdminNote: input.adminNote,
      },
      select: { id: true },
    });

    await tx.organizationProfile.updateMany({
      where: { supplierProfileId: profile.id },
      data: {
        verificationDocumentStatus: input.verificationDocumentStatus,
      },
    });

    return profile;
  });

  return prisma.supplierProfile.findFirstOrThrow({
    where: { id: updated.id },
    include: organizationSupplierInclude,
  });
};

export const createSupplierVerificationNotification = async (input: {
  userId: string;
  title: string;
  body: string;
  supplierProfileId: string;
  eventKey?: string;
  actorId?: string | null;
}) => {
  return createNotification({
      userId: input.userId,
      notificationType: 'SUPPLIER_VERIFICATION_UPDATE',
      title: input.title,
      body: input.body,
      relatedEntityType: 'SUPPLIER_PROFILE',
      relatedEntityId: input.supplierProfileId,
      eventKey: input.eventKey ?? `supplier-verification:${input.supplierProfileId}:${input.title.trim()}`,
      entityType: 'SUPPLIER_PROFILE',
      entityId: input.supplierProfileId,
      actionType: 'OPEN_PROFILE',
      actorId: input.actorId ?? null,
  });
};
