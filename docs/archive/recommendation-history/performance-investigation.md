# ImpactLoop Phase 0 Database Performance Investigation

Investigation date: 2026-07-17  
Environment: local Windows development environment  
Audience: technical reviewers  
Status: investigation complete; no fix, migration, index, cache change, or recommendation instrumentation implemented

## 1. Executive Finding

Learner Home cache misses are reproducibly far above the provisional gates and the frozen baseline: the clean in-process HTTP pass measured 1,485–3,346 ms for five controlled misses, with a separate post-startup miss at 2,618 ms. The existing frozen baseline records 3,922 ms for Learner Home, so the current results are directionally consistent with the prior measurement rather than evidence that the slow baseline was an artifact.

The measured miss path emitted 76–77 Prisma query events per request. The most expensive repeated shape was the material-relevance candidate query, which contains a large OR predicate and repeated category/tag/location relation joins; query-event durations for this shape were approximately 1.3–2.2 s. The same miss also loads broad project, behavior, and material relation graphs in multiple parallel phases. This is sufficient to confirm an uncached, multi-phase candidate-assembly cost. The exact split among PostgreSQL execution, connection acquisition, Prisma hydration, and application work is not directly observable from the available hooks.

Cache hits were 6–13 ms in the clean route pass. Targeted invalidation was verified with the existing invalidation function: invalidating the primary learner produced a 1,714 ms miss-like request while a secondary learner’s subsequent request remained a 12 ms hit.

The investigation did not obtain a real login measurement because no local benchmark password was available. The `/me` route was measured with a locally generated access token, not a token obtained through login; its five measured requests were 13–36 ms after separate warm-up. No conclusion about bcrypt, login query cost, or login’s relation to the Learner Home root cause is therefore confirmed.

## 2. Benchmark Table

All timings are wall-clock milliseconds for the request or direct service call. The clean pass had detailed Prisma query logging disabled. The HTTP harness started the application in-process because no backend listener was present on port 4000; these are not external-backend or production-capacity measurements.

| Series | Exact state and sample | Result | Interpretation against gates |
|---|---|---:|---|
| Frozen before-measurement | Existing `performance-baseline.md` | Learner Home 3,922 ms | Comparison anchor retained; not overwritten |
| Login | Credential check skipped; `PHASE0_PASSWORD` absent | Not measured | No login claim is made |
| `/me` | Two separate warm-ups, then 5 synthetic-token requests | 13, 33, 36, 13, 14; p50 14, p95 36 | Below provisional DB/request thresholds for this route, but not a login-chain result |
| Learner Home post-startup miss | First primary request after in-process app/Prisma startup | 2,618 | Miss; not a true independently restarted external process |
| Learner Home controlled misses | Invalidate primary entry before each of 5 requests | 1,485, 1,671, 1,621, 1,666, 3,346; p50 1,666, sample p95 3,346 | Fails noncached p95 ≤700 ms and warm-home p95 <500 ms when misses are considered separately |
| Learner Home hit | Two separate hit warm-ups, then 10 measured hits | 6–13; approximate p50 10, sample p95 13 | Hit path is fast; cache miss is the dominant user-visible state |
| Direct service benchmark | Existing benchmark script, fresh `tsx` process, no query logging; not HTTP | `getLearnerHome` about 1,686 ms; profiler total about 1,650 ms | Corroborates the miss cost without route/network overhead |
| Learner Home concurrency 1 | Fresh miss, one request | p50/p95 4,457; wall 4,458 | Sample is variable and not a capacity result |
| Learner Home concurrency 5 | Five simultaneous fresh misses | p50 4,206; p95 4,398; wall 4,402; errors 0 | Latency remained high; no HTTP errors |
| Learner Home concurrency 10 | Ten simultaneous fresh misses | p50 7,785; p95 7,963; wall 7,973; errors 0 | Clear degradation under local contention |
| Learner Home concurrency 20 | Twenty simultaneous fresh misses | p50 14,088; p95 15,067; wall 15,080; errors 0 | Severe local latency escalation; not a production capacity claim |

The clean request order was: login credential check (skipped), `/me` warm-up 1, `/me` warm-up 2, `/me` measured 1–5, primary Learner Home post-startup miss, primary controlled misses 1–5 with explicit invalidation before each, primary hit warm-up 1–2, primary hit measured 1–10, secondary learner warm-up, targeted primary invalidation followed by primary request and secondary request, then separate concurrency series at 1, 5, 10, and 20. Login, `/me`, and Learner Home requests from one series were not reused as warm-up for another.

The run used development application code with hot reload/source-map/debug implications possible, although the temporary harnesses set log level to `silent`. Existing Learner Home profiling is development/debug-gated. No external production-style process was available. PostgreSQL buffer-cache state was not reset; the miss results therefore represent a warm application with PostgreSQL cache state potentially cold or warm, not a controlled PostgreSQL cold-cache experiment. The hit results represent a warm application-cache hit.

