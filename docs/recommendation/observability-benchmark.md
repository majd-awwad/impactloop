# Phase 1 Observability Benchmark

Date: 2026-07-17  
Environment: local Windows development database, existing seeded learner dataset  
Instrumentation: temporary Prisma query-event hook and temporary structured-log sink; both were removed after the run.

## Comparison

The before values are the preserved Phase 0 measurements. Phase 0 did not have recommendation event tables, so event rows, bulk-write count, telemetry errors, and generation/write timing were not available before this phase.

| Scenario | Before latency (ms) | After latency (ms) | After response bytes | After query events | After event rows (G/R/I/T) | Logical bulk writes | Telemetry errors |
|---|---:|---:|---:|---:|---:|---:|---:|
| Five misses | 1,485 / 1,671 / 1,621 / 1,666 / 3,346 | 2,567 / 662 / 515 / 540 / 530 | 23,917 | 71/request | 875 (5/5/115/750) | 20 | 0 |
| Ten hits | 6–13 | 25–47 | 23,917 | 7/request | 391 (1/10/230/150) | 20 | 0 |
| Same learner ×10 | not captured | 463–1,109 | 23,917 | overlapping concurrent hook; not de-overlapped per caller | 391 (1/10/230/150) | 22 | 0 |
| Five distinct learners | not captured | 2,789–2,933 | 14,831–23,917 | overlapping concurrent hook; not de-overlapped per caller | 832 (5/5/101/721) | 20 | 0 |
| Ten distinct learners | not captured | 3,381–3,744 | 14,778–23,917 | overlapping concurrent hook; not de-overlapped per caller | 1,573 (10/10/181/1,372) | 40 | 0 |

`G/R/I/T` means generation, request, impression, and candidate-trace rows. Logical bulk writes count the awaited `create/upsert` or `createMany` operations in the bounded telemetry transaction; it is not a count of individual rows.

The first miss includes local process/database warm-up variance. The same-learner run is the important correctness check: all ten callers shared one generation and each received a separate request plus fresh impressions. A concurrent upsert race found during the first benchmark was fixed with a concurrency-safe upsert retry and rerun with zero telemetry errors.

Generation/write timing from the final sequential run, measured as recommendation-table write query duration, was 36–170 ms for five misses and 5–24 ms for ten hits. Concurrent write timings overlap and are not used as per-caller latency claims.

## Gates and interpretation

- Event persistence was non-fatal in the experiment: the final required scenarios recorded zero telemetry errors.
- Candidate traces stayed bounded at 512 per generation; the observed trace rows are lower because the candidate pools are smaller.
- The benchmark response-size increase was caused by the experimental impression IDs, which are no longer part of the active response contract.

## Conclusion

- Failed gates: the five-miss sample had an observed p95 of 2,567 ms, above the provisional noncached Learner Home p95 gate of 700 ms; the synchronous recommendation write path also added 71 query events per miss and one awaited telemetry transaction per exposure. The event-write query duration was 36–170 ms for misses and 5–24 ms for hits.
- Cache behavior: cache hits did not fail the warm-home 500 ms gate, but regressed from the Phase 0 6–13 ms range to 25–47 ms; misses remained the dominant performance failure.
- Added work: each synchronous exposure materialized generation/request/impression/trace rows in the request path, using bounded bulk writes inside an awaited transaction.
- Rejection reason: the rejected component is synchronous request-path materialization, not the recommendation schema or event-domain model. The request path must not await this work until a durable asynchronous delivery strategy is accepted.

No temporary benchmark files or production query hooks remain, and no production migration application or commit was performed.
