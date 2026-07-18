## Phase 0 — Learner Home Performance

### Slice 1: Material relevance candidate query

Status: ADOPT_WITH_CONDITIONS

Implemented:
- Consolidated repeated material title/type, tag, category, and location predicates.
- Added deterministic ID tie-breaking.
- Preserved candidate set, eligibility, ranking, hydration, and response behavior.

Measured results:
- Material candidate load median: 1,374ms → 219ms.
- Learner Home miss median: 1,795ms → 402ms.
- Relevance SQL event: approximately 1.3–2.2s → 67–100ms.
- Representative shared-buffer hits: 8,665 → 41.
- Query events per miss: 76–77 → 76.

Validation:
- Candidate IDs remained identical for the frozen benchmark learner.
- 97 Learner Home tests passed.
- Build remains blocked by a pre-existing unrelated admin-people TypeScript error.

Remaining:
- Broad material/project hydration.
- Repeated project and behavior reads.
- Cold-miss concurrency degradation.
- Login performance investigation.

### Slice 2: Narrow Learner Home hydration

Status: ADOPT_WITH_CONDITIONS

Implemented:
- Replaced broad project candidate and saved-project includes with typed Learner Home selects.
- Narrowed continue-project builds to build progress, reservation status, and required-component display fields.
- Removed unused continue-project linked-material hydration.
- Split saved-project behavior hydration from liked, followed, and in-progress project behavior hydration.
- Preserved material hydration, candidate pools, eligibility, scoring, reasons, ordering, cache behavior, and public response shape.

Validation:
- Focused Learner Home tests: 97 passed.
- Seeded `majd@learner.com` response section keys and item IDs remained identical across five post-change cache misses.
- Response size remained stable at approximately 22,353 bytes across those five misses.
- Existing benchmark request: 926 ms before → 633 ms after in paired local runs.
- Existing suggested-material section benchmark: 272 ms before → 253 ms after.
- Post-change miss samples: 1,142, 311, 252, 210, 171 ms; median 252 ms; observed sample p95 1,142 ms.
- Post-change bounded concurrency p95: 201 ms at 1, 1,132 ms at 5, and 1,884 ms at 10.
- No errors occurred in the bounded concurrency run.

Evidence limits:
- Query-event counts, raw Prisma hydration bytes, and nested database record counts were not independently captured because the available Prisma client is not configured with query-event logging; response bytes are not database payload bytes.
- Full backend test execution exceeded the local three-minute validation window after unrelated integration suites; no changed-path failure was reported.
- Global typecheck remains blocked only by the pre-existing `admin-people.service.ts` nullability error.

Remaining:
- Repeated project and behavior query phases remain for Slice 3.
- Query consolidation, cache single-flight, pool tuning, and other out-of-scope changes remain deferred.

### Slice 3: Consolidate repeated project and behavior reads

Status: ADOPT_WITH_CONDITIONS

Confirmed:
- Prisma query events per cache miss decreased from 76–77 to 63.
- Saved projects, likes, follows, review summaries, and bounded build data are reused within the request.
- Seeded response parity passed.
- 98 Learner Home tests passed.
- Response size remained approximately 22,353 bytes.

Observed performance:
- Cache-miss samples: 1505, 355, 321, 278, 263ms.
- Median: 321ms.
- Observed sample p95: 1505ms.
- Concurrency p95: 223ms at 1, 1130ms at 5, and 2710ms at 10.
- Slice 3 did not demonstrate a stable latency improvement; its confirmed benefit is query-count reduction.

Remaining:
- Concurrent identical cache misses still duplicate the full request pipeline.
- General multi-user concurrency and connection-pool behavior remain unresolved.
- Login performance remains unmeasured.

### Slice 4: Per-learner cache-miss single-flight

Status: ADOPT_WITH_CONDITIONS

Confirmed:
- Simultaneous misses for the same learner execute one uncached pipeline.
- Same-learner batches of 1, 5, and 10 each emitted approximately 63 query events and one pipeline invocation.
- Different learners remain independent and execute one pipeline per learner.
- In-flight and generation metadata are removed after completion.
- Invalidation during flight does not allow a stale computation to repopulate the cache.
- Failure cleanup and retry behavior are covered.
- 104 Learner Home tests and 32 related invalidation tests passed.

Observed performance:
- Same-learner batches: 1071ms at 1, 275ms at 5, and 238ms at 10.
- These values were not collected as a controlled paired benchmark and were affected by warm-up state.
- Different-learner p95: 846ms at 5 learners and 1388ms at 10 learners.
- Different-user concurrency remains a performance concern.

