import { AppError } from '../../utils/app-error.js';

import {
  LEARNER_PICKUP_WINDOW_TOO_CLOSE_MESSAGE,
  MIN_PICKUP_LEAD_TIME_MINUTES,
  MIN_REMAINING_PICKUP_WINDOW_MINUTES,
  PICKUP_WINDOW_TOO_CLOSE_MESSAGE,
  PROPOSED_PICKUP_START_TOO_SOON_MESSAGE,
} from './reservation-timing-policy.js';

export const PICKUP_ERROR_CODES = {
  START_IN_PAST: 'PICKUP_START_IN_PAST',
  END_IN_PAST: 'PICKUP_END_IN_PAST',
  END_BEFORE_START: 'PICKUP_END_BEFORE_START',
  WINDOW_TOO_CLOSE_TO_ENDING: 'PICKUP_WINDOW_TOO_CLOSE_TO_ENDING',
  START_TOO_SOON: 'PICKUP_START_TOO_SOON',
  WINDOW_REQUIRED: 'PICKUP_WINDOW_REQUIRED',
} as const;

export type PickupWindowValidationMode =
  | 'learner_preferred'
  | 'supplier_selected_preferred'
  | 'supplier_custom_proposal';

export type PickupWindowInput = {
  start: Date;
  end: Date;
};

export type PickupWindowValidationFailure = {
  code: (typeof PICKUP_ERROR_CODES)[keyof typeof PICKUP_ERROR_CODES];
  message: string;
  field: 'start' | 'end';
};

const remainingWindowTooCloseMessage = (mode: PickupWindowValidationMode) =>
  mode === 'learner_preferred'
    ? LEARNER_PICKUP_WINDOW_TOO_CLOSE_MESSAGE
    : PICKUP_WINDOW_TOO_CLOSE_MESSAGE;

export const validatePickupWindow = (
  input: PickupWindowInput,
  mode: PickupWindowValidationMode,
  now: number = Date.now(),
): PickupWindowValidationFailure | null => {
  const { start, end } = input;

  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime())
  ) {
    return {
      code: PICKUP_ERROR_CODES.END_BEFORE_START,
      message: 'Pickup window dates must be valid.',
      field: 'end',
    };
  }

  if (end.getTime() <= start.getTime()) {
    return {
      code: PICKUP_ERROR_CODES.END_BEFORE_START,
      message:
        mode === 'learner_preferred'
          ? 'Preferred window end must be after start.'
          : 'Pickup end time must be after start time.',
      field: 'end',
    };
  }

  if (mode !== 'supplier_selected_preferred' && start.getTime() < now) {
    return {
      code: PICKUP_ERROR_CODES.START_IN_PAST,
      message:
        mode === 'learner_preferred'
          ? 'Preferred pickup window start must be in the future.'
          : 'Pickup window start must be in the future.',
      field: 'start',
    };
  }

  if (end.getTime() <= now) {
    return {
      code: PICKUP_ERROR_CODES.END_IN_PAST,
      message:
        mode === 'learner_preferred'
          ? 'Preferred window must be in the future.'
          : mode === 'supplier_custom_proposal'
            ? 'Supplier window end must be in the future.'
            : 'Pickup window end must be in the future.',
      field: 'end',
    };
  }

  const minRemainingEnd = now + MIN_REMAINING_PICKUP_WINDOW_MINUTES * 60_000;
  if (end.getTime() < minRemainingEnd) {
    return {
      code: PICKUP_ERROR_CODES.WINDOW_TOO_CLOSE_TO_ENDING,
      message: remainingWindowTooCloseMessage(mode),
      field: 'end',
    };
  }

  if (mode !== 'supplier_selected_preferred') {
    const minLeadStart = now + MIN_PICKUP_LEAD_TIME_MINUTES * 60_000;
    if (start.getTime() < minLeadStart) {
      return {
        code: PICKUP_ERROR_CODES.START_TOO_SOON,
        message:
          mode === 'learner_preferred'
            ? `Preferred pickup window must start at least ${MIN_PICKUP_LEAD_TIME_MINUTES} minutes from now.`
            : PROPOSED_PICKUP_START_TOO_SOON_MESSAGE,
        field: 'start',
      };
    }
  }

  return null;
};

export const assertValidPickupWindow = (
  input: PickupWindowInput,
  mode: PickupWindowValidationMode,
  now?: number,
): void => {
  const failure = validatePickupWindow(input, mode, now);
  if (failure) {
    throw new AppError(failure.message, 400, failure.code, {
      field: failure.field,
    });
  }
};

export const mapPickupValidationFailureToZodIssue = (
  failure: PickupWindowValidationFailure,
  pathPrefix: (string | number)[] = [],
) => ({
  code: 'custom' as const,
  message: failure.message,
  path: [...pathPrefix, failure.field],
});
