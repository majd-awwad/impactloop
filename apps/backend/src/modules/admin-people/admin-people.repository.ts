import type { AccountStatus, Prisma, UserRole } from '../../generated/prisma/index.js';
import { prisma } from '../../database/prisma.js';

import type { AdminPeopleListQuery } from './admin-people.validation.js';

const elevatedRoles: UserRole[] = ['SUPPLIER', 'DRIVER', 'MODERATOR', 'ADMIN'];

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
} satisfies Prisma.UserInclude;

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

export const updateUserAccountStatus = async (
  userId: string,
  accountStatus: AccountStatus,
) =>
  prisma.user.update({
    where: { id: userId },
    data: { accountStatus },
    include: userListInclude,
  });
