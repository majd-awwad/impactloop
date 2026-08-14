import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  classifyAdminReportContract,
  type AdminReportAction,
  type AdminReportClassifierContext,
} from './admin-no-show-reports.classifier.js';
import {
  countVerifiedStrikesForUser,
  STRIKE_ELIGIBLE_TARGET_ROLES,
  suspendUserForVerifiedStrikes,
  SUSPENSION_VERIFIED_THRESHOLD,
} from '../reservations/account-suspension.js';
import type { AdminNoShowReportsListQuery, AdminNoShowReportsExportFilters } from './admin-no-show-reports.validation.js';
import { buildAdminNoShowReportsWhere } from './admin-no-show-reports.where.js';
import { AppError } from '../../utils/app-error.js';
import { finalizeReturnedDeliveryInTransaction } from '../delivery-returns/delivery-return-resolution.js';

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
  delivery: {
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
      deliveryGroupId: true,
      returnRequiredAt: true,
    },
  },
  reporter: { select: { id: true, displayName: true, email: true } },
  target: { select: { id: true, displayName: true, email: true } },
  reviewedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.NoShowReportInclude;

export type AdminNoShowReportRecord = Prisma.NoShowReportGetPayload<{
  include: typeof reportInclude;
}>;

const reportMutationSelect = {
  id: true,
} satisfies Prisma.NoShowReportSelect;

const verifyMutationSelect = {
  id: true,
  targetUserId: true,
  targetRole: true,
} satisfies Prisma.NoShowReportSelect;

const actionContextInclude = {
  reservation: {
    select: {
      status: true,
      fulfillmentMethod: true,
      pendingRescheduleRequestedBy: true,
      pendingRescheduleReason: true,
    },
  },
  delivery: {
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
      deliveryGroupId: true,
      returnRequiredAt: true,
    },
  },
} satisfies Prisma.NoShowReportInclude;

const toActionContext = (
  report: Prisma.NoShowReportGetPayload<{ include: typeof actionContextInclude }>,
): AdminReportClassifierContext => ({
  report: {
    status: report.status,
    reasonCode: report.reasonCode,
    targetRole: report.targetRole,
    targetUserId: report.targetUserId,
    deliveryId: report.deliveryId,
  },
  reservation: report.reservation,
  delivery: report.delivery,
  isGroupedDelivery: report.delivery?.deliveryGroupId != null,
  isGroupRecoverySupported: true,
});

const actionIsAvailable = (
  report: Prisma.NoShowReportGetPayload<{ include: typeof actionContextInclude }>,
  action: AdminReportAction,
) => classifyAdminReportContract(toActionContext(report)).availableActions.includes(action);

const assertPhysicalReturnConfirmed = (
  report: Prisma.NoShowReportGetPayload<{ include: typeof actionContextInclude }>,
) => {
  if (
    report.reasonCode === 'DELIVERY_FAILED' &&
    report.delivery?.returnRequiredAt &&
    report.delivery.status !== 'RETURNED_TO_SUPPLIER'
  ) {
    throw new AppError(
      'Physical return must be confirmed before reviewing this delivery failure.',
      409,
      'DELIVERY_RETURN_CONFIRMATION_REQUIRED',
    );
  }
};

