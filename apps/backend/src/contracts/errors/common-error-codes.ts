export const COMMON_ERROR_CODES = {
  notFound: 'NOT_FOUND',
  validationError: 'VALIDATION_ERROR',
  conflict: 'CONFLICT',
  forbidden: 'FORBIDDEN',
  unauthenticated: 'UNAUTHENTICATED',
  internalError: 'INTERNAL_ERROR',
  rateLimited: 'RATE_LIMITED',
} as const;

export type CommonErrorCode =
  (typeof COMMON_ERROR_CODES)[keyof typeof COMMON_ERROR_CODES];

const COMMON_ERROR_CODE_VALUES = new Set<string>(
  Object.values(COMMON_ERROR_CODES),
);

export const isCommonErrorCode = (
  value: string | null | undefined,
): value is CommonErrorCode =>
  value != null && COMMON_ERROR_CODE_VALUES.has(value);
