import type {
  MaterialCondition,
  MaterialStatus,
  Prisma,
  ReservationStatus,
} from "../../generated/prisma/client.js";

import { prisma } from "../../database/prisma.js";
import type { UpdateSupplierProfileInput } from "./supplier.validation.js";

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

const decimalToNumber = (value: { toNumber(): number } | number): number => {
  if (typeof value === "number") {
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

export const countSupplierFollowers = async (supplierProfileId: string) => {
  return prisma.supplierFollower.count({
    where: { supplierProfileId },
  });
};

export const listLatestSupplierFollowers = async (
  supplierProfileId: string,
  limit = 5,
) => {
  return prisma.supplierFollower.findMany({
    where: { supplierProfileId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      followerUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
          profileImageUrl: true,
        },
      },
    },
  });
};

export const listSupplierFollowers = async (input: {
  supplierProfileId: string;
  page: number;
  limit: number;
}) => {
  const skip = (input.page - 1) * input.limit;

  const [items, total] = await Promise.all([
    prisma.supplierFollower.findMany({
      where: { supplierProfileId: input.supplierProfileId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: input.limit,
      include: {
        followerUser: {
          select: {
            id: true,
            displayName: true,
            email: true,
            profileImageUrl: true,
          },
        },
      },
    }),
    prisma.supplierFollower.count({
      where: { supplierProfileId: input.supplierProfileId },
    }),
  ]);

  return { items, total };
};

export const findSupplierMaterialsPreview = async (
  ownerId: string,
  limit = 4,
) => {
  return prisma.material.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      category: {
        select: { id: true, nameEn: true, nameAr: true },
      },
      location: {
        select: { city: true, area: true },
      },
      images: {
        where: { isCover: true },
        take: 1,
        orderBy: { sortOrder: 'asc' },
      },
    },
  });
};

export const countSupplierReservationsTotal = async (ownerId: string) => {
  return prisma.reservation.count({ where: { ownerId } });
};

export const countLikesByMaterialIds = async (materialIds: string[]) => {
  if (materialIds.length === 0) return new Map<string, number>();

  const groups = await prisma.materialLike.groupBy({
    by: ['materialId'],
    where: { materialId: { in: materialIds } },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.materialId, group._count._all]));
};

export const countViewsByMaterialIds = async (materialIds: string[]) => {
  if (materialIds.length === 0) return new Map<string, number>();

  const groups = await prisma.materialView.groupBy({
    by: ['materialId'],
    where: { materialId: { in: materialIds } },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.materialId, group._count._all]));
};

export const countReservationsByMaterialIds = async (materialIds: string[]) => {
  if (materialIds.length === 0) return new Map<string, number>();

  const groups = await prisma.reservation.groupBy({
    by: ['materialId'],
    where: { materialId: { in: materialIds } },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.materialId, group._count._all]));
};

export const countTotalLikesForSupplier = async (ownerId: string) => {
  return prisma.materialLike.count({
    where: { material: { ownerId } },
  });
};

export const countTotalViewsForSupplier = async (ownerId: string) => {
  return prisma.materialView.count({
    where: { material: { ownerId } },
  });
};

export const isOrganizationSupplierType = (supplierType: string): boolean => {
  return (
    supplierType === "WORKSHOP" ||
    supplierType === "FACTORY" ||
    supplierType === "EDUCATIONAL_INSTITUTION"
  );
};

type LocationCopySource = {
  country: string;
  city: string;
  area: string | null;
  addressLine: string | null;
  latitude: Prisma.Decimal | number | null;
  longitude: Prisma.Decimal | number | null;
  visibility: string | null;
  isApproximate: boolean;
};

export const copyLocationRow = async (
  source: LocationCopySource,
  locationType = "MATERIAL_PICKUP",
  client: PrismaClientLike = prisma,
): Promise<string> => {
  const location = await client.location.create({
    data: {
      country: source.country,
      city: source.city,
      area: source.area,
      addressLine: source.addressLine,
      latitude: source.latitude,
      longitude: source.longitude,
      visibility: source.visibility,
      isApproximate: source.isApproximate,
      locationType,
    },
  });

  return location.id;
};

export const createMaterialPickupLocation = async (
  input: UpdateSupplierProfileInput["defaultPickupLocation"],
  client: PrismaClientLike = prisma,
): Promise<string> => {
  const location = await client.location.create({
    data: {
      country: input.country,
      city: input.city,
      area: input.area ?? null,
      addressLine: input.addressLine ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      visibility: input.visibility,
      isApproximate: input.isApproximate,
      locationType: input.locationType ?? "MATERIAL_PICKUP",
    },
  });

  return location.id;
};

