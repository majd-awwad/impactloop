import {
  MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS,
  PENDING_SUPPLIER_RESPONSE_HOURS,
} from './reservation-timing-policy.js';

export const RESERVATION_HISTORY_NOTE_PREFIX = 'event:';

export const RESERVATION_HISTORY_EVENT_CODES = [
  'ACCEPTED_BY_SUPPLIER',
  'DECLINED_BY_SUPPLIER',
  'PICKUP_COMPLETED_BY_SUPPLIER',
  'SUPPLIER_REQUESTED_RESCHEDULE',
  'SUPPLIER_ACCEPTED_LEARNER_RESCHEDULE',
  'SUPPLIER_CANCELLED',
  'SUPPLIER_CANCELLED_PENDING_RESCHEDULE',
  'REPORTED_AFTER_MISSED_PICKUP',
  'REQUESTED_BY_LEARNER',
  'CANCELLED_BY_LEARNER',
  'CANCELLED_BY_LEARNER_AWAITING_CONFIRMATION',
  'LEARNER_ACCEPTED_SUPPLIER_PICKUP_WINDOW',
  'LEARNER_CONFIRMED_DELIVERY_WINDOW',
  'LEARNER_REQUESTED_RESCHEDULE',
  'LEARNER_CANCELLED_AFTER_RESCHEDULE',
  'LEARNER_NO_SHOW_AFTER_PICKUP',
  'LEARNER_REPORTED_SUPPLIER_ISSUE',
  'PENDING_EXPIRED_AFTER_PREFERRED_WINDOW',
  'PENDING_EXPIRED_AFTER_TIMEOUT',
  'MISSED_PICKUP_AUTO_EXPIRED',
  'NO_DRIVER_AVAILABLE',
  'NO_DRIVER_AUTO_ESCALATED',
  'ASSIGNED_DRIVER_PICKUP_AUTO_ESCALATED',
  'DELIVERY_PICKUP_WINDOW_EXPIRED',
  'DRIVER_NO_SHOW_AT_SUPPLIER',
  'DRIVER_NO_SHOW_REPORTED_BY_SUPPLIER',
  'SUPPLIER_MARKED_PICKUP_EXPIRED',
  'SUPPLIER_PICKUP_WINDOW_EXPIRED_NO_DRIVER',
  'DELIVERY_COMPLETED_BY_DRIVER',
  'GROUPED_DELIVERY_COMPLETED_BY_DRIVER',
  'SUPPLIER_SUBMITTED_PICKUP_WINDOW_NO_DRIVER',
  'SUPPLIER_SUBMITTED_REPLACEMENT_PICKUP_WINDOW',
  'SUPPLIER_SUBMITTED_PICKUP_WINDOW_ADMIN_RECOVERY',
  'ADMIN_REQUESTED_NEW_PICKUP_WINDOW_NO_DRIVER',
  'ADMIN_REQUESTED_NEW_PICKUP_WINDOW_PICKUP_INCOMPLETE',
  'ADMIN_CANCELLED_NO_DRIVER',
  'ADMIN_CANCELLED_PICKUP_INCOMPLETE',
  'FULFILLMENT_ISSUE_REPORTED',
] as const;

export type ReservationHistoryEventCode =
  (typeof RESERVATION_HISTORY_EVENT_CODES)[number];

export type ReservationHistoryNoteContext = {
  oldStatus?: string | null;
  newStatus?: string;
};

export type ParsedReservationHistoryNote = {
  eventCode: ReservationHistoryEventCode | null;
  reasonText: string | null;
};