## 3. Execution Path

### Authentication

The approved authentication path is:

`auth.routes.ts` → `auth.controller.ts` → `auth.service.ts` → `auth.repository.ts`

The login service first loads the user and role/profile graph, performs password comparison, updates last-login state, creates an authentication session/token record, signs tokens, and returns the user summary. Because the benchmark credential was unavailable, these stages were inventory findings only and were not timed as a login request.

The `/me` route was exercised with a locally signed access token. The measured controller/service path loaded the user-with-roles graph after authentication middleware had accepted the token. The middleware’s separate account-status lookup and the login path were not treated as part of the `/me` timing conclusion.

### Learner Home

The approved path is:

`learner-home.routes.ts` → `learner-home.controller.ts` → `learner-home.service.ts` → `learner-home.repository.ts`

On a cache hit, the process-local Learner Home cache returns the stored response immediately. On a miss, the service loads learner context in parallel, loads material and project candidates, computes ranking/continue/saved sections, serializes the response, and stores the result. The repository uses bounded candidate limits, but it requests broad nested relation graphs and repeats several project-interaction and review-loading phases.

The existing `invalidateLearnerHomeCache(userId)` function deletes only the key for the supplied learner. The targeted two-user experiment verified the behavioral consequence without mutating user, material, project, interaction, or reservation data.

## 4. Query Inventory

Query hooks reported normalized SQL text and duration only; parameter values were not captured. The measured miss total was 76 or 77 query events. Exact database result-row counts, database payload size, connection-acquisition time, and Prisma hydration time were not directly observable.

| Owning function/path | Query groups and operation shape | Relation/load behavior | Transaction context and evidence |
|---|---|---|---|
| `loadLearnerBehaviorContext` | Seven parallel root reads for material likes/views, reservations, project saves/likes/follows, and in-progress builds | Nested material/project relations, bounded filters/takes, public-status predicates | Separate parallel Prisma calls; no explicit transaction observed |
| `loadMaterialCandidatesForLearner` | Available-material count; relevance/popular/free candidate-ID reads; optional fallback; material hydration; held-quantity `groupBy` | Material hydration includes tags, category, location, images, supplier/owner, and like counts | Separate parallel phases; relevance ID query is the slowest recurring fingerprint |
| `loadProjectCandidates` | Project pool limited to 120; review summary `groupBy`; liked/saved/followed ID reads | Project pool includes category, tags, required components, and global counts | Separate reads; repeated public interaction joins appear in diagnostics |
| `loadSavedProjectsForLearner` | Saved-project rows, review summaries, and liked/followed IDs | Reuses a broad project include graph | Separate reads; repeated project data is not isolated as a single shared load |
| `loadInProgressBuilds` | In-progress build read limited to 6 | Project/build relation shape is bounded | Separate read; no unbounded load observed |
| `authRepository.findUserByEmailWithRoles` | User-by-email read with roles and learner/supplier profile branches | Includes default pickup location and organization profile branches | Not measured in the login pass because credential was unavailable |
| `/me` user lookup/service path | User identity/status and user-with-roles reads | Role/profile relation graph | Synthetic-token route measurement only |

The query inventory shows batched and bounded phases rather than a confirmed per-item N+1 loop. It does not show that the relation graphs are cheap: 76–77 query events per miss and repeated wide loads are directly measured. HTTP response bodies were approximately 22,410 bytes for one primary miss/hit response and 21,464 bytes for the secondary response; these are response sizes, not database payload-size measurements.

## 5. Query Plan Findings

Only read-only statements were explained using `EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS)`. Plans below were executed against the local database and use safe effective-shaped parameters. The material relevance plan is a representative normalized plan preserving the repeated relation-join shape; it is not byte-for-byte identical to the runtime statement and must not be reported as the exact runtime plan.

