# Slice 2 — Baseline Evaluation Readiness Report

## 1. Decision

**PASS.** The privacy-safe catalog and all three synthetic variants are ready for a later, separately approved model-training slice. Slice 2 trained or imported no LightFM model. This decision establishes evaluation readiness, not recommendation quality.

## 2. Snapshot/schema update

Catalog source: real public ImpactLoop catalog, exported read-only by the isolated Windows Node exporter. Learners and behavior: fully synthetic, generated in Ubuntu.

The snapshot contract was incremented to `impactloop-catalog-snapshot-v2`. It adds only controlled English category, relation-backed material-type, taxonomy-concept, project-difficulty, and required-component labels. Hashed model keys remain authoritative. Titles, descriptions, notes, people, contacts, locations, raw IDs, credentials, and interaction data remain excluded.

Two consecutive Windows exports selected 161 eligible materials and 29 published projects and produced the same logical hash, `94c3165783ba4fca06d959f9b9d566434793c03f79858c089ab9cbe26dcd4186`. Evidence in both runs: session read-only `true`, explicit `BEGIN READ ONLY`, rollback, and database write count `0`. The credential never left the Windows process. All queried tables remain on the fixed catalog allowlist.

Privacy/schema tests and prohibited-field scans passed. Regeneration retained the exact Slice 1 logical behavior hashes: seed 11 `99523dc…f4eb4`, seed 29 `71307d…35dc5`, and seed 47 `86c564…8c697` (`OOD_ROBUSTNESS_ONLY`).

## 3. Feature-cardinality audit

| Feature | Unique | Singleton share | p50 / p75 / p90 frequency | Max | Classification |
|---|---:|---:|---:|---:|---|
| Material type | 150 | 99.33% | 1 / 1 / 1 | 2 | `EXCLUDE_HIGH_CARDINALITY_FEATURE` |
| Material category | 13 | 0% | 9 / 13 / 16 | 51 | `APPROVED_AS_MODEL_FEATURE` |
| Material taxonomy concepts | 34 | 58.82% | 1 / 8.75 / 12.7 | 51 | `APPROVED_AS_MODEL_FEATURE` |
| Project topic/category | 6 | 0% | 4.5 / 5 / 6.5 | 8 | `APPROVED_AS_MODEL_FEATURE` |
| Project taxonomy concepts | 6 | 0% | 4.5 / 5 / 6.5 | 8 | `APPROVED_AS_MODEL_FEATURE` |
| Required-component concepts | 18 | 16.67% | 2 / 3 / 3.6 | 5 | `APPROVED_AS_MODEL_FEATURE` |

Material type is a controlled relation, not user-entered text, but is effectively item-identity: 151 non-null observations contain 150 values, 149 of them singletons. Its missing rate is 6.21%, and every material has broader taxonomy coverage. It is excluded rather than used merely because it exists. Controlled examples reviewed include “Ultrasonic Sensor,” “Acrylic Paint,” and “Aluminum Sheet.” Location is `EXCLUDED_NOT_EXPORTED`; no catalog location feature is available.

## 4. Natural cold-start cohorts

Natural counts were measured from unchanged generated behavior, separately from masks.

| Seed | Domain | Natural cold users | Natural cold items | Validation + test positives |
|---:|---|---:|---:|---:|
| 11 | Material | 12 | 0 | 1,409 |
| 11 | Project | 21 | 0 | 532 |
| 29 | Material | 10 | 0 | 948 |
| 29 | Project | 23 | 0 | 467 |
| 47 | Material | 33 | 1 | 384 |
| 47 | Project | 4 | 0 | 952 |

The previously observed natural cold-item count remains zero in five of six seed/domain datasets. Seed 47 material has one genuine later-positive item absent from training and is reported as generated, not corrected away. All eligible catalog rows have category and publication metadata; approved feature completeness is audited separately.

## 5. Evaluation-masked cold-start design

