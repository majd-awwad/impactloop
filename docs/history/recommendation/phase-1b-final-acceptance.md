# Phase 1B Final Acceptance Verification

Date: 2026-07-18  
Environment: local Windows development database with the frozen seeded learner set. Clean timings used detailed logging disabled, the same direct service process mode, the same first ten seeded learners, and explicit Learner Home cache invalidation. The HTTP series used request contexts so outbox enqueue was active; the worker was not polling during those timings.

## Migration tracking and schema

Both required migration checks passed:

```text
apps/backend/prisma/migrations/20260717140000_add_recommendation_observability/migration.sql
apps/backend/prisma/migrations/20260717230000_add_recommendation_event_outbox/migration.sql
```

The original migration is unchanged. The outbox migration is additive and non-destructive: two enums, one table, a unique deduplication index, and status/availability/lease/processed/created-time indexes. Prisma schema validation, client generation, and local migration deployment passed. No production migration or deployment occurred.

## Before/after HTTP benchmark

The inactive values are a same-process direct-service control without request context, so enqueue is disabled by execution path. They are not presented as an HTTP baseline; the historical Phase 1 synchronous measurements remain the formal inactive record. Active values are request-context calls with enqueue active and worker polling disabled.

| Series | Inactive individual ms | Inactive median / p95 / wall ms | Active individual ms | Active median / p95 / wall ms | Active bytes | Errors |
|---|---|---:|---|---:|---:|---:|
| Five controlled misses | 134, 198, 263, 305, 1014 | 263 / 1014 / — | 138, 226, 350, 355, 1690 | 350 / 1690 / — | 14,831–23,917 | 0 |
| Ten cache hits | 0, 0, 1, 1, 1, 1, 1, 2, 2, 2 | 1 / 2 / 2 | 29, 29, 30, 30, 31, 32, 33, 34, 34, 35 | 32 / 35 / 35 | 23,917 | 0 |
| Same learner ×10 | 212, 212, 213, 213, 213, 213, 213, 214, 214, 214 | 213 / 214 / 214 | 266, 267, 268, 269, 269, 270, 270, 271, 271, 271 | 270 / 271 / 272 | 23,917 | 0 |
| Five distinct learners | 552, 702, 820, 854, 915 | 820 / 915 / 915 | 984, 1117, 1161, 1163, 1189 | 1161 / 1189 / 1189 | 14,831–23,917 | 0 |
| Ten distinct learners | 843, 972, 1193, 1235, 1286, 1413, 1471, 1530, 1586, 1613 | 1413 / 1613 / 1614 | 2618, 2618, 2623, 2679, 2774, 2775, 2780, 2784, 2784, 2786 | 2775 / 2786 / 2787 | 14,778–23,917 | 0 |

The active cache-hit absolute p95 remains below the 500 ms warm-hit gate. Miss and distinct-learner tails are variable local measurements and require production-like tail observation; they are conditions rather than evidence for a ranking or cache change.

## Enqueue benchmark

The measured duration is the complete public enqueue call: bounded payload preparation plus one database `createMany`. The implementation has no retained phase hook to split those two internal subphases; query-event counts and a safe pool-usage maximum were unavailable in the clean harness.

| Enqueue path | Individual ms | p50 / observed p95 ms | Failures | Outbox rows |
|---|---|---:|---:|---:|
| Cache-hit exposure | 3, 4, 4, 4, 3, 4, 5, 3, 3, 3 | 4 / 5 | 0 | 10 exposures |
| Cache-miss generation + exposure | 7, 4, 4, 6, 4, 4, 4, 6, 4, 4 | 4 / 7 | 0 | 10 generations + 10 exposures |
| Single-flight waiter exposure | 5, 3, 3, 3, 3, 3, 3, 3, 3, 3 | 3 / 5 | 0 | 10 exposures |

The HTTP implementation awaits the outbox enqueue before returning, but never awaits normalized domain materialization. A failed enqueue is caught/logged, the recommendation response remains successful, and the failed exposure receives no impression IDs.

## Request-path write shape

- Cache hit: one exposure outbox row, zero generation outbox rows for the hit, and zero new synchronous generation/request/impression rows. The runtime test also confirms the cached response copy has no impression IDs.
- First cache miss: one generation outbox row plus one exposure outbox row, zero synchronous normalized event rows.
- Same-learner single-flight: one generation outbox row, ten exposure rows, fresh IDs per caller, and one shared generation computation.
- Item count: one outbox row contains an ordered impressions array and one generation row contains a bounded trace array. The HTTP path uses one `createMany` per exposure enqueue, never an insert loop per displayed item.

