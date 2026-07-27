# Slice 4D — Confidence-Gated Material Rank Fusion

## 1. Decision

Material confidence-gated rank fusion passes the engineering acceptance gate in disabled-serving shadow mode. It removes the Slice 4C 0-to-5 threshold cliff: three distinct coherent preference-shift pairs each produced two recent-domain and three long-term-domain materials in Top 5. No project mapping, model training, catalog data, visible response, or serving default changed.

## 2. Root cause

The recent channel was correct but the globally normalized linear score blend crossed a catalog-wide margin cliff. At 35% and 40%, the valid Slice 4C target remained 0 recent / 5 long-term; at 45% it became 5 / 0. Rank fusion treats the independently ordered channels as ranks and applies bounded representation guardrails, avoiding comparison of uncalibrated raw scores.

## 3. Channel definitions

The long-term channel is the unchanged `runtime-approved-features-v2` LightFM material ranking with stable key tie-breaking. The recent channel uses the unchanged event strengths, active reversals, two-view cap, four-day half-life, mapped category/concept evidence, and stable key tie-breaking. Both receive the identical existing eligible material universe (161 items in the controlled runs).

The retained v2 artifact content hash is `f88bb0741b7b66ded580e28668b70037412ff634d0422aa08da842e2fabd1c17`; its file SHA-256 is `f9bffaaca76905646eef0a0cf92e48eded6e761088ccc65b016c6c5b766cb4b2`.

## 4. Confidence contract

Confidence is deterministic and uses unique mapped entities, active likes after reversal, strong operations, dominant category/concept share, and newest evidence age. Repeated refreshes do not increase the unique count.

| Level | Gate and behavior |
|---|---|
| `NONE` | No active mapped recent evidence; output equals long-term ranking. |
| `LOW` | Evidence exists but coherence/support gates fail; no recent slot is reserved. |
| `MEDIUM` | At least four coherent unique views, or one active like supported by three views; dominant share ≥60%; age factor ≥0.25. At most one Top-5/Top-10 recent item. |
| `HIGH` | Eight coherent unique views plus two active likes, or a strong action plus three views; dominant share ≥70%; age factor ≥0.5. At most two Top-5 and three Top-10 recent items. |

One accidental like and three coherent views remain `LOW`. Eight views plus two likes are `HIGH`. At five days the tested HIGH case decays to `MEDIUM`; evidence outside the 14-day active window becomes `NONE`.

## 5. Candidate quality gate

A candidate must be in the shared universe, have a mapped recent category/concept score of at least `0.05`, be unique, and be present in the recent ranking. Repeated views alone cannot create HIGH confidence. Fewer than the maximum recent slots are used when fewer candidates qualify.

## 6. Fusion algorithm

The policy builds a stable long-term pool and a recent pool ordered by bounded recent score, reserves confidence-limited recent positions, and fills every other position from long-term order. HIGH inserts at deterministic positions 2 and 4 in Top 5 and permits one further recent item in Top 10. MEDIUM inserts at most one. LOW/NONE return long-term order exactly.

The historical normalized 35% blend is still computed and reported as `linearBlendTop5Keys`; it is not promoted to 40% or 45%.

## 7. Top-5/Top-10 guardrails

HIGH produced exactly two recent items and three retained long-term items in every controlled Top 5. It cannot occupy all Top 5 or Top 10. MEDIUM inserts at most one. Unqualified candidates are not injected, and an empty recent pool uses the long-term ranking.

## 8. Live scenario results

Pure and real-catalog fixtures covered profile-only, accidental like, three views, eight views plus two likes, aligned evidence, scattered noise, unlike, repeated views, and decay. Profile-only output was byte-for-byte equal to long-term order. Accidental/scattered/repeated evidence did not force representation. Unlike reduced active-like evidence; deterministic age gates reduced confidence.

| Scenario | Confidence | Fusion effect |
|---|---|---|
| Profile only | NONE | Exact long-term order |
| One accidental like | LOW | No reserved recent slot |
| Three coherent views | LOW | No reserved recent slot |
| Eight views + two likes | HIGH | Two bounded recent Top-5 positions |
| Repeated one-item views | LOW | Cannot become HIGH |
| Like then unlike | Reduced active-like count | Recomputed without active like |
| Five-day decay | MEDIUM | Recent representation falls from at most two to at most one |

No database behavior mutation was required for rank-fusion scenarios; all events were exposure-backed in-memory fixtures over fixed eligible candidates.

## 9. Multi-domain preference-shift results

Three distinct long-term/recent category pairs ran over the real 161-material candidate universe. For every pair, confidence was HIGH, recent-domain Top-5 representation was 2, long-term-domain representation was 3, candidate IDs were unchanged, and the recent channel had qualified mapped candidates. This directly replaces the Slice 4C 0/5 fixed-35% outcome without the 45% 5/0 takeover.

