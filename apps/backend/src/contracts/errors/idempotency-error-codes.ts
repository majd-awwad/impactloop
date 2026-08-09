export const IDEMPOTENCY_ERROR_CODES = {
  keyReused: 'IDEMPOTENCY_KEY_REUSED',
  inProgress: 'IDEMPOTENCY_IN_PROGRESS',
  previouslyFailed: 'IDEMPOTENCY_PREVIOUSLY_FAILED',
} as const;

export type IdempotencyErrorCode =
  (typeof IDEMPOTENCY_ERROR_CODES)[keyof typeof IDEMPOTENCY_ERROR_CODES];

const IDEMPOTENCY_ERROR_CODE_VALUES = new Set<string>(
  Object.values(IDEMPOTENCY_ERROR_CODES),
);

export const isIdempotencyErrorCode = (
  value: string | null | undefined,
): value is IdempotencyErrorCode =>
  value != null && IDEMPOTENCY_ERROR_CODE_VALUES.has(value);
