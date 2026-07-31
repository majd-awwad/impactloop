# Recommendation Phase 2C — Offline Typed Matching Evaluation

## Scope and decision

This is an offline, reproducible comparison. It does not change recommendation runtime behavior, ranking weights, schemas, migrations, seed data, APIs, frontend behavior, learner-home integration, compatibility rules, or production matching.

The evaluator is reusable at [apps/backend/scripts/evaluate-taxonomy.ts](../../apps/backend/scripts/evaluate-taxonomy.ts). The manually reviewed fixture is at [taxonomy-evaluation-fixture.json](./taxonomy-evaluation-fixture.json).

Final decision: reviewed normalization and aliases are useful for shadow evaluation, but typed matching is not ready for runtime use. The accepted Phase 2C decision is:

ADOPT_NORMALIZATION_ONLY

## Frozen population and fixture

The primary denominator was validated before scoring:

| Population | Count | Use |
|---|---:|---|
| Seeded materials | 159 | 150 primary listings plus 9 workflow copies |
| Learning projects | 30 | Primary project population |
| Required components | 117 | Primary component population |
| Test materials | 40 | Excluded from every primary metric |

The fixture contains 240 manually reviewed pairs, with no `INSUFFICIENT_INFORMATION` labels:

| Task | Queries | Pairs |
|---|---:|---:|
| Learner interest → material | 6 | 60 |
| Learner interest → project | 6 | 60 |
| Component → material | 6 | 120 |

Labels are `RELEVANT` = 2, `PARTIALLY_RELEVANT` = 1, `NOT_RELEVANT` = 0. The fixture has 49 relevant, 74 partially relevant, and 117 not relevant pairs. Each query ranks its reviewed candidate pool: 10 candidates for interest tasks and 20 for component tasks. These are fixture-pool metrics, not claims about an exhaustive 159/30/117 catalog ranking.

Entity keys are stable title-derived keys. The evaluator resolves them to local seeded rows and fails if a key is missing, if the primary population is not 159 materials, or if a test row is referenced.

## Compared approaches

| Approach | Definition |
|---|---|
| A | Current production lexical predicates, called directly from `learner-interest-taxonomy.ts` and `learner-home.scoring.ts`. |
| B | Reviewed alias/normalization resolution followed by the same lexical predicates; no typed overlap score. |
| C | Exact stored taxonomy concept-ID overlap only. Concepts with different types are not treated as compatible. |
| D | B lexical evidence plus an offline typed tie-breaker/additive feature. No runtime code uses it. |

Approach A parity was checked over all 240 fixture pairs: 240 checks, 0 mismatches. The baseline version is `learner-interest-taxonomy.ts + learner-home.scoring.ts`; taxonomy vocabulary version is `phase-2b-v1`.

## Primary metrics

Metrics are averages across the six query groups for each task. `P@k`, `Recall@k`, and `HitRate@k` use the reviewed relevance labels. `zero-result` means the approach predicted no candidate at all. FP/FN are pair-level prediction errors over the whole fixture pool, where a positive prediction is a non-zero approach score and positive ground truth is `RELEVANT` or `PARTIALLY_RELEVANT`.

### Interest → material

| Approach | P@5 | P@10 | Recall@5 | Recall@10 | NDCG@10 | MRR | Zero-result | FP | FN | Arabic coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | .833 | .633 | .654 | 1.000 | .857 | .806 | 16.7% | 1 | 21 | 0/1 |
| B | .867 | .633 | .696 | 1.000 | .917 | .917 | 0% | 1 | 19 | 1/1 |
| C | .700 | .633 | .562 | 1.000 | .770 | .778 | 100% | 0 | 38 | 0/1 |
| D | .867 | .633 | .696 | 1.000 | .917 | .917 | 0% | 1 | 19 | 1/1 |

### Interest → project

| Approach | P@5 | P@10 | Recall@5 | Recall@10 | NDCG@10 | MRR | Zero-result | FP | FN | Arabic coverage |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | .867 | .683 | .631 | 1.000 | .913 | 1.000 | 16.7% | 1 | 17 | 0/1 |
| B | .933 | .683 | .687 | 1.000 | .951 | 1.000 | 0% | 1 | 13 | 1/1 |
| C | .667 | .683 | .488 | 1.000 | .777 | .889 | 100% | 0 | 41 | 0/1 |
| D | .933 | .683 | .687 | 1.000 | .951 | 1.000 | 0% | 1 | 13 | 1/1 |

### Component → material

| Approach | P@5 | P@10 | Recall@5 | Recall@10 | NDCG@10 | MRR | Zero-result | FP | FN |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A | .733 | .567 | .513 | .751 | .816 | 1.000 | 0% | 8 | 17 |
| B | .733 | .567 | .513 | .751 | .816 | 1.000 | 0% | 8 | 17 |
| C | .600 | .533 | .360 | .677 | .551 | .649 | 100% | 0 | 44 |
| D | .733 | .567 | .513 | .751 | .816 | 1.000 | 0% | 8 | 17 |