## 10. Slice 3B regression comparison

The frozen Benchmark B casebook and source Parquet inputs were read without modification. The replay covered all 50 true-cold users at profile-only, coherent-intent, drift, and decay stages using the existing expanded LightFM bundle and frozen actions. Profile-only confidence was NONE and its fused ranking exactly matched LightFM for all 50 users. No noisy/accidental T4 case reached HIGH confidence. The original 300-row casebook SHA-256 remains `73f6126856bff45e3e1870291d9822958b2030a1558f8d1456ef9541d6fead2b`.

## 11. Noise and reversal behavior

Confidence counts distinct entities, caps repeated views at two contributions, requires dominant mapped evidence, and resolves unlike before classification. One accidental like cannot reserve a position. Frozen Benchmark B noisy users remained below HIGH at T4. Aligned evidence can reinforce already relevant results but cannot consume all guarded positions.

## 12. Decay behavior

Recent scores retain the unchanged four-day half-life. Confidence additionally applies deterministic age gates: a tested HIGH sequence falls to MEDIUM as its newest evidence passes four days and eventually to NONE after the bounded 14-day window. Long-term order returns through decreasing representation limits rather than a raw-score threshold flip.

## 13. Section-scoped diagnostics

Fusion is applied only to the `suggested_materials` shadow diagnostic. `free_materials_near_you` and `materials_for_saved_projects` retain long-term diagnostic order. The service continues to report section Top 5/10, deduplicated global Top 5, and cross-section duplicate counts using privacy-safe keys. API sections and membership are unchanged.

## 14. Performance

| Measurement | Result | Target |
|---|---:|---:|
| Fusion, 161 candidates, 200 runs p95 | 0.107 ms | ≤2 ms |
| Isolated warm material shadow p95 | 9.23 ms | ≤15 ms |
| Isolated complete incremental p95 | 20.53 ms | ≤25 ms |
| Query delta | 2 existing bounded concept reads | no new fusion query |

The concurrent four-file test run observed 15.38 ms material p95; the isolated acceptance benchmark passed at 9.23 ms. Fusion itself adds no query and remains far below its budget. There is no per-candidate read or N+1.

## 15. Response invariance

Six controlled learner-home cases produced logically identical shadow-disabled and shadow-enabled payloads, including section/item order and serialized fields. Material and project serving flags remained false. The tracked example defaults keep shadow and both serving flags false.

## 16. Failure behavior

Existing artifact, candidate-universe, duplicate, over-limit, timestamp, and scorer failures preserve the visible deterministic response. Empty or unqualified recent rankings use long-term shadow order. Fusion validates duplicate candidates and finite scores deterministically; the surrounding shadow boundary remains fail-safe and does not retry.

## 17. Project-gap deferral

Projects remain `SHADOW_EVALUATION_ONLY`. The verified status remains:

```text
NO_COMPONENT_MATERIAL_CONCEPT_OVERLAP
```

A separate human-reviewed taxonomy crosswalk slice is recommended. No string similarity or fabricated project/material mapping was added.

## 18. Files changed

Slice 4D adds two TypeScript implementation modules, updates the existing shadow service, adds Python offline parity functions, and adds focused TypeScript/Python tests. This is four implementation files—within the six-file boundary—plus tests and this report. No learner-home, Prisma, schema, migration, seed, catalog, artifact, or model-training file changed for Slice 4D.

## 19. Repository state

The repository was already substantially dirty from accepted prior slices and unrelated pre-existing work; those changes were preserved. Benchmark A verification matches all seven frozen hashes. Generated Benchmark A/B and portable artifacts remain ignored and untracked. Focused TypeScript tests pass (10/10 in the final fusion/shadow run), and the Python fusion plus existing Slice 3B regression suites report 18/18 passed. The repository-wide typecheck is not clean because the unrelated existing `admin-people.service.ts:52` reports that `location` may be null; no Slice 4D file produced a TypeScript error. No commit was created.

## 20. Known limitations

This is synthetic/local shadow evidence, not real-user recommendation-quality evidence. Confidence gates are reviewed fixed policy, not learned calibration. The 14-day confidence window is distinct from the four-day score half-life. Project component mapping remains unresolved. Artifact deployment remains outside this slice. The fused ranking does not control the client response.

## 21. Slice decision

All material Slice 4D engineering gates pass: the threshold cliff is removed, three preference-shift pairs retain long-term representation, noise/reversal/decay are bounded, profile-only behavior is unchanged, latency and query limits pass, visible output is invariant, serving stays disabled, and no state or commit was created.

SLICE_4D_MATERIAL_RANK_FUSION_PASSED
