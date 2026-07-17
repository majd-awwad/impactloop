# Recommendation Events and Attribution Domain

## Semantics

- A generation is one ranking computation. A request is one HTTP recommendation exposure. An impression is one item returned in that exposure. An action is a learner action attributed to an impression.
- The retained domain models support separate generation and exposure semantics for cache hits and same-learner single-flight waiters.
- Candidate traces are limited to the already-loaded Learner Home material/project pools and are capped at 512 rows per generation.

## Runtime status

The normalized event schema and the durable outbox are active in the recommendation read path. Learner Home and section requests enqueue at most one generation event and one exposure event with one bounded `createMany` call; they do not materialize recommendation domain rows synchronously. The worker is opt-in through `RECOMMENDATION_OUTBOX_WORKER_ENABLED` and materializes generation, request, candidate-trace, and impression rows with short idempotent transactions.

Action attribution is active for supported learner actions through the durable action outbox. The request path captures a successful business response, enqueues at most one bounded action envelope, and never inserts a `RecommendationAction` row synchronously. The old awaited synchronous materialization strategy remains rejected historical context.

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

The action envelope supports material view/like, reservation creation, project like/save/follow, and project build start/progress routes. Direct attribution validates learner ownership, entity type and ID, the optional `X-Recommendation-Impression-Id`, and a 24-hour window. The impression’s stored surface is authoritative. When direct attribution is unavailable, the worker selects the latest matching materialized impression by `shownAt DESC, id DESC` and labels the result `ASSISTED`. If neither is valid, no action row is created. A matching pending exposure causes `IMPRESSION_NOT_READY` retry; a foreign or mismatched impression does not retry.

The optional `X-Recommendation-Impression-Id` request header is accepted by CORS. `X-Recommendation-Surface` is not required for action attribution. Action payloads contain only internal IDs, action/entity types, an impression hint, a bounded operation ID, timestamp, event source, and schema version. No request body, names, email addresses, tokens, descriptions, or supplier/private fields are stored.

Currently instrumented learner actions are material view/like, reservation submission, project like/save/follow, and project build start/progress. Project views and supplier-side reservation lifecycle actions are not reliably attributable in this slice.

## Privacy and retention

Events store internal learner/entity IDs, bounded section/source/reason/version metadata, scores, positions, action types, operation IDs, and timestamps. They do not store names, emails, descriptions, search text, profiles, coordinates, tokens, request bodies, or response bodies. Impressions/actions are retained for evaluation; verbose candidate traces are intended for shorter evaluation retention. Cleanup/aggregation automation is deferred.

## Additive response contract

The pre-Phase-1 response shape remains valid. When an exposure event is successfully enqueued, each returned recommendation entity may include an opaque `recommendationImpressionId`; clients that ignore the optional field remain compatible. The identifier is not written into the cache envelope and is omitted when telemetry enqueue fails or when the service is called outside an HTTP request context.

Supported action delivery is at-least-once and idempotent by action outbox ID and stable deduplication key. It is not exactly-once external publication. Enqueue and worker failures are logged and retried/dead-lettered without failing the learner’s already-committed business action. Project views and supplier-side reservation lifecycle actions remain unsupported.

## Data quality

The write path rejects invalid IDs, unknown surfaces/action types, non-positive positions, and non-finite scores. Polymorphic material/project entity references are validated in the event service because PostgreSQL cannot enforce a single foreign key across both tables.
