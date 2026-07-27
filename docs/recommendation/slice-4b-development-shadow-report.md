# Slice 4B — End-to-End Development Shadow Validation

## 1. Decision

`SLICE_4B_DEVELOPMENT_SHADOW_BLOCKED`.

The local shadow path is operational, response-safe, cached, private, and within the isolated material latency targets. Progression is blocked because coherent recent material likes did not change the live shadow Top 5, runtime taxonomy/component feature coverage is absent, and material views do not currently invalidate the learner-home cache.

## 2. Environment and flags

Validation ran through Windows Node against the local development backend/database while the Ubuntu environment continued to own the offline model artifacts. The process-only test override enabled ML shadow execution. Tracked defaults remain:

```text
RECOMMENDATION_ML_SHADOW_ENABLED=false
RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED=false
RECOMMENDATION_ML_PROJECT_SERVING_ENABLED=false
```

Both serving flags stayed false during every run. No response ordering was delegated to ML.

## 3. Artifact validation

Both ignored Benchmark A artifacts loaded successfully with domain, schema, dimensions, finite-value, logical-content hash, frozen catalog snapshot hash, training dataset hash, and domain mapping hash validation. Benchmark B markers, identity features, material type, hidden intent, and cohort features remain prohibited.

Failure cases for missing files, corrupt hashes, malformed dimensions, unsupported schemas, wrong domains, non-finite values, duplicate features, and prohibited features returned bounded fallbacks. Removing a copied artifact after its first successful load did not affect the cached immutable model and did not trigger a reparse.

## 4. Test-case coverage

Six existing local learner accounts were selected without reporting credentials or identifiers and assigned privacy-safe labels:

- `case_profile_only`
- `case_no_interests`
- `case_recent_material_behavior`
- `case_project_driven`
- `case_mixed_behavior`
- `case_recent_and_stale`

Only aggregate counts and namespaced diagnostic hashes appear in test output. No names, emails, credentials, tokens, phone numbers, or raw user identifiers appear in the Slice 4B diagnostic payload.

## 5. Response invariance

For all six cases, a complete uncached learner-home payload with shadow disabled was compared to the corresponding uncached payload with shadow enabled. Section order, item identifiers/order, explanations, empty states, counts, and every serialized response field were identical.

```text
6/6 complete payloads identical
visible response changes = 0
```

The shadow service continued returning the exact deterministic response object. Serving remained disabled.

## 6. Runtime feature coverage

Aggregate development coverage from the isolated final run:

| Feature | Materials | Projects |
|---|---:|---:|
| Category/topic | 100% | 100% |
| Taxonomy concepts | 0% | 0% |
| Condition | 99.83% | n/a |
| Free/paid | 99.83% | n/a |
| Pickup | 99.83% | n/a |
| Delivery | 99.83% | n/a |
| Difficulty | n/a | 100% |
| Component concepts | n/a | 0% |
| Average active item features | 4.99 | 2.00 |
| Average active user features | 0.54 | 0.35 |

Among 24 material scoring observations, 11 had zero mapped user features. Among 20 project observations, 13 had zero mapped user features. Runtime user input currently supplies mapped long-term interests only; free/paid preference, pickup/delivery preference, activity band, and project-tendency metadata are not available in the learner-home shadow input. Values were not fabricated.

The missing taxonomy/component context prevents the project-driven channel from raising related material concepts in the actual request lifecycle.

## 7. Query-count comparison

ML-specific database-query delta was zero. The shadow modules import no database client and consume only the already-loaded learner-home context. Disabled shadow returns before artifact or scorer work. The existing consolidated behavior reads remain bounded at `30/50/30/20/20/20/10` rows for likes, views, reservations, saves, project likes, follows, and builds. Candidate scoring is in-memory and bounded to 200 items; there is no per-candidate query or N+1 path.

The final request comparison used the same learner-home retrieval path for disabled and enabled runs. No new query, table, schema, or persistent diagnostic write was introduced.

## 8. Shadow divergence

Across the isolated run:

| Diagnostic | Materials | Projects |
|---|---:|---:|
| Observations | 24 | 20 |
| Candidate range | 1–120 | 29 |
| Average Top-5 overlap | 45.83% | 7.00% |
| Average Top-10 overlap | 41.88% | 15.25% |
| Recent channel applied | 37.5% | 35.0% |
| Average recent rows loaded | 7.83 | 9.30 |

Top lists in diagnostics use 16-character namespaced hashes, not raw catalog identifiers or titles. Project divergence remains descriptive only and is not interpreted as quality due to the 29-item saturation warning and missing concept features.

## 9. Recent-behavior scenarios

The accepted deterministic fixture suite continues to verify views, like strength, reversals, repeated-view caps, strong actions, future-event rejection, and four-day decay. The local lifecycle additionally used three reversible same-category likes:

- One isolated like did not change the material Top 5, which is consistent with noise resistance.
- Three coherent likes were loaded, applied to the recent channel, and caused fresh shadow passes, but still did not change the material Top 5.
- All test likes were removed and a zero-row cleanup assertion passed.

Consequently, profile-only and noise-resistance mechanics are operational, but coherent recent intent and preference-shift visibility are not demonstrated. Project-driven material relevance cannot be demonstrated because runtime component-concept coverage is zero.

## 10. Cache invalidation