Remaining:
- Approximately 63 queries are still executed for every distinct uncached learner.
- General multi-user concurrency and connection-pool behavior require isolated investigation.
- Login performance remains unmeasured.

## Phase 1 — Recommendation Observability

### Data model and event domain

Status: ADOPT_WITH_CONDITIONS

Retained:
- generation, exposure/request, candidate trace, impression, and action models;
- migration and supporting indexes;
- algorithm/version registry;
- bounded trace and attribution domain logic;
- focused event-domain tests.

The models are retained for an asynchronous or durable delivery experiment. The migration was applied locally and must not be edited for this status change.

### Awaited synchronous runtime integration

Status: REJECT

Reason:
- synchronous telemetry did not pass existing Learner Home performance gates;
- the request path must not await generation/request/impression/action materialization;
- all active synchronous runtime wiring was removed.

Historical next step:
- evaluate a durable outbox or another bounded asynchronous delivery strategy. This was addressed by Phase 1B below.
- action attribution remains deferred until impressions are persisted reliably.

Historical synchronous contract:
- Learner Home and section requests performed zero normalized recommendation-event writes;
- cache hits performed zero normalized recommendation-event writes;
- responses contained no recommendation impression identifiers;
- action controllers do not inspect recommendation attribution headers;
- the recommendation attribution headers are not enabled through CORS.

Scope limitations retained in the domain:
- project views and supplier-side reservation lifecycle transitions remain unsupported for live attribution;
- no ranking, candidate, section, cache-content, or Learner Home UI behavior changes are active;
- no action-attribution delivery, dashboard, taxonomy, or learned recommender is implemented.

### Phase 1B — Durable outbox delivery

Status: ADOPT_WITH_CONDITIONS

Implemented within the scoped production files:
- `RecommendationEventOutbox` enum/table migration with unique deduplication key and status/lease/availability indexes;
- bounded generation and exposure payload builders using `recommendation-generation-outbox-v1` and `recommendation-exposure-outbox-v1`;
- one request-path `createMany` enqueue operation per HTTP caller, with no per-item writes and non-fatal telemetry failure handling;
- opt-in worker with `SKIP LOCKED` claims, generation-before-exposure ordering, lease recovery, bounded retry/dead-letter state, payload validation, and idempotent short materialization transactions;
- Learner Home full and section exposure envelopes, cache/single-flight semantics, fresh exposure/impression IDs, and additive response fields outside the cache envelope.

Validation:
- Prisma schema validation, client generation, and local migration deployment passed;
- focused recommendation event/outbox tests: 11 worker tests passed, with retained event-domain coverage;
- Learner Home outbox runtime test: 1 passed;
- local outbox benchmark covered five misses, ten hits, same-learner ×10, five distinct learners, and ten distinct learners with zero telemetry errors;
- final acceptance evidence is recorded in `phase-1b-final-acceptance.md`;
- global typecheck remains blocked only by the pre-existing `admin-people.service.ts` nullability error.

Conditions:
- worker enablement remains disabled by default and requires migration review, queue-depth/dead-letter monitoring, and production-like tail-latency/drain measurements;

### Phase 1D — Flutter impression propagation

Status: ADOPT_WITH_CONDITIONS

Implemented:
- optional `recommendationImpressionId` fields on the existing material and project models and API mappers;
- item-scoped Learner Home card-to-detail-to-action propagation through transient GoRouter route extras;
- optional `X-Recommendation-Impression-Id` headers on supported material, project, reservation, and build actions;
- null/blank omission, no `X-Recommendation-Surface`, no persistent storage, and no global request interceptor;
- focused mapper and Dio-interceptor tests for context propagation, body preservation, and isolation.

Conditions and limitations:
- direct deep links and app restarts have no recommendation context by design;
- project views and supplier-side reservation lifecycle actions remain unsupported;
- the Flutter client does not perform attribution validation; the backend remains the authority for ownership, entity, surface, and time-window checks;
- focused propagation, mapper, and affected learner-flow checks passed 128/128 after the final scope hardening; an aggregate repository-wide run reported 8 pre-existing failures, while isolated reproduction deterministically reproduced 6 across admin/supplier UI expectations and the registration-draft `toJson` compilation failure;
- full analysis was time-limited locally, while targeted analysis over all changed Flutter domains reported no issues;
- final adoption remains conditional on the known repository-wide test/typecheck baseline being resolved separately.

