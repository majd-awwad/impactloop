# Slice 4C — Runtime Feature Alignment and Recent-Intent Effectiveness

## 1. Decision

Runtime feature alignment, concept hydration, targeted view invalidation, response invariance, and performance pass. Slice 4C remains blocked because the valid fixed-35% preference-shift case does not change material Top 5, and the real catalog contains no overlap between project required-component concepts and eligible material concepts.

## 2. Feature-source contract

| Feature | Offline source | Runtime source | Available? | Exact mapping? | Action |
|---|---|---|---:|---:|---|
| Long-term interests | Synthetic persona primary/secondary category keys | Persisted learner interest labels mapped to namespaced category hash | Yes | Yes in v2, equal weight | `DERIVE_WITH_EXACT_OFFLINE_RUNTIME_PARITY` |
| Free/paid preference | Synthetic persona scalar bucket | No persisted declared preference | No | No | `REMOVE_FROM_RUNTIME_MODEL_CONTRACT` |
| Pickup/delivery preference | Synthetic persona scalar bucket | No equivalent persisted learner preference | No | No | `REMOVE_FROM_RUNTIME_MODEL_CONTRACT` |
| Activity band | Synthetic persona activity band | Bounded behavior exists, but no identical offline threshold definition | No | No | `REMOVE_FROM_RUNTIME_MODEL_CONTRACT` |
| Project-driven tendency | Synthetic persona latent tendency | Saves/follows/builds are behavior, not the synthetic latent field | No | No | `REMOVE_FROM_RUNTIME_MODEL_CONTRACT` |
| Material category | Namespaced hash of category ID | Same category ID namespace/hash | Yes | Yes | `DERIVE_WITH_EXACT_OFFLINE_RUNTIME_PARITY` |
| Material taxonomy | Controlled taxonomy canonical keys | Active material-concept canonical keys | Yes | Yes | `ADD_WITH_ONE_BOUNDED_BATCH_READ` |
| Condition | Controlled material condition | Existing candidate condition | Yes | Yes | `ADD_FROM_EXISTING_LOADED_CONTEXT` |
| Free/paid item | Catalog boolean | Existing candidate boolean | Yes | Yes | `ADD_FROM_EXISTING_LOADED_CONTEXT` |
| Pickup/delivery item | Catalog booleans | Existing candidate booleans | Yes | Yes | `ADD_FROM_EXISTING_LOADED_CONTEXT` |
| Project category/topic | Namespaced category hash | Same category ID namespace/hash | Yes | Yes | `DERIVE_WITH_EXACT_OFFLINE_RUNTIME_PARITY` |
| Project taxonomy | Controlled taxonomy canonical keys | Active project-concept canonical keys | Yes | Yes | `ADD_WITH_ONE_BOUNDED_BATCH_READ` |
| Difficulty | Controlled project difficulty | Existing candidate difficulty | Yes | Yes | `ADD_FROM_EXISTING_LOADED_CONTEXT` |
| Required-component concepts | Controlled component canonical keys | Active required-component canonical keys | Yes | Yes | `ADD_WITH_ONE_BOUNDED_BATCH_READ` |

No interaction-derived proxy is presented as a declared preference.

## 3. Item concept coverage

The shadow-enabled path performs exactly two bounded batch reads per learner-home miss: one material-concept query and one project/project-component concept query, keyed only by the already selected candidate IDs and bounded at 200. Shadow-disabled requests execute neither query.

Measured coverage:

| Coverage | Slice 4B | Slice 4C | Target |
|---|---:|---:|---:|
| Material taxonomy | 0% | 99.83% | ≥90% |
| Project taxonomy | 0% | 100% | ≥90% |
| Project component concepts | 0% | 82.76% | ≥75% |

Unknown or inactive concepts are omitted. No free text, titles, or descriptions become model features.

## 4. User feature alignment

