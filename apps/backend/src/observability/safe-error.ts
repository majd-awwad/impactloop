import { Prisma } from '../generated/prisma/client.js';

import type { SafeLogValue } from './log-types.js';
import { redactString, redactUnknownValue } from './redact.js';

const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_LENGTH = 4000;
const MAX_CAUSE_DEPTH = 3;

export type SafeSerializedError = {
  name?: string;
  message?: string;
  stack?: string;
  code?: string;
  prismaCode?: string;
  model?: string;
  constraint?: string;
  cause?: SafeSerializedError;
};

const boundString = (value: string, maxLength: number): string => {
  const redacted = redactString(value);

  if (redacted.length <= maxLength) {
    return redacted;
  }

  return `${redacted.slice(0, maxLength)}…[truncated]`;
};

const serializeCause = (
  cause: unknown,
  depth: number,
  seen: WeakSet<object>,
): SafeSerializedError | undefined => {
  if (cause === undefined || cause === null || depth >= MAX_CAUSE_DEPTH) {
    return undefined;
  }

  return serializeUnknownError(cause, depth, seen).error;
};

export const serializeUnknownError = (
  error: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): { error: SafeSerializedError; safeContext: SafeLogValue } => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta ?? {};

    return {
      error: {
        name: error.name,
        message: boundString(error.message, MAX_MESSAGE_LENGTH),
        prismaCode: error.code,
        model: typeof meta.modelName === 'string' ? meta.modelName : undefined,
        constraint:
          typeof meta.target === 'string'
            ? meta.target
            : Array.isArray(meta.target)
              ? meta.target.join(',')
              : undefined,
        cause: serializeCause(error.cause, depth + 1, seen),
      },
      safeContext: redactUnknownValue({
        prismaCode: error.code,
        model: meta.modelName,
        constraint: meta.target,
      }),
    };
  }

  if (error instanceof Error) {
    if (seen.has(error)) {
      return {
        error: { name: error.name, message: '[circular]' },
        safeContext: { name: error.name, message: '[circular]' },
      };
    }

    seen.add(error);

    const serialized: SafeSerializedError = {
      name: error.name,
      message: boundString(error.message, MAX_MESSAGE_LENGTH),
      stack: error.stack ? boundString(error.stack, MAX_STACK_LENGTH) : undefined,
      cause: serializeCause(error.cause, depth + 1, seen),
    };

    if ('code' in error && typeof error.code === 'string') {
      serialized.code = error.code;
    }

    return {
      error: serialized,
      safeContext: redactUnknownValue(serialized),
    };
  }

  if (typeof error === 'string') {
    return {
      error: { message: boundString(error, MAX_MESSAGE_LENGTH) },
      safeContext: boundString(error, MAX_MESSAGE_LENGTH),
    };
  }

  return {
    error: {
      message: boundString(String(error), MAX_MESSAGE_LENGTH),
    },
    safeContext: redactUnknownValue(error),
  };
};