Evidence: `phase-1d-validation.md`.
- query-event counts were not independently captured in the clean benchmark harness;
- action attribution, recommendation headers/CORS, project views, and supplier-side reservation lifecycle actions remain unsupported;
- no production migration application or commit was performed.

### Slice 6: Request-scoped database fan-out limiter

Status: REJECT

Findings:
- Caps 2, 3, 4, and 5 were evaluated against the unbounded baseline.
- Cap 2 materially reduced connection-acquisition waiting but did not improve end-to-end batch latency.
- Other caps failed single-user or multi-user latency gates.
- Query volume remained unchanged.
- No cap demonstrated a sufficient balance of latency, throughput, and complexity.
- The production scheduler implementation was removed.
- Existing unbounded behavior was preserved.

Decision:
Do not add a request-scoped database limiter.
Do not increase the pool size based on current evidence.
Revisit multi-user cold-miss performance only with production-like telemetry or after a future reduction in total query volume.

## Phase 1C — Durable action attribution

Status: ADOPT_WITH_CONDITIONS

Implemented:
- Additive action enum values and `RECOMMENDATION_ACTION` outbox event migration;
- successful-response capture for supported learner material, reservation, project, and project-build actions;
- bounded action payloads with stable deduplication, optional impression hint, and no request-body storage;
- worker-side direct ownership/entity/window validation, pending-exposure retry, deterministic assisted attribution, and idempotent action upsert;
- optional CORS allowance for `X-Recommendation-Impression-Id`;
- focused tests for bulk enqueue, no synchronous action row, direct/assisted/foreign attribution, race retry, and idempotent redelivery.

Conditions:
- keep the worker disabled until migration deployment, queue-depth/dead-letter monitoring, and production-like drain/tail-latency evidence are available;
- action delivery is at-least-once and asynchronous, not exactly-once external publication;
- project views, supplier-side reservation lifecycle actions, historical backfill, and unsupported action routes remain out of scope;
- the local validation database was migrated for testing only; no production migration application or commit was performed.

## Phase 2B — Typed Taxonomy Foundation

Status: ADOPT_WITH_CONDITIONS

Implemented as an inactive, additive foundation:

- five globally prefixed concept types: interest, material family, material form, project topic, and component;
- 74 reviewed concepts and 189 bilingual aliases with deterministic normalization;
- explicit learner-interest, material, project, and required-component mapping tables;
- read-only alias/entity resolution with active-status filtering, ambiguity reporting, and a 500-ID bounded load limit;
- idempotent exact-rule backfill from the frozen seed vocabulary;
- additive migration `20260718120000_add_typed_taxonomy_foundation` and standalone `scripts/seed-taxonomy.ts` command.

Validation:

- local migration deployment passed;
- first backfill inserted 74 concepts, 189 aliases, 13 learner-interest rows, 228 material rows, 30 project rows, and 56 component rows;
- second backfill inserted zero duplicate aliases or mapping rows;
- same-type alias collisions: 0; explicit cross-type collisions: 37;
- mapped local coverage: 199/199 materials, 30/30 projects, and 56/117 required components; comparable seeded-material coverage is 159/159;
- focused taxonomy tests: 5/5 passed;
- local alias lookup p95: 5.82 ms; bounded mapping load p95: 81.92 ms over 30 iterations.

Conditions:

- current recommendation behavior, frontend/API behavior, scoring, ranking, and candidate generation do not read the foundation;
- compatibility edges and transitive closure remain deferred;
- the 61 unmapped required components require vocabulary review before activation;
- repository-wide typecheck remains blocked by the pre-existing `admin-people.service.ts:52` nullability error.

Evidence: `taxonomy.md`, `taxonomy-shadow-dataset.json`, and `phase-2b-validation.md`.

Final acceptance verification:

- the comparable Phase 2A database slice is 159 seeded materials (150 primary plus 9 workflow copies); the current local count is 199 because 40 clearly named test materials remain from three test supplier groups;
- three consecutive backfill runs inserted zero duplicate rows, preserved all existing content/display fields and learner-interest arrays, and kept canonical IDs stable;
- role-level component coverage is 36/64 required material, 9/32 optional material, 11/19 consumable, and 0/2 tool rows;
- the active Learner Home/recommendation paths have no import or query dependency on the typed taxonomy foundation;
- the shadow JSON is a deterministic contract fixture only, not a relevance or quality dataset.
