# Recommendation Phase 2E — Normalized Scoring Validation

## Decision

The guarded implementation is correct and remains opt-in. The production default is still `legacy-v1`.

`ADOPT_FEATURE_FLAG_ONLY`

Final acceptance verification passed the correctness, retrieval-parity, cache-miss, cache-hit, and concurrency safety gates. Normalized scoring remains opt-in because the reviewed preferred-learner sections showed no visible top-ranking improvement; the measured benefit is limited to bounded score-only changes in the frozen candidate pools.

## Implementation boundary

Changed production files:

- `apps/backend/src/config/recommendation-scoring-version.ts` — immutable `legacy-v1` / `normalized-interests-v2` registry and validation.
- `apps/backend/src/config/env.ts` — validates `RECOMMENDATION_SCORER_VERSION` using the existing configuration module.
- `apps/backend/src/modules/learner-home/learner-interest-taxonomy.ts` — static reviewed vocabulary and guarded material/project matching.
- `apps/backend/src/modules/learner-home/learner-home.scoring.ts` — explicit scorer-version plumbing for deterministic tests; default calls remain unchanged.
- `apps/backend/src/modules/recommendation-events/recommendation-events.service.ts` — stamps the existing algorithm version as `learner-home-v1:<scorer-version>`.

No repository, candidate query, schema, migration, seed, frontend, API, component, compatibility, or typed-runtime files were changed.

## Runtime model and match semantics

At module initialization, each of the 13 current learner interests receives a frozen, deterministic term list capped at 28 terms. The list contains current canonical search terms followed by only the Phase 2B reviewed English aliases and reviewed Arabic labels/aliases for that same interest. Other concept types are filtered out before terms are built. Terms are normalized and deduplicated once; no per-candidate vocabulary is constructed.

Canonical matching runs first and retains its existing weights: strong content evidence remains 40 and the existing category evidence remains 18. Only when canonical matching misses does normalized mode select the strongest bounded reviewed term and return one custom/weak interest match at the accepted Phase 2D score of 12. Multiple English/Arabic hits still produce one match for that learner interest.

Alias-only reasons are bounded and truthful, for example `Matches your Arduino interest through a reviewed Arabic term`. Raw aliases, numeric scores, taxonomy IDs, descriptions, and learner identifiers are not included in explanations or recommendation event metadata.

## Candidate and score parity

Phase 2D’s frozen retrieval evidence remains the candidate reference: 159 seeded materials, 30 seeded projects, 29 public projects evaluated, and 13 interests. Strategy B changed scoring only.

| Check | Result |
|---|---:|
| Material retrieval additions | 0 |
| Material retrieval removals | 0 |
| Project retrieval additions | 0 |
| Project retrieval removals | 0 |
| Material scoring-only deltas in unchanged production pools | 48 |
| Project scoring-only deltas | 8 |
| Reviewed false positives | 0 |

The raw matcher scan across all 159 seeded material rows found 51 alias-only matches. Three are outside the unchanged production candidate pools (`Denim Offcuts Bundle`, `Small DC Gear Motors Pair (Spare Batch)`, and `Acrylic Paint Leftovers Set (Spare Batch)` for `art_crafts`), so they are not recommendation-output deltas. The accepted candidate-pool result is the Phase 2D reference of 48 materials and 8 projects.

Phase 2D deterministic reference hash: `53654b6d47ff209b17c802232ce71425ba3441a2f4e16310b18259e0ab146712`.

## Cache and version isolation

The scorer version is captured once at process initialization; there is no request-level mode switch. The existing Learner Home cache remains learner-scoped and single-flight. Changing `RECOMMENDATION_SCORER_VERSION` requires a process restart, and restart clears the in-memory cache, preventing a legacy response from being returned as normalized. Existing cache tests continue to cover same-learner single-flight, learner isolation, invalidation, TTL, and failure cleanup.

Generation and exposure metadata distinguish modes through the existing `algorithmVersion` field, for example `learner-home-v1:legacy-v1` and `learner-home-v1:normalized-interests-v2`. No telemetry table or payload schema was added.

## Performance

Read-only microbenchmark over all 159 materials × 13 interests and 29 public projects × 13 interests, with five warm-up iterations and 30 measured iterations:

| Mode | p50 | observed p95 | max |
|---|---:|---:|---:|
| `legacy-v1` | 380.73 ms | 465.08 ms | 472.45 ms |
| `normalized-interests-v2` | 388.95 ms | 510.66 ms | 513.36 ms |

The normalized scorer p95 regression is approximately 9.8%, below the 15% scorer gate. Cache-hit and single-flight behavior are structurally unchanged and the focused cache suite passed.

## Final end-to-end acceptance verification

