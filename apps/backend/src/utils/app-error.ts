import type { SafeLogValue } from '../observability/log-types.js';

export type AppErrorOptions = {
  cause?: unknown;
  context?: Record<string, SafeLogValue>;
};

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly cause?: unknown;
  readonly context?: Record<string, SafeLogValue>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown,
    options?: AppErrorOptions,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.cause = options?.cause;
    this.context = options?.context;
  }
}
