# Slice 3B — Expanded Catalog and New-User Personalization Stress Test

## 1. Decision

Engineering acceptance passes. Automatic result: `ELIGIBLE_FOR_MANUAL_NEW_USER_REVIEW`. This is an independent synthetic robustness result and does not authorize production integration or revise Slice 3.

## 2. Benchmark separation

Benchmark A remains the original Slice 1–3 snapshot, datasets, masks, models, hyperparameters, and reports. Seven byte-level hashes were recorded before Benchmark B and verified again after every run; all match. Benchmark B lives only under ignored `ml/recommendation/generated/benchmark-b/`. No Benchmark A command or model was overwritten.

## 3. Expanded catalog design

Benchmark B adds exactly 150 materials and 50 learning projects, producing totals of 311 and 79 while leaving the 161/29 originals unchanged. Every extension row is marked `SYNTHETIC_CATALOG_EXTENSION`. Material records use approved existing categories with non-uniform deterministic assignments across controlled concepts, conditions, free/paid buckets, pickup/delivery, and component usefulness. Review names begin with “Synthetic” and are never model features.

All projects have a controlled topic, difficulty, taxonomy concept, three required component concepts, and multiple material relations. No PostgreSQL, Prisma, seed, or production catalog operation occurred.

## 4. Duplicate and relation audit

The frozen extension hash is `8f1abf55b347c33cde3942aefb710dc7c5e79ed4f7fd3f5f9920ece9a35eed5c`. Exact duplicate feature vectors: 0; near-duplicate vectors differing in at most one audited dimension: 0; duplicate project component structures: 0. Relations contain 150 `EXACT_COMPONENT_MATCH`, 100 `VALID_ALTERNATIVE`, and 50 `WEAKLY_RELATED` rows. `UNRELATED` is not exhaustively materialized. Every project has exact and alternative matches. Maximum links for one material are six.

## 5. Expanded training population

The original 300 synthetic-persona pattern was regenerated independently against the expanded catalog with seed 101, 8–15 sessions, 6–10 impressions, 15% randomized exploration, exposure-first stochastic actions, view caps, reversals, and unchanged Slice 1 event weights. New learners never enter this history.

Expanded-item exposure coverage is 100% at 1/5/10 impressions; engagement coverage is 100% at two and three users and 98.5% at five users. This emerged from approximately 300×8–15 sessions over a 390-item catalog, not success-padding. It is unusually broad and is retained as a limitation rather than altered.

Frozen-hybrid training-user temporal test metrics were material NDCG@10 `.1881`, Recall@10 `.2322`, Hit Rate@10 `.5698` over 179 users; project `.1715`, `.2489`, `.4637` over 179 users.

## 6. New-user cohort design

Exactly 50 `SYNTHETIC_NEW_USER_EVALUATION` learners (`new_user_0001`–`0050`) are split into ten each: interests-only, reinforced, preference-shift, project-driven, and noisy/accidental. They remain separate from the 300 training personas, have approved metadata, never receive trained identity entries, and are true cold users throughout primary evaluation.

## 7. Staged interaction design

Each user has T0 profile only; T1 three unique views; T2 six additional views and two likes for coherent cohorts; T3 one exposure-backed project save or build start; T4 shift/noise activity; and T5 a 14-day decay advance. Every action follows a matching domain/entity/user impression. Timestamps strictly follow T0→T5. Repeated noisy views cap at two contributions, and unlike removes the active-like state.

## 8. Frozen LightFM stress test

The first and only holdout configuration uses Slice 3’s frozen WARP settings: material 16 components and project 32, both 10 epochs, LR .03, user/item alpha 1e-6, random state 101, and one thread. There was no retuning. New-user rows contain metadata but zero identity entries. Fit times were roughly `.05s` materials and `.10s` projects; matrices were 350×311 (3,056 nonzeros) and 350×79 (1,927 nonzeros).

## 9. Short-term intent scorer

The offline deterministic scorer uses controlled categories, taxonomy concepts, project components, unique action strength, a four-day half-life, and bounded channel scores. Views contribute .35 and cap after two per item; likes contribute 1.0; project save/follow contributes 1.8; reservation/build start contributes 2.5. Unlike removes like evidence. Hybrid combination normalizes the frozen LightFM channel and uses one fixed 35% recent-intent blend. Long-term LightFM is never erased and hidden intent is never read.

## 10. LightFM update experiment

