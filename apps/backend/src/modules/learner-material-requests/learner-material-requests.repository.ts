import type {
  LearnerMaterialRequestMatchStatus,
  LearnerMaterialRequestStatus,
  Prisma,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

export const requestInclude = {
  category: { select: { id: true, nameEn: true, nameAr: true } },
  project: { select: { id: true, title: true } },
  projectBuildItem: {
    select: {
      id: true,
      requiredComponent: { select: { componentName: true } },
    },
  },
  matches: {
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
} satisfies Prisma.LearnerMaterialRequestInclude;

export const findRequestById = (id: string) =>
  prisma.learnerMaterialRequest.findUnique({
    where: { id },
    include: requestInclude,
  });

export const findRequestByIdForLearner = (id: string, learnerId: string) =>
  prisma.learnerMaterialRequest.findFirst({
    where: { id, learnerId },
    include: requestInclude,
  });

export const countOpenRequestsForLearner = (learnerId: string) =>
  prisma.learnerMaterialRequest.count({
    where: { learnerId, status: 'OPEN' },
  });

export const findDuplicateOpenRequest = (input: {
  learnerId: string;
  categoryId: string;
  normalizedRequestedItemName: string;
}) =>
  prisma.learnerMaterialRequest.findFirst({
    where: {
      learnerId: input.learnerId,
      categoryId: input.categoryId,
      normalizedRequestedItemName: input.normalizedRequestedItemName,
      status: 'OPEN',
    },
    select: { id: true },
  });

export const createRequest = (
  data: Prisma.LearnerMaterialRequestCreateInput,
) =>
  prisma.learnerMaterialRequest.create({
    data,
    include: requestInclude,
  });

export const updateRequest = (
  id: string,
  data: Prisma.LearnerMaterialRequestUpdateInput,
) =>
  prisma.learnerMaterialRequest.update({
    where: { id },
    data,
    include: requestInclude,
  });

export const listRequestsForLearner = (input: {
  learnerId: string;
  status?: LearnerMaterialRequestStatus;
  skip: number;
  take: number;
}) =>
  Promise.all([
    prisma.learnerMaterialRequest.findMany({
      where: {
        learnerId: input.learnerId,
        ...(input.status ? { status: input.status } : {}),
      },
      include: requestInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: input.skip,
      take: input.take,
    }),
    prisma.learnerMaterialRequest.count({
      where: {
        learnerId: input.learnerId,
        ...(input.status ? { status: input.status } : {}),
      },
    }),
  ]);

export const findMatchById = (matchId: string) =>
  prisma.learnerMaterialRequestMatch.findUnique({
    where: { id: matchId },
    include: {
      materialRequest: true,
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
  });

export const updateMatchStatus = (
  matchId: string,
  status: LearnerMaterialRequestMatchStatus,
  extra?: Prisma.LearnerMaterialRequestMatchUpdateInput,
) =>
  prisma.learnerMaterialRequestMatch.update({
    where: { id: matchId },
    data: { status, ...extra },
  });