| Plan | Plan evidence | Finding |
|---|---|---|
| Representative 28-term material relevance query | Planning 322.144 ms; execution 86.010 ms; 8,665 shared-buffer hits; 28 repeated category joins; repeated material-tag scans; nested-loop joins; final sort over 55 rows | Confirms a deep/wide repeated-join shape. It does not explain the full 1.3–2.2 s Prisma event duration because it is normalized and the hook cannot isolate adapter, connection, hydration, or application time |
| Available-material count and pool order | Sequential scan of 150 material rows, category primary-key lookups, small quicksort; execution about 0.86–0.93 ms | Fast at the current data size; no index proposal supported |
| Material hydration with global likes aggregate | Hash right join over 150 materials and 21 likes; execution about 0.73–1.16 ms | Fast at current size; broad relation hydration remains an application-path concern not isolated by this plan |
| Learner material views/likes | User-index scans and small sorts; execution below 1 ms | No current-plan evidence for an index change |
| Active learner reservations | Sequential scan of 12 rows with two matches; execution about 0.10–0.12 ms | Current table is too small to support an index recommendation |
| Public project saves/likes/follows | User-index access, small project scan, nested loops, small sort; execution about 0.34–0.48 ms | Fast at current data size; no index proposal supported |
| Public project builds | Learner-index access and one-project scan; execution about 0.12–0.32 ms | Fast at current data size |
| Global material/project likes and saves aggregates | Small sequential scans and hash aggregates; execution below 0.1 ms | Not a current bottleneck in the observed dataset |
| Project review summary | Parameterized representative `IN`-list shape; existing project/created-at index used; table currently empty; execution about 0.13–0.15 ms | No evidence for a new index; the plan is representative because the current table has no rows |

The discrepancy between the representative relevance plan’s 86 ms execution and recurring Prisma event durations above 1,300 ms is an evidence boundary, not an unexplained claim of connection waiting or hydration. The two measurements are not the same statement under the same result distribution, and the available hooks do not split the remaining stages safely.

## 6. Confirmed Root Causes

Only the following findings are presented as final root causes.

1. **CONFIRMED — Learner Home cache misses execute an expensive multi-phase candidate-assembly path.** Controlled misses remained 1,485–3,346 ms, while the same process returned cache hits in 6–13 ms. The miss path includes material relevance, material hydration, project candidates, behavior context, ranking, and saved/continue assembly.

2. **CONFIRMED — The miss path performs a high number of Prisma query phases.** Query-level diagnostics captured 76–77 query events per miss, with no evidence of an unbounded per-material or per-project request loop. The confirmed issue is the volume and breadth of the batched phases, not a claimed classic N+1 loop.

3. **CONFIRMED — A repeated-join material relevance operation is on the measured critical path.** The normalized fingerprint recurred as the slowest query event, approximately 1.3–2.2 s in the diagnostic requests, and the source path invokes it during miss candidate selection. The exact fraction attributable to PostgreSQL execution versus other layers is not directly observable.

The concurrency results confirm severe local latency escalation, but they do not by themselves establish a separate database root cause. No connection-exhaustion error occurred, and wait-event counts do not identify connection acquisition.

## 7. Unconfirmed Hypotheses

- **STRONGLY_INDICATED:** Repeated category/tag/location joins in the relevance predicate are causing disproportionate database and adapter work. The representative plan shows 28 repeated relation-join branches and many nested loops, while the runtime fingerprint is repeatedly slow. Exact runtime-plan confirmation with the real parameter set is still needed.
- **STRONGLY_INDICATED:** Broad nested relation graphs and repeated project interaction/review loads add substantial Prisma result processing and application work. Query count, relation shape, and stage timings support this, but Prisma hydration and result payload size are not separately observable.
- **HYPOTHESIS:** Connection-pool acquisition contributes to the concurrency degradation. The observed pool default is 10 and up to 10 sessions had a PostgreSQL wait event during sampling, but the available evidence does not identify pool wait or acquisition duration.
- **HYPOTHESIS:** PostgreSQL buffer-cache state materially explains request-to-request variance. Buffer hits were observed in plans, but the database cache was not reset and no controlled cold/warm cache comparison was available.
- **HYPOTHESIS:** Login latency is dominated by bcrypt or the full role/profile graph. The credential was absent, so neither component was measured.
- **HYPOTHESIS:** A missing composite index is the primary Learner Home cause. Current plans for the interaction tables and current-size candidate scans were fast; no exact measured plan supports an index change.

## 8. Minimal Fix Plan

This is a proposal for a later implementation phase. No item below was implemented during Phase 0.

1. **Reduce the material relevance query shape** in `learner-home.repository.ts`, especially `loadMaterialCandidatesForLearner` and its relevance predicate construction. Preserve relevance semantics while avoiding repeated relation joins where possible, and ensure filtering and limiting occur before broad hydration. Expected benefit: highest potential reduction in miss latency. Main risks: search/relevance correctness and ranking regressions. Verify with exact request fixtures and PostgreSQL plans.

2. **Narrow material and project relation selections** in `learner-home.repository.ts` (`materialPoolSelect`, `projectPoolInclude`, and behavior selections) to fields actually needed by scoring and response serialization. Expected benefit: lower query count/width and less result processing. Main risks: missing fields in ranking or response sections. Verify serialized responses and ranking parity.

3. **Remove repeated project interaction graph loads** across `loadLearnerBehaviorContext`, `loadProjectCandidates`, and `loadSavedProjectsForLearner` where a single bounded read can safely serve the same request. Expected benefit: fewer repeated phases and less contention under concurrency. Main risks: changed timing/order semantics and stale assumptions between sections. Verify section-level output and query-count reduction.