Slice 4B averages of 0.54 material and 0.35 project user features reflected partial interest mapping against a v1 artifact that also expected synthetic-only preference/tendency features. Runtime v2 retains only interest features and weights every persisted interest equally. This matches the production profile contract; it no longer treats primary/secondary synthetic persona roles as runtime semantics.

Users without a mapped persisted interest correctly receive a zero-feature metadata representation. No fallback preference values are invented.

## 5. Runtime artifact decision

Option B, `runtime-approved-features-v2`, was selected. Benchmark A seed 11 was retrained offline with the already frozen WARP hyperparameters and `num_threads=1`; no hyperparameter or event-weight tuning occurred. Benchmark A v1 artifacts and historical results remain unchanged.

| Domain | v1 NDCG@10 / Recall@10 | v2 NDCG@10 / Recall@10 | v2 artifact hash |
|---|---:|---:|---|
| Material | 0.2182 / 0.2563 | 0.1987 / 0.2330 | `f88bb0741b7b66ded580e28668b70037412ff634d0422aa08da842e2fabd1c17` |
| Project | 0.2487 / 0.4050 | 0.2594 / 0.4218 | `2ce13d6f2a2418fc831b548ed9d6021f275da6254b68e6115b0af4de02f402d5` |

Two consecutive v2 exports produced identical logical hashes. Generated artifacts remain ignored and are used only for local shadow validation.

## 6. View cache invalidation

`recordMaterialView` now reports whether it persisted a new view. After a successful new authenticated view, only that viewer's learner-home cache is invalidated. Anonymous views, failed writes, and deduplicated repeated authenticated views do not invalidate. There is no global clear.

The focused local test verified immediate recent-context refresh, unrelated-user cache preservation, deduplication, failure behavior, and cleanup. Test-created view rows were deleted and their material view counters restored transactionally.

## 7. Valid scenario preconditions

The controlled real-catalog scenario used a learner with mapped long-term domain A and selected a distinct domain B with eight eligible concept-bearing materials. Domain B had zero initial Top-5 representation, the candidate universe remained fixed at 161 items, no availability changed, and all identifiers in output were privacy-safe hashes.

T1 used three unique views. T2 used eight unique views and two active likes. No database behavior row was required for score decomposition; the candidates themselves formed the exposure-backed fixture, so there was no persistent scenario state to clean up.

## 8. Score decomposition

At T2, representative domain-B candidates received recent raw scores from 0.6941 to 0.7772. Their long-term normalized scores ranged from 0.0252 to 0.2129. Combined scores ranged from 0.2593 to 0.3814. Candidates moved materially—for example ranks 139→68, 152→73, 160→98, 103→62, and 115→66—but none reached Top 5.

Proven causes:

```text
RECENT_CHANNEL_WORKING_BUT_BELOW_TOP5
LONG_TERM_MARGIN_TOO_LARGE
```

The evidence rules out unmapped recent features, absent candidates, target-domain dominance, tie-breaking, and candidate-set change.

## 9. Section and deduplicated diagnostics

Shadow diagnostics now deduplicate the global current list before overlap/rank-correlation calculations and record cross-section duplicate count. They also report per-section candidate-pool size and section-scoped Top-5/Top-10 overlap. The API response and section membership are unchanged. Privacy-safe Top-K keys remain namespaced hashes.

## 10. Fixed-weight result

The complete fixed configuration was run first and remained unchanged:

```text
view 0.35; like 1.0; project 1.8; strong 2.5
view cap 2; half-life 4 days; recent blend 35%
```

Domain-B Top-5 representation was 0 at T0, 0 at T1, and 0 at T2. Domain A retained all five positions. One accidental like remained bounded and reversals/caps/decay retained Python–TypeScript parity. The required T2 visibility gate failed.

## 11. Optional sensitivity result

The same fixed scenario was evaluated at only the approved values:

