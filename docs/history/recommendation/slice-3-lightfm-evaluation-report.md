# Slice 3 — LightFM Training and Offline Model Comparison

## 1. Decision

Engineering acceptance passes. The automatic result is `ELIGIBLE_FOR_MANUAL_INTEGRATION_REVIEW`; it is not authorization to integrate or feature-flag a model. Material and project hybrid models are classified `COMPETITIVE` on this synthetic protocol. This is synthetic offline evidence, not real-learner product evidence.

## 2. Runtime environment

All acceptance work ran in Ubuntu 22.04 WSL2 using Python 3.11.15, LightFM 1.17, and the exact `requirements-linux-lock.txt` environment. Acceptance fixed `PYTHONHASHSEED=0`, Python and NumPy seeds, LightFM `random_state`, stable sorted mappings, and `num_threads=1`. No Windows-native training or multi-thread benchmark was used.

## 3. Dataset and feature schemas

Snapshot v2 validated at hash `94c31657…dcd4186`. Slice 1 logical hashes remain `99523dc…f4eb4` (11), `71307d…35dc5` (29), and `86c564c…8c697` (47). Seed 47 remains `OOD_ROBUSTNESS_ONLY`.

Feature schema `slice-3-approved-features-v1` uses synthetic long-term interests, activity, bucketed free/delivery preferences, and project tendency. Material items use category, taxonomy concepts, condition, free, pickup, and delivery. Project items use topic/category, concepts, difficulty, and required-component concepts. Material type is absent. Hidden intent, cohort, future behavior, exposure source/rank, titles, descriptions, raw IDs, and hashed IDs as metadata are absent. Identity columns exist only in explicit warm/pure configurations.

## 4. Training views and masks

Models use resolved Slice 1 weights without changing caps, reversals, outcomes, or decay. Slice 2 masks are recomputed from the same deterministic contract and verified before fit. Masked-user/item train rows are absent; held-out rows and metadata remain. Original Parquet logical hashes are unchanged.

Training interaction shapes are 300×161 materials and 300×29 projects. Nonzero counts by seed are materials `1,918 / 1,564 / 828` and projects `962 / 794 / 1,412`. Training weights span the unchanged resolved weights; exact min/median/max are retained per artifact.

## 5. Model families

- Pure collaborative: WARP with user/item identity features only.
- Hybrid warm: WARP with identity plus approved metadata.
- Hybrid cold representation: the selected hybrid model scored masked entities with the same trained feature namespace but identity entries removed from those rows. Tests inspect the sparse rows and prove forbidden identities are zero.

Pure collaborative cold output is explicitly `UNAVAILABLE_FOR_TRUE_COLD_START`; it is never converted to a zero score. Domains have separate mappings, matrices, configurations, and decisions.

## 6. Hyperparameter search

Four predefined deterministic trials per domain/family—well below the 24-trial cap—covered 8/16/32 components, 5/10/20 epochs, learning rates .01/.03, and regularization 0/1e-6/1e-5. Only validation NDCG@10 from Seeds 11 and 29 selected configurations. Search fit time was approximately .095s material pure, .290s material hybrid, .047s project pure, and .167s project hybrid. Seed 47 was not loaded by selection and was evaluated only after freeze.

## 7. Frozen configurations

| Domain | Family | Components | Epochs | LR | User/item alpha |
|---|---|---:|---:|---:|---:|
| Material | Pure | 32 | 10 | .03 | 1e-6 |
| Material | Hybrid | 16 | 10 | .03 | 1e-6 |
| Project | Pure | 16 | 20 | .01 | 1e-5 |
| Project | Hybrid | 32 | 10 | .03 | 1e-6 |

Selected validation NDCG@10 was `.08283` material pure, `.19762` material hybrid, `.18978` project pure, and `.24370` project hybrid.

## 8. Primary temporal metrics

Test full-catalog metrics are primary. The compact table reports NDCG@10 / Recall@10 / catalog coverage.

| Seed | Domain | Pure | Hybrid |
|---:|---|---|---|
| 11 | Material | .0985 / .1124 / .453 | .2182 / .2563 / .870 |
| 11 | Project | .1914 / .3620 / .655 | .2487 / .4050 / 1.000 |
| 29 | Material | .1046 / .1333 / .323 | .2486 / .3286 / .839 |
| 29 | Project | .1818 / .3247 / .655 | .2176 / .3609 / 1.000 |
| 47 | Material | .0816 / .1250 / .087 | .2236 / .3011 / .609 |
| 47 | Project | .1920 / .3129 / .897 | .2335 / .3671 / 1.000 |

The ignored result contains Precision, Recall, NDCG, and Hit Rate at 5/10; MRR; long-tail coverage; average recommended popularity; concentration; and prediction timing for every seed/domain/family. Hybrid long-tail coverage is `.837/.798/.512` for materials and `1.0` for projects across Seeds 11/29/47.

## 9. Baseline comparisons

Against interest/category popularity, hybrid per-user mean NDCG@10 deltas were `.1535`, `.1755`, `.1686` for materials and `.0701`, `.0516`, `.0536` for projects on Seeds 11/29/47. Pure deltas were positive but materially smaller. Identical candidate universes are enforced through the Slice 2 service. Popularity uses only masked training rows; held-out behavior contributes only targets.

## 10. Paired per-user results

