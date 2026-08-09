import { isSupplierVerificationAwaitingAdminReview } from '../supplier/supplier-verification.status.js';
import type { NotificationActionType } from '../notifications/notification-identifiers.js';

export const SUPPLIER_NOTIFICATION_CATEGORIES = [
  'RESERVATION',
  'MATERIAL_REVIEW',
  'DELIVERY_RECOVERY',
  'ACCOUNT',
  'SYSTEM',
  'UNKNOWN',
] as const;

export const SUPPLIER_NOTIFICATION_STATES = [
  'NEEDS_ACTION',
  'WAITING',
  'UPDATE',
  'RESOLVED',
  'UNKNOWN',
] as const;

export const SUPPLIER_NOTIFICATION_ACTIONS = [
  'REVIEW_RESERVATION',
  'OPEN_RESERVATION',
  'CHOOSE_PICKUP_WINDOW',
  'CONTINUE_LISTING',
  'EDIT_LISTING',
  'OPEN_MATERIAL',
  'OPEN_PROFILE',
  'NONE',
  'UNKNOWN',
] as const satisfies readonly (NotificationActionType | 'UNKNOWN')[];

export type SupplierNotificationCategory =
  (typeof SUPPLIER_NOTIFICATION_CATEGORIES)[number];
export type SupplierNotificationState =
  (typeof SUPPLIER_NOTIFICATION_STATES)[number];
export type SupplierNotificationActionType =
  (typeof SUPPLIER_NOTIFICATION_ACTIONS)[number];

export type SupplierNotificationClassification = {
  category: SupplierNotificationCategory;
  state: SupplierNotificationState;
  actionType: SupplierNotificationActionType;
  waitingOn: 'SUPPLIER' | 'LEARNER' | 'DRIVER' | 'ADMIN' | 'SYSTEM' | null;
};

export type SupplierNotificationTarget =
  | {
      kind: 'RESERVATION';
      status: string;
      attentionState: string;
      nextActor: string;
      availableActions: string[];
    }
  | {
      kind: 'CATEGORY_REQUEST' | 'PRICE_RULE_REQUEST';
      status: string;
      hasDraft: boolean;
      isPublished: boolean;
    }
  | { kind: 'MATERIAL'; status: string }
  | { kind: 'SUPPLIER_PROFILE'; verificationStatus: string }
  | null;

const RESERVATION_TYPES = new Set([
  'RESERVATION_REQUESTED',
  'RESERVATION_CANCELLED',
  'RESERVATION_EXPIRED',
]);

const RECOVERY_TYPES = new Set([
  'NO_DRIVER_SUPPLIER_RESCHEDULE_REQUESTED',
  'STALE_PICKUP_SUPPLIER_RESCHEDULE_REQUESTED',
]);

const REVIEW_TYPES = new Set([
  'CATEGORY_REQUEST_UPDATE',
  'PRICE_REQUEST_UPDATE',
  'MATERIAL_MODERATION_UPDATE',
]);

const ACCOUNT_TYPES = new Set(['SUPPLIER_VERIFICATION_UPDATE']);

const isTerminalReservation = (target: Extract<SupplierNotificationTarget, { kind: 'RESERVATION' }>) =>
  target.attentionState === 'TERMINAL' ||
  ['REJECTED', 'CANCELLED', 'EXPIRED', 'NO_SHOW', 'FULFILLMENT_FAILED', 'COMPLETED'].includes(
    target.status,
  );

