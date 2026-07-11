import pino, { type DestinationStream, type Logger } from 'pino';

import { env } from '../config/env.js';

import type { LogContext } from './log-types.js';
import { pickAllowlistedLogContext, PINO_REDACT_PATHS } from './redact.js';
import { getRequestContext } from './request-context.js';

export type ProjectLogger = {
  debug: (context: LogContext | undefined, message: string) => void;
  info: (context: LogContext | undefined, message: string) => void;
  warn: (context: LogContext | undefined, message: string) => void;
  error: (context: LogContext | undefined, message: string) => void;
  child: (bindings: LogContext) => ProjectLogger;
};

let testDestination: DestinationStream | null = null;
let rootLogger = createRootLogger();

function createRootLogger(): Logger {
  if (testDestination) {
    return pino(buildLoggerOptions(), testDestination);
  }

  if (env.logPretty) {
    return pino({
      ...buildLoggerOptions(),
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino(buildLoggerOptions());
}

export const setLoggerDestinationForTests = (
  destination: DestinationStream | null,
): void => {
  testDestination = destination;
};

function buildLoggerOptions(): pino.LoggerOptions {
  return {
    level: env.logLevel,
    base: {
      service: env.serviceName,
      environment: env.nodeEnv,
    },
    redact: {
      paths: PINO_REDACT_PATHS,
      censor: '[redacted]',
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'message',
  };
}

export const resetLoggerForTests = (): void => {
  rootLogger = createRootLogger();
};

export const setLoggerLevelForTests = (level: string): void => {
  rootLogger.level = level;
};

const mergeRequestContext = (context?: LogContext): LogContext => {
  const requestContext = getRequestContext();

  return pickAllowlistedLogContext({
    ...(requestContext?.requestId ? { requestId: requestContext.requestId } : {}),
    ...(requestContext?.method ? { method: requestContext.method } : {}),
    ...(requestContext?.path ? { path: requestContext.path } : {}),
    ...(requestContext?.userId ? { userId: requestContext.userId } : {}),
    ...(requestContext?.activeRole ? { activeRole: requestContext.activeRole } : {}),
    ...context,
  });
};

const wrapLogger = (instance: Logger): ProjectLogger => ({
  debug(context, message) {
    instance.debug(mergeRequestContext(context), message);
  },
  info(context, message) {
    instance.info(mergeRequestContext(context), message);
  },
  warn(context, message) {
    instance.warn(mergeRequestContext(context), message);
  },
  error(context, message) {
    instance.error(mergeRequestContext(context), message);
  },
  child(bindings) {
    return wrapLogger(instance.child(pickAllowlistedLogContext(bindings)));
  },
});

const getLogger = (): ProjectLogger => wrapLogger(rootLogger);

export const logger: ProjectLogger = {
  debug(context, message) {
    getLogger().debug(context, message);
  },
  info(context, message) {
    getLogger().info(context, message);
  },
  warn(context, message) {
    getLogger().warn(context, message);
  },
  error(context, message) {
    getLogger().error(context, message);
  },
  child(bindings) {
    return getLogger().child(bindings);
  },
};
