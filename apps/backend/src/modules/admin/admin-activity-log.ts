import type { Prisma } from '../../generated/prisma/index.js';
import { prisma } from '../../database/prisma.js';

export const ADMIN_ACTIVITY_ACTIONS = {
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  SUPPLIER_VERIFICATION_APPROVED: 'SUPPLIER_VERIFICATION_APPROVED',
  SUPPLIER_VERIFICATION_REJECTED: 'SUPPLIER_VERIFICATION_REJECTED',
  SUPPLIER_VERIFICATION_CHANGES_REQUESTED:
    'SUPPLIER_VERIFICATION_CHANGES_REQUESTED',
  INVITATION_CREATED: 'INVITATION_CREATED',
  INVITATION_REVOKED: 'INVITATION_REVOKED',
  INVITATION_RESENT: 'INVITATION_RESENT',
  MATERIAL_HIDDEN: 'MATERIAL_HIDDEN',
  MATERIAL_MARKED_UNAVAILABLE: 'MATERIAL_MARKED_UNAVAILABLE',
  MATERIAL_RESTORED: 'MATERIAL_RESTORED',
  MATERIAL_REPORT_RESOLVED: 'MATERIAL_REPORT_RESOLVED',
  MATERIAL_REPORT_REJECTED: 'MATERIAL_REPORT_REJECTED',
  MATERIAL_REPORT_HIDE_MATERIAL: 'MATERIAL_REPORT_HIDE_MATERIAL',
  CATEGORY_REQUEST_APPROVED: 'CATEGORY_REQUEST_APPROVED',
  CATEGORY_REQUEST_REJECTED: 'CATEGORY_REQUEST_REJECTED',
  PRICE_REQUEST_APPROVED: 'PRICE_REQUEST_APPROVED',
  PRICE_REQUEST_REJECTED: 'PRICE_REQUEST_REJECTED',
  LEARNING_PROJECT_APPROVED: 'LEARNING_PROJECT_APPROVED',
  LEARNING_PROJECT_CHANGES_REQUESTED: 'LEARNING_PROJECT_CHANGES_REQUESTED',
  LEARNING_PROJECT_REJECTED: 'LEARNING_PROJECT_REJECTED',
  LEARNING_PROJECT_HIDDEN: 'LEARNING_PROJECT_HIDDEN',
  LEARNING_PROJECT_RESTORED: 'LEARNING_PROJECT_RESTORED',
  LEARNING_PROJECT_ARCHIVED: 'LEARNING_PROJECT_ARCHIVED',
} as const;

export const ADMIN_ACTIVITY_TARGET_TYPES = {
  USER: 'USER',
  SUPPLIER_PROFILE: 'SUPPLIER_PROFILE',
  INVITATION: 'INVITATION',
  MATERIAL: 'MATERIAL',
  MATERIAL_REPORT: 'MATERIAL_REPORT',
  CATEGORY_REQUEST: 'CATEGORY_REQUEST',
  PRICE_RULE_REQUEST: 'PRICE_RULE_REQUEST',
  LEARNING_PROJECT: 'LEARNING_PROJECT',
} as const;

export type AdminActivityAction =
  (typeof ADMIN_ACTIVITY_ACTIONS)[keyof typeof ADMIN_ACTIVITY_ACTIONS];

export type AdminActivityTargetType =
  (typeof ADMIN_ACTIVITY_TARGET_TYPES)[keyof typeof ADMIN_ACTIVITY_TARGET_TYPES];