export const listNoShowReportsForAdmin = async (query: AdminNoShowReportsListQuery) => {
  const where = buildAdminNoShowReportsWhere(query);

  const [items, total] = await Promise.all([
    prisma.noShowReport.findMany({
      where,
      include: reportInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.noShowReport.count({ where }),
  ]);

  return { items, total };
};

export type AdminNoShowReportExportKeysetCursor = {
  createdAt: Date;
  id: string;
};

export type AdminNoShowReportExportRecord = AdminNoShowReportRecord;

export const countAdminNoShowReportsForExport = async (
  query: AdminNoShowReportsExportFilters,
) => prisma.noShowReport.count({ where: buildAdminNoShowReportsWhere(query) });

/**
 * Keyset pagination: createdAt DESC, id DESC.
 * Predicate: createdAt < cursor.createdAt OR (createdAt = cursor.createdAt AND id < cursor.id)
 */
export const listAdminNoShowReportsExportBatch = async (input: {
  query: AdminNoShowReportsExportFilters;
  cursor?: AdminNoShowReportExportKeysetCursor;
  take: number;
}): Promise<AdminNoShowReportExportRecord[]> => {
  const baseWhere = buildAdminNoShowReportsWhere(input.query);
  const where: Prisma.NoShowReportWhereInput = input.cursor
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

  return prisma.noShowReport.findMany({
    where,
    include: reportInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: input.take,
  });
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
  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.noShowReport.findUnique({
      where: { id: input.reportId },
      include: actionContextInclude,
    });

    if (!existing) {
      return null;
    }

    if (!actionIsAvailable(existing, 'VERIFY')) {
      return { actionUnavailable: true as const };
    }
    assertPhysicalReturnConfirmed(existing);

    const updated = await tx.noShowReport.update({
      where: { id: existing.id },
      data: {
        status: 'VERIFIED',
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote?.trim() || null,
      },
      select: verifyMutationSelect,
    });

    const verifiedCount =
      updated.targetUserId &&
      (STRIKE_ELIGIBLE_TARGET_ROLES as readonly string[]).includes(
        updated.targetRole,
      )
        ? await countVerifiedStrikesForUser(updated.targetUserId, tx)
        : 0;

    let targetSuspended = false;

    if (updated.targetUserId) {
      targetSuspended = await suspendUserForVerifiedStrikes(tx, {
        targetUserId: updated.targetUserId,
        adminUserId: input.adminUserId,
        verifiedCount,
      });
    }

    const resolution =
      existing.reasonCode === 'DELIVERY_FAILED' &&
      existing.delivery?.returnRequiredAt
        ? await finalizeReturnedDeliveryInTransaction(tx, {
            deliveryId: existing.delivery.id,
            adminUserId: input.adminUserId,
            outcome: 'VERIFIED_LEARNER_RESPONSIBILITY',
          })
        : null;

    return {
      reportId: updated.id,
      verifiedCount,
      shouldWarnAdmin: verifiedCount >= SUSPENSION_VERIFIED_THRESHOLD,
      targetSuspended,
      postCommitRefunds: resolution?.postCommitRefunds ?? [],
    };
  });

  if (!outcome) {
    return null;
  }

  if ('actionUnavailable' in outcome) {
    return outcome;
  }

  const report = await findNoShowReportByIdForAdmin(outcome.reportId);

  if (!report) {
    return null;
  }

  return {
    report,
    verifiedCount: outcome.verifiedCount,
    shouldWarnAdmin: outcome.shouldWarnAdmin,
    targetSuspended: outcome.targetSuspended,
    postCommitRefunds: outcome.postCommitRefunds,
  };
};

export const resolveNoShowReportWithoutStrike = async (input: {
  reportId: string;
  adminUserId: string;
  reviewNote?: string;
}) => {
  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.noShowReport.findUnique({
      where: { id: input.reportId },
      include: actionContextInclude,
    });

    if (!existing) {
      return null;
    }

    if (!actionIsAvailable(existing, 'RESOLVE_WITHOUT_STRIKE')) {
      return { actionUnavailable: true as const };
    }
    assertPhysicalReturnConfirmed(existing);

    const updated = await tx.noShowReport.update({
      where: { id: existing.id },
      data: {
        status: 'RESOLVED_NO_STRIKE',
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote?.trim() || null,
      },
      select: reportMutationSelect,
    });

    const resolution =
      existing.reasonCode === 'DELIVERY_FAILED' &&
      existing.delivery?.returnRequiredAt
        ? await finalizeReturnedDeliveryInTransaction(tx, {
            deliveryId: existing.delivery.id,
            adminUserId: input.adminUserId,
            outcome: 'LEARNER_NOT_RESPONSIBLE',
          })
        : null;
    return {
      reportId: updated.id,
      postCommitRefunds: resolution?.postCommitRefunds ?? [],
    };
  });

  if (!outcome) {
    return null;
  }

  if ('actionUnavailable' in outcome) {
    return outcome;
  }

  const report = await findNoShowReportByIdForAdmin(outcome.reportId);

  if (!report) {
    return null;
  }

  return { report, postCommitRefunds: outcome.postCommitRefunds };
};

export const rejectNoShowReport = async (input: {
  reportId: string;
  adminUserId: string;
  reviewNote?: string;
}) => {
  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.noShowReport.findUnique({
      where: { id: input.reportId },
      include: actionContextInclude,
    });

    if (!existing) {
      return null;
    }

    if (!actionIsAvailable(existing, 'REJECT')) {
      return { actionUnavailable: true as const };
    }
    assertPhysicalReturnConfirmed(existing);

    const updated = await tx.noShowReport.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        reviewedById: input.adminUserId,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote?.trim() || null,
      },
      select: reportMutationSelect,
    });

    const resolution =
      existing.reasonCode === 'DELIVERY_FAILED' &&
      existing.delivery?.returnRequiredAt
        ? await finalizeReturnedDeliveryInTransaction(tx, {
            deliveryId: existing.delivery.id,
            adminUserId: input.adminUserId,
            outcome: 'LEARNER_NOT_RESPONSIBLE',
          })
        : null;
    return {
      reportId: updated.id,
      postCommitRefunds: resolution?.postCommitRefunds ?? [],
    };
  });

  if (!outcome) {
    return null;
  }

  if ('actionUnavailable' in outcome) {
    return outcome;
  }

  const report = await findNoShowReportByIdForAdmin(outcome.reportId);

  if (!report) {
    return null;
  }

  return { report, postCommitRefunds: outcome.postCommitRefunds };
};
