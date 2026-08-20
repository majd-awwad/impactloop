import { prisma } from '../../../src/database/prisma.js';

const redact = (id: string) => `${id.slice(0, 6)}…${id.slice(-4)}`;

export const MAJD_DRIVER_NAME = 'Majd Driver';
export const MAJD_LEARNER_NAME = 'Majd Learner';
export const MAJD_LEARNER_EMAIL = 'majd@learner.com';
export const ISRAA_LEARNER_EMAIL = 'israa@learner.com';
export const MAJD_SUPPLIER_NAME = 'Majd Tech Reuse Workshop';
export const ADMIN_EMAIL = 'admin@admin.com';

export type NamedUserRow = {
  id: string;
  displayName: string;
  email: string;
  accountStatus: string;
  emailVerifiedAt: Date | null;
  roles: string[];
  driverProfile: {
    id: string;
    status: string;
    availability: string;
    acceptingNewJobs: boolean;
  } | null;
};

export const formatNamedAccount = (row: {
  displayName: string;
  email: string;
  accountStatus: string;
  roles: string[];
  id: string;
}) =>
  `${row.displayName} | ${row.email} | status=${row.accountStatus} | roles=${row.roles.join(',') || '(none)'} | id=${redact(row.id)}`;

export const findNamedUsers = async (displayName: string): Promise<NamedUserRow[]> => {
  const users = await prisma.user.findMany({
    where: { displayName },
    select: {
      id: true,
      displayName: true,
      email: true,
      accountStatus: true,
      emailVerifiedAt: true,
      roles: { select: { role: true, isPrimary: true } },
      driverProfile: {
        select: {
          id: true,
          status: true,
          availability: true,
          acceptingNewJobs: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return users.map((user) => ({
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    accountStatus: user.accountStatus,
    emailVerifiedAt: user.emailVerifiedAt,
    roles: user.roles.map((role) => (role.isPrimary ? `${role.role}*` : role.role)),
    driverProfile: user.driverProfile,
  }));
};

export const findSupplierByOrganizationName = async (organizationName: string) =>
  prisma.organizationProfile.findMany({
    where: { organizationName },
    select: {
      organizationName: true,
      supplierProfile: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
              accountStatus: true,
              roles: { select: { role: true, isPrimary: true } },
            },
          },
        },
      },
    },
  });

export type MajdTrio = {
  driver: NamedUserRow;
  learner: NamedUserRow;
  supplierUser: {
    id: string;
    displayName: string;
    email: string;
    accountStatus: string;
  };
  driverProfile: NonNullable<NamedUserRow['driverProfile']>;
};

export const resolveMajdDeliveryTrio = async (): Promise<
  { ok: true; trio: MajdTrio } | { ok: false; reason: string }
> => {
  const drivers = await findNamedUsers(MAJD_DRIVER_NAME);
  const learners = await findNamedUsers(MAJD_LEARNER_NAME);
  const supplierUsers = await findNamedUsers(MAJD_SUPPLIER_NAME);
  const supplierOrgs = await findSupplierByOrganizationName(MAJD_SUPPLIER_NAME);

  const ambiguous: string[] = [];
  if (drivers.length !== 1) ambiguous.push(`driver (${drivers.length})`);
  if (learners.length !== 1) ambiguous.push(`learner (${learners.length})`);
  if (supplierOrgs.length !== 1 && supplierUsers.length !== 1) {
    ambiguous.push(
      `supplier (${Math.max(supplierOrgs.length, supplierUsers.length)})`,
    );
  }
  if (supplierOrgs.length === 1 && supplierUsers.length === 1) {
    if (supplierOrgs[0]!.supplierProfile.user.id !== supplierUsers[0]!.id) {
      ambiguous.push('supplier user and organization resolved to different accounts');
    }
  }

  if (ambiguous.length > 0) {
    return { ok: false, reason: ambiguous.join(', ') };
  }

  const driver = drivers[0]!;
  const learner = learners[0]!;
  const supplierUser = supplierOrgs[0]?.supplierProfile.user ?? supplierUsers[0]!;
  const driverProfile = driver.driverProfile;
  if (!driverProfile || driverProfile.status !== 'ACTIVE') {
    return { ok: false, reason: 'Majd Driver has no ACTIVE driver profile' };
  }

  return {
    ok: true,
    trio: {
      driver,
      learner,
      supplierUser: {
        id: supplierUser.id,
        displayName: supplierUser.displayName,
        email: supplierUser.email,
        accountStatus: supplierUser.accountStatus,
      },
      driverProfile,
    },
  };
};

export { redact };