const LEGACY_EXACT_NOTE_TO_EVENT_CODE = new Map<string, ReservationHistoryEventCode>([
  ['Accepted by supplier', 'ACCEPTED_BY_SUPPLIER'],
  ['Pickup completed by supplier', 'PICKUP_COMPLETED_BY_SUPPLIER'],
  [
    'Supplier accepted learner reschedule proposal',
    'SUPPLIER_ACCEPTED_LEARNER_RESCHEDULE',
  ],
  [
    'Reported to admin after missed pickup window',
    'REPORTED_AFTER_MISSED_PICKUP',
  ],
  ['Reservation requested by learner', 'REQUESTED_BY_LEARNER'],
  ['Cancelled by learner', 'CANCELLED_BY_LEARNER'],
  [
    'Cancelled by learner while awaiting confirmation',
    'CANCELLED_BY_LEARNER_AWAITING_CONFIRMATION',
  ],
  [
    'Learner accepted supplier proposed pickup window',
    'LEARNER_ACCEPTED_SUPPLIER_PICKUP_WINDOW',
  ],
  ['Learner confirmed feasible delivery window', 'LEARNER_CONFIRMED_DELIVERY_WINDOW'],
  ['Learner cancelled after reschedule request', 'LEARNER_CANCELLED_AFTER_RESCHEDULE'],
  ['Learner no-show after pickup window', 'LEARNER_NO_SHOW_AFTER_PICKUP'],
  [
    'Learner reported supplier issue after pickup window',
    'LEARNER_REPORTED_SUPPLIER_ISSUE',
  ],
  [
    'Expired automatically after the last preferred scheduling window passed without supplier response.',
    'PENDING_EXPIRED_AFTER_PREFERRED_WINDOW',
  ],
  [
    `Expired automatically after ${PENDING_SUPPLIER_RESPONSE_HOURS} hours without supplier response.`,
    'PENDING_EXPIRED_AFTER_TIMEOUT',
  ],
  [
    `Automatically expired after the pickup window passed without follow-up within ${MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS} hours.`,
    'MISSED_PICKUP_AUTO_EXPIRED',
  ],
  ['No driver available', 'NO_DRIVER_AVAILABLE'],
  ['No driver auto-escalated', 'NO_DRIVER_AUTO_ESCALATED'],
  [
    'Assigned-driver pickup auto-escalated',
    'ASSIGNED_DRIVER_PICKUP_AUTO_ESCALATED',
  ],
  ['Delivery pickup window expired', 'DELIVERY_PICKUP_WINDOW_EXPIRED'],
  ['Driver no-show at supplier pickup', 'DRIVER_NO_SHOW_AT_SUPPLIER'],
  ['Driver no-show reported by supplier', 'DRIVER_NO_SHOW_REPORTED_BY_SUPPLIER'],
  ['Supplier marked pickup window expired', 'SUPPLIER_MARKED_PICKUP_EXPIRED'],
  [
    'Supplier pickup window expired with no driver assigned',
    'SUPPLIER_PICKUP_WINDOW_EXPIRED_NO_DRIVER',
  ],
  ['Delivery completed by driver', 'DELIVERY_COMPLETED_BY_DRIVER'],
  ['Grouped delivery completed by driver', 'GROUPED_DELIVERY_COMPLETED_BY_DRIVER'],
  [
    'Supplier submitted new pickup window after no driver available',
    'SUPPLIER_SUBMITTED_PICKUP_WINDOW_NO_DRIVER',
  ],
  [
    'Supplier submitted replacement pickup window after partial pickup',
    'SUPPLIER_SUBMITTED_REPLACEMENT_PICKUP_WINDOW',
  ],
  [
    'Supplier submitted new pickup window after admin recovery',
    'SUPPLIER_SUBMITTED_PICKUP_WINDOW_ADMIN_RECOVERY',
  ],
  [
    'Admin asked supplier to choose a new pickup window after no driver was available',
    'ADMIN_REQUESTED_NEW_PICKUP_WINDOW_NO_DRIVER',
  ],
  [
    'Admin asked supplier to choose a new pickup window after pickup was not completed',
    'ADMIN_REQUESTED_NEW_PICKUP_WINDOW_PICKUP_INCOMPLETE',
  ],
  [
    'Admin cancelled and released hold after no driver available',
    'ADMIN_CANCELLED_NO_DRIVER',
  ],
  [
    'Admin cancelled and released hold after pickup was not completed',
    'ADMIN_CANCELLED_PICKUP_INCOMPLETE',
  ],
]);

const LEGACY_PREFIX_NOTE_TO_EVENT_CODE: Array<{
  prefix: string;
  eventCode: ReservationHistoryEventCode;
}> = [
  {
    prefix: 'Supplier requested reschedule:',
    eventCode: 'SUPPLIER_REQUESTED_RESCHEDULE',
  },
  {
    prefix: 'Learner requested reschedule:',
    eventCode: 'LEARNER_REQUESTED_RESCHEDULE',
  },
];

const isReservationHistoryEventCode = (
  value: string,
): value is ReservationHistoryEventCode =>
  (RESERVATION_HISTORY_EVENT_CODES as readonly string[]).includes(value);

export const formatReservationHistoryNote = (
  eventCode: ReservationHistoryEventCode,
  options?: { reasonText?: string | null },
): string => {
  const reasonText = options?.reasonText?.trim();
  if (!reasonText) {
    return `${RESERVATION_HISTORY_NOTE_PREFIX}${eventCode}`;
  }

  return `${RESERVATION_HISTORY_NOTE_PREFIX}${eventCode}|${reasonText}`;
};

