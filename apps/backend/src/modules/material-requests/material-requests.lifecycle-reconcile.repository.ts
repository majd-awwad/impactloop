import { prisma } from '../../database/prisma.js';
import { clearLearnerMaterialRequestOpenBusinessKey } from './material-requests.open-business-key.js';

export const expireStaleOpenMaterialRequestsBatch = async (
  batchSize: number,
): Promise<number> => {
  const stale = await prisma.learnerMaterialRequest.findMany({
    where: {
      status: 'OPEN',
      expiresAt: { lte: new Date() },
    },
    select: { id: true },
    orderBy: [{ expiresAt: 'asc' as const }, { id: 'asc' as const }],
    take: batchSize,
  });

  if (stale.length === 0) {
    return 0;
  }

  await prisma.learnerMaterialRequest.updateMany({
    where: { id: { in: stale.map((row) => row.id) } },
    data: {
      status: 'EXPIRED',
      ...clearLearnerMaterialRequestOpenBusinessKey,
    },
  });

  return stale.length;
};