const ACTION_LABELS: Record<AdminActivityAction, string> = {
  USER_SUSPENDED: 'User suspended',
  USER_REACTIVATED: 'User reactivated',
  SUPPLIER_VERIFICATION_APPROVED: 'Supplier verification approved',
  SUPPLIER_VERIFICATION_REJECTED: 'Supplier verification rejected',
  SUPPLIER_VERIFICATION_CHANGES_REQUESTED: 'Supplier changes requested',
  INVITATION_CREATED: 'Invitation created',
  INVITATION_REVOKED: 'Invitation revoked',
  INVITATION_RESENT: 'Invitation resent',
  MATERIAL_HIDDEN: 'Material hidden',
  MATERIAL_MARKED_UNAVAILABLE: 'Material marked unavailable',
  MATERIAL_RESTORED: 'Material restored',
  MATERIAL_REPORT_RESOLVED: 'Material report resolved',
  MATERIAL_REPORT_REJECTED: 'Material report rejected',
  MATERIAL_REPORT_HIDE_MATERIAL: 'Material hidden from report',
  CATEGORY_REQUEST_APPROVED: 'Category request approved',
  CATEGORY_REQUEST_REJECTED: 'Category request rejected',
  PRICE_REQUEST_APPROVED: 'Price request approved',
  PRICE_REQUEST_REJECTED: 'Price request rejected',
  LEARNING_PROJECT_APPROVED: 'Learning project approved',
  LEARNING_PROJECT_CHANGES_REQUESTED: 'Learning project changes requested',
  LEARNING_PROJECT_REJECTED: 'Learning project rejected',
  LEARNING_PROJECT_HIDDEN: 'Learning project hidden',
  LEARNING_PROJECT_RESTORED: 'Learning project restored',
  LEARNING_PROJECT_ARCHIVED: 'Learning project archived',
};

const TARGET_TYPE_LABELS: Record<AdminActivityTargetType, string> = {
  USER: 'User',
  SUPPLIER_PROFILE: 'Supplier profile',
  INVITATION: 'Invitation',
  MATERIAL: 'Material',
  MATERIAL_REPORT: 'Material report',
  CATEGORY_REQUEST: 'Category request',
  PRICE_RULE_REQUEST: 'Price request',
  LEARNING_PROJECT: 'Learning project',
};

export const getAdminActivityActionLabel = (action: string): string =>
  ACTION_LABELS[action as AdminActivityAction] ??
  action.replaceAll('_', ' ').toLowerCase();

export const getAdminActivityTargetTypeLabel = (targetType: string): string =>
  TARGET_TYPE_LABELS[targetType as AdminActivityTargetType] ??
  targetType.replaceAll('_', ' ').toLowerCase();

export type AdminActivityLogActionOption = {
  value: string;
  label: string;
};

export type AdminActivityLogTargetTypeOption = {
  value: string;
  label: string;
};

export type AdminActivityLogActorOption = {
  id: string;
  displayName: string;
  email: string;
};

export type AdminActivityLogFilterOptions = {
  actions: AdminActivityLogActionOption[];
  targetTypes: AdminActivityLogTargetTypeOption[];
  actors: AdminActivityLogActorOption[];
};

export type AdminActivityLogSummary = {
  total: number;
  today: number;
  thisWeek: number;
  mostRecentAt: string | null;
};

const startOfUtcDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const startOfUtcWeek = (date: Date): Date => {
  const copy = startOfUtcDay(date);
  const day = copy.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy;
};

