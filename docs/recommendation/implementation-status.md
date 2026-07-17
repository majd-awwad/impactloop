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