export const classifySupplierNotification = (input: {
  rawType: string;
  target: SupplierNotificationTarget;
  resolvedAt: Date | null;
}): SupplierNotificationClassification => {
  const rawType = input.rawType.trim().toUpperCase();
  const category = RECOVERY_TYPES.has(rawType)
    ? 'DELIVERY_RECOVERY'
    : RESERVATION_TYPES.has(rawType)
      ? 'RESERVATION'
      : REVIEW_TYPES.has(rawType)
        ? 'MATERIAL_REVIEW'
        : ACCOUNT_TYPES.has(rawType)
          ? 'ACCOUNT'
          : rawType.startsWith('SYSTEM_')
            ? 'SYSTEM'
            : 'UNKNOWN';

  if (category === 'UNKNOWN') {
    return { category, state: 'UNKNOWN', actionType: 'UNKNOWN', waitingOn: null };
  }

  if (input.target == null) {
    return { category, state: 'UNKNOWN', actionType: 'UNKNOWN', waitingOn: null };
  }

  if (input.resolvedAt != null) {
    return { category, state: 'RESOLVED', actionType: 'NONE', waitingOn: null };
  }

  if (category === 'RESERVATION' || category === 'DELIVERY_RECOVERY') {
    const target = input.target;
    if (target.kind !== 'RESERVATION') {
      return { category, state: 'UNKNOWN', actionType: 'UNKNOWN', waitingOn: null };
    }

    if (isTerminalReservation(target)) {
      return { category, state: 'RESOLVED', actionType: 'NONE', waitingOn: null };
    }

    if (
      category === 'DELIVERY_RECOVERY' &&
      target.availableActions.includes('SUBMIT_RECOVERY_PICKUP_WINDOW')
    ) {
      return {
        category,
        state: 'NEEDS_ACTION',
        actionType: 'CHOOSE_PICKUP_WINDOW',
        waitingOn: 'SUPPLIER',
      };
    }

    if (
      rawType === 'RESERVATION_REQUESTED' &&
      target.availableActions.some((action) => action === 'ACCEPT' || action === 'DECLINE')
    ) {
      return {
        category,
        state: 'NEEDS_ACTION',
        actionType: 'REVIEW_RESERVATION',
        waitingOn: 'SUPPLIER',
      };
    }

    if (target.attentionState === 'SUPPLIER_ACTION_REQUIRED') {
      return {
        category,
        state: 'NEEDS_ACTION',
        actionType: 'OPEN_RESERVATION',
        waitingOn: 'SUPPLIER',
      };
    }

    if (target.attentionState === 'WAITING_FOR_LEARNER') {
      return { category, state: 'WAITING', actionType: 'NONE', waitingOn: 'LEARNER' };
    }
    if (target.attentionState === 'ADMIN_REVIEW_REQUIRED') {
      return { category, state: 'WAITING', actionType: 'NONE', waitingOn: 'ADMIN' };
    }
    if (target.nextActor === 'DRIVER') {
      return { category, state: 'WAITING', actionType: 'NONE', waitingOn: 'DRIVER' };
    }

    return { category, state: 'UPDATE', actionType: 'OPEN_RESERVATION', waitingOn: null };
  }

  if (category === 'MATERIAL_REVIEW') {
    if (input.target.kind === 'MATERIAL') {
      return { category, state: 'UPDATE', actionType: 'OPEN_MATERIAL', waitingOn: null };
    }

    if (input.target.kind === 'CATEGORY_REQUEST' || input.target.kind === 'PRICE_RULE_REQUEST') {
      if (input.target.isPublished) {
        return { category, state: 'RESOLVED', actionType: 'NONE', waitingOn: null };
      }
      if (input.target.status === 'PENDING') {
        return { category, state: 'WAITING', actionType: 'NONE', waitingOn: 'ADMIN' };
      }
      if (input.target.status === 'APPROVED' && input.target.hasDraft) {
        return { category, state: 'NEEDS_ACTION', actionType: 'CONTINUE_LISTING', waitingOn: 'SUPPLIER' };
      }
      if (input.target.status === 'REJECTED' && input.target.hasDraft) {
        return { category, state: 'NEEDS_ACTION', actionType: 'EDIT_LISTING', waitingOn: 'SUPPLIER' };
      }
      return { category, state: 'UPDATE', actionType: 'NONE', waitingOn: null };
    }
  }

  if (category === 'ACCOUNT' && input.target.kind === 'SUPPLIER_PROFILE') {
    if (
      isSupplierVerificationAwaitingAdminReview(
        input.target.verificationStatus,
      )
    ) {
      return { category, state: 'WAITING', actionType: 'NONE', waitingOn: 'ADMIN' };
    }
    return { category, state: 'UPDATE', actionType: 'OPEN_PROFILE', waitingOn: null };
  }

  return { category, state: 'UNKNOWN', actionType: 'UNKNOWN', waitingOn: null };
};
