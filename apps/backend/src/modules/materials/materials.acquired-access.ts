import { prisma } from '../../database/prisma.js';

import * as materialsRepository from './materials.repository.js';

export const findLearnerAcquiredMaterialAccess = async (input: {
  requesterId: string;
  materialId: string;
}) =>
  prisma.reservation.findFirst({
    where: {
      requesterId: input.requesterId,
      materialId: input.materialId,
      status: 'COMPLETED',
    },
    select: {
      id: true,
      status: true,
      quantityRequested: true,
      completedAt: true,
    },
  });

export const findMaterialDetailForAcquiredLearner = async (materialId: string) =>
  materialsRepository.findMaterialDetailByIdIncludingNonPublic(materialId);
