# Recommendation Events and Attribution Domain

## Semantics

- A generation is one ranking computation. A request is one HTTP recommendation exposure. An impression is one item returned in that exposure. An action is a learner action attributed to an impression.
- The retained domain models support separate generation and exposure semantics for cache hits and same-learner single-flight waiters.
- Candidate traces are limited to the already-loaded Learner Home material/project pools and are capped at 512 rows per generation.

## Runtime status

The schema, migration, event service, bounded-write logic, version registry, and event-domain tests are retained. The synchronous request-path integration is inactive: Learner Home, section requests, and learner action controllers do not call the event service.

No live recommendation exposure or action attribution is currently persisted. The event tables may remain empty until a durable asynchronous delivery strategy is adopted.

## Current baseline

```text
algorithm: deterministic-hybrid
version: learner-home-v1
policy: learner-home-policy-v1
```

The version must change when candidate generation, eligibility, scoring, ranking, section logic, or fallback behavior changes.

## Planned delivery behavior

The retained domain was evaluated with `MISS`, `HIT`, `SINGLE_FLIGHT`, and `UNCACHED` exposure states and one bounded awaited transaction using bulk inserts. That synchronous request-path strategy was rejected because it failed existing Learner Home performance gates. A future durable outbox or another bounded asynchronous delivery strategy must be evaluated before runtime activation. No worker, queue, or outbox is implemented in this phase.

## Attribution

The retained domain defines direct and assisted attribution rules, including learner ownership, entity match, surface match, and a 24-hour window. These rules are not active in live controllers. No attribution headers are currently accepted through the recommendation API contract, and no live action is attributed to a recommendation impression.

Currently instrumented learner actions are material view/like, reservation submission, project like/save/follow, and project build start/progress. Project views and supplier-side reservation lifecycle actions are not reliably attributable in this slice.

## Privacy and retention

Events store internal learner/entity IDs, bounded section/source/reason/version metadata, scores, positions, and timestamps. They do not store names, emails, descriptions, search text, profiles, coordinates, tokens, request bodies, or response bodies. Impressions/actions are retained for evaluation; verbose candidate traces are intended for shorter evaluation retention. Cleanup/aggregation automation is deferred.

## Inactive response contract

Learner Home responses currently contain no `recommendationImpressionId`. The pre-Phase-1 response shape remains active. Impression identifiers must not be added until a delivery strategy is accepted.

## Data quality

The write path rejects invalid IDs, unknown surfaces/action types, non-positive positions, and non-finite scores. Polymorphic material/project entity references are validated in the event service because PostgreSQL cannot enforce a single foreign key across both tables.
