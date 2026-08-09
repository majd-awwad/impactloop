import { Prisma } from '../generated/prisma/client.js';
import { COMMON_ERROR_CODES } from '../contracts/errors/common-error-codes.js';
import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/app-error.js';

export const isPrismaCode = (error: unknown, code: string) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === code;

const hasRetryableTransactionMarker = (
  error: unknown,
  seen: Set<object> = new Set(),
): boolean => {
  if (typeof error !== 'object' || error === null || seen.has(error)) {
    return false;
  }

  seen.add(error);

  const candidate = error as {
    code?: unknown;
    originalCode?: unknown;
    kind?: unknown;
    cause?: unknown;
  };

  if (
    candidate.code === 'P2034' ||
    candidate.code === '40001' ||
    candidate.originalCode === '40001' ||
    candidate.kind === 'TransactionWriteConflict'
  ) {
    return true;
  }

  return hasRetryableTransactionMarker(candidate.cause, seen);
};

const getErrorMessage = (
  error: unknown,
  seen: Set<object> = new Set(),
): string => {
  if (typeof error === 'object' && error !== null) {
    if (seen.has(error)) {
      return '';
    }

    seen.add(error);
  }

  if (error instanceof Error) {
    const causeMessage =
      error.cause !== undefined ? getErrorMessage(error.cause, seen) : '';
    return [error.message, causeMessage].filter(Boolean).join(' ');
  }

  if (typeof error === 'object' && error !== null) {
    const parts: string[] = [];

    if ('message' in error && typeof error.message === 'string') {
      parts.push(error.message);
    }

    if ('cause' in error) {
      parts.push(getErrorMessage((error as { cause?: unknown }).cause, seen));
    }

    return parts.filter(Boolean).join(' ');
  }

  return '';
};

export const isRetryableSerializableConflict = (error: unknown) => {
  if (hasRetryableTransactionMarker(error)) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return message.includes('deadlock') || message.includes('write conflict');
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export const runSerializableTransaction = async <T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  options: {
    maxAttempts?: number;
    retryDelayMilliseconds?: (attempt: number) => number;
  } = {},
) => {
  const maxAttempts = options.maxAttempts ?? 12;
  const retryDelayMilliseconds =
    options.retryDelayMilliseconds ?? ((attempt: number) => attempt * 50);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (attempt < maxAttempts && isRetryableSerializableConflict(error)) {
        const delay = retryDelayMilliseconds(attempt);
        if (delay > 0) {
          await sleep(delay);
        }
        continue;
      }

      throw error;
    }
  }

  throw new AppError(
    'Unable to complete transaction.',
    500,
    COMMON_ERROR_CODES.internalError,
  );
};