## Single-flight, cache, and parity evidence

The active same-learner ×10 run produced 1 generation and 10 exposures. Normalized responses had identical item IDs/order after removing optional impression IDs; the active hit and same-flight outputs also matched after normalization. The response-copy test passed while the cached response contained no `recommendationImpressionId`. The enqueue-failure test passed with no IDs and no synchronous domain rows.

## Worker coverage matrix

| Required behavior | Direct test |
|---|---|
| Two workers cannot claim the same row | `claims are bounded and do not overlap across workers` |
| Claim batch limit | `claims are bounded and do not overlap across workers` |
| Future `availableAt` skipped | `future events are skipped and active leases are not stolen` |
| Active lease not stolen | `future events are skipped and active leases are not stolen` |
| Stale lease recovered | `stale processing leases are recoverable` |
| Success marks processed | `successful processing marks the event processed` |
| Retry increments attempts | `retry increments attempts and uses bounded backoff before dead lettering` |
| Retry bounded backoff | `retry increments attempts and uses bounded backoff before dead lettering` |
| Maximum attempts moves to dead | `retry increments attempts and uses bounded backoff before dead lettering` |
| Unsupported schema handled | `unsupported schema and invalid payloads do not materialize` |
| Invalid payload does not materialize | `unsupported schema and invalid payloads do not materialize` |
| Duplicate processing idempotent | `worker materializes generation and exposure idempotently` |
| Generation traces inserted in bulk | `one bad event does not stop the worker loop and materialization remains bulk-shaped` |
| Exposure impressions inserted in bulk | `one bad event does not stop the worker loop and materialization remains bulk-shaped` |
| One bad event does not stop worker loop | `one bad event does not stop the worker loop and materialization remains bulk-shaped` |
| Graceful shutdown stops new claims | `graceful shutdown prevents new claims and disabled defaults do not poll` |
| Worker disabled by default | `graceful shutdown prevents new claims and disabled defaults do not poll` |

The recommendation outbox worker suite passed 11/11 tests. Enqueue failure coverage is `enqueue failure is non-fatal and returns no impression IDs`; Learner Home cache-copy coverage is `Learner Home enqueues bounded outbox exposures without synchronous domain writes`.

## Worker benchmark

The bounded worker run processed 21 events in 3 claim batches with batch size 10. Claim time was 38 ms, materialization time 301 ms, and total measured worker time 339 ms. It materialized 1 generation, 20 requests, 20 impressions, and 1 candidate trace; retries and dead events were zero. Processing was sequential with maximum concurrency 1, no transaction spanned the whole batch, and generation traces/impressions used `createMany`. Queue wait and maximum pool usage were not captured safely.

## Queue state and cleanup

Before cleanup, the worker benchmark had 21 `PROCESSED` events and zero `PENDING`, `PROCESSING`, `RETRY`, or `DEAD` events. After cleanup, all five status counts were zero. Acceptance-only outbox rows, generation/request/impression rows, and temporary benchmark files were removed. No production-like user data was modified.

## Configuration and lifecycle

| Setting | Effective default |
|---|---:|
| Worker enabled | `false` |
| Poll interval | 2,000 ms |
| Batch size | 10 |
| Maximum attempts | 5 |
| Lease duration | 30,000 ms |
| Processing concurrency | 1 sequential operation per worker |
| Retry backoff | 1,000 ms × 2^(attempt−1), capped at 60,000 ms |

Tests do not start an uncontrolled polling loop. `start()` is idempotent, `stop()` clears the timer and awaits the current run, and shutdown stops the worker before Prisma disconnect. Worker startup is opt-in and poll failures are logged by the loop; invalid environment values are rejected by bounded configuration parsing.

## Operational interpretation

Delivery is at-least-once, with idempotent materialization; it is not exactly-once delivery. Action attribution is inactive. Impression IDs are optional and omitted on failed enqueue. The worker must be enabled intentionally. Candidate traces may be truncated by row and payload-size bounds. Retention cleanup is not automated. No production migration or deployment occurred.

## Decision basis

Correctness, bounded write shape, single-flight semantics, idempotent worker behavior, local cache-hit latency, and failure isolation passed. Conditions remain for production-like p95/p99 observation, query/pool telemetry, worker queue monitoring, intentional enablement, and retention operations. The schema and worker are retained if the active request-path strategy is later rejected by production evidence.
