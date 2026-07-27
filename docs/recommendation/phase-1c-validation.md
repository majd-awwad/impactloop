# Phase 1C — Durable Action Attribution Validation

Date: 2026-07-18

## Scope and invariants

Phase 1C activates durable learner-action attribution after a successful business action. Ranking, candidate limits, section order, cache content, single-flight computation, recommendation response ordering, and Learner Home UI behavior are unchanged. No frontend, admin, supplier, driver, generated Prisma, or historical migration file was edited. Project views and supplier-side reservation lifecycle actions remain unsupported.

Delivery is at-least-once: action materialization is idempotent, exactly-once delivery is not guaranteed, and a telemetry enqueue failure may lose attribution without failing the business action. Retention cleanup is not automated. Frontend clients must forward the optional impression ID to obtain direct attribution; assisted attribution is less certain.

## Migration tracking and schema state

The three tracked migration paths are:

```text
apps/backend/prisma/migrations/20260717140000_add_recommendation_observability/migration.sql
apps/backend/prisma/migrations/20260717230000_add_recommendation_event_outbox/migration.sql
apps/backend/prisma/migrations/20260718090000_add_recommendation_action_outbox/migration.sql
```

The Phase 1C migration is additive only. It adds the six action enum values required by the existing action matrix and `RECOMMENDATION_ACTION` to the outbox enum; it contains no table drop, column drop, data rewrite, or destructive SQL. The two earlier migration files are unchanged. `prisma validate` passed and local `prisma migrate status` reported the database up to date after the new migration was applied locally. No production migration was run.

## Supported action matrix

All rows below use the `RECOMMENDATION_ACTION` outbox event kind. The impression header is optional on every row. A valid learner-owned matching header is eligible for `DIRECT`; no header, malformed header, or an invalid explicit hint may use the assisted path when a matching impression exists.

| Action | Endpoint | Role | Entity | Durable business result | Stable operation identity | Direct / assisted |
|---|---|---|---|---|---|---|
| `MATERIAL_VIEW` | `GET /api/materials/:id` | `LEARNER` | `MATERIAL/:id` | material detail response | request correlation ID; distinct requests remain distinct | yes / yes |
| `MATERIAL_LIKE` | `POST /api/materials/:id/like` | `LEARNER` | `MATERIAL/:id` | like response/count | `Idempotency-Key`, then request ID | yes / yes |
| `MATERIAL_UNLIKE` | `DELETE /api/materials/:id/like` | `LEARNER` | `MATERIAL/:id` | unlike response/count | `Idempotency-Key`, then request ID | yes / yes |
| `RESERVATION_CREATED` | `POST /api/reservations/` | `LEARNER` | returned `MATERIAL` ID | returned reservation ID | returned reservation ID | yes / yes |
| `PROJECT_LIKE` | `POST /api/learning-projects/:id/like` | `LEARNER` | `PROJECT/:id` | like response/count | `Idempotency-Key`, then request ID | yes / yes |
| `PROJECT_UNLIKE` | `DELETE /api/learning-projects/:id/like` | `LEARNER` | `PROJECT/:id` | unlike response/count | `Idempotency-Key`, then request ID | yes / yes |
| `PROJECT_SAVE` | `POST /api/learning-projects/:id/save` | `LEARNER` | `PROJECT/:id` | save response | `Idempotency-Key`, then request ID | yes / yes |
| `PROJECT_UNSAVE` | `DELETE /api/learning-projects/:id/save` | `LEARNER` | `PROJECT/:id` | unsave response | `Idempotency-Key`, then request ID | yes / yes |
| `PROJECT_FOLLOW` | `POST /api/learning-projects/:id/follow` | `LEARNER` | `PROJECT/:id` | follow response | `Idempotency-Key`, then request ID | yes / yes |
| `PROJECT_UNFOLLOW` | `DELETE /api/learning-projects/:id/follow` | `LEARNER` | `PROJECT/:id` | unfollow response | `Idempotency-Key`, then request ID | yes / yes |
| `PROJECT_BUILD_STARTED` | `POST /api/learning-projects/:id/builds/start` | `LEARNER` | `PROJECT/:id` | returned build ID | returned build ID | yes / yes |
| `PROJECT_BUILD_PROGRESS_UPDATED` | `PATCH /api/learning-projects/:id/builds/me/items/:itemId` | `LEARNER` | `PROJECT/:id` | returned build item/update timestamp | `build:<buildId>:item:<itemId>:<updatedAt>` | yes / yes |

The response-boundary mapper normalizes mounted Express paths (`baseUrl + path`), uses only successful response data for durable results, and does not inspect request bodies.

## Request-path write shape

The verified sequence is:

```text
business operation commits
  -> successful response boundary computes at most one action plan
  -> one bounded createMany enqueue with one outbox row and skipDuplicates
  -> original business response is sent
```

There is no runtime `RecommendationAction.create` or `RecommendationAction.createMany` in the request path. There is no synchronous recommendation-impression lookup. There is no per-item or per-field outbox insert loop. Action payloads contain bounded IDs and metadata only. Enqueue failures are caught and correlation-logged; the already-successful business response remains successful. Failed JSON responses, unauthenticated requests, and non-learner roles produce no action plan. Supplier, admin, and driver route families are not mapped.