const upsertLocation = async (
  tx: Prisma.TransactionClient,
  locationId: string | null | undefined,
  input: UpdateSupplierProfileInput["defaultPickupLocation"],
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
      "PICKUP_POINT",
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
            "BUSINESS_LOCATION",
          )
        : (existingOrganization?.businessLocationId ?? null);

      await tx.organizationProfile.upsert({
        where: { supplierProfileId: supplierProfile.id },
        create: {
          supplierProfileId: supplierProfile.id,
          organizationName: input.organizationProfile.organizationName,
          organizationType: input.organizationProfile.organizationType,
          contactPersonName:
            input.organizationProfile.contactPersonName ?? null,
          workingDays: input.organizationProfile.workingDays as
            | Prisma.InputJsonValue
            | undefined,
          workingHours: input.organizationProfile.workingHours as
            | Prisma.InputJsonValue
            | undefined,
          businessLocationId,
        },
        update: {
          organizationName: input.organizationProfile.organizationName,
          organizationType: input.organizationProfile.organizationType,
          contactPersonName:
            input.organizationProfile.contactPersonName ?? null,
          workingDays: input.organizationProfile.workingDays as
            | Prisma.InputJsonValue
            | undefined,
          workingHours: input.organizationProfile.workingHours as
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

export const updateSupplierProfileImages = async (
  userId: string,
  input: { avatarImageUrl?: string | null; coverImageUrl?: string | null },
) => {
  const data: {
    avatarImageUrl?: string | null;
    coverImageUrl?: string | null;
  } = {};

  if (input.avatarImageUrl !== undefined) {
    data.avatarImageUrl = input.avatarImageUrl;
  }
  if (input.coverImageUrl !== undefined) {
    data.coverImageUrl = input.coverImageUrl;
  }

  return prisma.supplierProfile.update({
    where: { userId },
    data,
  });
};

export const countMaterialsByStatus = async (ownerId: string) => {
  return prisma.material.groupBy({
    by: ["status"],
    where: { ownerId },
    _count: { _all: true },
  });
};

export const countReservationsByStatus = async (ownerId: string) => {
  return prisma.reservation.groupBy({
    by: ["status"],
    where: { ownerId },
    _count: { _all: true },
  });
};

export const aggregateReusedMaterials = async (ownerId: string) => {
  return prisma.material.aggregate({
    where: { ownerId, status: "REUSED" },
    _count: { _all: true },
    _sum: { quantity: true },
  });
};

export const aggregateSupplierReviews = async (reviewedUserId: string) => {
  return prisma.review.aggregate({
    where: {
      reviewedUserId,
      targetType: "SUPPLIER",
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

const supplierMaterialListInclude = {
  category: {
    select: { id: true, nameEn: true, nameAr: true },
  },
  location: {
    select: { city: true, area: true, addressLine: true },
  },
  images: {
    orderBy: { sortOrder: "asc" as const },
  },
} satisfies Prisma.MaterialInclude;

const buildSupplierMaterialsWhere = (
  ownerId: string,
  query: {
    search?: string;
    status?: MaterialStatus;
    isFree?: boolean;
    categoryId?: string;
    condition?: MaterialCondition;
  },
): Prisma.MaterialWhereInput => {
  const where: Prisma.MaterialWhereInput = { ownerId };

  if (query.status) {
    where.status = query.status;
  }

  if (query.isFree !== undefined) {
    where.isFree = query.isFree;
  }

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.condition) {
    where.condition = query.condition;
  }

  if (query.search) {
    const normalized = query.search.trim();
    const searchConditions: Prisma.MaterialWhereInput[] = [
      { title: { contains: normalized, mode: "insensitive" } },
      { description: { contains: normalized, mode: "insensitive" } },
      { category: { nameEn: { contains: normalized, mode: "insensitive" } } },
      { category: { nameAr: { contains: normalized, mode: "insensitive" } } },
      { location: { city: { contains: normalized, mode: "insensitive" } } },
      { location: { area: { contains: normalized, mode: "insensitive" } } },
    ];

    const statusCandidate = normalized
      .toUpperCase()
      .replace(/[\s-]+/g, "_") as MaterialStatus;
    const materialStatuses: MaterialStatus[] = [
      "AVAILABLE",
      "PENDING_RESERVATION",
      "RESERVED",
      "REUSED",
      "UNAVAILABLE",
    ];

    if (materialStatuses.includes(statusCandidate)) {
      searchConditions.push({ status: statusCandidate });
    }

    where.OR = searchConditions;
  }

  return where;
};

export const findSupplierMaterials = async (
  ownerId: string,
  query: {
    page: number;
    limit: number;
    search?: string;
    status?: MaterialStatus;
    isFree?: boolean;
    categoryId?: string;
    condition?: MaterialCondition;
  },
) => {
  const where = buildSupplierMaterialsWhere(ownerId, query);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.material.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: query.limit,
      include: supplierMaterialListInclude,
    }),
    prisma.material.count({ where }),
  ]);

  return { items, total };
};

export const findSupplierMaterialsSummary = async (ownerId: string) => {
  const baseWhere = { ownerId };

  const [
    total,
    available,
    pendingReservation,
    reserved,
    reused,
    unavailable,
    free,
    paid,
  ] = await Promise.all([
    prisma.material.count({ where: baseWhere }),
    prisma.material.count({
      where: { ...baseWhere, status: "AVAILABLE" },
    }),
    prisma.material.count({
      where: { ...baseWhere, status: "PENDING_RESERVATION" },
    }),
    prisma.material.count({
      where: { ...baseWhere, status: "RESERVED" },
    }),
    prisma.material.count({
      where: { ...baseWhere, status: "REUSED" },
    }),
    prisma.material.count({
      where: { ...baseWhere, status: "UNAVAILABLE" },
    }),
    prisma.material.count({
      where: { ...baseWhere, isFree: true },
    }),
    prisma.material.count({
      where: { ...baseWhere, isFree: false },
    }),
  ]);

  return {
    total,
    available,
    pendingReservation,
    reserved,
    reused,
    unavailable,
    free,
    paid,
  };
};

export const findSupplierMaterialCategories = async (ownerId: string) => {
  const groups = await prisma.material.groupBy({
    by: ["categoryId"],
    where: { ownerId },
    _count: { id: true },
  });

  const categoryIds = groups
    .map((group) => group.categoryId)
    .filter((id): id is string => id != null);

  if (categoryIds.length === 0) {
    return [];
  }

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, nameEn: true, nameAr: true },
    orderBy: { nameEn: "asc" },
  });

  return categories
    .map((category) => {
      const count =
        groups.find((group) => group.categoryId === category.id)?._count.id ??
        0;

      return {
        id: category.id,
        nameEn: category.nameEn,
        nameAr: category.nameAr,
        count,
      };
    })
    .filter((category) => category.count > 0);
};

