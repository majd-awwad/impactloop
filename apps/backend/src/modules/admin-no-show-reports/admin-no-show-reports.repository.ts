import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  countVerifiedStrikesForUser,
  STRIKE_ELIGIBLE_TARGET_ROLES,
  suspendUserForVerifiedStrikes,
  SUSPENSION_VERIFIED_THRESHOLD,
} from '../reservations/account-suspension.js';

export const reportInclude = {
  reservation: {
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      pickupWindowStart: true,
      pickupWindowEnd: true,
      supplierProposedPickupWindowStart: true,
      supplierProposedPickupWindowEnd: true,
      learnerProposedPickupWindowStart: true,
      learnerProposedPickupWindowEnd: true,
      pendingRescheduleRequestedBy: true,
      pendingRescheduleReason: true,
      pendingRescheduleNote: true,
      material: { select: { id: true, title: true } },
      requester: { select: { id: true, displayName: true, email: true } },
      owner: { select: { id: true, displayName: true, email: true } },
    },
  },
  reporter: { select: { id: true, displayName: true, email: true } },
  target: { select: { id: true, displayName: true, email: true } },
  reviewedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.NoShowReportInclude;

export type AdminNoShowReportRecord = Prisma.NoShowReportGetPayload<{
  include: typeof reportInclude;
}>;

export const listNoShowReportsForAdmin = async (input: {
  status?: 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED' | 'RESOLVED_NO_STRIKE';
  page: number;
  limit: number;
}) => {
  const where: Prisma.NoShowReportWhereInput = input.status
    ? { status: input.status }
    : {};

  const [items, total] = await Promise.all([
    prisma.noShowReport.findMany({
      where,
      include: reportInclude,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.noShowReport.count({ where }),
  ]);

  return { items, total };
};

export const findNoShowReportByIdForAdmin = async (id: string) => {
  return prisma.noShowReport.findUnique({
    where: { id },
    include: reportInclude,
  });
};

export const countVerifiedNoShowReportsForTarget = async (targetUserId: string) =>
  countVerifiedStrikesForUser(targetUserId);

export const verifyNoShowReport = async (input: {
  reportId: string;
  adminUserId: string;
  reviewNote?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.noShowReport.findUnique({
      where: { id: input.reportId },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'PENDING_REVIEW') {
      return { conflict: true as const, report: existing };
    }

    const report = await tx.noShowReport.update({
      where: { id: existing.id },
      data: {
        status: 'VERIFIED',
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote?.trim() || null,
      },
      include: reportInclude,
    });

    const verifiedCount =
      report.targetUserId &&
      (STRIKE_ELIGIBLE_TARGET_ROLES as readonly string[]).includes(
        report.targetRole,
      )
        ? await countVerifiedStrikesForUser(report.targetUserId, tx)
        : 0;

    let targetSuspended = false;

    if (report.targetUserId) {
      targetSuspended = await suspendUserForVerifiedStrikes(tx, {
        targetUserId: report.targetUserId,
        adminUserId: input.adminUserId,
        verifiedCount,
      });
    }

    return {
      report,
      verifiedCount,
      shouldWarnAdmin: verifiedCount >= SUSPENSION_VERIFIED_THRESHOLD,
      targetSuspended,
    };
  });
};

export const resolveNoShowReportWithoutStrike = async (input: {
  reportId: string;
  adminUserId: string;
  reviewNote?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.noShowReport.findUnique({
      where: { id: input.reportId },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'PENDING_REVIEW') {
      return { conflict: true as const, report: existing };
    }

    const report = await tx.noShowReport.update({
      where: { id: existing.id },
      data: {
        status: 'RESOLVED_NO_STRIKE',
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote?.trim() || null,
      },
      include: reportInclude,
    });

    return { report };
  });
};

export const rejectNoShowReport = async (input: {
  reportId: string;
  adminUserId: string;
  reviewNote?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.noShowReport.findUnique({
      where: { id: input.reportId },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'PENDING_REVIEW') {
      return { conflict: true as const, report: existing };
    }

    const report = await tx.noShowReport.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote?.trim() || null,
      },
      include: reportInclude,
    });

    return { report };
  });
};