Five selected cold users were evaluated with a one-epoch metadata-only `fit_partial` copy. Mapping hash remained stable, identity rows stayed absent, two repeated updates produced identical rankings, and mean update time was below 1 ms. Selected Top-10 changed by .2 items on average; the measured unrelated training user changed by zero items. Because shared metadata embeddings are updated and broader forgetting was not exhaustively assessed, this mechanism is `BOUNDED_UPDATE_EVALUATED_NOT_ADOPTED`; durable collaborative incorporation still requires a reviewed retraining design.

## 11. New-user recommendation casebook

The ignored casebook contains 300 rows: all 50 users at six stages. Every row includes the user/cohort, explicit interests, cumulative staged actions, and results for interest popularity, frozen hybrid, short-term only, and hybrid plus recent intent. The five update users also show bounded-update LightFM. Each output includes controlled Top-5 review names/categories/concepts, Top-10 category/concept distribution, diversity, prior overlap, changed items, explicit/recent/component matches, and unrelated rate. No raw real identifiers or titles are present.

## 12. Cohort and stage results

Frozen hybrid profile-only Top-5 explicit-interest match averages 93.2%. Combined T2 target match is 100% for interests-only, reinforced, and project-driven cohorts; 90% for preference shift; and remains bounded under noise. The complete comparison table for every cohort/stage/model is stored in `expanded-metrics.json`; no losing model is omitted.

## 13. Noise resistance

Noisy users’ hybrid-plus-intent unrelated rate at T4 is 17%. One accidental like is bounded, unlike removes it, repeated views cap, and cross-category evidence does not replace the long-term hybrid channel. Noisy combined explicit/recent Top-5 match moves from 90% at T0 to 76% at T4 and recovers to 84% after decay, demonstrating influence without complete takeover.

## 14. Preference-shift response

At T4, preference-shift users receive 94% recent-domain Top-5 representation while retaining 16% long-term-domain representation. Frozen LightFM alone remains long-term oriented; the change comes from the offline recent-intent channel. This proves one coherent session can become visible without claiming LightFM itself updates before retraining.

## 15. Project-driven results

Project save/build actions emit controlled required-component evidence and casebook rows report component-match rates. Project-driven combined target match reaches 100% after coherent evidence. The relation audit ensures each synthetic project has multiple exact and alternative candidate materials. This is metadata-grounded synthetic relevance, not a hidden target feature.

## 16. Decay behavior

For shift users, recent-domain Top-5 representation decreases from 94% at T4 to 90% at T5 while long-term representation rises from 16% to 20%. The transition is modest but gradual, deterministic, and in the intended direction; no event is deleted. Noisy users similarly recover toward the fixed long-term channel.

## 17. Final holdout

Seed 101 is marked `EXPANDED_BENCHMARK_FINAL_HOLDOUT`. Catalog, relations, user scenarios, blend, and frozen hyperparameters were fixed before model scoring. It was never used for selection, threshold changes, or retuning. A timestamp-order integrity defect was corrected before acceptance and the entire benchmark was refrozen; no model-result-driven edit followed the final holdout.

## 18. Performance

Frozen fits complete in under .1s per domain in this environment. Models are approximately 269 KB material and 274 KB project. The full deterministic generation, two fits, 50×6×4+ staged scoring, casebook write, update experiment, and training-user temporal evaluation complete in seconds. Benchmark files total several MB, dominated by auditable impressions/actions and the 2.1 MB casebook.

## 19. Artifacts

Ignored artifacts include extension material/project/relation Parquet, expanded training funnel and feedback, new-user personas/impressions/actions, two model Pickles, frozen hashes, metrics, holdout result, and casebook. Git ignore verification passes.

## 20. Files changed

Slice 3B adds three bounded offline modules: `expanded_catalog.py`, `short_term.py`, and `run_expanded.py`; one focused test module; and this report. It does not change Slice 1–3 implementation, reports, configurations, hyperparameters, or generated results.

## 21. Repository state

Benchmark A hashes remain unchanged. Scoped whitespace checks pass. Generated Benchmark B artifacts are ignored. No model is integrated, no production file/database/schema/migration/seed/API/scorer/flag is changed, no commit is created, and no production-integration slice is started.

## 22. Limitations

All evidence is synthetic. Exposure coverage is unusually broad. Review labels and relations are structurally generated rather than human relevance judgments. The 35% blend is an initial fixed value, not a production calibration. The observed decay response is small. The update experiment covers five users and one unrelated user only. No online serving, real-user response, production latency, or causal claim is supported.

## 23. Manual decision

The expanded cold-user benchmark is eligible for human review because profile-only personalization, recent intent, project needs, noise resistance, and decay are observable without identity embeddings or production changes. Any production design remains a separate, explicitly approved decision.