Users with later positives were ordered by `sha256("slice2:u:<seed>:<domain>:<synthetic-user-key>")`; approximately 10% were selected. Supported later-positive items with complete metadata and at least two users were ordered by the corresponding item namespace. Project masks are capped at two items because the domain has only 29 items.

| Seed | Domain | Masked users | Masked items | Status |
|---:|---|---:|---:|---|
| 11 | Material | 22 | 16 | Supported |
| 11 | Project | 18 | 2 | Supported, small absolute item cohort |
| 29 | Material | 20 | 15 | Supported |
| 29 | Project | 19 | 2 | Supported, small absolute item cohort |
| 47 | Material | 8 | 9 | Supported |
| 47 | Project | 24 | 2 | Supported, small absolute item cohort |

Masks are evaluation-only ignored artifacts. Raw Parquet files, timestamps, actions, and temporal assignments are unchanged. Rows are labeled `EVALUATION_MASKED_COLD_USER` or `EVALUATION_MASKED_COLD_ITEM` in the mask, never as natural cold entities.

## 6. Leakage tests

Every masked user/item training row is removed from the derived training view; validation/test positives remain. Popularity is computed after masking from resolved `train` rows only. Metadata contains no behavior or hidden intent. Candidate eligibility is evaluated at prediction time, training positives are excluded, and validation/test interactions do not affect scores. Primary and diagnostic universes are distinct. Stable hashes make masks repeatable, and the original Slice 1 logical hashes prove source artifacts were not mutated.

## 7. Data sufficiency

| Seed | Domain | Train / validation / test positives | Pair density | Median unseen candidates | Support |
|---:|---|---:|---:|---:|---|
| 11 | Material | 3,205 / 666 / 743 | 6.56% | 155 | Supported |
| 11 | Project | 1,339 / 228 / 304 | 16.79% | 26 | Supported with saturation caution |
| 29 | Material | 2,268 / 417 / 531 | 5.02% | 156 | Supported |
| 29 | Project | 1,024 / 193 / 274 | 14.56% | 27 | Supported with saturation caution |
| 47 | Material | 1,096 / 220 / 164 | 2.50% | 160 | Supported |
| 47 | Project | 2,118 / 435 / 517 | 25.48% | 24 | Supported with saturation caution |

No evaluated user has zero, fewer than five, or fewer than ten catalog-unseen candidates. Four seed-47 project users exceed 50% catalog interaction; none exceed 70%. The 29-project universe is intrinsically small, so project results and the two-item masked cohort are diagnostic and must not be treated as high-powered evidence. Full item/user support thresholds and 2/3/5-user, 2/5/10-item distributions are retained in the ignored metrics artifact. Unsupported subgroup metrics return `INSUFFICIENT_SYNTHETIC_SUPPORT`; interactions are never added to make a cohort pass.

## 8. Candidate-universe contract

One `CandidateUniverse` service is used by both baselines and is the interface intended for later models. `PRIMARY` is the full time-eligible, domain-correct, public catalog minus allowed training positives and protocol exclusions; validation/test targets remain. `DIAGNOSTIC` intersects that set with eligible impressions and optionally `POLICY_SELECTED` or `RANDOM_EXPLORATION`. Diagnostic exposure conditioning never replaces primary evaluation. Tests cover future publication exclusion, training-positive exclusion, diagnostic separation, and identical baseline candidates.

## 9. Baseline definitions

Global popularity sums training-only resolved positive weights after evaluation masking and ranks deterministically by score then hashed key. Interest/category-aware popularity uses the same score plus a bounded category match against synthetic long-term persona interests. It does not use hidden current intent, exposure rank, validation/test behavior, or simulator utility coefficients. The optional production scorer adapter was not attempted because it was unnecessary for acceptance and would increase production coupling.

## 10. Temporal metrics