| Blend | Domain-B Top 5 | Domain-A Top 5 |
|---:|---:|---:|
| 35% | 0 | 5 |
| 40% | 0 | 5 |
| 45% | 5 | 0 |

At 45%, recent intent abruptly erases the long-term domain, violating the guardrail. Therefore no higher blend is recommended and the runtime default remains 35%. A broader multi-case blend selection was not used to promote a value because the first valid case already demonstrated pathological all-or-nothing behavior and the separate project-component gate is unsupported.

## 12. Project-driven material result

Project taxonomy and component features are now present. However, the real catalog snapshot contains no canonical-key overlap between published project required-component concepts and eligible material concepts. The scenario status is:

```text
NO_COMPONENT_MATERIAL_CONCEPT_OVERLAP
```

No relation was fabricated. Project-driven material uplift therefore cannot be demonstrated, and projects remain shadow-only.

## 13. Query and performance impact

| Measurement | Result |
|---|---:|
| Concept-query delta when shadow disabled | 0 |
| Concept-query delta when shadow enabled | 2 bounded queries/miss |
| Candidate bounds | materials ≤120 home pool; projects 29; hard scorer bound 200 |
| Warm material scorer p95 | 11.12 ms |
| Complete incremental p95 | 12.02 ms |
| Cold request with artifact/concepts | 150.64 ms |

There is no N+1 or per-candidate query. Material scorer and complete incremental targets pass. Project scorer measurements remained noisier under concurrent test execution and are not serving evidence.

## 14. Response invariance

All six controlled learner-home cases again produced complete payload equality with shadow disabled and enabled. Section order, item order, explanations, counts, empty states, and serialized fields were identical. Both serving flags remained false.

## 15. Failure behavior

The existing missing/corrupt/stale/malformed artifact, candidate mismatch, duplicate, over-budget, invalid timestamp, future event, and scorer-error cases remain fail-safe. Concept reads are bounded and their failure is contained by the same shadow fallback boundary. No ML failure changes the deterministic response.

## 16. Files changed

Changes are bounded to eight implementation files: learner-home repository/service, material view repository/service, artifact loader, shadow service, portable exporter, and offline feature builder, plus focused tests and this report. No API response, Prisma schema, migration, seed, frontend, serving flag default, or production ordering logic changed.

## 17. Repository state

The extensive pre-existing dirty worktree and unrelated line-ending noise remain untouched. Generated v2 JSON remains under the ignored ML generated directory. Benchmark A frozen hashes still match, Benchmark B remains absent, all controlled local mutations were reverted, and no commit was created.

Focused evidence:

- Runtime alignment and view-cache tests: 2 passed.
- Shadow E2E response/coverage test: passed.
- Slice 4A parity/fallback tests: 7 passed.
- Ubuntu ML suite: 65 passed.
- Changed TypeScript modules type-check; repository-wide typecheck remains stopped only by the unrelated existing nullable `location` error in `admin-people.service.ts:52`.

## 18. Known limitations

- Fixed 35% recent intent moves relevant candidates substantially but not into Top 5 for the valid shift case.
- 45% produces an unacceptable abrupt takeover; 40% is ineffective in that case.
- Project component/material taxonomy has no real overlap despite adequate per-domain coverage.
- Users without mapped interests have no runtime user features by design.
- Runtime v2 material offline metrics are lower than v1.
- Artifact deployment remains out of scope and artifacts remain ignored.
- Projects retain the 29-item saturation and shadow-only warnings.

## 19. Slice decision

Three infrastructure gaps are closed: concepts meet coverage targets, the runtime user contract is exact through v2, and authenticated new views invalidate only the correct cache entry. Query, latency, response-invariance, privacy, and cleanup gates pass. The slice cannot pass the required effectiveness gates because valid T2 activity does not change material Top 5 and real project components cannot match eligible materials. No weight or catalog data was changed to manufacture success.

`SLICE_4C_RUNTIME_ALIGNMENT_BLOCKED`
