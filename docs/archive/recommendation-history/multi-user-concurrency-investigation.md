# Phase 0 — Slice 5 Multi-User Concurrency and Connection-Pool Investigation

Investigation date: 2026-07-17  
Environment: local Windows development environment  
Status: diagnostic complete; no production remediation implemented

## 1. Executive Finding

The different-learner degradation is a confirmed combination of query volume and pool acquisition waiting inside the current uncached Learner Home pipeline. PostgreSQL server saturation is not confirmed. Application-stage work and Prisma/adapter processing are strongly indicated contributors, but Node CPU and database execution were not isolated enough to call application CPU the sole cause.

The clean direct-service run produced these observed sample p95 values: approximately 1,018 ms for five learners, 1,703 ms for ten learners, and 2,856 ms for twenty learners. All requests succeeded. One distinct learner emitted 63 query calls; five, ten, and twenty learners emitted approximately 312, 626, and 1,253 calls respectively. This is approximately 63 query calls per distinct uncached learner.

The temporary pool instrumentation observed a maximum of ten checked-out connections even for one learner. Acquisition p95 increased from 2.6 ms for one learner to 101.1 ms for five and 230.7 ms for ten. Pool waiting was directly observed. PostgreSQL activity showed `ClientRead` waits and no lock waits; these are client-side protocol waits and are not treated as pool-acquisition evidence.

The pool-size matrix did not support increasing the pool. In this local workload, pool size 5 was slightly better than 10 and 15 for the five- and ten-learner batches, but the measurements are not a production recommendation. No pool value should be changed from this slice alone.

## 2. Environment and Pool Configuration

| Item | Observed value |
|---|---|
| Prisma / `@prisma/client` | 7.8.0 |
| `@prisma/adapter-pg` | 7.8.0 |
| `pg` | 8.21.0 |
| PostgreSQL | 18.3 on Windows x86_64 |
| Database URL | `postgresql://<redacted>@127.0.0.1:5433/impactloop?schema=public` |
| URL options | `schema` only; no pool or timeout options |
| Effective pool maximum | 10 |
| Effective pool minimum | 0 |
| Effective pool idle timeout | 10,000 ms from runtime `pg.Pool.options` |
| `pg` client default idle timeout | 30,000 ms; this is not the effective pool idle timeout |
| Connection timeout | unset/disabled (`connect_timeout=0`; runtime pool option unset) |
| Statement timeout | PostgreSQL `0` / unlimited; runtime pool option unset |
| Query timeout | unset/disabled |
| Lock timeout | PostgreSQL `0` / unlimited |
| Idle-in-transaction timeout | PostgreSQL `0` / unlimited |
| PostgreSQL transaction timeout | `0` / unlimited |
| Prisma interactive transaction defaults | `maxWait=2000ms`, `timeout=5000ms` |
| PostgreSQL `max_connections` | 100 |

The application exports one Prisma singleton and constructs one `PrismaPg` adapter per process. One backend listener was present on port 4000 during inspection. `tsx watch` restarts the process and therefore can create a new client/pool for the replacement process; no evidence of multiple in-process Prisma singletons was found. The benchmark itself used a dedicated direct-service process so cache invalidation was exact and authentication/network work was excluded.

## 3. Clean Benchmark

The clean pass used valid existing learners represented only as `L01`–`L20`, no query-event capture, and explicit per-learner cache invalidation before misses. The twenty-user run was allowed because the ten-user run completed without errors and without severe local saturation.

### Individual requests

| Series | Individual request latency (ms) |
|---|---|
| One learner, five misses | `L01`: 358.0, 262.1, 266.2, 231.0, 297.8 |
| Five learners | `L01`: 786.5; `L02`: 887.4; `L03`: 1,018.2; `L04`: 924.5; `L05`: 948.7 |
| Ten learners | `L01`: 1,104.3; `L02`: 1,288.3; `L03`: 1,676.4; `L04`: 1,358.4; `L05`: 1,001.4; `L06`: 1,535.9; `L07`: 1,559.0; `L08`: 1,450.8; `L09`: 1,432.2; `L10`: 1,703.1 |
| Twenty learners | `L01`: 2,238.9; `L02`: 2,034.9; `L03`: 2,823.9; `L04`: 2,566.1; `L05`: 2,549.6; `L06`: 2,071.5; `L07`: 2,855.5; `L08`: 2,755.3; `L09`: 2,386.1; `L10`: 2,486.4; `L11`: 2,115.1; `L12`: 2,340.4; `L13`: 2,415.1; `L14`: 2,432.0; `L15`: 2,623.0; `L16`: 2,457.1; `L17`: 2,742.2; `L18`: 2,658.7; `L19`: 2,900.4; `L20`: 2,836.5 |

### Batch measurements

