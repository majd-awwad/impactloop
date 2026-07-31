import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

const ELIGIBLE_MATERIAL_STATUSES = [
  'AVAILABLE',
  'PENDING_RESERVATION',
  'RESERVED',
] as const;

export const supplierRequestInclude = (
  supplierUserId: string,
) =>
  ({
    category: { select: { id: true, nameEn: true, nameAr: true } },
    project: { select: { id: true, title: true } },
    projectBuildItem: {
      select: {
        id: true,
        requiredComponent: { select: { componentName: true } },
      },
    },
    matches: {
      where: { supplierUserId },
      include: {
        material: {
          select: {
            id: true,
            title: true,
            status: true,
            quantity: true,
            unit: true,
            pickupAllowed: true,
            deliveryAllowed: true,
            location: { select: { city: true, area: true } },
            owner: {
              select: {
                displayName: true,
                supplierProfile: { select: { publicName: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' as const },
    },
    _count: { select: { matches: true } },
  }) satisfies Prisma.LearnerMaterialRequestInclude;

/** Lazily flips OPEN requests that already passed expiresAt. Safe to call from any read path. */
export const expireStaleOpenRequests = () =>
  prisma.learnerMaterialRequest.updateMany({
    where: { status: 'OPEN', expiresAt: { lte: new Date() } },
    data: { status: 'EXPIRED' },
  });

export const buildSupplierFeedWhere = (input: {
  supplierUserId: string;
  categoryId?: string;
  city?: string;
  area?: string;
  alternativesAllowed?: boolean;
  unansweredByMe?: boolean;
  neededByBefore?: Date;
}): Prisma.LearnerMaterialRequestWhereInput => ({
  status: 'OPEN',
  expiresAt: { gt: new Date() },
  learnerId: { not: input.supplierUserId },
  ...(input.categoryId ? { categoryId: input.categoryId } : {}),
  ...(input.city
    ? { locationCity: { equals: input.city, mode: 'insensitive' as const } }
    : {}),
  ...(input.area
    ? { locationArea: { equals: input.area, mode: 'insensitive' as const } }
    : {}),
  ...(input.alternativesAllowed !== undefined
    ? { alternativesAllowed: input.alternativesAllowed }
    : {}),
  ...(input.neededByBefore
    ? { neededBy: { lte: input.neededByBefore } }
    : {}),
  ...(input.unansweredByMe
    ? { matches: { none: { supplierUserId: input.supplierUserId } } }
    : {}),
});

export const listRequestsForSupplierFeed = (input: {
  supplierUserId: string;
  categoryId?: string;
  city?: string;
  area?: string;
  alternativesAllowed?: boolean;
  unansweredByMe?: boolean;
  neededByBefore?: Date;
  skip: number;
  take: number;
}) => {
  const where = buildSupplierFeedWhere(input);
  return Promise.all([
    prisma.learnerMaterialRequest.findMany({
      where,
      include: supplierRequestInclude(input.supplierUserId),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: input.skip,
      take: input.take,
    }),
    prisma.learnerMaterialRequest.count({ where }),
  ]);
};

export const findRequestByIdForSupplier = (
  id: string,
  supplierUserId: string,
) =>
  prisma.learnerMaterialRequest.findUnique({
    where: { id },
    include: supplierRequestInclude(supplierUserId),
  });

export const updateRequestStatus = (
  id: string,
  data: Prisma.LearnerMaterialRequestUpdateInput,
) =>
  prisma.learnerMaterialRequest.update({
    where: { id },
    data,
  });

const candidateMaterialSelect = {
  id: true,
  title: true,
  description: true,
  materialType: true,
  categoryId: true,
  quantity: true,
  unit: true,
  condition: true,
  isFree: true,
  price: true,
  status: true,
  pickupAllowed: true,
  deliveryAllowed: true,
  createdAt: true,
  tags: { select: { tag: true } },
  location: { select: { city: true, area: true } },
} satisfies Prisma.MaterialSelect;

export type SupplierCandidateMaterialRow = Prisma.MaterialGetPayload<{
  select: typeof candidateMaterialSelect;
}>;

export const findOwnedMaterialsForCandidates = (
  supplierUserId: string,
): Promise<SupplierCandidateMaterialRow[]> =>
  prisma.material.findMany({
    where: {
      ownerId: supplierUserId,
      status: { in: [...ELIGIBLE_MATERIAL_STATUSES] },
    },
    select: candidateMaterialSelect,
  });

export const findOwnedMaterialForSuggestion = (
  supplierUserId: string,
  materialId: string,
): Promise<SupplierCandidateMaterialRow | null> =>
  prisma.material.findFirst({
    where: {
      id: materialId,
      ownerId: supplierUserId,
      status: { in: [...ELIGIBLE_MATERIAL_STATUSES] },
    },
    select: candidateMaterialSelect,
  });

export const findMatchByRequestAndMaterial = (
  materialRequestId: string,
  materialId: string,
) =>
  prisma.learnerMaterialRequestMatch.findUnique({
    where: {
      materialRequestId_materialId: {
        materialRequestId,
        materialId,
      },
    },
  });

export const createMatch = (
  data: Prisma.LearnerMaterialRequestMatchCreateInput,
) => prisma.learnerMaterialRequestMatch.create({ data });
