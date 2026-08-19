import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, test } from 'node:test';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Prisma } from '../generated/prisma/client.js';
import { errorMiddleware } from '../middlewares/error.middleware.js';
import { notFoundMiddleware } from '../middlewares/not-found.middleware.js';
import { requestContextMiddleware } from '../middlewares/request-context.middleware.js';
import {
  resetLoggerForTests,
  setLoggerDestinationForTests,
  setLoggerLevelForTests,
} from './logger.js';
import { MockAuthEmailProvider } from '../modules/auth/email/mock-auth-email-provider.js';
import { MockEmailInvitationProvider } from '../modules/invitations/email/mock-email-invitation-provider.js';
import {
  getRequestContext,
  getRequestId,
  runWithRequestContext,
} from './request-context.js';
import {
  isValidRequestId,
  REQUEST_ID_HEADER,
  resolveRequestId,
} from './request-id.js';
import { redactUnknownValue } from './redact.js';
import { serializeUnknownError } from './safe-error.js';
import { AppError } from '../utils/app-error.js';
import { updateRequestContext } from './request-context.js';
import { INVALID_JSON_ERROR_CODE } from './invalid-json-error.js';
import { ZodError, z } from 'zod';

type ParsedLog = Record<string, unknown>;

const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Accept',
  'Authorization',
  'Cache-Control',
  'X-Request-Id',
  'X-Client-Platform',
  'Idempotency-Key',
] as const;

const PRODUCTION_LIKE_ALLOWED_ORIGIN = 'http://localhost:3000';
const DISALLOWED_ORIGIN = 'http://evil.example';

const PINO_LEVEL_NAMES: Record<number, string> = {
  10: 'trace',
  20: 'debug',
  30: 'info',
  40: 'warn',
  50: 'error',
  60: 'fatal',
};

const logLevelName = (entry: ParsedLog): string =>
  typeof entry.level === 'number'
    ? (PINO_LEVEL_NAMES[entry.level] ?? String(entry.level))
    : String(entry.level ?? 'unknown');

const assertMatchingRequestIds = (
  response: Response,
  body: Record<string, unknown> | null,
) => {
  const headerId = response.headers.get('x-request-id');
  assert.ok(headerId);

  if (body?.error) {
    assert.equal((body.error as { requestId?: string }).requestId, undefined);
  }

  return headerId!;
};

const createIntegrationApp = (
  registerRoutes: (app: express.Express) => void,
  options: { includeNotFound?: boolean } = {},
) => {
  const app = express();
  app.use(requestContextMiddleware);
  app.use(express.json());
  registerRoutes(app);

  if (options.includeNotFound !== false) {
    app.use(notFoundMiddleware);
  }

  app.use(errorMiddleware);
  return app;
};

const createCorsIntegrationApp = () => {
  const allowedOrigin = PRODUCTION_LIKE_ALLOWED_ORIGIN;
  const app = express();

  app.use(requestContextMiddleware);
  app.use(
    cors({
      origin: [allowedOrigin],
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
      allowedHeaders: [...CORS_ALLOWED_HEADERS],
    }),
  );
  app.use(express.json());
  app.get('/cors-check', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.post('/cors-post', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return { app, allowedOrigin };
};

const createProductionLikeCorsApp = (
  registerRoutes?: (app: express.Express) => void,
) => {
  const app = express();

  app.use(requestContextMiddleware);
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(
    cors({
      origin: [PRODUCTION_LIKE_ALLOWED_ORIGIN],
      credentials: true,
      exposedHeaders: ['X-Request-Id'],
      allowedHeaders: [...CORS_ALLOWED_HEADERS],
    }),
  );
  app.use(express.json());

  if (registerRoutes) {
    registerRoutes(app);
  }

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};

const parseCorsHeaderList = (value: string | null): string[] =>
  value?.split(',').map((header) => header.trim().toLowerCase()) ?? [];

const assertRequestedHeadersPermitted = (
  allowHeaders: string | null,
  requested: string[],
) => {
  const allowed = parseCorsHeaderList(allowHeaders);

  for (const header of requested) {
    assert.ok(
      allowed.includes(header.toLowerCase()),
      `Expected ${header} in Access-Control-Allow-Headers (${allowHeaders})`,
    );
  }
};

const createLogCapture = () => {
  const lines: string[] = [];
  const stream = new PassThrough();

  stream.on('data', (chunk) => {
    lines.push(chunk.toString());
  });

  setLoggerDestinationForTests(stream);
  resetLoggerForTests();
  setLoggerLevelForTests('debug');

  return {
    parseAll(): ParsedLog[] {
      return lines
        .flatMap((line) => line.split('\n'))
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          try {
            return JSON.parse(line) as ParsedLog;
          } catch {
            return { message: line };
          }
        });
    },
    clear() {
      lines.length = 0;
    },
  };
};

const request = async (
  server: Server,
  options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  } = {},
) => {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Server is not listening');
  }

  const response = await fetch(
    `http://127.0.0.1:${address.port}${options.path ?? '/'}`,
    {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: options.signal,
    },
  );

  const text = await response.text();
  const body = text.length > 0 ? (JSON.parse(text) as Record<string, unknown>) : null;

  return { response, body };
};

const requestRaw = async (
  server: Server,
  options: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  } = {},
) => {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Server is not listening');
  }

  const response = await fetch(
    `http://127.0.0.1:${address.port}${options.path ?? '/'}`,
    {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: options.signal,
    },
  );

  const text = await response.text();
  let body: Record<string, unknown> | null = null;

  if (text.length > 0) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = null;
    }
  }

  return { response, body, text };
};

