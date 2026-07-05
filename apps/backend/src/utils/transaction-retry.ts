import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../database/prisma.js';
import { AppError } from '../utils/app-error.js';

export const isPrismaCode = (error: unknown, code: string) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === code;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const causeMessage =
      error.cause !== undefined ? getErrorMessage(error.cause) : '';
    return [error.message, causeMessage].filter(Boolean).join(' ');
  }

  if (typeof error === 'object' && error !== null) {
    const parts: string[] = [];

    if ('message' in error && typeof error.message === 'string') {
      parts.push(error.message);
    }

    if ('cause' in error) {
      parts.push(getErrorMessage((error as { cause?: unknown }).cause));
    }

    return parts.filter(Boolean).join(' ');
  }

  return '';
};

export const isRetryableSerializableConflict = (error: unknown) => {
  if (isPrismaCode(error, 'P2034')) {
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
  options: { maxAttempts?: number } = {},
) => {
  const maxAttempts = options.maxAttempts ?? 12;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (attempt < maxAttempts && isRetryableSerializableConflict(error)) {
        await sleep(attempt * 50);
        continue;
      }

      throw error;
    }
  }

  throw new AppError('Unable to complete transaction.', 500, 'INTERNAL_ERROR');
};
