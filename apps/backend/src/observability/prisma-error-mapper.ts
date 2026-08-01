import { Prisma } from '../generated/prisma/client.js';

import { AppError } from '../utils/app-error.js';

const extractConstraintMetadata = (
  meta: Record<string, unknown> | undefined,
): Record<string, string> | undefined => {
  if (!meta) {
    return undefined;
  }

  const output: Record<string, string> = {};

  if (typeof meta.modelName === 'string') {
    output.model = meta.modelName;
  }

  if (typeof meta.target === 'string') {
    output.constraint = meta.target;
  } else if (Array.isArray(meta.target)) {
    output.constraint = meta.target
      .filter((entry): entry is string => typeof entry === 'string')
      .join(',');
  }

  return Object.keys(output).length > 0 ? output : undefined;
};

export const mapUnhandledPrismaError = (error: unknown): AppError | null => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  const constraintMetadata = extractConstraintMetadata(
    error.meta as Record<string, unknown> | undefined,
  );

  switch (error.code) {
    case 'P2002':
      return new AppError(
        'The request conflicts with existing data.',
        409,
        'CONFLICT',
        undefined,
        {
          cause: error,
          context: constraintMetadata,
        },
      );
    case 'P2025':
      return new AppError('Resource not found.', 404, 'NOT_FOUND', undefined, {
        cause: error,
        context: constraintMetadata,
      });
    default:
      return null;
  }
};
