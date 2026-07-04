import type { Prisma } from '../../generated/prisma/client.js';
import type { NoShowReportTargetRole } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { revokeAllRefreshTokensForUser } from '../auth/auth.repository.js';

export const STRIKE_ELIGIBLE_TARGET_ROLES = [
  'LEARNER',
  'SUPPLIER',
  'DRIVER',
] as const satisfies readonly NoShowReportTargetRole[];

export const SUSPENSION_VERIFIED_THRESHOLD = 3;

export const SUSPENSION_USER_MESSAGE =
  'Your account has been suspended after repeated verified reports. Contact admin.';

export const countVerifiedStrikesForUser = async (
  targetUserId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
) =>
  client.noShowReport.count({
    where: {
      targetUserId,
      status: 'VERIFIED',
      targetRole: { in: [...STRIKE_ELIGIBLE_TARGET_ROLES] },
    },
  });

export const suspendUserForVerifiedStrikes = async (
  tx: Prisma.TransactionClient,
  input: {
    targetUserId: string;
    adminUserId: string;
    verifiedCount: number;
  },
): Promise<boolean> => {
  if (input.verifiedCount < SUSPENSION_VERIFIED_THRESHOLD) {
    return false;
  }

  const target = await tx.user.findUnique({
    where: { id: input.targetUserId },
    select: { accountStatus: true },
  });

  if (!target || target.accountStatus !== 'ACTIVE') {
    return false;
  }

  await tx.user.update({
    where: { id: input.targetUserId },
    data: {
      accountStatus: 'SUSPENDED',
      suspensionReason: `Automatic suspension after ${input.verifiedCount} verified incident reports.`,
      suspendedAt: new Date(),
      suspendedById: input.adminUserId,
      reactivatedAt: null,
      reactivatedById: null,
    },
  });

  await revokeAllRefreshTokensForUser(input.targetUserId, tx);

  return true;
};
