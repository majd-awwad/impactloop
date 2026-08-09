import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';

import * as repository from './admin-people.repository.js';

type UserWithRoles = NonNullable<
  Awaited<ReturnType<typeof repository.findUserWithRoles>>
>;

export const userHasAdminRole = (user: UserWithRoles) =>
  user.roles.some((assignment) => assignment.role === 'ADMIN');

export const assertActorMayChangeUserStatus = async (
  actorId: string,
  targetUserId: string,
) => {
  if (actorId === targetUserId) {
    throw new AppError(
      'You cannot change the status of your own account.',
      403,
      COMMON_ERROR_CODES.forbidden,
      { reason: 'SELF_ACTION_BLOCKED' },
    );
  }

  const target = await repository.findUserWithRoles(targetUserId);
  if (!target) {
    throw new AppError('User not found.', 404, COMMON_ERROR_CODES.notFound);
  }

  if (userHasAdminRole(target)) {
    const activeAdminCount = await repository.countActiveAdmins();
    if (activeAdminCount <= 1) {
      throw new AppError(
        'The last active admin account cannot be modified.',
        403,
        COMMON_ERROR_CODES.forbidden,
        { reason: 'LAST_ACTIVE_ADMIN' },
      );
    }

    throw new AppError(
      'Admin accounts cannot be suspended or reactivated through People Management.',
      403,
      COMMON_ERROR_CODES.forbidden,
      { reason: 'PROTECTED_ADMIN_ACCOUNT' },
    );
  }

  return target;
};

export const buildStatusActionFlags = (
  user: UserWithRoles,
  actorId: string,
) => {
  const isAdmin = userHasAdminRole(user);
  const isSelf = user.id === actorId;
  const canModifyStatus = !isAdmin && !isSelf;

  return {
    isProtectedAdmin: isAdmin,
    canSuspend:
      canModifyStatus &&
      (user.accountStatus === 'ACTIVE' ||
        user.accountStatus === 'PENDING_VERIFICATION'),
    canReactivate: canModifyStatus && user.accountStatus === 'SUSPENDED',
  };
};