const buildAuditLogFilterOptions = async (): Promise<AdminActivityLogFilterOptions> => {
  const [actionRows, targetTypeRows, actorRows] = await Promise.all([
    prisma.adminActivityLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    }),
    prisma.adminActivityLog.findMany({
      distinct: ['targetType'],
      select: { targetType: true },
      orderBy: { targetType: 'asc' },
    }),
    prisma.adminActivityLog.findMany({
      distinct: ['actorUserId'],
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        actorUserId: true,
        actor: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const actionValues = new Set<string>([
    ...Object.values(ADMIN_ACTIVITY_ACTIONS),
    ...actionRows.map((row) => row.action),
  ]);

  const targetTypeValues = new Set<string>([
    ...Object.values(ADMIN_ACTIVITY_TARGET_TYPES),
    ...targetTypeRows.map((row) => row.targetType),
  ]);

  return {
    actions: [...actionValues]
      .map((value) => ({
        value,
        label: getAdminActivityActionLabel(value),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    targetTypes: [...targetTypeValues]
      .map((value) => ({
        value,
        label: getAdminActivityTargetTypeLabel(value),
      }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    actors: actorRows
      .filter((row) => row.actor != null)
      .map((row) => ({
        id: row.actorUserId,
        displayName: row.actor!.displayName,
        email: row.actor!.email,
      })),
  };
};

const buildAuditLogSummary = async (
  filteredTotal: number,
): Promise<AdminActivityLogSummary> => {
  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const weekStart = startOfUtcWeek(now);

  const [today, thisWeek, mostRecent] = await Promise.all([
    prisma.adminActivityLog.count({
      where: { createdAt: { gte: todayStart } },
    }),
    prisma.adminActivityLog.count({
      where: { createdAt: { gte: weekStart } },
    }),
    prisma.adminActivityLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  return {
    total: filteredTotal,
    today,
    thisWeek,
    mostRecentAt: mostRecent?.createdAt.toISOString() ?? null,
  };
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

export type AdminActivityLogListItemDto = {
  id: string;
  action: string;
  actionLabel: string;
  actorUserId: string;
  actorName: string;
  actorEmail: string;
  targetType: string;
  targetId: string | null;
  targetLabel: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type AdminActivityLogListQuery = {
  page: number;
  limit: number;
  search?: string;
  action?: AdminActivityAction;
  targetType?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
};

const mapActivityRow = (
  row: {
    id: string;
    action: string;
    actorUserId: string;
    targetType: string;
    targetId: string | null;
    targetLabel: string;
    metadata: Prisma.JsonValue;
    createdAt: Date;
    actor: { displayName: string; email: string } | null;
  },
): AdminActivityLogListItemDto => ({
  id: row.id,
  action: row.action,
  actionLabel: getAdminActivityActionLabel(row.action),
  actorUserId: row.actorUserId,
  actorName: row.actor?.displayName?.trim() || 'Unknown admin',
  actorEmail: row.actor?.email?.trim() || '',
  targetType: row.targetType,
  targetId: row.targetId,
  targetLabel: row.targetLabel,
  metadata:
    row.metadata != null && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null,
  createdAt: row.createdAt.toISOString(),
});

const buildActivityLogWhere = (
  query: AdminActivityLogListQuery,
): Prisma.AdminActivityLogWhereInput => {
  const where: Prisma.AdminActivityLogWhereInput = {};

  if (query.action) {
    where.action = query.action;
  }

  if (query.targetType) {
    where.targetType = query.targetType;
  }

  if (query.actorId) {
    where.actorUserId = query.actorId;
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) {
      const parsed = new Date(query.dateFrom);
      if (!Number.isNaN(parsed.getTime())) {
        where.createdAt.gte = startOfUtcDay(parsed);
      }
    }
    if (query.dateTo) {
      const parsed = new Date(query.dateTo);
      if (!Number.isNaN(parsed.getTime())) {
        const end = startOfUtcDay(parsed);
        end.setUTCHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
  }

  const search = query.search?.trim();
  if (search) {
    const normalized = search.toLowerCase();
    const matchingActions = Object.values(ADMIN_ACTIVITY_ACTIONS).filter((action) =>
      getAdminActivityActionLabel(action).toLowerCase().includes(normalized),
    );

    where.OR = [
      { targetLabel: { contains: search, mode: 'insensitive' } },
      { action: { contains: search, mode: 'insensitive' } },
      ...(matchingActions.length > 0 ? [{ action: { in: matchingActions } }] : []),
      { targetType: { contains: search, mode: 'insensitive' } },
      { actor: { displayName: { contains: search, mode: 'insensitive' } } },
      { actor: { email: { contains: search, mode: 'insensitive' } } },
    ];
  }

  return where;
};

export const listAdminActivityLogs = async (query: AdminActivityLogListQuery) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const where = buildActivityLogWhere({ ...query, page, limit });
  const skip = (page - 1) * limit;

  const [total, rows, filterOptions, summary] = await Promise.all([
    prisma.adminActivityLog.count({ where }),
    prisma.adminActivityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        actor: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    }),
    buildAuditLogFilterOptions(),
    buildAuditLogSummary(0),
  ]);

  const resolvedSummary: AdminActivityLogSummary = {
    ...summary,
    total,
  };

  return {
    items: rows.map(mapActivityRow),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 1 : Math.ceil(total / limit),
    },
    filterOptions,
    summary: resolvedSummary,
  };
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
    actionLabel: getAdminActivityActionLabel(row.action),
    actorName: row.actor.displayName,
    actorEmail: row.actor.email,
    targetLabel: row.targetLabel,
    createdAt: row.createdAt.toISOString(),
  }));
};