Focused evidence: `enqueue is bulk-shaped and does not synchronously write actions`, `failed, unauthenticated, and non-learner responses produce no action plan`, `expired impressions are not attributed and enqueue failures are non-fatal`, and the live benchmark returned successful HTTP responses for all 24 active cases.

## Direct attribution security matrix

| Condition | Result | Evidence/policy |
|---|---|---|
| valid learner-owned impression | `DIRECT` | learner, type, ID, allowed surface, and 24-hour window all match |
| foreign learner impression | not direct; no action row | worker scopes the lookup to authenticated learner |
| wrong entity type | not direct; unsupported payload is rejected | application action/entity matrix; invalid payload is dead-lettered |
| correct type, wrong entity ID | not direct; no action row | entity ID is part of the lookup predicate |
| expired impression | not direct; no action row | shown time must be within 24 hours |
| malformed impression ID | not direct; may fall back to `ASSISTED` | no record detail is exposed; a matching same-learner impression may be assisted |
| impression not yet materialized | temporary retry | pending exposure envelope produces `IMPRESSION_NOT_READY`, not a false mismatch |
| unsupported action/entity pair | bounded poison handling; no action row | worker marks the event `DEAD` without materialization |
| missing impression header | eligible for assisted path | latest same-learner/type/ID impression is selected |
| wrong surface | not direct unless the stored impression surface is one of `LEARNER_HOME` or `LEARNER_HOME_SECTION` | stored surface is authoritative; no client surface header is required |

Invalid explicit hints may fall back to assisted attribution, but never to foreign, mismatched, expired, or disallowed-surface direct attribution. Rejected attribution exposes no record-existence detail and stores no cross-user data.

## Assisted attribution

Assisted attribution requires the authenticated learner, identical entity type and entity ID, an eligible recommendation surface, and `shownAt` within the same 24-hour bounded window. Selection is deterministic: `shownAt DESC, id DESC`. Expired impressions, other users, and other entities are ignored. A matching row is stored as `ASSISTED`; no matching row is processed as unattributed with no `RecommendationAction` row. The focused test `assisted attribution selects the latest matching impression` covers latest selection; the retained recommendation test covers learner/entity/surface scoping and expired records.

## Action-before-impression race

The focused test `action retries when its matching exposure is still pending` executes the required sequence: exposure envelope first, action enqueue before exposure materialization, action claim before the exposure is ready, `IMPRESSION_NOT_READY`, retry status and delayed `availableAt`, exposure materialization, then one final action row. The action request does not wait for impression materialization. The retry is not dead-lettered prematurely. A permanently foreign, expired, or mismatched reference is processed without indefinite retry and never creates a false direct action.

## Idempotency

| Action family | Policy and verification |
|---|---|
| reservation | returned reservation ID is the durable operation ID; duplicate delivery is one action; separate reservation IDs remain distinct |
| build start | returned build ID is the durable operation ID; duplicate delivery is one action |
| build progress | build ID, item ID, and `updatedAt` identify one transition; repeated delivery of that transition is idempotent; a new timestamp/transition is distinct |
| like/save/follow toggles | `Idempotency-Key`, then request ID; each verb is a distinct action type, so LIKE/UNLIKE, SAVE/UNSAVE, and FOLLOW/UNFOLLOW do not collapse |
| material view | request correlation is the fallback identity; each real request is distinct, while redelivery of the same operation key deduplicates |

The outbox deduplication key is `action:<actionType>:<sourceOperationId>`. Worker materialization upserts by opaque `actionId`. Replaying all 24 benchmark action events produced 24 domain rows before and after replay; no duplicate domain rows were created.

## Worker coverage matrix

| Required behavior | Exact test |
|---|---|
| action enqueue after business success; no synchronous action insert; bulk shape | `enqueue is bulk-shaped and does not synchronously write actions` |
| no enqueue after business failure; unauthenticated/non-learner exclusion | `failed, unauthenticated, and non-learner responses produce no action plan` |
| enqueue failure is non-fatal | `expired impressions are not attributed and enqueue failures are non-fatal` |
| worker materializes once; duplicate delivery idempotent; valid direct | `worker records direct attribution and remains idempotent` |
| valid assisted attribution and deterministic latest selection | `assisted attribution selects the latest matching impression` |
| foreign user, entity mismatch, expired reference | `foreign learner and entity mismatch are processed without an action row`; `expired impressions are not attributed...` |
| malformed hint fallback and unsupported entity/action | `malformed hints fall back to assisted attribution and unsupported entity actions are dead` |
| impression-not-ready retry and bounded delay | `action retries when its matching exposure is still pending`; `retry increments attempts and uses bounded backoff before dead lettering` |
| maximum attempts/dead policy | `retry increments attempts and uses bounded backoff before dead lettering` |
| stale lease recovery | `stale processing leases are recoverable` |
| one bad event does not stop worker; payload validation | `one bad event does not stop the worker loop and materialization remains bulk-shaped`; `unsupported schema and invalid payloads do not materialize` |
| graceful shutdown | `graceful shutdown prevents new claims and disabled defaults do not poll` |

