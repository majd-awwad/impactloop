# Phase 1B Recommendation Outbox Benchmark

Date: 2026-07-17
Environment: local Windows development database, existing seeded learner dataset
Baseline: preserved Phase 0/Phase 1 synchronous measurements, not rerun in this pass
After harness: temporary direct-service runner, removed after the run; no production query hook was retained.

## Before/after comparison

The earlier synchronous integration is the rejected “before” implementation. The current “after” path enqueues outbox envelopes and does not await normalized generation/request/impression writes. The after latency values are one local run and include warm-up variance.

| Scenario | Before latency evidence (ms) | After latency (ms) | After response bytes | After query events | After outbox rows (generation/exposure) | Request-path bulk enqueue calls | Telemetry errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| Five misses | 1,485 / 1,671 / 1,621 / 1,666 / 3,346 | 1,976 batch | 14,831–23,917 | not captured | 5 / 5 | 5 | 0 |
| Ten hits | 25–47 synchronous | 41 batch | 23,917 | not captured | 1 warm-up / 11 total exposures | 11 | 0 |
| Same learner ×10 | 463–1,109 synchronous | 219 batch | 23,917 | not captured | 1 / 10 | 10 | 0 |
| Five distinct learners | 2,789–2,933 synchronous | 929 batch | 14,831–23,917 | not captured | 5 / 5 | 5 | 0 |
| Ten distinct learners | 3,381–3,744 synchronous | 1,319 batch | 14,778–23,917 | not captured | 10 / 10 | 10 | 0 |

The ten-hit row includes one cache-miss warm-up used to establish the cached envelope; the measured ten callers were hits. The outbox row total therefore includes one generation and one warm-up exposure plus ten measured exposures. “Outbox rows” counts delivery envelopes, not materialized generation/request/impression/trace rows. Each enqueue call uses one bulk `createMany`, never one insert per returned item. Concurrent callers overlap, so batch latency is not a per-caller p95 claim.

The payload carried generation duration metadata of approximately 174–1,956 ms for the five-miss run, 174 ms for same-learner ×10, 623–896 ms for five distinct learners, and 906–1,305 ms for ten distinct learners. These are ranking-computation timings copied into bounded envelopes, not outbox write timings. The clean harness measured zero enqueue telemetry errors.

## Evidence limits and gates

- Query-event counts were not captured because the clean benchmark process used the production Prisma singleton without temporary query-event hooks. The report therefore makes no claim about query-count neutrality; the implementation contains no ranking, candidate, cache-content, section-order, or extra per-item query logic.
- Response bytes stayed at the existing service output sizes in the measured runs; the optional impression IDs are additive and are attached only to the response clone, never to the cached envelope.
- Same-learner correctness passed: ten callers shared one generation and received ten fresh exposure/impression envelopes. The focused runtime and worker tests passed with zero failures.
- The request-path latency gate is evaluated against the rejected synchronous implementation only as context. The asynchronous delivery path removes the awaited domain transaction from the caller critical path, but production tail latency and worker drain time still require production-like observation.

## Conclusion

The synchronous integration remains `REJECT`. The durable outbox implementation passes the local correctness, bounded-payload, one-bulk-enqueue, non-fatal-failure, cache/single-flight, and idempotent-worker gates. Adoption is conditional on production-like latency/tail measurements, pending/retry/dead monitoring, and a controlled worker enablement after migration review.

No temporary benchmark files or production query hooks remain, and no production migration application or commit was performed.