The final measurements used separate clean Node processes per scorer version against the same local database and the same preferred seeded learner (`majd@learner.com`). The benchmark called the existing Learner Home service directly, so HTTP transport/auth latency was intentionally excluded; service exceptions were captured and telemetry enqueue errors were zero because the direct calls had no request correlation context. Learner Home section calls are uncached by design and are reported as direct section-service timings, not cache hits.

| Full cache miss, 10 controlled invalidations | `legacy-v1` | `normalized-interests-v2` |
|---|---:|---:|
| Individual durations (ms) | 401.23, 349.28, 316.58, 251.57, 260.07, 207.81, 199.08, 280.50, 253.24, 189.24 | 366.64, 291.89, 309.24, 259.67, 280.63, 212.43, 192.05, 257.89, 228.72, 214.58 |
| Median (ms) | 253.24 | 257.89 |
| p95 (ms) | 349.28 | 309.24 |
| Max (ms) | 401.23 | 366.64 |
| Errors / response bytes / total items | 0 / 21,984 / 23 | 0 / 21,984 / 23 |

The normalized p95 limit was `349.28 + max(10%, 15 ms) = 384.21 ms`; normalized p95 was 309.24 ms. Median increased 1.8% and max decreased 8.6%.

Ten warm-cache hits had p95/max of 0.087/0.092 ms for legacy and 0.116/0.156 ms for normalized: a sub-millisecond absolute difference with identical 21,984-byte, 23-item responses. Ten concurrent same-learner calls completed with one stable response signature in each mode; the existing single-flight test (`shares one same-learner miss and caches one complete result`) verifies one fill with shared waiters. Five distinct learner misses had p95 2,276.76 ms legacy versus 2,340.98 ms normalized; ten distinct learner misses had p95 2,428.93 ms legacy versus 1,949.45 ms normalized. Both runs had zero errors.

Representative uncached section timings (three calls per section) were:

| Section | Legacy p50 / p95 / max (ms) | Normalized p50 / p95 / max (ms) |
|---|---:|---:|
| Suggested materials | 154.82 / 154.82 / 188.64 | 164.72 / 164.72 / 237.33 |
| Suggested projects | 211.46 / 211.46 / 211.72 | 216.59 / 216.59 / 299.00 |
| Free materials near you | 154.95 / 154.95 / 160.62 | 187.69 / 187.69 / 224.17 |
| Materials for saved projects | 157.97 / 157.97 / 173.91 | 164.66 / 164.66 / 166.00 |

Query counts were not independently instrumented because doing so would require temporary production instrumentation; structural review found no changed repository, candidate-query, taxonomy-query, schema, migration, seed, or write path. No benchmark files, timing outputs, or generated JSON were created.

## Final ranking, privacy, and observability review

The three preferred seeded learners were reviewed in both clean processes. Suggested materials, saved-project materials, suggested projects, nearby/free materials, saved/continue/popular sections, top-five IDs, scores, ordering, section caps, duplicate behavior, and user-facing explanations were identical between modes. No visible top-section change was found. The 6 direct scorer tests cover default/invalid configuration, deterministic bounded vocabulary, English alias scoring, Arabic alias scoring, canonical-score preservation/no multiplication, and entry-point selection/non-content preservation. The frozen catalog still records 48 material and 8 project score-only deltas with zero retrieval changes.

Alias-only explanations remain generic and bounded; they do not expose raw aliases, taxonomy IDs, descriptions, learner identifiers, or numeric internals. The existing event/outbox contract remains compatible, while generation metadata is exact: `learner-home-v1:legacy-v1` and `learner-home-v1:normalized-interests-v2`. Process restart is required to change mode and clears the in-memory cache, so no legacy/normalized cache mixing was observed. The scorer vocabulary is constructed once at module initialization; no per-request or per-candidate vocabulary instrumentation was added.

## Validation

Passed focused checks:

- normalized mode/version/alias-boundary tests: 6/6;
- learner-interest and Learner Home scoring/taxonomy/cache tests: 31/31;
- recommendation event and outbox tests: 15/15;
- Phase 2D evaluator tests: 3/3;
- full Phase 2D frozen evaluator: 48 material and 8 project scoring-only deltas, zero retrieval deltas.

Backend typecheck remains blocked only by the known unrelated `admin-people.service.ts:52` nullability error; no changed-path type errors were reported.

Component matching remains unchanged and no component normalization, compatibility relation, typed overlap, semantic retrieval, or learned ranking was introduced.

## Activation conditions

Keep `RECOMMENDATION_SCORER_VERSION=legacy-v1`. Normalized mode is safe to retain as an explicit feature flag, but there is insufficient user-visible ranking improvement to justify changing the default. Any future default-change proposal must repeat the frozen 48/8 parity check, paired end-to-end measurements, and bounded explanation/event review.
