import type { Prisma } from '../../generated/prisma/index.js';
import { prisma } from '../../database/prisma.js';

export const ADMIN_ACTIVITY_ACTIONS = {
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  SUPPLIER_VERIFICATION_APPROVED: 'SUPPLIER_VERIFICATION_APPROVED',
  SUPPLIER_VERIFICATION_REJECTED: 'SUPPLIER_VERIFICATION_REJECTED',
  SUPPLIER_VERIFICATION_CHANGES_REQUESTED:
    'SUPPLIER_VERIFICATION_CHANGES_REQUESTED',
} as const;

export type AdminActivityAction =
  (typeof ADMIN_ACTIVITY_ACTIONS)[keyof typeof ADMIN_ACTIVITY_ACTIONS];

const ACTION_LABELS: Record<AdminActivityAction, string> = {
  USER_SUSPENDED: 'User suspended',
  USER_REACTIVATED: 'User reactivated',
  SUPPLIER_VERIFICATION_APPROVED: 'Supplier verification approved',
  SUPPLIER_VERIFICATION_REJECTED: 'Supplier verification rejected',
  SUPPLIER_VERIFICATION_CHANGES_REQUESTED:
    'Supplier verification changes requested',
};

export type AdminActivityLogInput = {
  actorUserId: string;
  action: AdminActivityAction;
  targetType: string;
  targetId?: string;
  targetLabel: string;
  metadata?: Prisma.InputJsonValue;
};

export const logAdminActivity = async (input: AdminActivityLogInput) => {
  return prisma.adminActivityLog.create({
    data: {
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel,
      metadata: input.metadata,
    },
  });
};

export type AdminActivityItemDto = {
  id: string;
  action: string;
  actionLabel: string;
  actorName: string;
  actorEmail: string;
  targetLabel: string;
  createdAt: string;
};

export const listRecentAdminActivity = async (
  limit: number,
): Promise<AdminActivityItemDto[]> => {
  const rows = await prisma.adminActivityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      actor: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actionLabel:
      ACTION_LABELS[row.action as AdminActivityAction] ?? row.action.replaceAll('_', ' '),
    actorName: row.actor.displayName,
    actorEmail: row.actor.email,
    targetLabel: row.targetLabel,
    createdAt: row.createdAt.toISOString(),
  }));
};
