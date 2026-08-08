import type {
  NoShowReportReason,
  NoShowReportTargetRole,
} from '../../generated/prisma/client.js';

const NULL_TOKEN = '_';
const ANY_REASON_TOKEN = '*';

export type NoShowReportIncidentKeyInput = {
  reservationId: string;
  deliveryId?: string | null;
  targetRole: NoShowReportTargetRole;
  targetUserId?: string | null;
  reasonCode?: NoShowReportReason | null;
  /**
   * When false, reasonCode is omitted from the key so only one incident per
   * reservation target is allowed regardless of reason.
   */
  includeReasonCode?: boolean;
};

export const buildNoShowReportIncidentKey = (
  input: NoShowReportIncidentKeyInput,
): string => {
  const delivery = input.deliveryId ?? NULL_TOKEN;
  const targetUser = input.targetUserId ?? NULL_TOKEN;
  const reason =
    input.includeReasonCode === false
      ? ANY_REASON_TOKEN
      : (input.reasonCode ?? NULL_TOKEN);

  return `${input.reservationId}:${delivery}:${input.targetRole}:${targetUser}:${reason}`;
};

export const noShowReportIncidentKeyForCreate = (
  data: {
    reservationId: string;
    deliveryId?: string | null;
    targetRole: NoShowReportTargetRole;
    targetUserId?: string | null;
    reasonCode: NoShowReportReason;
  },
  options?: Pick<NoShowReportIncidentKeyInput, 'includeReasonCode'>,
) =>
  buildNoShowReportIncidentKey({
    reservationId: data.reservationId,
    deliveryId: data.deliveryId,
    targetRole: data.targetRole,
    targetUserId: data.targetUserId,
    reasonCode: data.reasonCode,
    includeReasonCode: options?.includeReasonCode,
  });

const SUPPLIER_WILDCARD_REASON_CODES = new Set<NoShowReportReason>([
  'SUPPLIER_UNAVAILABLE',
  'SUPPLIER_MATERIAL_NOT_READY',
  'WRONG_INFORMATION',
  'OTHER',
]);

/** Mirrors production duplicate-key rules for seeds and test fixtures. */
export const resolveNoShowReportIncidentKeyInput = (data: {
  reservationId: string;
  deliveryId?: string | null;
  targetRole: NoShowReportTargetRole;
  targetUserId?: string | null;
  reasonCode: NoShowReportReason;
  note?: string | null;
}): NoShowReportIncidentKeyInput => {
  const isPartialPickupIncident =
    data.reasonCode === 'PICKUP_FAILED' &&
    data.note?.includes('PARTIAL_PICKUP_INCIDENT') === true;

  if (
    data.targetRole === 'SUPPLIER' &&
    (SUPPLIER_WILDCARD_REASON_CODES.has(data.reasonCode) ||
      (data.reasonCode === 'PICKUP_FAILED' && !isPartialPickupIncident))
  ) {
    return {
      reservationId: data.reservationId,
      deliveryId: null,
      targetRole: 'SUPPLIER',
      targetUserId: data.targetUserId,
      includeReasonCode: false,
    };
  }

  if (data.targetRole === 'LEARNER' && data.reasonCode === 'DELIVERY_FAILED') {
    return {
      reservationId: data.reservationId,
      deliveryId: null,
      targetRole: 'LEARNER',
      targetUserId: data.targetUserId,
      includeReasonCode: false,
    };
  }

  if (
    data.targetRole === 'SYSTEM' &&
    (data.reasonCode === 'NO_DRIVER_AVAILABLE' ||
      data.reasonCode === 'NO_RESPONSE_AFTER_PICKUP_WINDOW')
  ) {
    return {
      reservationId: data.reservationId,
      deliveryId: null,
      targetRole: 'SYSTEM',
      targetUserId: null,
      reasonCode: data.reasonCode,
    };
  }

  if (data.targetRole === 'DRIVER' && data.reasonCode === 'DRIVER_ISSUE') {
    return {
      reservationId: data.reservationId,
      deliveryId: null,
      targetRole: 'DRIVER',
      targetUserId: data.targetUserId,
      reasonCode: 'DRIVER_ISSUE',
    };
  }

  return {
    reservationId: data.reservationId,
    deliveryId: data.deliveryId ?? null,
    targetRole: data.targetRole,
    targetUserId: data.targetUserId,
    reasonCode: data.reasonCode,
  };
};

export const resolveNoShowReportIncidentKey = (
  data: Parameters<typeof resolveNoShowReportIncidentKeyInput>[0],
) => buildNoShowReportIncidentKey(resolveNoShowReportIncidentKeyInput(data));
