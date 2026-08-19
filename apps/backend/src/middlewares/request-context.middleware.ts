import type { NextFunction, Request, Response } from 'express';

import { logger } from '../observability/logger.js';
import {
  getRequestContext,
  runWithRequestContext,
  type RequestContext,
} from '../observability/request-context.js';
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from '../observability/request-id.js';
import type { LogContext } from '../observability/log-types.js';
import { getDatabasePoolSnapshot } from '../database/prisma.js';

type ObservabilityLocals = {
  errorLogged?: boolean;
  completionLogged?: boolean;
  abortController?: AbortController;
  errorCode?: string;
};

const getObservabilityLocals = (res: Response): ObservabilityLocals => {
  const locals = res.locals as { observability?: ObservabilityLocals };

  if (!locals.observability) {
    locals.observability = {};
  }

  return locals.observability;
};

export const markErrorLogged = (res: Response): void => {
  getObservabilityLocals(res).errorLogged = true;
};

export const hasErrorBeenLogged = (res: Response): boolean =>
  Boolean(getObservabilityLocals(res).errorLogged);

export const getRequestAbortSignal = (res: Response): AbortSignal => {
  const locals = getObservabilityLocals(res);
  return (locals.abortController ??= new AbortController()).signal;
};

export const recordResponseErrorCode = (res: Response, errorCode: string): void => {
  getObservabilityLocals(res).errorCode = errorCode;
};

const normalizeRequestPath = (req: Request): string => {
  const routePattern = req.route?.path;

  if (typeof routePattern === 'string') {
    const base = req.baseUrl ?? '';
    return `${base}${routePattern}` || req.path;
  }

  return req.path || '/';
};

const isHealthCheckPath = (path: string): boolean =>
  path === '/health' || path.startsWith('/health/');

const completionLogLevel = (
  statusCode: number,
  errorLogged: boolean,
  event: 'finished' | 'aborted',
): 'debug' | 'info' | 'warn' | 'error' => {
  if (event === 'aborted') {
    return 'warn';
  }

  if (statusCode >= 500) {
    return errorLogged ? 'warn' : 'error';
  }

  if (statusCode === 429) {
    return 'warn';
  }

  // Expected auth denials are routine client noise.
  if (statusCode === 401 || statusCode === 403) {
    return 'info';
  }

  if (statusCode >= 400) {
    return 'warn';
  }

  return 'info';
};

const logRequestCompletion = (
  req: Request,
  res: Response,
  event: 'finished' | 'aborted',
): void => {
  const observability = getObservabilityLocals(res);

  if (observability.completionLogged) {
    return;
  }

  observability.completionLogged = true;

  const requestContext = getRequestContext();
  const route = normalizeRequestPath(req);
  const statusCode = res.statusCode || (event === 'aborted' ? 499 : 500);
  const durationMs = requestContext
    ? Date.now() - requestContext.startedAt
    : undefined;
  const responseSizeHeader = res.getHeader('content-length');
  const responseSize =
    typeof responseSizeHeader === 'string'
      ? Number.parseInt(responseSizeHeader, 10)
      : typeof responseSizeHeader === 'number'
        ? responseSizeHeader
        : undefined;

  const context: LogContext = {
    operation: 'http.request.complete',
    event,
    route,
    statusCode,
    durationMs,
    ...(Number.isFinite(responseSize) ? { responseSize } : {}),
    ...(observability.errorCode ? { errorCode: observability.errorCode } : {}),
    ...getDatabasePoolSnapshot(),
  };

  const level = isHealthCheckPath(route)
    ? 'debug'
    : completionLogLevel(statusCode, Boolean(observability.errorLogged), event);

  const message =
    event === 'aborted'
      ? 'HTTP request aborted'
      : 'HTTP request completed';

  logger[level](context, message);
};

export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const requestId = resolveRequestId(req.headers[REQUEST_ID_HEADER]);

  res.setHeader('X-Request-Id', requestId);

  const context: RequestContext = {
    requestId,
    startedAt: Date.now(),
    method: req.method,
    path: req.path || '/',
  };

  runWithRequestContext(context, () => {
    const abortController = new AbortController();
    getObservabilityLocals(res).abortController = abortController;
    const onFinish = () => {
      logRequestCompletion(req, res, 'finished');
    };

    const onClose = () => {
      if (!res.writableFinished) {
        abortController.abort();
        logRequestCompletion(req, res, 'aborted');
      }
    };

    res.on('finish', onFinish);
    res.on('close', onClose);
    req.once('aborted', () => abortController.abort());

    next();
  });
};