## Performance benchmark

The clean local paired harness used the same process and isolated frozen fixtures. Baseline disabled only the test harness’s `createMany` enqueue call; active exercised the real HTTP response boundary and outbox write. Variants are listed in request order: `none`, `valid`, `invalid`, `assisted`. Each endpoint has four baseline and four active individual timings in milliseconds.

| Endpoint family | Baseline individual ms | Active individual ms | Baseline median / observed p95 | Active median / observed p95 |
|---|---|---|---:|---:|
| material view | 144.5, 50.9, 36.4, 32.9 | 40.2, 27.1, 35.3, 32.8 | 43.6 / 144.5 | 34.1 / 40.2 |
| material like | 118.8, 17.0, 17.7, 16.4 | 19.6, 17.6, 17.8, 18.7 | 17.4 / 118.8 | 18.2 / 19.6 |
| project save | 29.1, 18.4, 15.3, 14.0 | 29.7, 14.8, 17.0, 14.9 | 16.8 / 29.1 | 16.0 / 29.7 |
| reservation creation | 85.8, 68.1, 44.3, 45.6 | 51.9, 46.8, 53.6, 46.5 | 56.9 / 85.8 | 49.4 / 53.6 |
| project build start | 39.6, 37.7, 81.0, 51.9 | 29.9, 29.0, 30.8, 33.4 | 45.7 / 81.0 | 30.3 / 33.4 |
| project build progress | 60.5, 29.7, 44.2, 110.7 | 49.8, 30.1, 32.9, 36.5 | 52.3 / 110.7 | 34.7 / 49.8 |

All 24 active responses were correct (`200` for non-reservation endpoints, `201` for reservation creation); all 24 baseline responses were also correct. No HTTP errors occurred. The benchmark created 24 action outbox events and 24 final action rows. Payload-construction duration and isolated enqueue p50/p95 were not separately timed so clean HTTP timings were not contaminated by instrumentation; the implementation shape is one `createMany` with one row, and the request path has no synchronous attribution lookup. A concurrent action batch was not run in this final local pass. These two measurement gaps are release conditions for production adoption.

## Queue state and cleanup

The bounded run reported:

```text
before:             {}
after enqueue:      PENDING=24
after worker drain:  PROCESSED=24
direct:             6
assisted:           18
unattributed:       0
normal retries:     0
normal dead:        0
duplicate delivery: 24 attempted; 0 duplicate domain rows
after duplicate:    PROCESSED=24
after cleanup:      {}
```

No stale `PROCESSING` rows, unexpected retries, or unexpected dead events remained. The harness removed its action rows, recommendation rows, materials, projects, locations, categories, and test users. No real learner or business data was in scope.

## CORS and API contract

Only `X-Recommendation-Impression-Id` was added to the allowed CORS headers. Existing allowed headers remain unchanged. The header is optional; `X-Recommendation-Surface` is not required and is not trusted as the stored surface. Business endpoints succeed without a header, with a valid header, with an invalid header, and with the assisted case. Invalid values do not change HTTP success/error semantics or expose impression details.

## Privacy and redacted payload

```json
{
  "eventKind": "RECOMMENDATION_ACTION",
  "schemaVersion": "recommendation-action-outbox-v1",
  "deduplicationKey": "action:PROJECT_SAVE:<operation-id>",
  "payload": {
    "actionId": "<opaque-action-id>",
    "learnerId": "<internal-learner-id>",
    "actionType": "PROJECT_SAVE",
    "entityType": "PROJECT",
    "entityId": "<internal-project-id>",
    "impressionId": "<opaque-impression-id-or-null>",
    "sourceOperationId": "<bounded-operation-id>",
    "occurredAt": "<iso-timestamp>",
    "eventSource": "REAL"
  }
}
```

The payload contains no email, display name, token, authorization header, raw request body, IP address, coordinates, free-text notes, descriptions, or full reservation/build/material/project object. Stored fields are IDs, bounded enums/metadata, timestamps, and version identifiers only.

## Validation commands and results

- `npx prisma validate`: passed.
- `npx prisma migrate status`: local database up to date.
- Focused Phase 1C action suite: 9/9 passed after the final coverage additions.
- Recommendation event, outbox, and Phase 1C action suites (serial local-database run): 24/24 passed.
- Learner Home/material/project/reservation regression suite: 331/331 passed.
- Backend TypeScript check: only the pre-existing `src/modules/admin-people/admin-people.service.ts:52` nullability error remains; no changed-path Phase 1C type error remains.
- `git diff --check` and staged diff check: passed.
- Temporary benchmark source and benchmark rows: removed.

## Known limitations and conditions

The worker remains opt-in, retention cleanup is not automated, action attribution can be lost when enqueue fails, and exactly-once delivery is not claimed. The local benchmark is sequential and does not independently time payload construction or enqueue latency. Before production enablement, add production-like concurrent-load evidence, queue-age/retry/dead monitoring, and isolated enqueue timing; review migration rollback implications and deploy the additive migration through the normal release process.
