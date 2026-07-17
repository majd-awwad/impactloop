# Recommendation Events and Attribution Domain

## Semantics

- A generation is one ranking computation. A request is one HTTP recommendation exposure. An impression is one item returned in that exposure. An action is a learner action attributed to an impression.
- The retained domain models support separate generation and exposure semantics for cache hits and same-learner single-flight waiters.
- Candidate traces are limited to the already-loaded Learner Home material/project pools and are capped at 512 rows per generation.

## Runtime status

The normalized event schema and the durable outbox are active in the recommendation read path. Learner Home and section requests enqueue at most one generation event and one exposure event with one bounded `createMany` call; they do not materialize recommendation domain rows synchronously. The worker is opt-in through `RECOMMENDATION_OUTBOX_WORKER_ENABLED` and materializes generation, request, candidate-trace, and impression rows with short idempotent transactions.

Action attribution remains inactive in live controllers. The old awaited synchronous materialization strategy was rejected and is retained only as historical decision context; the outbox is the accepted delivery experiment for this phase.

## Current baseline

```text
algorithm: deterministic-hybrid
version: learner-home-v1
policy: learner-home-policy-v1
```

The version must change when candidate generation, eligibility, scoring, ranking, section logic, or fallback behavior changes.

## Outbox delivery behavior

- One ranking computation produces one generation envelope. Cache hits and single-flight waiters reuse that generation but receive a new exposure envelope and fresh opaque impression IDs.
- The request path records `MISS`, `HIT`, `SINGLE_FLIGHT`, or `UNCACHED` in the envelope and returns successfully when enqueue fails; failures are correlated and logged as non-fatal telemetry errors.
- The outbox is at-least-once. A worker claims pending/retry rows with `FOR UPDATE SKIP LOCKED`, leases them, prioritizes generation before exposure, and uses idempotent upserts/create-many writes. Stale leases are recovered; bounded exponential retry ends in `DEAD`.
- Payloads contain IDs, bounded metadata, scores, reason codes, timestamps, and version values only. Generation traces are capped at 512 entries and each envelope is capped at 256 KiB. No request or response body is stored.
- The public response is additive: returned material/project/build entities may carry `recommendationImpressionId` when enqueue succeeds. Cached response envelopes never contain impression IDs.
- The worker is disabled by default for safe deployment ordering. Enqueueing remains non-blocking from the recommendation domain’s perspective; enabling the worker is a separate operational step after migration deployment.

## Attribution

The retained domain defines direct and assisted attribution rules, including learner ownership, entity match, surface match, and a 24-hour window. These rules are not active in live controllers. No attribution headers are currently accepted through the recommendation API contract, and no live action is attributed to a recommendation impression. The outbox phase intentionally does not add action-controller or CORS changes.

Currently instrumented learner actions are material view/like, reservation submission, project like/save/follow, and project build start/progress. Project views and supplier-side reservation lifecycle actions are not reliably attributable in this slice.

## Privacy and retention

Events store internal learner/entity IDs, bounded section/source/reason/version metadata, scores, positions, and timestamps. They do not store names, emails, descriptions, search text, profiles, coordinates, tokens, request bodies, or response bodies. Impressions/actions are retained for evaluation; verbose candidate traces are intended for shorter evaluation retention. Cleanup/aggregation automation is deferred.

## Additive response contract

The pre-Phase-1 response shape remains valid. When an exposure event is successfully enqueued, each returned recommendation entity may include an opaque `recommendationImpressionId`; clients that ignore the optional field remain compatible. The identifier is not written into the cache envelope and is omitted when telemetry enqueue fails or when the service is called outside an HTTP request context.

## Data quality

The write path rejects invalid IDs, unknown surfaces/action types, non-positive positions, and non-finite scores. Polymorphic material/project entity references are validated in the event service because PostgreSQL cannot enforce a single foreign key across both tables.