4. **Re-measure pool behavior before changing pool configuration.** The current run does not confirm connection acquisition as a root cause. Any pool adjustment should wait for a direct pool-wait measurement in a production-like process and must be evaluated for database connection pressure.

No login change is proposed from this evidence because login was not measured with credentials.

## 9. Proposed Indexes

**None confirmed and no index should be added from this investigation.** The read-only plans for material interaction, reservations, project interactions, builds, candidate scans, and current-size aggregates were fast on the measured database. The relevance plan’s repeated-join shape is not supported by an exact index recommendation, particularly because the executed plan was representative rather than byte-for-byte runtime SQL.

Potential composite-index ideas may be revisited only after the exact runtime statements, effective parameter distributions, and larger representative data are captured. They are intentionally not proposed as Phase 0 changes.

## 10. Verification Plan

The next implementation/verification cycle should preserve the same frozen baseline and provisional gates rather than lowering targets to match the slow result.

1. Run the clean pass first with detailed Prisma query logging disabled, using a real local benchmark credential supplied only through environment variables. Run login as cold Node/Prisma process, separate login warm-up, and five measured warm requests; then run `/me` with its own warm-up and five measured requests.

2. Run Learner Home in the recorded order: post-restart miss, five misses using only `invalidateLearnerHomeCache(userId)`, separate hit warm-up, and ten hit measurements. Record whether the PostgreSQL cache was controlled; otherwise label it potentially cold or warm.

3. Repeat diagnostics separately: application-stage instrumentation with query logging disabled, then query-level instrumentation. Report instrumentation overhead only from a controlled paired comparison; do not compare an instrumented duration directly with the clean baseline.

4. Capture exact runtime SQL fingerprints and read-only plans with effective parameters. For large `IN` lists or multiple relation phases, label plans exact or representative. Use PostgreSQL plans for rows examined, actual rows, joins, sorts, and buffers; retain `not directly observable` for connection acquisition, Prisma hydration, and database payload size unless independently measured.

5. Repeat bounded concurrency at 1, 5, 10, and 20 only while the local environment remains stable. Stop on errors, connection exhaustion, or severe resource saturation. Report throughput, sample p50/p95, errors, pool observations, CPU, and memory; do not convert the local result into a production capacity claim.

Acceptance remains anchored to both the frozen baseline and the documented provisional gates:

- recommendation p50 <100 ms, p95 <250 ms, p99 <500 ms;
- warm Learner Home p95 <500 ms;
- individual database query generally <200 ms;
- noncached Learner Home provisional p95 ≤700 ms;
- no unexplained query >300 ms;
- no unbounded candidate relation loads;
- no catastrophic degradation under bounded concurrency.

If later evidence shows a gate is unrealistic for the required data volume, propose target revision separately with workload and plan evidence; do not weaken the gate during remediation.

## 11. Files Inspected

The eight authorized direct production modules were inspected:

- `apps/backend/src/modules/auth/auth.routes.ts`
- `apps/backend/src/modules/auth/auth.controller.ts`
- `apps/backend/src/modules/auth/auth.service.ts`
- `apps/backend/src/modules/auth/auth.repository.ts`
- `apps/backend/src/modules/learner-home/learner-home.routes.ts`
- `apps/backend/src/modules/learner-home/learner-home.controller.ts`
- `apps/backend/src/modules/learner-home/learner-home.service.ts`
- `apps/backend/src/modules/learner-home/learner-home.repository.ts`

Configuration/schema/runtime evidence inspected without counting toward the production-module gate included the Prisma configuration, environment/configuration definitions, server/app startup files, package manifests, the Prisma schema, and the existing benchmark script. A planning pass also read the authentication middleware and a small number of directly referenced support modules to establish the already-measured `/me` execution path and relation limits; none was modified, and no additional production module was required for the diagnostic harness. This disclosure is intentional because the scope amendment distinguishes production-file inspection from configuration/schema/harness work.

The existing untracked `docs/recommendation/performance-baseline.md` was preserved and not overwritten.

## 12. Temporary Instrumentation

The temporary Prisma query-event hook was added only to `apps/backend/src/database/prisma.ts`, emitted normalized SQL without parameter values, and was removed before this report was finalized. The temporary clean, diagnostic, explain, concurrency, runtime, and targeted-invalidation harnesses under `apps/backend/scripts/tmp-phase0-*.ts` were removed. The existing development Learner Home profiler was not modified.

Final repository-state evidence after cleanup and report creation:

```text
?? docs/recommendation/performance-baseline.md
?? docs/recommendation/performance-investigation.md
```

There are no remaining temporary production instrumentation changes, no temporary Phase 0 harness files, and no commit was created.
