import { containsUnsafeProjectLearningMarkup } from '../project-learning/project-learning-text.js';

export const PROJECT_HELP_SESSION_MIN_PROBLEM_LENGTH = 20;
export const PROJECT_HELP_SESSION_MAX_PROBLEM_LENGTH = 500;
export const PROJECT_HELP_SESSION_MAX_REASON_LENGTH = 300;
export const PROJECT_HELP_SESSION_MIN_FUTURE_MINUTES = 60;
export const PROJECT_HELP_SESSION_MAX_FUTURE_DAYS = 60;
export const PROJECT_HELP_SESSION_PROPOSED_TIME_COUNT = 3;
export const PROJECT_HELP_SESSION_MAX_TIMEZONE_LENGTH = 64;
export const PROJECT_HELP_SESSION_ALLOWED_DURATIONS = [15, 30] as const;

export type ProjectHelpSessionAllowedDuration =
  (typeof PROJECT_HELP_SESSION_ALLOWED_DURATIONS)[number];

export const isValidIanaTimeZone = (timeZone: string) => {
  if (
    timeZone.length === 0 ||
    timeZone.length > PROJECT_HELP_SESSION_MAX_TIMEZONE_LENGTH
  ) {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const normalizeProblemDescription = (value: string) => value.trim();

export const validateProblemDescription = (value: string) => {
  const normalized = normalizeProblemDescription(value);
  if (normalized.length < PROJECT_HELP_SESSION_MIN_PROBLEM_LENGTH) {
    return {
      valid: false as const,
      code: 'VALIDATION_ERROR' as const,
      message: `Problem description must be at least ${PROJECT_HELP_SESSION_MIN_PROBLEM_LENGTH} characters.`,
    };
  }
  if (normalized.length > PROJECT_HELP_SESSION_MAX_PROBLEM_LENGTH) {
    return {
      valid: false as const,
      code: 'VALIDATION_ERROR' as const,
      message: `Problem description must be at most ${PROJECT_HELP_SESSION_MAX_PROBLEM_LENGTH} characters.`,
    };
  }
  if (containsUnsafeProjectLearningMarkup(normalized)) {
    return {
      valid: false as const,
      code: 'VALIDATION_ERROR' as const,
      message: 'Problem description must be plain text.',
    };
  }
  return { valid: true as const, value: normalized };
};

export const parseUtcInstant = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

export const normalizeProposedUtcTimes = (values: string[], now = new Date()) => {
  if (values.length !== PROJECT_HELP_SESSION_PROPOSED_TIME_COUNT) {
    return {
      valid: false as const,
      code: 'INVALID_TIME_OPTIONS' as const,
      message: `Exactly ${PROJECT_HELP_SESSION_PROPOSED_TIME_COUNT} proposed times are required.`,
    };
  }

  const minFutureMs = now.getTime() + PROJECT_HELP_SESSION_MIN_FUTURE_MINUTES * 60_000;
  const maxFutureMs =
    now.getTime() + PROJECT_HELP_SESSION_MAX_FUTURE_DAYS * 24 * 60 * 60_000;
  const parsed: Date[] = [];

  for (const value of values) {
    const instant = parseUtcInstant(value);
    if (!instant) {
      return {
        valid: false as const,
        code: 'INVALID_TIME_OPTIONS' as const,
        message: 'Each proposed time must be a valid ISO timestamp.',
      };
    }
    if (instant.getTime() < minFutureMs) {
      return {
        valid: false as const,
        code: 'INVALID_TIME_OPTIONS' as const,
        message: `Each proposed time must be at least ${PROJECT_HELP_SESSION_MIN_FUTURE_MINUTES} minutes in the future.`,
      };
    }
    if (instant.getTime() > maxFutureMs) {
      return {
        valid: false as const,
        code: 'INVALID_TIME_OPTIONS' as const,
        message: `Each proposed time must be within ${PROJECT_HELP_SESSION_MAX_FUTURE_DAYS} days.`,
      };
    }
    parsed.push(new Date(instant.getTime()));
  }

  const sorted = [...parsed].sort((left, right) => left.getTime() - right.getTime());
  const unique = new Set(sorted.map((value) => value.toISOString()));
  if (unique.size !== sorted.length) {
    return {
      valid: false as const,
      code: 'INVALID_TIME_OPTIONS' as const,
      message: 'Proposed times must be distinct.',
    };
  }

  return { valid: true as const, values: sorted };
};

export const validateFutureUtcInstant = (value: Date, now = new Date()) => {
  const minFutureMs = now.getTime() + PROJECT_HELP_SESSION_MIN_FUTURE_MINUTES * 60_000;
  const maxFutureMs =
    now.getTime() + PROJECT_HELP_SESSION_MAX_FUTURE_DAYS * 24 * 60 * 60_000;
  if (value.getTime() < minFutureMs || value.getTime() > maxFutureMs) {
    return false;
  }
  return true;
};

export const addMinutes = (value: Date, minutes: number) =>
  new Date(value.getTime() + minutes * 60_000);

export const intervalsOverlap = (input: {
  existingStart: Date;
  existingDurationMinutes: number;
  newStart: Date;
  newDurationMinutes: number;
}) => {
  const existingEnd = addMinutes(input.existingStart, input.existingDurationMinutes);
  const newEnd = addMinutes(input.newStart, input.newDurationMinutes);
  return (
    input.existingStart.getTime() < newEnd.getTime() &&
    existingEnd.getTime() > input.newStart.getTime()
  );
};
