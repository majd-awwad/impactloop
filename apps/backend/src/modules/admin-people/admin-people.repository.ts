import type { AccountStatus, Prisma, UserRole } from '../../generated/prisma/index.js';
import { prisma } from '../../database/prisma.js';
import { STRIKE_ELIGIBLE_TARGET_ROLES } from '../reservations/account-suspension.js';

import type { AdminPeopleListQuery } from './admin-people.validation.js';

const elevatedRoles: UserRole[] = ['SUPPLIER', 'DRIVER', 'MODERATOR', 'ADMIN'];

const moderatorSelect = {
  id: true,
  displayName: true,
  email: true,
} as const;

const userListInclude = {
  roles: {
    select: {
      role: true,
      isPrimary: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  supplierProfile: {
    select: {
      publicName: true,
      supplierType: true,
      verificationStatus: true,
    },
  },
  driverProfile: {
    select: {
      status: true,
      transportationType: true,
    },
  },
  suspendedBy: {
    select: moderatorSelect,
  },
  reactivatedBy: {
    select: moderatorSelect,
  },
} satisfies Prisma.UserInclude;

export type AdminPeopleUserRecord = Prisma.UserGetPayload<{
  include: typeof userListInclude;
}>;

const roleFilterMap: Record<
  Exclude<AdminPeopleListQuery['tab'], 'ALL' | 'LEARNERS'>,
  UserRole
> = {
  SUPPLIERS: 'SUPPLIER',
  DRIVERS: 'DRIVER',
  MODERATORS: 'MODERATOR',
  ADMINS: 'ADMIN',
};

const learnersWhere = (): Prisma.UserWhereInput => ({
  roles: {
    some: {
      role: 'LEARNER',
    },
  },
  NOT: {
    roles: {
      some: {
        role: {
          in: elevatedRoles,
        },
      },
    },
  },
});

const countUsersWithRole = (role: UserRole) =>
  prisma.user.count({
    where: {
      roles: {
        some: { role },
      },
    },
  });

export const countPeopleSummary = async () => {
  const [total, suspended, suppliers, drivers, moderators, admins, learners] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { accountStatus: 'SUSPENDED' } }),
      countUsersWithRole('SUPPLIER'),
      countUsersWithRole('DRIVER'),
      countUsersWithRole('MODERATOR'),
      countUsersWithRole('ADMIN'),
      prisma.user.count({ where: learnersWhere() }),
    ]);

  return {
    total,
    suspended,
    learners,
    suppliers,
    drivers,
    moderators,
    admins,
  };
};

const buildTabWhere = (tab: AdminPeopleListQuery['tab']): Prisma.UserWhereInput => {
  if (tab === 'ALL') {
    return {};
  }

  if (tab === 'LEARNERS') {
    return learnersWhere();
  }

  return {
    roles: {
      some: {
        role: roleFilterMap[tab],
      },
    },
  };
};

export const listUsersForAdmin = async (query: AdminPeopleListQuery) => {
  const where: Prisma.UserWhereInput = buildTabWhere(query.tab);

  if (query.search?.trim()) {
    const search = query.search.trim();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { displayName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      },
    ];
  }

  if (query.status) {
    where.accountStatus = query.status;
  }

  const skip = (query.page - 1) * query.limit;

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: userListInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take: query.limit,
    }),
  ]);

  return { total, items };
};

const toCountMap = <T extends string>(
  rows: Array<Record<T, string | null> & { _count: { _all: number } }>,
  key: T,
) =>
  new Map(
    rows
      .filter((row) => row[key] != null)
      .map((row) => [row[key]!, row._count._all]),
  );

export const countVerifiedStrikesForUserIds = async (userIds: string[]) => {
  if (userIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await prisma.noShowReport.groupBy({
    by: ['targetUserId'],
    where: {
      targetUserId: { in: userIds },
      status: 'VERIFIED',
      targetRole: { in: [...STRIKE_ELIGIBLE_TARGET_ROLES] },
    },
    _count: { _all: true },
  });

  return toCountMap(rows, 'targetUserId');
};

export const countMaterialsByOwnerIds = async (userIds: string[]) => {
  if (userIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await prisma.material.groupBy({
    by: ['ownerId'],
    where: { ownerId: { in: userIds } },
    _count: { _all: true },
  });

  return toCountMap(rows, 'ownerId');
};

export const countReservationsByRequesterIds = async (userIds: string[]) => {
  if (userIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await prisma.reservation.groupBy({
    by: ['requesterId'],
    where: { requesterId: { in: userIds } },
    _count: { _all: true },
  });

  return toCountMap(rows, 'requesterId');
};

export const countReservationsByOwnerIds = async (userIds: string[]) => {
  if (userIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await prisma.reservation.groupBy({
    by: ['ownerId'],
    where: { ownerId: { in: userIds } },
    _count: { _all: true },
  });

  return toCountMap(rows, 'ownerId');
};

export const findUserWithRoles = async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    include: userListInclude,
  });

export const countActiveAdmins = async () =>
  prisma.user.count({
    where: {
      accountStatus: 'ACTIVE',
      roles: {
        some: {
          role: 'ADMIN',
        },
      },
    },
  });

export const suspendUserAccount = async (input: {
  userId: string;
  actorId: string;
  reason: string;
}) => {
  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: {
      accountStatus: 'SUSPENDED',
      suspensionReason: input.reason,
      suspendedAt: new Date(),
      suspendedById: input.actorId,
      reactivatedAt: null,
      reactivatedById: null,
    },
    select: { id: true },
  });

  return prisma.user.findUniqueOrThrow({
    where: { id: updated.id },
    include: userListInclude,
  });
};

export const reactivateUserAccount = async (input: {
  userId: string;
  actorId: string;
}) => {
  const updated = await prisma.user.update({
    where: { id: input.userId },
    data: {
      accountStatus: 'ACTIVE',
      reactivatedAt: new Date(),
      reactivatedById: input.actorId,
    },
    select: { id: true },
  });

  return prisma.user.findUniqueOrThrow({
    where: { id: updated.id },
    include: userListInclude,
  });
};

export const updateUserAccountStatus = async (
  userId: string,
  accountStatus: AccountStatus,
) =>
  prisma.user.update({
    where: { id: userId },
    data: { accountStatus },
    include: userListInclude,
  });