| Batch | Wall time | p50 | Observed p95 | Throughput | Errors | Node CPU / RSS change | PostgreSQL activity |
|---|---:|---:|---:|---:|---:|---|---|
| One learner, five sequential misses | 1,415.0 ms | 266.2 ms | 358.0 ms | 3.53/s | 0 | not separately retained | `ClientRead` only; detailed pool metrics reported below |
| Five learners | 1,018.8 ms | 924.5 ms | 1,018.2 ms | 4.91/s | 0 | 874 ms CPU; 180.3→191.3 MB | max 10 sessions, 4 active, `ClientRead` |
| Ten learners | 1,703.3 ms | 1,432.2 ms | 1,703.1 ms | 5.87/s | 0 | 1,438 ms CPU; 191.3→199.9 MB | max 10 sessions, 2 active, `ClientRead` |
| Twenty learners | 2,900.6 ms | 2,486.4 ms | 2,855.5 ms | 6.89/s | 0 | 2,140 ms CPU; 199.9→236.8 MB | max 10 sessions, 3 active, `ClientRead` |

The clean run was direct service timing rather than external HTTP capacity testing. PostgreSQL buffer-cache state was not reset. The activity sampler used a separate observer session and excluded that session from reported application sessions.

## 4. Pool Metrics

Detailed instrumentation was run separately from clean timing. It captured adapter `pg.Pool` calls, acquisition completion, release/hold duration, pool counters, and normalized SQL fingerprints without values.

| Batch | Query calls | Query fingerprints | Acquisition p50 | Acquisition p95 | Acquisition max | Hold p95 | Max checked out | Max pool waiting |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| One learner | 63 | 54 | 0.45 ms | 2.61 ms | 3.30 ms | 64.67 ms | 10 | 8 |
| Five learners | 312 | 87 | 33.49 ms | 101.07 ms | 109.47 ms | 149.35 ms | 10 | 86 |
| Ten learners | 626 | 108 | 125.15 ms | 230.68 ms | 233.33 ms | 116.09 ms | 10 | 184 |
| Twenty learners | 1,253 | 112 | 191.86 ms | 261.81 ms | 393.35 ms | 100.57 ms | 10 | 387 |

Acquisition completion timing was directly instrumented around `pg.Pool.connect`; it was not estimated by subtracting SQL time from request time. The increasing acquisition delay and nonzero pool queue establish pool waiting as a real contributor. The pool counters also show that one uncached learner can consume the entire current pool because the service starts several independent read phases concurrently.

## 5. Query Timeline

The existing Learner Home profiler was captured without emitting learner IDs. The logical execution shape is:

```text
Learner interests ───────┐
Saved location ──────────┤
Behavior context ────────┤─ parallel project-context phase
Project pool/context ────┘
                              │
                              └─ material candidate phases
                                 count → relevance/popular/free IDs → hydration → held quantities

After context and candidates:
  ranking / response construction runs in parallel with continue-project and saved-project section construction
```

For one detailed miss, the observed total was about 274 ms after warm-up, with approximately 251 ms in context loading, 121 ms in material candidates, and 116 ms in project context. For the five-user batch, individual logical totals ranged from approximately 847–1,231 ms; material candidates ranged from 506–775 ms and project context from 293–493 ms.

The database-call timeline confirms that logical stages themselves fan out into multiple concurrent Prisma calls. A single request can therefore occupy all ten connections. Multiple learners remain independent after Slice 4, so their 63-call pipelines compete for the same pool and create queued acquisitions. No evidence indicates a single learner monopolizes the pool indefinitely; instead, all learners produce broad concurrent work and share the finite queue.

## 6. PostgreSQL Activity

During five- and ten-user batches:

- application sessions reached the configured pool maximum of ten;
- active PostgreSQL sessions were generally low relative to total sessions;
- observed wait events were `ClientRead`;
- no lock waits were observed;
- no idle-in-transaction sessions were observed;
- database statistics showed very high buffer hits relative to reads;
- temporary-file activity remained zero in the sampled runs;
- PostgreSQL CPU could not be captured reliably from the local Windows process view and is reported as unavailable rather than inferred.

`ClientRead` means PostgreSQL is waiting for the client protocol stream and is not evidence that the application is waiting to acquire a pool connection. Pool acquisition conclusions come only from the direct `pg.Pool.connect` instrumentation and pool `waitingCount`.

PostgreSQL saturation is therefore not confirmed. The available evidence is more consistent with application-side fan-out and pool queueing around many short database operations than with lock contention or sustained server execution saturation.

## 7. Pool-Size Matrix

Each value was applied only to a temporary benchmark process. No tracked production configuration was changed.

| Pool max | Learners | Wall | p50 | p95 | Throughput | Max pool waiting | Max checked out | Max DB sessions | DB CPU | Errors |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|
| 5 | 5 | 1,861.7 ms | 1,027.4 ms | 1,202.1 ms | 2.69/s | 94 | 5 | 5 | unavailable | 0 |
| 5 | 10 | 2,393.7 ms | 1,271.0 ms | 1,602.0 ms | 4.18/s | 195 | 5 | 5 | unavailable | 0 |
| 10 | 5 | 2,527.7 ms | 920.4 ms | 1,061.7 ms | 1.98/s | 82 | 10 | 10 | unavailable | 0 |
| 10 | 10 | 2,490.8 ms | 1,543.2 ms | 1,702.7 ms | 4.01/s | 184 | 10 | 10 | unavailable | 0 |
| 15 | 5 | 2,674.9 ms | 1,213.2 ms | 1,297.7 ms | 1.87/s | 79 | 15 | 15 | unavailable | 0 |
| 15 | 10 | 3,401.8 ms | 1,767.9 ms | 2,085.5 ms | 2.94/s | 182 | 15 | 15 | unavailable | 0 |

