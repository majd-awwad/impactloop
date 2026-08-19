# Backend Observability

Operational logging, request correlation, and centralized error handling for the ImpactLoop API.

## Scope

This foundation covers:

- structured operational logs (Pino behind a project-owned logger)
- request correlation via `X-Request-Id`
- centralized safe error responses
- sensitive-data redaction
- selected Prisma error fallback mapping
- request completion logging (replaces Morgan)

**Separate from operational logs:** `admin_activity_logs` records admin audit events through `logAdminActivity`. Do not route audit events through the operational logger.

## Request correlation

### Incoming header

Clients may send:

```http
X-Request-Id: <id>
```

The server accepts a client-provided ID only when it is:

- a single string value
- trimmed
- at most 128 characters
- characters `A-Z`, `a-z`, `0-9`, `_`, `-` only
- free of control characters

Otherwise the server generates a new ID with `crypto.randomUUID()`.

### Response header

Every response includes:

```http
X-Request-Id: <id>
```

### Error responses

Middleware-generated errors include the same ID in the JSON body:

```json
{
  "success": false,
  "message": "Human-readable safe message",
  "error": {
    "code": "ERROR_CODE",
    "requestId": "same-as-header",
    "details": {}
  }
}
```

`details` is omitted when undefined.

Search operational logs by `requestId` to trace one frontend failure to one backend request.

## API error envelope

Success responses are unchanged.

Error responses use:

```json
{
  "success": false,
  "message": "Error message",
  "error": {
    "code": "ERROR_CODE",
    "requestId": "uuid-or-client-id",
    "details": {}
  }
}
```

### Common codes

- `VALIDATION_ERROR`
- `INVALID_JSON`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

Unexpected internal failures always return generic `INTERNAL_ERROR` with a safe public message. Raw error text, stack traces, SQL, and Prisma messages are never returned to clients in any environment.

Malformed JSON request bodies return HTTP `400` with code `INVALID_JSON`. This is a client error, not an unexpected server failure.

## AppError

`AppError` remains the single application error type.

Public client fields:

- `message`
- `statusCode`
- `code`
- `details` (optional)

Internal-only fields (never serialized to clients):

- `cause` — original error for server logs
- `context` — allowlisted operational metadata for server logs

Throw `AppError` from services/middleware for expected failures. Let unknown errors reach global middleware.

## Prisma fallback mapping

Global middleware maps only unhandled known Prisma errors:

| Code | HTTP | API code |
|------|------|----------|
| `P2002` | 409 | `CONFLICT` |
| `P2025` | 404 | `NOT_FOUND` |

Other Prisma errors remain generic `500 INTERNAL_ERROR` and are logged server-side.

Module-specific `P2002` handling remains authoritative when a service already converts the error to `AppError`.

`P2034` transaction conflicts are handled by existing transaction retry logic, not the global mapper.

## Structured log schema

Production logs are JSON objects emitted by Pino with `messageKey: 'message'`.

| Field | Description |
|-------|-------------|
| `level` | Numeric Pino level (`10` trace, `20` debug, `30` info, `40` warn, `50` error, `60` fatal) |
| `time` | ISO-8601 timestamp |
| `message` | Human-readable event message |
| `service` | Service name (`impactloop-api` by default) |
| `environment` | `development`, `test`, `production` |
| `requestId` | Present inside active HTTP requests |
| `method` | HTTP method when in request scope |
| `path` | Normalized request path when in request scope |
| `userId` | Authenticated user ID when enriched |
| `activeRole` | Active role when available |
| `operation` | Optional operation name |
| `statusCode` | HTTP status for request events |
| `durationMs` | Request duration for completion logs |
| `route` | Route pattern when available |
| `errorCode` | API error code for server failures |

## Log levels

Configured with `LOG_LEVEL` (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`).

Defaults:

- development: `debug`
- test: `silent` (foundation tests attach an in-memory sink)
- production: `info`

### Request completion policy

One completion log per response:

- `2xx` / `3xx` → `info` (`debug` for `/health`)
- routine auth denials `401` / `403` → `info`
- other client errors including `400`, `404`, `409` → `warn`, with `errorCode` when the error middleware produced the response
- `429` → `warn`
- `5xx` → `error` for the detailed unexpected-error event; completion logs `warn` without repeating the stack when a detailed error log was already written
- aborted connections → `warn` (`HTTP request aborted`, no duplicate completion)

### Middleware order

Request context is the first application middleware so every request — including CORS preflight, security middleware, static files, malformed JSON, and route errors — receives AsyncLocalStorage context, an `X-Request-Id` response header when a response is produced, and correlation in the global error middleware.

```text
requestContextMiddleware
→ helmet
→ cors
→ static middleware
→ body parsers
→ routes
→ notFoundMiddleware
→ errorMiddleware
```

### CORS

Browser clients on allowed origins can read `X-Request-Id` from responses via `Access-Control-Expose-Headers`. Clients may send `X-Request-Id` on cross-origin requests when permitted by `Access-Control-Allow-Headers`.

Explicit `Access-Control-Allow-Headers` (case-insensitive matching):

- `Content-Type`
- `Accept`
- `Authorization`
- `X-Request-Id`
- `X-Client-Platform`
- `Idempotency-Key`

### Server error logging

Logged at `error` when:

- final status is `500+`
- an unexpected non-`AppError` reaches middleware
- an `AppError` with status `500+` is returned

Routine expected `4xx` `AppError` responses are not logged at `error`.

## Redaction policy

The logger and safe error serializer redact sensitive keys including:

- authorization / cookies / set-cookie
- access, refresh, reset, and invitation tokens
- passwords and password hashes
- SMTP passwords and API keys / secrets

Never log:

- complete request bodies
- complete request headers
- user records / Prisma entities
- location or address objects
- latitude / longitude

Use allowlisted operational fields only. Prefer `logger.child({ operation, reservationId })` for resource context.

## Mock email link logging

Mock auth and invitation providers do **not** print token-bearing links by default.

To print links in local development only:

```env
MOCK_EMAIL_LOG_LINKS=true
NODE_ENV=development
```

Test, staging, and production never print token-bearing links, even if the flag is set.

## Adding logs in modules

1. Import `logger` from `observability/logger.js` — never import Pino directly.
2. Do not pass `requestId` manually inside HTTP handlers; request context adds it automatically.
3. Do not log and rethrow the same error unless the local log adds unique context.
4. Use `logger.child({ operation: 'my_operation', resourceId })` for scoped logs.
5. Keep audit events in `logAdminActivity`, not operational logs.

## Learner home profiling (development/debug)

`GET /api/learner/home` and `GET /api/learner/home/sections/:sectionKey` emit a single debug log per request when `NODE_ENV=development` or `LOG_LEVEL=debug|trace`.

Log fields:

- `learnerHomeScope` — `getLearnerHome` or `getLearnerHomeSection`
- `timingsMs` — per-step durations (context load, candidate pool, scoring, section builders)
- `slowestStep` / `slowestStepMs` — hottest actionable child step in that request; aggregate full-operation timers (for example, `totalGetLearnerHome`) remain in `timingsMs` but are excluded

These logs are allowlisted and safe for local profiling. They are not emitted at `info` in production.

## Environment variables

See `apps/backend/env.example`:

- `SERVICE_NAME`
- `LOG_LEVEL`
- `LOG_PRETTY` (development readability)
- `MOCK_EMAIL_LOG_LINKS` (local development only)

Do not print secret environment values in logs.