Hybrid improved/regressed/unchanged counts versus interest-aware popularity were `72/16/61`, `70/15/50`, `21/2/17` for material Seeds 11/29/47, and `60/33/36`, `49/33/47`, `78/51/55` for projects. The result artifact includes percentages, mean/median/p25/p75, materially positive/negative counts, and stable/gradual/abrupt/exploratory/noisy plus activity-band breakdowns. Cohorts below five users carry `INSUFFICIENT_SYNTHETIC_SUPPORT`.

## 11. Robustness intervals

Deterministic 500-resample paired bootstrap intervals for hybrid minus interest-aware mean NDCG@10 were materials `[.1089,.1985]`, `[.1370,.2176]`, `[.0892,.2561]`; projects `[.0204,.1237]`, `[.0040,.1016]`, `[.0141,.0937]` for Seeds 11/29/47. The artifact also reports the fraction above zero. These are synthetic stability diagnostics, not causal or real-user significance claims.

## 12. Cold-start results

Hybrid metadata-only masked-user NDCG@10 was `.275/.285/.068` for materials and `.288/.293/.293` for projects across seeds. Masked-item NDCG@10 was `.289/.209/.428` for materials and `.305/.257/.213` for projects. Pure results remain unavailable for true cold start. Natural user/item counts are retained from Slice 2; unsupported zero cohorts stay explicit. Project masked-item conclusions remain cautious because only two projects are masked per seed.

## 13. Seed 47 OOD results

Frozen hybrid models retained positive paired means on OOD: `.1686` material and `.0536` project. Material has only 40 eligible test users and two masked-cold test users, so it carries a weak-support warning. Project has 184 eligible users and project-heavy interaction support, but its 29-item saturation warning remains. No configuration, threshold, simulator, or weight was changed after OOD inspection.

## 14. Exposure-bias diagnostics

Hybrid NDCG@10 on all exposed / policy / randomized candidates was: material `.389/.402/.157`, `.386/.373/.142`, `.519/.492/.258`; project `.351/.362/.191`, `.314/.327/.232`, `.276/.291/.180` for Seeds 11/29/47. Advantages contract substantially on randomized exposure. These diagnostic universes do not replace primary full-catalog judgment.

## 15. Controlled scenarios

All 14 Slice 2 scenarios were run through global popularity, interest popularity, pure LightFM, warm hybrid, and hybrid metadata-only representation. Outputs contain controlled category labels only, Top 5/10, candidate counts, and score-source explanations. Every scenario says `NO_RETRAIN`: recent views/likes do not change a fixed LightFM representation before retraining. No short-term reranker was added, and no claim is made that LightFM handles immediate drift.

## 16. Reproducibility

Selected material/project training ran at least twice. The stable mapping/configuration/probe ranking hash matched exactly: `2610b1e238e4d2c6bf2f4f2a082a8b402358a8eab43c28bc5aeca60dee6ce163`. Twelve artifacts were loaded in a fresh process; prediction and Top-K parity passed exactly. Artifact metadata includes model/feature versions, snapshot and simulator hashes, mapping hash, hyperparameters, runtime version, and training timestamp.

## 17. Performance

Selected fit times ranged from `.008–.038s`; full-test prediction loops from `.003–.015s`. Pure artifacts are about 96 KB projects and 233 KB materials; hybrid artifacts are about 189 KB materials and 203 KB projects. Warm feature shapes are 300×334 users, 161×217 materials, and 29×62 projects; pure shapes are identity-only. Serialization is measured per artifact in the ignored output. The complete bounded search and all acceptance evaluations complete in seconds. These timings are engineering evidence only.

## 18. Artifacts

Twelve ignored Pickle bundles exist under `generated/models/seed-*`. Ignored JSON outputs include selected hyperparameters, training metrics, complete test metrics/bootstrap results, and 14 recommendation examples. No model or evaluation dump appears in `git status`.

## 19. Files changed

Four bounded modules were added: `features.py`, `model_io.py`, `recommend.py`, and `train_lightfm.py`; the Slice 2 evaluator and candidate universe were reused. One focused LightFM test module and this report were added. No production file was modified by Slice 3.

## 20. Repository state

Scoped `git diff --check` passes; repository-wide output still reflects the unrelated pre-existing CRLF-heavy dirty tree. Generated models and environments are ignored. No PostgreSQL access or mutation occurred. No Node, Flutter, Prisma, migration, seed, API, scorer, weight, or feature-flag change was made. No commit was created and Slice 4 did not start.

## 21. Material domain result

`COMPETITIVE` on synthetic evidence. Hybrid materially improves primary ranking and coverage over both baselines and pure collaborative LightFM, including OOD and metadata-only masked cohorts. Material OOD sample size and immediate-drift limitations require manual review.

## 22. Project domain result

`COMPETITIVE` on synthetic evidence, with explicit small-catalog/saturation and two-item masked-cohort warnings. Hybrid gains are smaller and regression counts are nontrivial, so the project decision is weaker than the material decision.

## 23. Overall automatic result

`ELIGIBLE_FOR_MANUAL_INTEGRATION_REVIEW`

This result cannot and does not output an integration instruction.

## 24. Known limitations

All behavior is synthetic and exposure-policy affected. The project catalog is only 29 items. Bootstrap intervals describe synthetic-user stability only. LightFM represents learned long-term patterns and does not react to recent actions until its training view changes. No online latency, real-user relevance, production data contract, serving architecture, short-term reranker, or feature flag was evaluated.