The matrix is variable local evidence, not a production recommendation. Increasing the pool to 15 did not improve either required batch and was worse in both p95 comparisons. Pool size 5 was locally favorable for ten learners but still had substantial queueing.

## 8. Confirmed Root Causes

1. **CONFIRMED — Query volume scales with distinct uncached learners.** The current code emits approximately 63 database query calls per learner miss, producing 312, 626, and 1,253 calls for five, ten, and twenty learners.

2. **CONFIRMED — Pool acquisition waiting contributes to concurrency latency.** Direct acquisition timing and positive `waitingCount` were observed, with acquisition p95 increasing materially as concurrent learners increased.

3. **CONFIRMED — A single learner can use the entire current pool.** The maximum checked-out connection count reached ten during a single distinct learner miss.

4. **STRONGLY_INDICATED — Broad parallel stage fan-out and Prisma/adapter processing amplify the cost.** Logical context, material-candidate, and project-context stages dominate the detailed timeline, but exact PostgreSQL execution versus hydration/adapter time is not separately observable.

5. **HYPOTHESIS — PostgreSQL CPU or physical I/O saturation is a primary cause.** No reliable CPU measurement, lock wait, temporary-file spike, or sustained server-side wait evidence was captured.

6. **HYPOTHESIS — Application CPU alone is the primary cause.** Node CPU rises with concurrency, but the measurement includes adapter/runtime work and does not isolate hydration from database/network time.

## 9. Remediation Options

| Option | Expected benefit | Evidence | Risk / correctness impact | Required files | Should implement now? |
|---|---|---|---|---|---|
| Further query-volume reduction and shared request data | Reduce roughly 63 calls per distinct miss and pool queue pressure | Query count scales almost linearly; repeated context/candidate phases are visible | Could change ordering, freshness, or section parity; correctness must be preserved | `learner-home.service.ts`, `learner-home.repository.ts` | No; implement only in a later controlled slice |
| Bounded per-request database concurrency | Prevent one learner from occupying the whole pool and improve fairness | One learner reached ten checked-out connections; queueing rises with batch size | Adds scheduling complexity and may increase single-request latency; must preserve all sections | `learner-home.service.ts` or repository path | No; requires paired fairness/latency test |
| Safe pool adjustment | Could reduce queueing only if database capacity remains available | Pool 15 was worse; pool 5 was locally competitive | Connection pressure and throughput regression; operational configuration change | Runtime deployment/configuration only | No evidence-backed production value |
| Precomputed aggregates | Reduce repeated candidate and interaction reads at larger scale | Current query volume is high, but current data is small and no server saturation was proven | Staleness and invalidation correctness; larger architecture change | Data model/jobs plus Learner Home path | No; premature for this slice |
| Request-context loading changes | Reduce duplicate project/behavior work and hydration | Stage timeline shows repeated broad context loads | Response parity and freshness risks | `learner-home.service.ts`, `learner-home.repository.ts` | No; pair with query-count and response-parity validation |

## 10. Verification Plan

No production remediation was selected for implementation in Slice 5. The next implementation slice, if chosen, must use this paired test:

1. Preserve the same twenty learner aliases, seed state, pool size, PostgreSQL instance, and direct-service workload.
2. Run the clean baseline before the change: one learner plus five misses, then five and ten distinct learners with the same invalidation and simultaneous-start rules.
3. Run the candidate remediation under the same process and pool conditions.
4. Repeat detailed measurement for query count, maximum checked-out connections, acquisition p50/p95, pool waiting, stage durations, response parity, errors, Node CPU/RSS, PostgreSQL activity, and throughput.
5. Accept only if response section keys/item identity remain correct, errors remain zero, query volume or pool waiting improves according to the selected option, and no new unbounded load or fairness regression appears.

## 11. Temporary Instrumentation

The temporary instrumentation in `apps/backend/src/database/prisma.ts` was environment-gated and captured pool options, pool lifecycle counters, acquisition completion, hold duration, and normalized query calls without parameter values. Temporary benchmark code and generated results were placed under `apps/backend/scripts/tmp-phase0-slice5*`.

All temporary instrumentation and benchmark artifacts were removed after the report was created. No service, repository, schema, migration, cache, API, frontend, or recommendation instrumentation change was retained.

## 12. Repository State

Final verification commands:

```text
git status --short
git diff --check
```

The report file is the only new investigation artifact. Existing user changes were preserved, and no commit was created.
