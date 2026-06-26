import { AppError } from '../../utils/app-error.js';

import * as repository from './admin-people.repository.js';
import {
  assertActorMayChangeUserStatus,
  buildStatusActionFlags,
} from './admin-people.safety.js';
import type {
  AdminPeopleListQuery,
  SuspendUserInput,
} from './admin-people.validation.js';

type UserRecord = NonNullable<
  Awaited<ReturnType<typeof repository.findUserWithRoles>>
>;

const mapPrimaryRole = (user: UserRecord) => {
  const primary = user.roles.find((role) => role.isPrimary);
  return primary?.role ?? user.roles[0]?.role ?? null;
};

const mapListItem = (user: UserRecord, actorId: string) => {
  const flags = buildStatusActionFlags(user, actorId);
  const isLearnerOnly =
    user.roles.some((role) => role.role === 'LEARNER') &&
    !user.roles.some((role) =>
      ['SUPPLIER', 'DRIVER', 'MODERATOR', 'ADMIN'].includes(role.role),
    );

  return {
    userId: user.id,
    displayName: user.displayName,
    email: user.email,
    roles: user.roles.map((role) => role.role),
    primaryRole: mapPrimaryRole(user),
    accountStatus: user.accountStatus,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    supplierName: user.supplierProfile?.publicName ?? null,
    supplierType: user.supplierProfile?.supplierType ?? null,
    verificationStatus: user.supplierProfile?.verificationStatus ?? null,
    driverStatus: user.driverProfile?.status ?? null,
    isLearnerOnly,
    ...flags,
  };
};

const mapDetail = (user: UserRecord, actorId: string) => ({
  ...mapListItem(user, actorId),
  phone: user.phone,
  emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
  updatedAt: user.updatedAt.toISOString(),
  suspendedAt:
    user.accountStatus === 'SUSPENDED' ? user.updatedAt.toISOString() : null,
  suspensionReason: null,
  suspendedByName: null,
  supplierProfile: user.supplierProfile
    ? {
        publicName: user.supplierProfile.publicName,
        supplierType: user.supplierProfile.supplierType,
        verificationStatus: user.supplierProfile.verificationStatus,
      }
    : null,
  driverProfile: user.driverProfile
    ? {
        status: user.driverProfile.status,
        transportationType: user.driverProfile.transportationType,
      }
    : null,
});

export const getAdminPeopleSummary = async () => repository.countPeopleSummary();

export const listAdminPeople = async (
  actorId: string,
  query: AdminPeopleListQuery,
) => {
  const result = await repository.listUsersForAdmin(query);

  return {
    summary: await repository.countPeopleSummary(),
    items: result.items.map((item) => mapListItem(item, actorId)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
    },
  };
};

export const getAdminPersonById = async (actorId: string, userId: string) => {
  const user = await repository.findUserWithRoles(userId);
  if (!user) {
    throw new AppError('User not found.', 404, 'NOT_FOUND');
  }

  return mapDetail(user, actorId);
};

export const suspendAdminPerson = async (
  actorId: string,
  userId: string,
  _input: SuspendUserInput,
) => {
  const target = await assertActorMayChangeUserStatus(actorId, userId);

  if (
    target.accountStatus !== 'ACTIVE' &&
    target.accountStatus !== 'PENDING_VERIFICATION'
  ) {
    throw new AppError(
      'Only active or pending accounts can be suspended.',
      409,
      'CONFLICT',
      { reason: 'INVALID_STATUS_TRANSITION' },
    );
  }

  const updated = await repository.updateUserAccountStatus(
    userId,
    'SUSPENDED',
  );

  return mapDetail(updated, actorId);
};

export const reactivateAdminPerson = async (actorId: string, userId: string) => {
  const target = await assertActorMayChangeUserStatus(actorId, userId);

  if (target.accountStatus !== 'SUSPENDED') {
    throw new AppError(
      'Only suspended accounts can be reactivated.',
      409,
      'CONFLICT',
      { reason: 'INVALID_STATUS_TRANSITION' },
    );
  }

  const updated = await repository.updateUserAccountStatus(userId, 'ACTIVE');

  return mapDetail(updated, actorId);
};