Material like and unlike services invalidated learner-home cache successfully: each immediate next request performed a fresh material and project shadow pass and observed updated recent context. Artifact parsing remained cached.

Material detail views currently record behavior without calling learner-home cache invalidation. Therefore a new view can remain invisible to shadow scoring until another invalidation or cache expiry. This is an exact lifecycle gap. The smallest follow-up is targeted `invalidateLearnerHomeCache(viewerId)` after a newly recorded authenticated view, with a focused cache test; it was not applied in this validation slice.

## 11. Failure injection

Validated fail-safe cases include missing artifact, removed-after-cache artifact, corrupt hash, malformed dimensions, unsupported schema, candidate-set mismatch, duplicate candidates, over-200 candidate budget, invalid evaluation timestamp/scorer exception, invalid event timestamp, and future event timestamp. Each returned or preserved the deterministic response. Invalid/future events contributed zero recent evidence. Rejected artifact promises remain cached, preventing repeated parse/retry loops until explicit cache reset.

No explicit asynchronous scorer timeout is required for the bounded synchronous in-process scorer; the 200-candidate bound is its execution budget. There is no network or subprocess to hang.

## 12. Performance

Isolated final run after normal application warm-up:

| Measurement | Result |
|---|---:|
| Cold artifact request | 78.20 ms total |
| Shadow disabled request p50 / p95 | 88.33 / 109.89 ms |
| Shadow enabled warm request p50 / p95 | 77.93 / 103.24 ms |
| Paired incremental p50 / p95 | -6.64 / 1.38 ms |
| Material scorer p95 | 4.74 ms |
| Project scorer p95 | 23.57 ms |
| ML query-count delta | 0 |

The material scorer meets the 15 ms p95 target and the isolated complete-request increment meets the 25 ms target. A concurrent multi-file test run produced a noisy 54.88 ms paired p95 while database-heavy tests ran in parallel; the isolated controlled benchmark is the acceptance measurement. Project scoring remains shadow-only and its higher p95 reinforces the cautious project boundary.

## 13. Diagnostics and privacy audit

The shadow diagnostics now expose aggregate status, domain, artifact version, candidate count, overlap, bounded rank correlation, recent-row/evidence counts, feature coverage, missing-feature count, scorer duration, fallback category, and privacy-safe Top-5 hashes. Test-only observers and cache counters are in-memory only.

A prohibited-key scan rejects diagnostic output containing email, display name, password, phone, or user-ID fields. Embeddings, raw feature vectors, full histories, titles, and descriptions are not logged.

## 14. Project shadow status

Projects remain `SHADOW_EVALUATION_ONLY`; project serving stayed disabled. The real local candidate universe contained 29 projects. The small-catalog saturation warning, weak evidence warning, zero concept/component runtime coverage, low overlap, and higher scorer p95 all remain material limitations. No broad project query or coupling was added.

## 15. Artifact-deployment limitation

Portable serving artifacts remain ignored and local. A later separately approved deployment design must define reviewed storage, release/version linkage, startup availability checks, rollback, catalog/training/mapping hash pinning, artifact promotion ownership, and retention. Slice 4B does not track or distribute model JSON.

## 16. Files changed

- Extended the existing artifact loader with pinned Benchmark A snapshot/training/mapping validation.
- Extended the existing shadow service with privacy-safe feature/divergence diagnostics and test-only cache observation.
- Added one bounded learner-home shadow E2E/benchmark test.
- Added this report.

No new production module, API field, Prisma file, migration, seed, model, or deployment artifact was added.

## 17. Repository state

The pre-existing dirty worktree and unrelated CRLF/trailing-whitespace noise remain untouched. Benchmark A frozen hashes still match. Generated artifacts remain ignored, Benchmark B is absent from runtime artifacts, no serving flag default changed, and no commit was created. The controlled like rows were explicitly reverted and verified absent.

Verification:

- Ubuntu ML tests: 65 passed.
- Isolated Slice 4B E2E: 1 passed.
- Slice 4A scorer/parity tests: 7 passed in the focused run.
- Learner-home regression tests: 16 passed; the combined run's only failure was the deliberately measured concurrent latency assertion, removed in favor of isolated benchmarking.
- Repository-wide TypeScript check remains blocked by the unrelated pre-existing nullable `location` error in `admin-people.service.ts:52`; Slice 4B files produced no TypeScript errors.

## 18. Known limitations

- Coherent recent likes did not alter live material Top 5.
- Authenticated material views do not invalidate learner-home cache.
- Runtime taxonomy and component concepts are absent.
- Many local cases map no user features; only interest/category matching is currently wired.
- Current Top-K aggregation can contain the same entity across multiple learner-home sections, which limits rank-correlation interpretation.
- Project shadow latency and divergence are not suitable for serving conclusions.
- Local demo-account evidence is operational validation, not real-user quality evidence.

## 19. Slice decision

Response invariance, artifact validation/cache, bounded reads, privacy, failure fallback, serving-disabled guarantees, and isolated material latency pass. The acceptance gate nevertheless requires recent behavior to affect live shadow ordering and cache invalidation to expose new behavior reliably. Coherent recent likes did not change Top 5, project/material concept metadata is unavailable, and views can remain cache-stale. No tuning or serving change was made to conceal these findings.

`SLICE_4B_DEVELOPMENT_SHADOW_BLOCKED`