const createObservabilityTestApp = (
  registerRoutes: (app: express.Express) => void,
) => {
  const app = express();
  app.use(requestContextMiddleware);
  registerRoutes(app);
  app.use(errorMiddleware);
  return app;
};

const withServer = async (
  app: express.Express,
  run: (server: Server) => Promise<void>,
) => {
  const server = createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    await run(server);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
};

describe('observability foundation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'debug';
    process.env.MOCK_EMAIL_LOG_LINKS = 'false';
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ??
      'postgresql://postgres:password@127.0.0.1:5432/impactloop?schema=public';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    setLoggerDestinationForTests(null);
    resetLoggerForTests();
  });

  test('request ID: generates when header is absent', async () => {
    const logs = createLogCapture();
    const app = createObservabilityTestApp((instance) => {
      instance.get('/ok', (_req, res) => {
        res.json({ requestId: getRequestId() });
      });
    });

    await withServer(app, async (server) => {
      const { response, body } = await request(server, { path: '/ok' });
      const requestId = response.headers.get('x-request-id');

      assert.ok(requestId);
      assert.equal(body?.requestId, requestId);
      assert.ok(isValidRequestId(requestId!));

      await new Promise((resolve) => setTimeout(resolve, 10));
      const completion = logs.parseAll().find((entry) => entry.message === 'HTTP request completed');
      assert.equal(completion?.requestId, requestId);
    });
  });

  test('request ID: accepts valid incoming request ID', async () => {
    const app = createObservabilityTestApp((instance) => {
      instance.get('/ok', (_req, res) => {
        res.status(200).end();
      });
    });

    await withServer(app, async (server) => {
      const incoming = 'client-request-id-01';
      const { response } = await request(server, {
        path: '/ok',
        headers: { [REQUEST_ID_HEADER]: incoming },
      });

      assert.equal(response.headers.get('x-request-id'), incoming);
    });
  });

  test('request ID: replaces newline/control-character IDs', () => {
    const resolved = resolveRequestId('bad\nid');
    assert.notEqual(resolved, 'bad\nid');
    assert.ok(isValidRequestId(resolved));
  });

  test('request ID: replaces overly long IDs', () => {
    const resolved = resolveRequestId(`a${'b'.repeat(200)}`);
    assert.ok(resolved.length <= 128);
    assert.ok(isValidRequestId(resolved));
  });

  test('request ID: rejects string[] header values', () => {
    const resolved = resolveRequestId(['client-array-id', 'second-id']);
    assert.notEqual(resolved, 'client-array-id');
    assert.notEqual(resolved, 'second-id');
    assert.ok(isValidRequestId(resolved));
  });

  test('request ID: rejects whitespace-only header values', () => {
    const resolved = resolveRequestId('   ');
    assert.ok(isValidRequestId(resolved));
    assert.notEqual(resolved.trim(), '');
  });

  test('request ID: keeps correlation ID in the response header only', async () => {
    const app = createObservabilityTestApp((instance) => {
      instance.get('/fail', () => {
        throw new AppError('Nope', 400, 'VALIDATION_ERROR');
      });
    });

    await withServer(app, async (server) => {
      const incoming = 'trace-me-42';
      const { response, body } = await request(server, {
        path: '/fail',
        headers: { [REQUEST_ID_HEADER]: incoming },
      });

      assert.equal(response.status, 400);
      assert.equal(response.headers.get('x-request-id'), incoming);
      assert.equal((body?.error as { requestId?: string })?.requestId, undefined);
    });
  });

  test('request ID: async context retains ID after awaited async operations', async () => {
    const app = createObservabilityTestApp((instance) => {
      instance.get('/async', async (_req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        res.json({ requestId: getRequestId() });
      });
    });

    await withServer(app, async (server) => {
      const incoming = 'async-context-id';
      const { body, response } = await request(server, {
        path: '/async',
        headers: { [REQUEST_ID_HEADER]: incoming },
      });

      assert.equal(response.headers.get('x-request-id'), incoming);
      assert.equal(body?.requestId, incoming);
    });
  });

  test('request ID: parallel requests do not leak IDs', async () => {
    const app = createObservabilityTestApp((instance) => {
      instance.get('/parallel', async (_req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        res.json({ requestId: getRequestId() });
      });
    });

    await withServer(app, async (server) => {
      const [left, right] = await Promise.all([
        request(server, {
          path: '/parallel',
          headers: { [REQUEST_ID_HEADER]: 'parallel-left' },
        }),
        request(server, {
          path: '/parallel',
          headers: { [REQUEST_ID_HEADER]: 'parallel-right' },
        }),
      ]);

      assert.equal(left.body?.requestId, 'parallel-left');
      assert.equal(right.body?.requestId, 'parallel-right');
    });
  });

  test('error middleware: preserves AppError status, code, message, and public details', async () => {
    const app = createObservabilityTestApp((instance) => {
      instance.get('/app-error', () => {
        throw new AppError('Bad input', 400, 'VALIDATION_ERROR', {
          field: 'email',
        });
      });
    });

    await withServer(app, async (server) => {
      const { response, body } = await request(server, { path: '/app-error' });

      assert.equal(response.status, 400);
      assert.equal(body?.message, 'Bad input');
      assert.equal((body?.error as { code?: string })?.code, 'VALIDATION_ERROR');
      assert.deepEqual((body?.error as { details?: unknown })?.details, {
        field: 'email',
      });
    });
  });

  test('error middleware: sanitizes internal AppError message, details, context, and cause', async () => {
    const internalId = '550e8400-e29b-41d4-a716-446655440000';
    const app = createObservabilityTestApp((instance) => {
      instance.get('/internal', () => {
        throw new AppError(
          `Payment session ${internalId} failed with SQLSTATE 23505`,
          500,
          'INTERNAL_ERROR',
          { sessionId: internalId },
          {
            cause: new Error(`secret root cause for ${internalId}`),
            context: { operation: 'test-op', password: 'hidden' },
          },
        );
      });
    });

    await withServer(app, async (server) => {
      const { body } = await request(server, { path: '/internal' });
      const serialized = JSON.stringify(body);

      assert.equal(body?.message, 'Internal server error');
      assert.equal((body?.error as { code?: string })?.code, 'INTERNAL_ERROR');
      assert.equal((body?.error as { details?: unknown })?.details, undefined);
      assert.doesNotMatch(serialized, /550e8400/);
      assert.doesNotMatch(serialized, /SQLSTATE/);
      assert.doesNotMatch(serialized, /secret root cause/);
      assert.doesNotMatch(serialized, /hidden/);
      assert.doesNotMatch(serialized, /test-op/);
    });
  });

  test('error middleware: Zod errors retain canonical validation issue shape', async () => {
    const app = createObservabilityTestApp((instance) => {
      instance.get('/zod', () => {
        const schema = z.object({ email: z.email() });
        schema.parse({ email: 'not-an-email' });
      });
    });

    await withServer(app, async (server) => {
      const { response, body } = await request(server, { path: '/zod' });

      assert.equal(response.status, 400);
      assert.equal((body?.error as { code?: string })?.code, 'VALIDATION_ERROR');
      const issues = (body?.error as { details?: { issues?: unknown[] } })?.details
        ?.issues;
      assert.ok(Array.isArray(issues));
      assert.equal(typeof (issues?.[0] as { path?: string })?.path, 'string');
      assert.equal(typeof (issues?.[0] as { message?: string })?.message, 'string');
    });
  });

  test('error middleware: P2002 maps to 409 CONFLICT', async () => {
    const app = createObservabilityTestApp((instance) => {
      instance.get('/p2002', () => {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
          meta: { target: ['email'] },
        });
      });
    });

    await withServer(app, async (server) => {
      const { response, body } = await request(server, { path: '/p2002' });

      assert.equal(response.status, 409);
      assert.equal((body?.error as { code?: string })?.code, 'CONFLICT');
      assert.match(String(body?.message), /conflicts/i);
    });
  });

  test('error middleware: P2025 maps to 404 NOT_FOUND', async () => {
    const app = createObservabilityTestApp((instance) => {
      instance.get('/p2025', () => {
        throw new Prisma.PrismaClientKnownRequestError('Record not found', {
          code: 'P2025',
          clientVersion: 'test',
        });
      });
    });

    await withServer(app, async (server) => {
      const { response, body } = await request(server, { path: '/p2025' });

      assert.equal(response.status, 404);
      assert.equal((body?.error as { code?: string })?.code, 'NOT_FOUND');
    });
  });

  test('error middleware: unknown Prisma errors map to generic 500', async () => {
    const logs = createLogCapture();
    const app = createObservabilityTestApp((instance) => {
      instance.get('/p9999', () => {
        throw new Prisma.PrismaClientKnownRequestError('Unknown prisma failure', {
          code: 'P9999',
          clientVersion: 'test',
        });
      });
    });

    await withServer(app, async (server) => {
      const { response, body } = await request(server, { path: '/p9999' });

      assert.equal(response.status, 500);
      assert.equal((body?.error as { code?: string })?.code, 'INTERNAL_ERROR');
      assert.equal(body?.message, 'Internal server error');
      assert.equal((body?.error as { details?: unknown })?.details, undefined);

      await new Promise((resolve) => setTimeout(resolve, 10));
      const errorLog = logs
        .parseAll()
        .find((entry) => entry.message === 'Request failed with server error');
      assert.ok(errorLog);
    });
  });

  test('error middleware: unknown errors never expose raw messages in any environment', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const app = createObservabilityTestApp((instance) => {
      instance.get('/boom', () => {
        throw new Error('database exploded with secret-token-value');
      });
    });

    await withServer(app, async (server) => {
      const { body } = await request(server, { path: '/boom' });
      const serialized = JSON.stringify(body);

      assert.equal(body?.message, 'Internal server error');
      assert.doesNotMatch(serialized, /database exploded/);
      assert.doesNotMatch(serialized, /secret-token-value/);
    });

    process.env.NODE_ENV = previousNodeEnv;
  });

  test('error middleware: 500 errors produce structured error log with requestId', async () => {
    const logs = createLogCapture();
    const app = createObservabilityTestApp((instance) => {
      instance.get('/server-error', () => {
        throw new Error('unexpected');
      });
    });

    await withServer(app, async (server) => {
      const incoming = 'server-error-id';
      await request(server, {
        path: '/server-error',
        headers: { [REQUEST_ID_HEADER]: incoming },
      });

      await new Promise((resolve) => setTimeout(resolve, 15));
      const errorLog = logs
        .parseAll()
        .find((entry) => entry.message === 'Request failed with server error');

      assert.ok(errorLog);
      assert.equal(errorLog?.requestId, incoming);
      assert.equal(errorLog?.errorCode, 'INTERNAL_ERROR');
    });
  });

  test('error middleware: expected 4xx AppErrors do not produce error-level stack logs', async () => {
    const logs = createLogCapture();
    const app = createObservabilityTestApp((instance) => {
      instance.get('/client-error', () => {
        throw new AppError('Forbidden', 403, 'FORBIDDEN');
      });
    });

    await withServer(app, async (server) => {
      await request(server, { path: '/client-error' });
      await new Promise((resolve) => setTimeout(resolve, 10));

      const errorLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'Request failed with server error');
      assert.equal(errorLogs.length, 0);
    });
  });

  test('redaction: password/token/cookie/authorization values are redacted', () => {
    const redacted = redactUnknownValue({
      authorization: 'Bearer secret-token',
      cookie: 'refreshToken=abc',
      password: 'pw',
      nested: {
        accessToken: 'token-value',
      },
    });

    const serialized = JSON.stringify(redacted);
    assert.match(serialized, /\[redacted\]/);
    assert.doesNotMatch(serialized, /secret-token/);
    assert.doesNotMatch(serialized, /token-value/);
  });

  test('redaction: nested cause values are redacted', () => {
    const { error } = serializeUnknownError(
      new Error('failed', {
        cause: new Error('password=abc refreshToken=xyz'),
      }),
    );

    const serialized = JSON.stringify(error);
    assert.doesNotMatch(serialized, /refreshToken=xyz/);
  });

  test('redaction: circular objects do not crash serialization', () => {
    const value: Record<string, unknown> = { name: 'loop' };
    value.self = value;

    assert.doesNotThrow(() => redactUnknownValue(value));
    const redacted = redactUnknownValue(value);
    assert.equal((redacted as { self?: string }).self, '[circular]');
  });

  test('redaction: long errors are bounded', () => {
    const longMessage = 'x'.repeat(10_000);
    const { error } = serializeUnknownError(new Error(longMessage));

    assert.ok((error.message?.length ?? 0) < 10_000);
    assert.match(error.message ?? '', /\[truncated\]/);
  });

  test('request logging: successful request produces one completion log', async () => {
    const logs = createLogCapture();
    const app = createObservabilityTestApp((instance) => {
      instance.get('/success', (_req, res) => {
        res.status(200).json({ ok: true });
      });
    });

    await withServer(app, async (server) => {
      await request(server, { path: '/success' });
      await new Promise((resolve) => setTimeout(resolve, 15));

      const completionLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'HTTP request completed');
      assert.equal(completionLogs.length, 1);
      assert.equal(completionLogs[0]?.statusCode, 200);
    });
  });

  test('request logging: validation failure produces one completion log', async () => {
    const logs = createLogCapture();
    const app = createObservabilityTestApp((instance) => {
      instance.get('/validation', () => {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      });
    });

    await withServer(app, async (server) => {
      await request(server, { path: '/validation' });
      await new Promise((resolve) => setTimeout(resolve, 15));

      const completionLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'HTTP request completed');
      assert.equal(completionLogs.length, 1);
      assert.equal(completionLogs[0]?.statusCode, 400);
      assert.equal(logLevelName(completionLogs[0]!), 'warn');
      assert.equal(completionLogs[0]?.errorCode, 'VALIDATION_ERROR');
    });
  });

  test('request logging: aborted request produces aborted event without duplicate completion', async () => {
    const logs = createLogCapture();
    const app = createObservabilityTestApp((instance) => {
      instance.get('/slow', async (_req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        res.status(200).end('done');
      });
    });

    await withServer(app, async (server) => {
      const controller = new AbortController();
      const requestPromise = request(server, {
        path: '/slow',
        signal: controller.signal,
      });

      await new Promise((resolve) => setTimeout(resolve, 20));
      controller.abort();

      await requestPromise.catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 250));

      const abortedLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'HTTP request aborted');
      const completedLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'HTTP request completed');

      assert.equal(abortedLogs.length, 1);
      assert.equal(completedLogs.length, 0);
      assert.equal(logLevelName(abortedLogs[0]!), 'warn');
    });
  });

  test('request logging: sensitive query/body/header values are absent from completion logs', async () => {
    const logs = createLogCapture();
    const app = createObservabilityTestApp((instance) => {
      instance.use(express.json());
      instance.post('/secure', (req, res) => {
        void req.body;
        res.status(201).end();
      });
    });

    await withServer(app, async (server) => {
      await request(server, {
        method: 'POST',
        path: '/secure?token=secret-token&email=user@example.com',
        headers: {
          authorization: 'Bearer secret-token',
          cookie: 'refreshToken=abc',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ password: 'secret-password', token: 'body-token' }),
      });

      await new Promise((resolve) => setTimeout(resolve, 15));
      const completion = logs
        .parseAll()
        .find((entry) => entry.message === 'HTTP request completed');

      assert.ok(completion);
      const serialized = JSON.stringify(completion);
      assert.doesNotMatch(serialized, /secret-token/);
      assert.doesNotMatch(serialized, /user@example.com/);
      assert.doesNotMatch(serialized, /refreshToken/);
    });
  });

  test('context enrichment: authenticated request logs userId but not email/token', async () => {
    const logs = createLogCapture();

    const app = createObservabilityTestApp((instance) => {
      instance.get('/protected', (_req, res) => {
        updateRequestContext({ userId: 'user-123' });
        res.status(200).end();
      });
    });

    await withServer(app, async (server) => {
      await request(server, {
        path: '/protected',
        headers: {
          authorization: 'Bearer secret-token-value',
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 15));
      const completion = logs
        .parseAll()
        .find((entry) => entry.message === 'HTTP request completed');

      assert.equal(completion?.userId, 'user-123');
      const serialized = JSON.stringify(completion);
      assert.doesNotMatch(serialized, /Bearer/);
      assert.doesNotMatch(serialized, /@/);
    });
  });

  test('context enrichment: parallel authenticated requests do not leak identity context', async () => {
    const app = createObservabilityTestApp((instance) => {
      instance.get('/whoami', async (_req, res) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        res.json({ userId: getRequestContext()?.userId ?? null });
      });
    });

    await withServer(app, async (server) => {
      const [left, right] = await Promise.all([
        (async () => {
          let capturedUserId: string | undefined;

          await runWithRequestContext(
            {
              requestId: 'left-request',
              startedAt: Date.now(),
              method: 'GET',
              path: '/whoami',
              userId: 'left-user',
            },
            async () => {
              await new Promise((resolve) => setTimeout(resolve, 25));
              capturedUserId = getRequestContext()?.userId;
            },
          );

          return capturedUserId;
        })(),
        (async () => {
          let capturedUserId: string | undefined;

          await runWithRequestContext(
            {
              requestId: 'right-request',
              startedAt: Date.now(),
              method: 'GET',
              path: '/whoami',
              userId: 'right-user',
            },
            async () => {
              await new Promise((resolve) => setTimeout(resolve, 25));
              capturedUserId = getRequestContext()?.userId;
            },
          );

          return capturedUserId;
        })(),
      ]);

      assert.equal(left, 'left-user');
      assert.equal(right, 'right-user');
    });
  });

  test('mock link security: token-bearing mock links disabled by default', async () => {
    process.env.MOCK_EMAIL_LOG_LINKS = 'false';
    process.env.NODE_ENV = 'development';

    const logs = createLogCapture();
    const authProvider = new MockAuthEmailProvider();
    const inviteProvider = new MockEmailInvitationProvider();

    await authProvider.sendPasswordResetEmail({
      recipientEmail: 'user@example.com',
      resetLink: 'http://localhost/reset-password?token=secret-reset-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    await inviteProvider.sendInvitationEmail({
      recipientEmail: 'invite@example.com',
      inviteLink: 'http://localhost/invite?token=secret-invite-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      role: 'DRIVER',
    });

    const serialized = JSON.stringify(logs.parseAll());
    assert.doesNotMatch(serialized, /secret-reset-token/);
    assert.doesNotMatch(serialized, /secret-invite-token/);
    assert.doesNotMatch(serialized, /invite@example.com/);
  });

  test('mock link security: explicit development flag enables links only in development', async () => {
    process.env.MOCK_EMAIL_LOG_LINKS = 'true';
    process.env.NODE_ENV = 'development';

    const logs = createLogCapture();
    const authProvider = new MockAuthEmailProvider();

    await authProvider.sendPasswordResetEmail({
      recipientEmail: 'user@example.com',
      resetLink: 'http://localhost/reset-password?token=dev-reset-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    const serialized = JSON.stringify(logs.parseAll());
    assert.match(serialized, /dev-reset-token/);
  });

  test('mock link security: test/production mode never prints token-bearing links', async () => {
    process.env.MOCK_EMAIL_LOG_LINKS = 'true';
    process.env.NODE_ENV = 'test';

    const logs = createLogCapture();
    const authProvider = new MockAuthEmailProvider();

    await authProvider.sendPasswordResetEmail({
      recipientEmail: 'user@example.com',
      resetLink: 'http://localhost/reset-password?token=blocked-reset-token',
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    const serialized = JSON.stringify(logs.parseAll());
    assert.doesNotMatch(serialized, /blocked-reset-token/);
  });

  test('malformed JSON: returns safe 400 INVALID_JSON with request correlation', async () => {
    const logs = createLogCapture();
    const app = createIntegrationApp((instance) => {
      instance.post('/payload', (_req, res) => {
        res.status(200).json({ ok: true });
      });
    });

    await withServer(app, async (server) => {
      const incoming = 'malformed-json-trace';
      const { response, body } = await request(server, {
        method: 'POST',
        path: '/payload',
        headers: {
          [REQUEST_ID_HEADER]: incoming,
          'content-type': 'application/json',
        },
        body: '{"broken":',
      });

      assert.equal(response.status, 400);
      assert.equal(response.headers.get('x-request-id'), incoming);
      assert.equal(body?.message, 'Invalid JSON request body');
      assert.equal((body?.error as { code?: string })?.code, INVALID_JSON_ERROR_CODE);
      assert.equal((body?.error as { requestId?: string })?.requestId, undefined);
      assert.equal((body?.error as { details?: unknown })?.details, undefined);

      const serialized = JSON.stringify(body);
      assert.doesNotMatch(serialized, /\{"broken":/);
      assert.doesNotMatch(serialized, /stack/i);

      await new Promise((resolve) => setTimeout(resolve, 15));
      const errorLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'Request failed with server error');
      const completionLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'HTTP request completed');

      assert.equal(errorLogs.length, 0);
      assert.equal(completionLogs.length, 1);
      assert.equal(logLevelName(completionLogs[0]!), 'warn');
      assert.equal(completionLogs[0]?.errorCode, INVALID_JSON_ERROR_CODE);
      assert.doesNotMatch(JSON.stringify(completionLogs[0]), /\{"broken":/);
    });
  });

  test('CORS: exposes X-Request-Id to allowed browser origins', async () => {
    const { app, allowedOrigin } = createCorsIntegrationApp();

    await withServer(app, async (server) => {
      const { response } = await request(server, {
        path: '/cors-check',
        headers: {
          Origin: allowedOrigin,
        },
      });

      assert.equal(response.status, 200);
      assert.match(
        response.headers.get('access-control-expose-headers') ?? '',
        /x-request-id/i,
      );
      assert.ok(response.headers.get('x-request-id'));
    });
  });

  test('request context: middleware error keeps request ID in header and logs, not body', async () => {
    const logs = createLogCapture();
    const app = express();

    app.use(requestContextMiddleware);
    app.use(
      helmet({
        crossOriginResourcePolicy: false,
      }),
    );
    app.use(
      cors({
        origin: [PRODUCTION_LIKE_ALLOWED_ORIGIN],
        credentials: true,
        exposedHeaders: ['X-Request-Id'],
        allowedHeaders: [...CORS_ALLOWED_HEADERS],
      }),
    );
    app.use((_req, _res, next) => {
      next(new AppError('Blocked before routes', 403, 'FORBIDDEN'));
    });
    app.use(errorMiddleware);

    await withServer(app, async (server) => {
      const incomingId = 'early-middleware-error-id';
      const { response, body } = await request(server, {
        path: '/any-path',
        headers: {
          [REQUEST_ID_HEADER]: incomingId,
          Origin: PRODUCTION_LIKE_ALLOWED_ORIGIN,
        },
      });

      assert.equal(response.status, 403);
      assert.equal(response.headers.get('x-request-id'), incomingId);
      assertMatchingRequestIds(response, body);

      await new Promise((resolve) => setTimeout(resolve, 15));

      const completion = logs
        .parseAll()
        .find((entry) => entry.message === 'HTTP request completed');

      assert.ok(completion);
      assert.equal(completion.requestId, incomingId);
    });
  });

  test('CORS preflight: JSON authenticated request headers are permitted for allowed origin', async () => {
    const { app, allowedOrigin } = createCorsIntegrationApp();
    const requestedHeaders = [
      'content-type',
      'authorization',
      'x-client-platform',
      'x-request-id',
    ];

    await withServer(app, async (server) => {
      const incomingId = 'preflight-json-auth-id';
      const { response } = await requestRaw(server, {
        method: 'OPTIONS',
        path: '/cors-post',
        headers: {
          Origin: allowedOrigin,
          [REQUEST_ID_HEADER]: incomingId,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': requestedHeaders.join(', '),
        },
      });

      assert.ok(response.status === 204 || response.status === 200);
      assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
      assertRequestedHeadersPermitted(
        response.headers.get('access-control-allow-headers'),
        requestedHeaders,
      );
      assert.equal(response.headers.get('x-request-id'), incomingId);
      assert.match(
        response.headers.get('access-control-expose-headers') ?? '',
        /x-request-id/i,
      );
    });
  });

  test('CORS preflight: idempotent request headers are permitted for allowed origin', async () => {
    const { app, allowedOrigin } = createCorsIntegrationApp();
    const requestedHeaders = [
      'content-type',
      'authorization',
      'idempotency-key',
    ];

    await withServer(app, async (server) => {
      const { response } = await requestRaw(server, {
        method: 'OPTIONS',
        path: '/cors-post',
        headers: {
          Origin: allowedOrigin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': requestedHeaders.join(', '),
        },
      });

      assert.ok(response.status === 204 || response.status === 200);
      assert.equal(response.headers.get('access-control-allow-origin'), allowedOrigin);
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
      assertRequestedHeadersPermitted(
        response.headers.get('access-control-allow-headers'),
        requestedHeaders,
      );
      assert.ok(response.headers.get('x-request-id'));
    });
  });

  test('CORS preflight: disallowed origin does not receive allow-origin or credentials headers', async () => {
    const { app } = createCorsIntegrationApp();

    await withServer(app, async (server) => {
      const incomingId = 'preflight-disallowed-origin-id';
      const { response } = await requestRaw(server, {
        method: 'OPTIONS',
        path: '/cors-post',
        headers: {
          Origin: DISALLOWED_ORIGIN,
          [REQUEST_ID_HEADER]: incomingId,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers':
            'content-type, authorization, x-client-platform',
        },
      });

      assert.equal(response.headers.get('access-control-allow-origin'), null);
      assert.notEqual(
        response.headers.get('access-control-allow-origin'),
        DISALLOWED_ORIGIN,
      );
      assert.equal(response.headers.get('x-request-id'), incomingId);
    });
  });

  test('request ID coverage: same ID across preflight, allowed request, malformed JSON, 404, server error, and CORS rejection', async () => {
    const logs = createLogCapture();
    const app = createProductionLikeCorsApp((instance) => {
      instance.get('/cors-check', (_req, res) => {
        res.status(200).json({ ok: true });
      });
      instance.post('/echo', (req, res) => {
        res.status(200).json(req.body);
      });
      instance.get('/boom', () => {
        throw new Error('unexpected failure');
      });
    });

    await withServer(app, async (server) => {
      const incomingId = 'coverage-single-request-id';

      const preflight = await requestRaw(server, {
        method: 'OPTIONS',
        path: '/echo',
        headers: {
          Origin: PRODUCTION_LIKE_ALLOWED_ORIGIN,
          [REQUEST_ID_HEADER]: incomingId,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers':
            'content-type, authorization, x-client-platform, x-request-id',
        },
      });
      assert.equal(preflight.response.headers.get('x-request-id'), incomingId);

      const allowed = await request(server, {
        path: '/cors-check',
        headers: {
          Origin: PRODUCTION_LIKE_ALLOWED_ORIGIN,
          [REQUEST_ID_HEADER]: incomingId,
        },
      });
      assert.equal(allowed.response.headers.get('x-request-id'), incomingId);

      const malformed = await requestRaw(server, {
        method: 'POST',
        path: '/echo',
        headers: {
          Origin: PRODUCTION_LIKE_ALLOWED_ORIGIN,
          [REQUEST_ID_HEADER]: incomingId,
          'Content-Type': 'application/json',
        },
        body: '{invalid-json',
      });
      assert.equal(malformed.response.status, 400);
      assert.equal(malformed.response.headers.get('x-request-id'), incomingId);
      assertMatchingRequestIds(malformed.response, malformed.body);

      const notFound = await request(server, {
        path: '/missing-route',
        headers: {
          Origin: PRODUCTION_LIKE_ALLOWED_ORIGIN,
          [REQUEST_ID_HEADER]: incomingId,
        },
      });
      assert.equal(notFound.response.status, 404);
      assert.equal(notFound.response.headers.get('x-request-id'), incomingId);
      assertMatchingRequestIds(notFound.response, notFound.body);

      const serverError = await request(server, {
        path: '/boom',
        headers: {
          Origin: PRODUCTION_LIKE_ALLOWED_ORIGIN,
          [REQUEST_ID_HEADER]: incomingId,
        },
      });
      assert.equal(serverError.response.status, 500);
      assert.equal(serverError.response.headers.get('x-request-id'), incomingId);
      assertMatchingRequestIds(serverError.response, serverError.body);

      const corsRejected = await requestRaw(server, {
        method: 'OPTIONS',
        path: '/echo',
        headers: {
          Origin: DISALLOWED_ORIGIN,
          [REQUEST_ID_HEADER]: incomingId,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type, authorization',
        },
      });
      assert.equal(
        corsRejected.response.headers.get('access-control-allow-origin'),
        null,
      );
      assert.equal(corsRejected.response.headers.get('x-request-id'), incomingId);

      await new Promise((resolve) => setTimeout(resolve, 25));

      const loggedIds = logs
        .parseAll()
        .filter((entry) => entry.requestId === incomingId)
        .map((entry) => entry.requestId);

      assert.ok(loggedIds.length >= 1);

      const distinctIdsForIncoming = new Set(
        [
          preflight.response.headers.get('x-request-id'),
          allowed.response.headers.get('x-request-id'),
          malformed.response.headers.get('x-request-id'),
          notFound.response.headers.get('x-request-id'),
          serverError.response.headers.get('x-request-id'),
          corsRejected.response.headers.get('x-request-id'),
        ].filter((value): value is string => Boolean(value)),
      );

      assert.equal(distinctIdsForIncoming.size, 1);
      assert.equal([...distinctIdsForIncoming][0], incomingId);
    });
  });

  test('request logging: routine 401 and 403 completion logs stay at info', async () => {
    const logs = createLogCapture();
    const app = createIntegrationApp((instance) => {
      instance.get('/unauthorized', () => {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      });
      instance.get('/forbidden', () => {
        throw new AppError('Forbidden', 403, 'FORBIDDEN');
      });
    });

    await withServer(app, async (server) => {
      await request(server, { path: '/unauthorized' });
      await request(server, { path: '/forbidden' });
      await new Promise((resolve) => setTimeout(resolve, 20));

      const completionLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'HTTP request completed');

      assert.equal(completionLogs.length, 2);
      assert.equal(logLevelName(completionLogs[0]!), 'info');
      assert.equal(logLevelName(completionLogs[1]!), 'info');
      assert.equal(completionLogs[0]?.errorCode, 'UNAUTHENTICATED');
      assert.equal(completionLogs[1]?.errorCode, 'FORBIDDEN');
    });
  });

  test('request logging: 429 completion logs at warn', async () => {
    const logs = createLogCapture();
    const app = createIntegrationApp((instance) => {
      instance.get('/limited', () => {
        throw new AppError('Too many requests', 429, 'RATE_LIMITED');
      });
    });

    await withServer(app, async (server) => {
      await request(server, { path: '/limited' });
      await new Promise((resolve) => setTimeout(resolve, 15));

      const completion = logs
        .parseAll()
        .find((entry) => entry.message === 'HTTP request completed');

      assert.ok(completion);
      assert.equal(logLevelName(completion), 'warn');
    });
  });

  test('duplicate logging: unexpected 500 writes one error log and one warn completion without stack', async () => {
    const logs = createLogCapture();
    const app = createIntegrationApp((instance) => {
      instance.get('/boom', () => {
        throw new Error('detailed server failure');
      });
    });

    await withServer(app, async (server) => {
      await request(server, { path: '/boom' });
      await new Promise((resolve) => setTimeout(resolve, 20));

      const errorLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'Request failed with server error');
      const completionLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'HTTP request completed');

      assert.equal(errorLogs.length, 1);
      assert.equal(completionLogs.length, 1);
      assert.equal(logLevelName(errorLogs[0]!), 'error');
      assert.equal(logLevelName(completionLogs[0]!), 'warn');
      assert.ok((errorLogs[0]?.err as { stack?: string } | undefined)?.stack);
      assert.equal(completionLogs[0]?.err, undefined);
    });
  });

  test('duplicate logging: finish then close does not duplicate completion', async () => {
    const logs = createLogCapture();
    const app = createIntegrationApp((instance) => {
      instance.get('/once', (_req, res) => {
        res.status(200).json({ ok: true });
      });
    });

    await withServer(app, async (server) => {
      await request(server, { path: '/once' });
      await new Promise((resolve) => setTimeout(resolve, 20));

      const completionLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'HTTP request completed');
      const abortedLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'HTTP request aborted');

      assert.equal(completionLogs.length, 1);
      assert.equal(abortedLogs.length, 0);
    });
  });

  test('duplicate logging: parallel failing requests keep separate duplicate-log state', async () => {
    const logs = createLogCapture();
    const app = createIntegrationApp((instance) => {
      instance.get('/parallel-fail', async () => {
        await new Promise((resolve) => setTimeout(resolve, 15));
        throw new Error('parallel failure');
      });
    });

    await withServer(app, async (server) => {
      await Promise.all([
        request(server, {
          path: '/parallel-fail',
          headers: { [REQUEST_ID_HEADER]: 'parallel-fail-left' },
        }),
        request(server, {
          path: '/parallel-fail',
          headers: { [REQUEST_ID_HEADER]: 'parallel-fail-right' },
        }),
      ]);

      await new Promise((resolve) => setTimeout(resolve, 25));

      const errorLogs = logs
        .parseAll()
        .filter((entry) => entry.message === 'Request failed with server error');

      assert.equal(errorLogs.length, 2);
      const requestIds = new Set(errorLogs.map((entry) => entry.requestId));
      assert.equal(requestIds.size, 2);
    });
  });

  test('Pino field contract: emits message and numeric level with service/environment', async () => {
    const logs = createLogCapture();
    const app = createIntegrationApp((instance) => {
      instance.get('/contract', (_req, res) => {
        res.status(200).json({ ok: true });
      });
    });

    await withServer(app, async (server) => {
      await request(server, { path: '/contract' });
      await new Promise((resolve) => setTimeout(resolve, 15));

      const completion = logs
        .parseAll()
        .find((entry) => entry.message === 'HTTP request completed');

      assert.ok(completion);
      assert.equal(typeof completion.message, 'string');
      assert.equal(typeof completion.level, 'number');
      assert.equal(logLevelName(completion), 'info');
      assert.equal(typeof completion.time, 'string');
      assert.equal(completion.service, 'impactloop-api');
      assert.ok(completion.environment);
      assert.equal(completion.msg, undefined);
    });
  });

  test('request ID consistency across success, client errors, and server failures', async () => {
    const app = createIntegrationApp((instance) => {
      instance.get('/success', (_req, res) => {
        res.status(200).json({ ok: true });
      });
      instance.get('/validation', () => {
        throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      });
      instance.get('/unauthorized', () => {
        throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
      });
      instance.get('/conflict', () => {
        throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        });
      });
      instance.get('/server-error', () => {
        throw new Error('boom');
      });
    });

    await withServer(app, async (server) => {
      const success = await request(server, {
        path: '/success',
        headers: { [REQUEST_ID_HEADER]: 'id-success' },
      });
      assert.equal(success.response.headers.get('x-request-id'), 'id-success');
      assert.equal(success.body?.error, undefined);

      const validation = await request(server, {
        path: '/validation',
        headers: { [REQUEST_ID_HEADER]: 'id-validation' },
      });
      assert.equal(validation.response.status, 400);
      assertMatchingRequestIds(validation.response, validation.body);

      const unauthorized = await request(server, {
        path: '/unauthorized',
        headers: { [REQUEST_ID_HEADER]: 'id-unauthorized' },
      });
      assert.equal(unauthorized.response.status, 401);
      assertMatchingRequestIds(unauthorized.response, unauthorized.body);

      const notFound = await request(server, {
        path: '/missing-route',
        headers: { [REQUEST_ID_HEADER]: 'id-not-found' },
      });
      assert.equal(notFound.response.status, 404);
      assertMatchingRequestIds(notFound.response, notFound.body);

      const conflict = await request(server, {
        path: '/conflict',
        headers: { [REQUEST_ID_HEADER]: 'id-conflict' },
      });
      assert.equal(conflict.response.status, 409);
      assertMatchingRequestIds(conflict.response, conflict.body);

      const serverError = await request(server, {
        path: '/server-error',
        headers: { [REQUEST_ID_HEADER]: 'id-server-error' },
      });
      assert.equal(serverError.response.status, 500);
      assertMatchingRequestIds(serverError.response, serverError.body);
    });
  });

  test('redaction: AppError internal context and cause stay out of API responses', async () => {
    const app = createIntegrationApp((instance) => {
      instance.get('/secret-context', () => {
        throw new AppError('Denied', 403, 'FORBIDDEN', undefined, {
          cause: new Error('password=secret refreshToken=abc'),
          context: { operation: 'secret-op', password: 'hidden-password' },
        });
      });
    });

    await withServer(app, async (server) => {
      const { body } = await request(server, { path: '/secret-context' });
      const serialized = JSON.stringify(body);

      assert.doesNotMatch(serialized, /hidden-password/);
      assert.doesNotMatch(serialized, /refreshToken=abc/);
      assert.doesNotMatch(serialized, /secret-op/);
    });
  });
});