The C ranking metrics are not promotion evidence: every C score is zero, so its ranking is only the deterministic tie order. Its operational result is a 100% zero-result rate and no predicted positives.

## Evidence, explanations, and source precision

Evidence coverage is measured among predicted top-five results. Explanation coverage is the share of those results with a non-empty evidence-backed explanation.

| Approach/task | Structured evidence | Explanation coverage |
|---|---:|---:|
| A interest → material | 60.0% | 83.3% |
| B interest → material | 76.7% | 100% |
| A interest → project | 0% | 83.3% |
| B interest → project | 0% | 100% |
| A component → material | 100% | 100% |
| B component → material | 100% | 100% |
| C all tasks | 0% | 0% |

Selected precision by evidence source:

| Task/source | A | B |
|---|---:|---:|
| Interest → material / title | 91.7% | 92.3% |
| Interest → material / description | 93.8% | 94.4% |
| Interest → material / material type | 100% | 100% |
| Interest → material / tag | 100% | 100% |
| Interest → project / title | 96.0% | 96.6% |
| Component → material / category | 76.5% | 76.5% |
| Component → material / reviewed alias | n/a | 76.0% |

The project matcher exposes title evidence in this fixture; its category/topic evidence is not treated as a typed match. Component category matching is the main source of false positives.

## Component mapping and role coverage

Across the 12 fixture component definitions, 9 are mapped and 3 are unmapped. Roles are represented as 10 `REQUIRED_MATERIAL`, 1 `OPTIONAL_MATERIAL`, and 1 `CONSUMABLE`. The six component matrices cover 5 mapped components and 1 unmapped component; the unmapped case is the soil-moisture sensor.

For the evaluated six component queries, A, B, and D all returned at least one reviewed-relevant predicted material in the top 10 for each mapped and unmapped matrix. C returned no predicted material for any mapped or unmapped matrix. This shows lexical fallback value, not typed compatibility.

## Failure analysis

- A’s main interest failure is the Arabic query: the current lexical resolver does not resolve that reviewed Arabic label, producing one zero-result query per interest task. B resolves it through the reviewed alias table and removes those zero results.
- B reduces false negatives from 21 to 19 for interest → material and from 17 to 13 for interest → project, while leaving P@10 unchanged and improving P@5, NDCG, MRR, explanation coverage, and bilingual coverage.
- Component B is unchanged in ranking metrics. Its reviewed-alias evidence is explainable but does not fix the 17 false negatives or the 8 false positives in this fixture.
- Category-only component matches account for the broadest observed false-positive source: 26 relevant predictions out of 34 category-evidence predictions (76.5% precision).
- C cannot match any positive pair because Phase 2B stores interest, material, project, and component concepts as separate typed concepts. No exact concept IDs cross those boundaries. Inferring compatibility between `INTEREST`, `MATERIAL_FAMILY`, `MATERIAL_FORM`, `PROJECT_TOPIC`, and `COMPONENT` would violate the Phase 2C constraint.
- D is exactly B on all reported rankings and metrics. There are zero exact typed-overlap rows, so no typed coefficient can affect the result.

## Sensitivity and robustness

Offline D sensitivity was checked at typed additive coefficients `0`, `0.01`, and `0.1`; all produce the same ranking hash because typed evidence rows are zero. A required-typed-evidence configuration produces zero results. There is therefore no evidence-based typed promotion gate to pass.

The secondary 40-material population was inspected only as a robustness check. Its taxonomy mapping coverage is 40/40 (100%). Those rows were excluded from every primary ranking metric and no private identifiers or raw database rows were written to the fixture or report.

Two consecutive evaluator runs produced the identical ranking/metric hash:

`8bced81da62eb2205e6def13df0a7694813c223deb7f60d02b402fc112f81534`

The recorded run timestamp was `2026-07-18T01:56:42Z`, against code revision `8978836e7d0860272737943a42b72c7f9db4beca`. Offline evaluator p50/p95 times were low across the six-query groups; the slowest reported group was B interest → material at approximately 9.2/13.0 ms. These timings are evaluator timings, not production endpoint latency.

## Promotion gates

| Gate | Result |
|---|---|
| Baseline parity | Pass: 240/240 checks, 0 mismatches |
| Primary fixture completeness | Pass: 240/240 pairs, frozen 159/30/117 population |
| Reviewed normalization improves bilingual/zero-result behavior | Pass for B: Arabic coverage 0/1 → 1/1 and zero-result 16.7% → 0% on both interest tasks |
| No P@10 regression | Pass: B equals A on all three tasks |
| Typed-only standalone viability | Fail: C zero-result 100% on all tasks |
| Hybrid typed improvement over B | Fail: D equals B because exact typed overlap is absent |
| Compatibility evaluation trigger | Not met by typed evidence; unmapped component gaps remain vocabulary/compatibility work for a later phase |
| Runtime activation | Not authorized and not performed |

The safe next step is to keep B’s reviewed normalization/alias behavior as an offline or shadow capability and expand/review typed vocabulary and explicit compatibility relations before any typed runtime proposal. No Phase 2C runtime change was made.

ADOPT_NORMALIZATION_ONLY