export const mapLegacyReservationHistoryNote = (
  note: string,
  context: ReservationHistoryNoteContext = {},
): ParsedReservationHistoryNote => {
  const trimmed = note.trim();
  if (!trimmed) {
    return { eventCode: null, reasonText: null };
  }

  const exact = LEGACY_EXACT_NOTE_TO_EVENT_CODE.get(trimmed);
  if (exact) {
    return { eventCode: exact, reasonText: null };
  }

  for (const entry of LEGACY_PREFIX_NOTE_TO_EVENT_CODE) {
    if (trimmed.startsWith(entry.prefix)) {
      const reasonText = trimmed.slice(entry.prefix.length).trim();
      return {
        eventCode: entry.eventCode,
        reasonText: reasonText || null,
      };
    }
  }

  if (
    trimmed.startsWith(
      'Expired automatically after the last preferred scheduling window passed without supplier response.',
    )
  ) {
    return { eventCode: 'PENDING_EXPIRED_AFTER_PREFERRED_WINDOW', reasonText: null };
  }

  if (
    /^Expired automatically after \d+ hours without supplier response\.$/.test(
      trimmed,
    )
  ) {
    return { eventCode: 'PENDING_EXPIRED_AFTER_TIMEOUT', reasonText: null };
  }

  if (
    /^Automatically expired after the pickup window passed without follow-up within \d+ hours\.$/.test(
      trimmed,
    )
  ) {
    return { eventCode: 'MISSED_PICKUP_AUTO_EXPIRED', reasonText: null };
  }

  const inferred = inferReservationHistoryEventFromTransition(
    context,
    trimmed,
  );
  if (inferred) {
    return inferred;
  }

  return { eventCode: null, reasonText: trimmed };
};

const inferReservationHistoryEventFromTransition = (
  context: ReservationHistoryNoteContext,
  note: string,
): ParsedReservationHistoryNote | null => {
  const { oldStatus, newStatus } = context;
  if (!newStatus) {
    return null;
  }

  if (oldStatus === 'PENDING' && newStatus === 'REJECTED') {
    return { eventCode: 'DECLINED_BY_SUPPLIER', reasonText: note };
  }

  if (oldStatus === 'ACCEPTED' && newStatus === 'CANCELLED') {
    return { eventCode: 'SUPPLIER_CANCELLED', reasonText: note };
  }

  if (
    oldStatus === 'AWAITING_SUPPLIER_CONFIRMATION' &&
    newStatus === 'CANCELLED'
  ) {
    return {
      eventCode: 'SUPPLIER_CANCELLED_PENDING_RESCHEDULE',
      reasonText: note,
    };
  }

  if (oldStatus === 'ACCEPTED' && newStatus === 'AWAITING_RESOLUTION') {
    return { eventCode: 'FULFILLMENT_ISSUE_REPORTED', reasonText: note };
  }

  if (
    oldStatus === 'AWAITING_RESOLUTION' &&
    newStatus === 'AWAITING_SUPPLIER_CONFIRMATION'
  ) {
    return {
      eventCode: 'ADMIN_REQUESTED_NEW_PICKUP_WINDOW_PICKUP_INCOMPLETE',
      reasonText: note,
    };
  }

  if (oldStatus === 'AWAITING_RESOLUTION' && newStatus === 'EXPIRED') {
    return { eventCode: 'ADMIN_CANCELLED_PICKUP_INCOMPLETE', reasonText: note };
  }

  if (oldStatus === 'PENDING' && newStatus !== 'REJECTED') {
    if (note === 'Accepted by supplier') {
      return { eventCode: 'ACCEPTED_BY_SUPPLIER', reasonText: null };
    }
    return { eventCode: 'ACCEPTED_BY_SUPPLIER', reasonText: note };
  }

  return null;
};

export const parseReservationHistoryNote = (
  note: string | null | undefined,
  context: ReservationHistoryNoteContext = {},
): ParsedReservationHistoryNote => {
  if (!note?.trim()) {
    return { eventCode: null, reasonText: null };
  }

  if (note.startsWith(RESERVATION_HISTORY_NOTE_PREFIX)) {
    const body = note.slice(RESERVATION_HISTORY_NOTE_PREFIX.length);
    const separatorIndex = body.indexOf('|');
    if (separatorIndex === -1) {
      const eventCode = body.trim();
      return isReservationHistoryEventCode(eventCode)
        ? { eventCode, reasonText: null }
        : mapLegacyReservationHistoryNote(note, context);
    }

    const eventCode = body.slice(0, separatorIndex).trim();
    const reasonText = body.slice(separatorIndex + 1).trim();
    if (!isReservationHistoryEventCode(eventCode)) {
      return mapLegacyReservationHistoryNote(note, context);
    }

    return {
      eventCode,
      reasonText: reasonText || null,
    };
  }

  return mapLegacyReservationHistoryNote(note, context);
};

export const mapReservationStatusHistoryForClient = (entry: {
  id: string;
  statusGroup: string;
  oldStatus: string | null;
  newStatus: string;
  note: string | null;
  createdAt: Date;
  changedByUser: { id: string; displayName: string } | null;
}) => {
  const parsed = parseReservationHistoryNote(entry.note, {
    oldStatus: entry.oldStatus,
    newStatus: entry.newStatus,
  });

  return {
    id: entry.id,
    statusGroup: entry.statusGroup,
    oldStatus: entry.oldStatus,
    newStatus: entry.newStatus,
    eventCode: parsed.eventCode,
    reasonText: parsed.reasonText,
    note: entry.note,
    createdAt: entry.createdAt.toISOString(),
    actor: entry.changedByUser
      ? {
          id: entry.changedByUser.id,
          displayName: entry.changedByUser.displayName,
        }
      : null,
  };
};
