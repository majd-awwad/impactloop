import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import type { MaterialStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import * as repository from './admin-materials.repository.js';

export const MODERATION_LOCKED_STATUSES = [
  'PENDING_RESERVATION',
  'RESERVED',
  'REUSED',
] as const satisfies readonly MaterialStatus[];

export type ModerationLockedStatus = (typeof MODERATION_LOCKED_STATUSES)[number];

const moderationLockedStatusSet = new Set<MaterialStatus>(
  MODERATION_LOCKED_STATUSES,
);

export const getMaterialModerationPolicy = (status: MaterialStatus) => {
  const canHide = status === 'AVAILABLE';
  const canMarkUnavailable = status === 'AVAILABLE';
  const canRestore = status === 'UNAVAILABLE';
  const isModerationLocked = moderationLockedStatusSet.has(status);

  let lockReason: string | null = null;
  if (status === 'REUSED') {
    lockReason =
      'This material has completed its reuse lifecycle and cannot be restored or made unavailable.';
  } else if (status === 'PENDING_RESERVATION' || status === 'RESERVED') {
    lockReason =
      'Moderation actions are locked while this material is involved in an active reservation.';
  } else if (isModerationLocked) {
    lockReason = 'Moderation locked due to reservation/reuse status.';
  }

  return {
    canHide,
    canMarkUnavailable,
    canRestore,
    isModerationLocked,
    lockReason,
    listLockNote: isModerationLocked
      ? 'Moderation locked due to reservation/reuse status.'
      : null,
  };
};

const hideBlockedMessage =
  'This material cannot be hidden because it is reserved or already reused.';

const markUnavailableBlockedMessage =
  'This material cannot be marked unavailable because it is reserved or already reused.';

const restoreBlockedMessage =
  'This material cannot be restored because its lifecycle is reserved or completed.';

export const assertCanHideMaterial = async (
  materialId: string,
  status: MaterialStatus,
) => {
  if (moderationLockedStatusSet.has(status)) {
    throw new AppError(hideBlockedMessage, 409, COMMON_ERROR_CODES.conflict, {
      reason: 'MODERATION_LOCKED',
      status,
    });
  }

  if (status !== 'AVAILABLE') {
    throw new AppError(
      'Only available materials can be hidden.',
      400,
      COMMON_ERROR_CODES.validationError,
      { status },
    );
  }

  const activeCount = await repository.countActiveReservations(materialId);
  if (activeCount > 0) {
    throw new AppError(hideBlockedMessage, 409, COMMON_ERROR_CODES.conflict, {
      reason: 'ACTIVE_RESERVATION',
      status,
    });
  }
};

export const assertCanMarkMaterialUnavailable = async (
  materialId: string,
  status: MaterialStatus,
) => {
  if (moderationLockedStatusSet.has(status)) {
    throw new AppError(
      markUnavailableBlockedMessage,
      409,
      COMMON_ERROR_CODES.conflict,
      {
        reason: 'MODERATION_LOCKED',
        status,
      },
    );
  }

  if (status !== 'AVAILABLE') {
    throw new AppError(
      'Only available materials can be marked unavailable.',
      400,
      COMMON_ERROR_CODES.validationError,
      { status },
    );
  }

  const activeCount = await repository.countActiveReservations(materialId);
  if (activeCount > 0) {
    throw new AppError(
      markUnavailableBlockedMessage,
      409,
      COMMON_ERROR_CODES.conflict,
      {
        reason: 'ACTIVE_RESERVATION',
        status,
      },
    );
  }
};

export const assertCanRestoreMaterial = (status: MaterialStatus) => {
  if (moderationLockedStatusSet.has(status)) {
    throw new AppError(restoreBlockedMessage, 409, COMMON_ERROR_CODES.conflict, {
      reason: 'MODERATION_LOCKED',
      status,
    });
  }

  if (status !== 'UNAVAILABLE') {
    throw new AppError(
      'Only unavailable materials can be restored.',
      400,
      COMMON_ERROR_CODES.validationError,
      { status },
    );
  }
};
