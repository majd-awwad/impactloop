import type {
  MaterialStatus,
  Prisma,
  ReservationStatus,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import type { UpdateSupplierProfileInput } from './supplier.validation.js';

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

export const findSupplierProfileForMaterialCreate = async (userId: string) => {
  return prisma.supplierProfile.findUnique({
    where: { userId },
    include: {
      defaultPickupLocation: true,
    },
  });
};

export const findSupplierProfileDetailsByUserId = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      displayName: true,
      email: true,
      profileImageUrl: true,
      supplierProfile: {
        include: {
          defaultPickupLocation: true,
          organizationProfile: {
            include: {
              businessLocation: true,
            },
          },
        },
      },
    },
  });
};

const isOrganizationSupplierType = (supplierType: string): boolean => {
  return (
    supplierType === 'WORKSHOP' ||
    supplierType === 'FACTORY' ||
    supplierType === 'EDUCATIONAL_INSTITUTION'
  );
};

const upsertLocation = async (
  tx: Prisma.TransactionClient,
  locationId: string | null | undefined,
  input: UpdateSupplierProfileInput['defaultPickupLocation'],
  fallbackLocationType: string,
): Promise<string> => {
  const data = {
    country: input.country,
    city: input.city,
    area: input.area ?? null,
    addressLine: input.addressLine ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    visibility: input.visibility,
    isApproximate: input.isApproximate,
    locationType: input.locationType ?? fallbackLocationType,
  };

  if (locationId) {
    const location = await tx.location.update({
      where: { id: locationId },
      data,
    });

    return location.id;
  }

  const location = await tx.location.create({ data });
  return location.id;
};

export const upsertSupplierProfileDetails = async (
  userId: string,
  input: UpdateSupplierProfileInput,
) => {
  return prisma.$transaction(async (tx) => {
    const existingProfile = await tx.supplierProfile.findUnique({
      where: { userId },
      include: {
        defaultPickupLocation: true,
        organizationProfile: {
          include: {
            businessLocation: true,
          },
        },
      },
    });

    const defaultPickupLocationId = await upsertLocation(
      tx,
      existingProfile?.defaultPickupLocationId,
      input.defaultPickupLocation,
      'PICKUP_POINT',
    );

    const supplierProfile = await tx.supplierProfile.upsert({
      where: { userId },
      create: {
        userId,
        publicName: input.publicName,
        supplierType: input.supplierType,
        description: input.description ?? null,
        defaultPickupLocationId,
      },
      update: {
        publicName: input.publicName,
        supplierType: input.supplierType,
        description: input.description ?? null,
        defaultPickupLocationId,
      },
    });

    if (
      isOrganizationSupplierType(input.supplierType) &&
      input.organizationProfile
    ) {
      const existingOrganization = await tx.organizationProfile.findUnique({
        where: { supplierProfileId: supplierProfile.id },
        include: { businessLocation: true },
      });

      const businessLocationId = input.organizationProfile.businessLocation
        ? await upsertLocation(
            tx,
            existingOrganization?.businessLocationId,
            input.organizationProfile.businessLocation,
            'BUSINESS_LOCATION',
          )
        : existingOrganization?.businessLocationId ?? null;

      await tx.organizationProfile.upsert({
        where: { supplierProfileId: supplierProfile.id },
        create: {
          supplierProfileId: supplierProfile.id,
          organizationName: input.organizationProfile.organizationName,
          organizationType: input.organizationProfile.organizationType,
          contactPersonName:
            input.organizationProfile.contactPersonName ?? null,
          workingDays:
            input.organizationProfile.workingDays as
              | Prisma.InputJsonValue
              | undefined,
          workingHours:
            input.organizationProfile.workingHours as
              | Prisma.InputJsonValue
              | undefined,
          businessLocationId,
        },
        update: {
          organizationName: input.organizationProfile.organizationName,
          organizationType: input.organizationProfile.organizationType,
          contactPersonName:
            input.organizationProfile.contactPersonName ?? null,
          workingDays:
            input.organizationProfile.workingDays as
              | Prisma.InputJsonValue
              | undefined,
          workingHours:
            input.organizationProfile.workingHours as
              | Prisma.InputJsonValue
              | undefined,
          businessLocationId,
        },
      });
    }

    return tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        profileImageUrl: true,
        supplierProfile: {
          include: {
            defaultPickupLocation: true,
            organizationProfile: {
              include: {
                businessLocation: true,
              },
            },
          },
        },
      },
    });
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

export const createSupplierMaterial = async (input: {
  ownerId: string;
  supplierProfileId: string;
  categoryId: string;
  locationId: string;
  title: string;
  description: string;
  materialType: string;
  materialTypeId?: string | null;
  customMaterialType?: string | null;
  quantity: number;
  unit: string;
  condition: Prisma.MaterialCreateInput['condition'];
  sourceType: Prisma.MaterialCreateInput['sourceType'];
  isFree: boolean;
  price?: number | null;
  currency: string;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
  pickupNotes?: string | null;
  suggestedUses?: string | null;
  priceRuleId?: string | null;
  priceCheckedAt?: Date | null;
  maxAllowedPriceAtCheck?: number | null;
  imageUrls: string[];
}) => {
  return prisma.$transaction(async (tx) => {
    const material = await tx.material.create({
      data: {
        ownerId: input.ownerId,
        supplierProfileId: input.supplierProfileId,
        categoryId: input.categoryId,
        locationId: input.locationId,
        title: input.title,
        description: input.description,
        materialType: input.materialType,
        materialTypeId: input.materialTypeId ?? null,
        customMaterialType: input.customMaterialType ?? null,
        quantity: input.quantity,
        unit: input.unit,
        condition: input.condition,
        sourceType: input.sourceType,
        status: 'AVAILABLE',
        isFree: input.isFree,
        price: input.price ?? null,
        currency: input.currency,
        pickupAllowed: input.pickupAllowed,
        deliveryAllowed: input.deliveryAllowed,
        pickupNotes: input.pickupNotes ?? null,
        suggestedUses: input.suggestedUses ?? null,
        priceRuleId: input.priceRuleId ?? null,
        priceCheckedAt: input.priceCheckedAt ?? null,
        maxAllowedPriceAtCheck: input.maxAllowedPriceAtCheck ?? null,
        images:
          input.imageUrls.length > 0
            ? {
                create: input.imageUrls.map((imageUrl, index) => ({
                  imageUrl,
                  sortOrder: index,
                  isCover: index === 0,
                })),
              }
            : undefined,
      },
      include: {
        category: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
          },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return material;
  });
};