Primary-universe aggregate NDCG@10 (global → interest-aware) was: seed 11 material `0.05546 → 0.05560`, project `0.18957 → 0.19028`; seed 29 material `0.05387 → 0.06055`, project `0.18735 → 0.19082`; seed 47 material `0.05257 → 0.05820`, project `0.20377 → 0.20426`.

The evaluator also records Precision/Recall/NDCG at 5 and 10, MRR, Hit Rate at 5 and 10, catalog coverage, average popularity/concentration inputs, and identical-top-five diagnostics. Precision uses `min(K, eligible candidate count)`; recall uses the count of eligible held-out targets. A zero-candidate user scores zero and is counted, not silently dropped. Hand-calculated fixture tests cover small-candidate denominators.

## 11. Paired per-user results

Interest-aware versus global NDCG@10 improved/regressed/unchanged users were: `4/1/220` (seed 11 material), `13/5/166` (seed 11 project), `17/1/180` (seed 29 material), `8/0/184` (seed 29 project), `7/0/74` (seed 47 material), and `2/0/241` (seed 47 project). Median deltas are zero in every domain; improvements are concentrated in a minority, so aggregates must not hide the predominantly unchanged population. The ignored artifact retains p25/p75 and paired breakdowns for stable, gradual-shift, abrupt-task, exploratory, noisy, and low/medium/high activity cohorts. Natural and masked cohort definitions remain available for later model comparisons; no unsupported cohort is reported as a score.

## 12. Exposure-bias diagnostics

Global-popularity NDCG@10 on all / policy / randomized exposed candidates was: seed 11 material `.390/.433/.199`, project `.326/.334/.211`; seed 29 material `.366/.401/.174`, project `.325/.320/.231`; seed 47 material `.550/.541/.271`, project `.268/.292/.192`. The consistent randomized-exposure drop demonstrates policy conditioning and circularity risk. These diagnostic values are not interpreted as general recommendation quality; primary full-catalog results remain authoritative.

## 13. Controlled scenarios

Fourteen deterministic scenario records cover the requested long-term-to-recent shifts, stable and random browsing, repeated views, accidental/reversed likes, reservation evidence, natural/masked cold cases, and project-driven abrupt intent. Each records candidate count, Top 5/10 controlled category labels, a synthetic behavior summary, explanation, and limitation. It exposes neither titles nor hashed keys. Because Slice 2 has no drift-aware trained model, these are baseline readiness examples and explicitly state that limitation.

## 14. Performance

The complete six-seed/domain evaluation plus ignored artifact writes took approximately 4.7 seconds per logical run in Ubuntu. A second run matched logical output exactly after excluding runtime timing. Artifacts are small: feature audit about 2 KB, metrics about 40 KB, scenarios about 13 KB, masks about 5 KB, and baseline recommendations about 19 KB.

## 15. Files changed

Slice 2 added six bounded offline implementation modules: `feature_audit.py`, `evaluation_splits.py`, `candidate_universe.py`, `baselines.py`, `evaluate.py`, and `scenario_evaluation.py`; one focused test module; and this report. The snapshot loader/schema, invented fixture, tests, and isolated Windows exporter changed only for controlled labels and schema v2. No production runtime file changed.

## 16. Repository state

Generated snapshots, Parquet datasets, evaluation outputs, and Linux environments remain ignored. The Linux lock and Slice 1 report remain unignored/reviewable. Scoped `git diff --check` passes. Repository-wide `git diff --check` still reports unrelated pre-existing CRLF changes, which were preserved. No model artifact was created, no production/schema/migration/seed/API file was changed by Slice 2, no database write occurred, and no commit was created.

## 17. Slice decision

The shared temporal evaluation protocol, leakage-safe natural/masked cohorts, training-only baselines, exposure-bias diagnostics, controlled scenarios, and deterministic artifacts are ready for review. Twenty-eight focused Slice 0–2 tests pass. Slice 3 has not started; the Slice 2 decision is pass.