export const findSupplierOwnedMaterialById = async (
  ownerId: string,
  materialId: string,
) => {
  return prisma.material.findFirst({
    where: { id: materialId, ownerId },
    include: supplierMaterialListInclude,
  });
};

export const countBlockingReservationsByMaterialIds = async (
  materialIds: string[],
) => {
  if (materialIds.length === 0) {
    return new Map<string, number>();
  }

  const groups = await prisma.reservation.groupBy({
    by: ["materialId"],
    where: {
      materialId: { in: materialIds },
      status: { in: ["PENDING", "ACCEPTED", "COMPLETED"] },
    },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.materialId, group._count._all]));
};

export const countBlockingReservationsForMaterial = async (
  materialId: string,
) => {
  return prisma.reservation.count({
    where: {
      materialId,
      status: { in: ["PENDING", "ACCEPTED", "COMPLETED"] },
    },
  });
};

export const updateSupplierOwnedMaterial = async (
  ownerId: string,
  materialId: string,
  data: {
    title: string;
    description: string;
    quantity: number;
    unit: string;
    condition: MaterialCondition;
    pickupAllowed: boolean;
    deliveryAllowed: boolean;
    pickupNotes: string | null;
    suggestedUses: string | null;
  },
) => {
  const existing = await prisma.material.findFirst({
    where: { id: materialId, ownerId },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  return prisma.material.update({
    where: { id: materialId },
    data,
    include: supplierMaterialListInclude,
  });
};

export const deleteSupplierOwnedMaterial = async (materialId: string) => {
  return prisma.material.delete({
    where: { id: materialId },
  });
};

export const findRecentMaterials = async (ownerId: string, limit = 3) => {
  return prisma.material.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      category: { select: { nameEn: true } },
      images: {
        where: { isCover: true },
        take: 1,
        orderBy: { sortOrder: "asc" },
      },
    },
  });
};

export const findUpcomingPickups = async (ownerId: string, limit = 3) => {
  const now = new Date();

  return prisma.reservation.findMany({
    where: {
      ownerId,
      status: "ACCEPTED",
      pickupWindowStart: { gte: now },
    },
    orderBy: { pickupWindowStart: "asc" },
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
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

export const findRecentReservationsForActivity = async (
  ownerId: string,
  limit = 3,
) => {
  return prisma.reservation.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
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
      case "AVAILABLE":
        stats.available = count;
        break;
      case "PENDING_RESERVATION":
        stats.pendingReservation = count;
        break;
      case "RESERVED":
        stats.reserved = count;
        break;
      case "REUSED":
        stats.reused = count;
        break;
      case "UNAVAILABLE":
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
      case "PENDING":
        stats.pending = count;
        break;
      case "ACCEPTED":
        stats.accepted = count;
        break;
      case "COMPLETED":
        stats.completed = count;
        break;
      case "REJECTED":
        stats.rejected = count;
        break;
      case "CANCELLED":
        stats.cancelled = count;
        break;
      case "EXPIRED":
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
  condition: Prisma.MaterialCreateInput["condition"];
  sourceType: Prisma.MaterialCreateInput["sourceType"];
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
  client?: PrismaClientLike;
}) => {
  const createMaterial = (client: PrismaClientLike) =>
    client.material.create({
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
        status: "AVAILABLE",
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
          orderBy: { sortOrder: "asc" },
        },
      },
    });

  if (input.client) {
    return createMaterial(input.client);
  }

  return prisma.$transaction((tx) => createMaterial(tx));
};
