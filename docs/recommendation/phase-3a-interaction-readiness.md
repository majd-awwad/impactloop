# Recommendation Phase 3A — Interaction Dataset and Collaborative-Model Readiness

Profile run: 2026-07-18, local PostgreSQL validation database. The profiler is read-only and emits JSON to stdout by default. It scanned at most 250,000 rows per interaction table; no table hit that bound. No raw interaction export was written.

## 1. Executive Decision

Decision: `COLLECT_MORE_REAL_INTERACTIONS`

The current database is not ready for LightFM, implicit ALS, or item-KNN experiments on trustworthy evidence. It contains 111 resolved interaction rows, but origin classification finds 71 `DEMO_SEED`, 40 `TEST_FIXTURE`, and 0 `REAL_USER` rows. Recommendation impressions, attributed actions, and the outbox are empty. The current real-user matrix therefore has zero observed cells, zero eligible split users, and no collaborative graph.

The accepted deterministic Learner Home baseline remains the comparison baseline. No model was trained, deployed, or added to the runtime.

## 2. Data Sources

| Signal | Model/table | User key | Item key | Timestamp/state | Repeats/reversals | Origin/attribution | Current behavior-profile use | Offline suitability |
|---|---|---|---|---|---|---|---|---|
| Material views | `MaterialView` / `material_views` | `viewerUserId` nullable | `materialId` | `createdAt`, `viewSource` | Repeated rows; no session ID; no reversal | Seed marker or user/item classification; recommendation attribution action can exist separately | Loaded, capped by profile loader at 50 rows; view affinity capped at 3 per material | Weak positive after cap; never an automatic negative |
| Material likes | `MaterialLike` / `material_likes` | `userId` | `materialId` | `createdAt`; active row | Unique active state; no unlike history in this table | Origin classification; attributed `MATERIAL_LIKE`/`MATERIAL_UNLIKE` is separate | Loaded, latest 30 | Positive active state; reversal must override when history exists |
| Reservations | `Reservation` / `reservations` | `requesterId` | `materialId` | `createdAt`, `status`, outcome timestamps | One durable business operation; history in `ReservationStatusHistory` | Origin classification; supported recommendation-created actions are separate | Active profile uses pending/awaiting/accepted/completed only | State-specific; created, accepted, completed, cancelled, rejected, expired, and failure differ |
| Reservation transitions | `ReservationStatusHistory` / `reservation_status_history` | `changedBy` nullable | Via `reservationId` | `createdAt`, old/new status | Repeated transitions retained | No direct recommendation attribution | Not loaded into current behavior profile | Useful for temporal state resolution, not an extra independent positive |
| Material reuse | `Material.reusedAt` and `reusedByReservationId`, plus completed reservation | Via completed reservation requester | `materialId` | `reusedAt` or reservation completion | One material reuse pointer | Attributable only through the linked reservation | Not a separate profile signal | Strong outcome when linked and time-valid; sparse |
| Project views | No persisted `ProjectView` model/table | n/a | n/a | n/a | Unsupported | Not attributable | Not used | Unavailable until an explicitly designed event exists |
| Project likes | `ProjectLike` / `project_likes` | `userId` | `projectId` | `createdAt`; active row | Unique active state; no reversal history in table | Origin classification; recommendation action may record reversal | Loaded, latest 20 | Medium positive; reversal overrides |
| Project saves | `ProjectSave` / `project_saves` | `userId` | `projectId` | `createdAt`; active row | Unique active state; no reversal history in table | Origin classification; recommendation action may record reversal | Loaded, latest 20 | Medium-to-strong intent; reversal overrides |
| Project follows | `ProjectFollow` / `project_follows` | `userId` | `projectId` | `createdAt`; active row | Unique active state; no reversal history in table | Origin classification; recommendation action may record reversal | Loaded, latest 20 | Medium intent; reversal overrides |
| Project builds | `ProjectBuild` / `project_builds` | `learnerId` | `projectId` | `startedAt`, `updatedAt`, `completedAt`, `status` | One build per learner/project; item updates are separate | Origin classification; recommendation build actions are separate | Only `IN_PROGRESS` public builds loaded, latest 10 | Start, progress, and completion are distinct |
| Build progress | `ProjectBuildItem` / `project_build_items` | Through `ProjectBuild.learnerId` | Through `ProjectBuild.projectId` | `updatedAt`, item status | Repeated updates possible; no event log | Recommendation progress action can exist | Used indirectly by current build context | Meaningful progress positive; repeated updates must be deduplicated by build/component |
| Recommendation impressions | `RecommendationImpression` / `recommendation_impressions` | `learnerId` | `entityId` plus `entityType` | `shownAt`, position, score, algorithm version | Unique request/entity/section/position | `eventSource`; action attribution joins by impression | Not in current behavior profile | Exposure/evaluation evidence, not a positive interaction |
| Recommendation actions | `RecommendationAction` / `recommendation_actions` | `learnerId` | `entityId` plus `entityType` | `actionAt`, action type | Source operation ID and impression join support dedupe | `DIRECT` or `ASSISTED`, event source | Not in current behavior profile | Training/evaluation only after volume and bias review |
| Recommendation outbox | `RecommendationEventOutbox` / `recommendation_event_outbox` | Payload only | Payload only | `createdAt`, status | Deduplication key; delivery status | Can measure enqueue backlog/failure | Not a behavior signal | Operational observability only |

Observed counts were: 10 material views, 21 material likes, 52 reservations, 31 reservation-history rows, 6 project likes, 6 project saves, 6 project follows, 3 builds, 0 project views, 0 recommendation impressions, 0 recommendation actions, and 0 outbox rows.

## 3. Data Origin

Origin classification is deterministic and conservative. It prioritizes explicit recommendation `eventSource`, then test markers, then known seed accounts/markers, and otherwise treats an identified user as `REAL_USER`; rows without enough evidence remain `UNKNOWN`. The classifier recognizes the frozen seed marker `[realistic-impactloop-seed]`, `viewSource: seed`, `(Spare Batch)`, known learner/supplier seed accounts, test-internal naming, and recommendation `TEST`/`LOAD_TEST`/`SYNTHETIC` sources.

| Origin | Resolved rows | Users | Interpretation |
|---|---:|---:|---|
| `REAL_USER` | 0 | 0 | No trustworthy real-user interaction evidence in this local database |
| `DEMO_SEED` | 71 | 3 | Main realistic seed behavior and seed reservation/workflow data |
| `TEST_FIXTURE` | 40 | 5 | Test-internal supplier/material/reservation rows |
| `BENCHMARK` | 0 | 0 | No load-test/benchmark interaction rows |
| `UNKNOWN` | 0 | 0 | No unresolved rows in this run |

The local catalog also matches the earlier Phase 2 classification: 199 materials comprise the comparable 159-row frozen seeded population plus 40 clearly named test materials; 30 projects exist, of which 29 are published/public. Persisted rows must not be promoted to “real” merely because they are in PostgreSQL.

## 4. User and Item Population

| Population | All current rows/catalog | Real-user-only evidence |
|---|---:|---:|
| Learner users | 306 | 306 eligible accounts, 0 with real interactions |
| Active learners | 306 | 0 active learners with real interaction evidence |
| Materials | 199 | 199 catalog rows |
| Public/available materials | 160 | 160 catalog rows |
| Projects | 30 | 30 catalog rows |
| Public projects | 29 | 29 catalog rows |
| Learners with at least one interaction | 8 | 0 |
| Users with material interactions | 8 | 0 |
| Users with project interactions | 3 | 0 |
| Users with both domains | 3 | 0 |
| Cold learners | 298 current-row view; 306 real-user view | 306 |
| Cold available materials | 119 current-row view; 160 real-user view | 160 |
| Cold public projects | 23 current-row view; 29 real-user view | 29 |

The “current-row view” includes seed and test rows only and is diagnostic, not promotion evidence. The “real-user view” is the decision-bearing denominator.

## 5. Interaction Distribution

The all-current distribution is over the 8 users with rows, not all 306 registered learners. It is useful for showing how synthetic/test data can look deceptively substantial:

| Distribution | Min | Median | P75 | P90 | P95 | Max |
|---|---:|---:|---:|---:|---:|---:|
| Interactions per user | 1 | 13.5 | 23.25 | 24 | 24 | 24 |
| Unique items per user | 1 | 12.5 | 15.25 | 16.3 | 16.65 | 17 |
| Interactions per material, 199 materials | 0 | 0 | 1 | 1 | 1 | 2 |
| Interactions per project, 30 projects | 0 | 0 | 0 | 3.3 | 6 | 7 |

The 71 demo-seed rows cover 3 users with 23–24 rows and 15–16 unique items per user. The 40 test rows cover 5 users with 1–17 rows and 1–17 unique items per user. Real-user distributions are all zero because there are no real-user rows. Activity-day distributions for real-user training are therefore empty; all current rows span only two UTC activity days.

The repeat interaction rate is not a trustworthy real-user metric in this run. Repeated event rows are resolved before training; missing interactions are never treated as explicit dislikes.

## 6. Matrix Density

The decision-bearing matrices use eligible, deduplicated real-user positives and therefore have zero users with observed real interactions:

| Matrix | Users | Items | Possible cells | Observed pairs | Density | Sparsity |
|---|---:|---:|---:|---:|---:|---:|
| Real user × available material | 0 | 160 | 0 | 0 | 0 | 1 |
| Real user × public project | 0 | 29 | 0 | 0 | 0 | 1 |
| Real combined item space | 0 | 189 | 0 | 0 | 0 | 1 |

For diagnostic context only, combining seed and test rows produces 8 users × 199 materials with 80 observed pairs, density `0.0502513`, sparsity `0.9497487`; and 8 users × 30 projects with 6 observed pairs, density `0.025`, sparsity `0.975`. The combined all-current space would be 8 × 229 with 86 observed pairs, density approximately `0.0469432`, but that row count is synthetic/test evidence and does not justify a combined model.

All-current threshold counts were:

| Matrix | Users below 2/5/10 items | Items below 2/5/10 users |
|---|---|---|
| Material | 1 / 1 / 3 | 199 / 199 / 199 |
| Project | 5 / 8 / 8 | 30 / 30 / 30 |

The real-user matrix threshold counts are zero qualifying users and all catalog items below every multi-user threshold. This is a hard failure for collaborative overlap.

## 7. Graph Connectivity

Graph analysis over all current observed pairs found:

| Graph | Components | Largest component share | User degree min/median/P95/max | Item degree min/median/P95/max | Top co-occurrence evidence |
|---|---:|---:|---|---|---|
| Material, seed/test | 8 | 20.45% | 1 / 11.5 / 15.95 / 17 | 1 / 1 / 1 / 1 | maximum item-pair count 1; user-pair overlap empty |
| Project, seed/test | 3 | 33.33% | 2 / 2 / 2 / 2 | 1 / 1 / 1 / 1 | 3 item pairs with count 1; user-pair overlap empty |
| Material, real only | 0 observed components | 0% | empty | empty | none |
| Project, real only | 0 observed components | 0% | empty | empty | none |

The observed graph has no isolated nodes because the graph routine operates on observed nodes; catalog cold items are reported separately: 119 unavailable/available-catalog cold materials in the current-row view and 23 cold public projects. There is no meaningful multi-user collaborative component. Item-KNN is not justified by three single-count project co-occurrences or single-count material co-occurrences.

## 8. Event State Resolution

The profiler resolves raw events deterministically:

1. Views are ordered by timestamp/id, deduplicated by user/item/day proxy, and capped at three per UTC day. The first is weak positive; capped repeats are slightly stronger. There is no session ID, so this is intentionally conservative.
2. Likes, saves, and follows are grouped by user/entity/family. The latest state wins; a recorded unlike/unsave/unfollow removes the active positive rather than creating universal dislike.
3. Reservations are one business operation. Created/pending, accepted, completed, cancelled, rejected, expired, no-show, and fulfillment-failed states receive distinct meanings. The row is not duplicated as independent positives for every status-history transition.
4. Builds use one start per build, meaningful non-missing component updates as progress, and completed status as a separate strongest outcome. Repeated item updates share the build/component operation key.
5. Impressions without action are exposure evidence, not negative feedback.

Current state counts: reservations were ACCEPTED 36, AWAITING_LEARNER_CONFIRMATION 1, AWAITING_RESOLUTION 2, AWAITING_SUPPLIER_CONFIRMATION 1, CANCELLED 1, COMPLETED 5, EXPIRED 1, PENDING 4, and REJECTED 1. Builds were IN_PROGRESS 3; seven linked/non-missing build items were observed; no completed build was observed. No reversal rows were present, and no view cap was triggered in this run.

## 9. Proposed Confidence Policy

The provisional offline-only policy is in [`interaction-signal-policy.json`](./interaction-signal-policy.json). It records a base weight, sensitivity range, rationale, risk, support status, and reversal behavior for each signal. Examples are view `0.25`, capped repeat view `0.5`, like `2`, save `3`, follow `2.5`, reservation created `4`, accepted `5`, completed `6`, build started `4`, progress `5`, and completed build `6`.

These are not finalized production weights. Current data can verify state semantics and deduplication, but cannot calibrate outcome weights: there are zero real-user labels and zero recommendation-attributed outcomes. Completed builds are explicitly marked unsupported by current volume. Sensitivity must be rerun after real outcomes exist. Missing interactions remain unknown, not negative.

## 10. Attribution and Exposure Bias

Recommendation instrumentation is structurally implemented, but the local data is empty: 0 impressions, 0 actions, 0 outbox rows, 0 direct actions, and 0 assisted actions. Unattributed business actions cannot be measured from the current tables because project views and unsupported direct/deep-link actions do not create recommendation action rows.

Future action policy:

- `DIRECT` actions may be used for evaluation and cautiously for training after sufficient volume.
- `ASSISTED` actions should be included only as lower-confidence evidence or a sensitivity slice.
- Unattributed actions should be excluded from recommendation-attribution training and may be used only in non-attributed aggregate outcome analysis.
- Impressions without action may become bounded evaluation negatives only after a visibility/window rule exists; they are not dislikes.

Exposure bias is material. The current deterministic recommender controls which items receive impressions, so naively training on its actions can reproduce its catalog, popularity, and eligibility biases. Keep algorithm version, surface, section, position, exposure time, and attribution type in the dataset; compare learned candidates against the deterministic baseline and report catalog coverage and cold-start slices.

## 11. Temporal Quality

| Check | Result |
|---|---:|
| Earliest interaction timestamp | `2026-07-15T18:17:11.383Z` |
| Latest interaction timestamp | `2026-07-17T19:57:02.817Z` |
| UTC activity days | 2 |
| Active time span | 3 calendar-day boundary span |
| Users active on multiple days | 0 |
| Items active on multiple days | 0 |
| Interactions before item publication | 10 |
| Future timestamps | 0 |
| Exact duplicate timestamp keys | 0 |
| Impossible reservation orderings | 1 |
| Impossible build orderings | 0 |

The pre-publication count and one impossible reservation ordering must be repaired or excluded before training. The two-day activity concentration is seed/test timing, not a meaningful temporal history. A temporal split is therefore not currently meaningful for real-user evaluation.

## 12. Leakage Risks

- Seeded interactions intentionally match seeded learner interests and should never be evidence of personalization quality.
- Test materials and workflow copies are identifiable but can still inflate catalog coverage and apparent item count. Nine `(Spare Batch)` workflow-copy materials were found.
- Build progress is linked to reservations/materials in seven cases; a model must not see completed or future workflow state before the prediction timestamp.
- Reservation status history and final outcome fields are post-outcome features for earlier prediction points. Use only fields available at the cutoff.
- Active like/save/follow rows represent current state and cannot reconstruct a historical training label without a state-event history.
- Multiple rows for one reservation/build operation must share one operation group and never be split across train and test.
- Recommendation actions are generated by the current deterministic system and are subject to policy/exposure feedback loops.
- Metadata derived from future moderation, completion, reuse, or taxonomy backfill must be timestamped and cutoff-filtered.

Strict cutoff rules: classify origin before any metric; use only event time at or before the cutoff; use item/user metadata as-of cutoff; group reservation/build/status-history rows by durable operation; exclude test/seed/unknown rows from real-user promotion metrics; and never place one operation group in both train and test.

## 13. Evaluation Protocol

The offline comparison should be staged, without implementing models in this phase:

| Candidate | Status in this phase | Protocol |
|---|---|---|
| Baseline 0 — Global Popularity | Ready when real outcomes exist | Eligible catalog popularity, with time decay and coverage reported |
| Baseline 1 — Current Deterministic Recommender | Accepted baseline | Existing learner interests, behavior, material/project signals, location, free/delivery, popularity, and recency; keep `legacy-v1` default |
| Baseline 2 — Personalized Popularity | Conditional | Interest/category/location buckets only where support exists; avoid unsupported cross-domain assumptions |
| Candidate 3 — Item-to-item co-occurrence | Deferred | Require repeated co-occurrence and multi-user overlap first |
| Candidate 4 — LightFM | Deferred | Hybrid implicit matrix with reviewed user/item features after readiness gates pass |
| Candidate 5 — Implicit ALS | Deferred | Stronger collaborative overlap and connected graph required |

Report Recall@K, NDCG@K, MRR/HitRate, catalog coverage, cold-user/item coverage, popularity concentration, exposure-position slices, and outcome-specific metrics. The current deterministic recommender is the required quality and operational comparator.

## 14. Split and Negative Sampling

Random interaction splits are not acceptable as the primary protocol because they can put later likes, completions, or build outcomes in training while earlier predictions are evaluated, and can duplicate a durable reservation/build operation across partitions.

Current qualification: 0 real users qualify for material leave-one-out, temporal per-user, or five-item training gates. In the synthetic/test diagnostic population, only seven users have at least two distinct material items, but that population is excluded from promotion decisions.

Primary future protocol: temporal per-user split after each user has at least five distinct eligible real items and at least one held-out later item. Robustness protocol: leave-one-out per user, with one durable operation group held out. A global time cutoff is useful as a catalog cold-start robustness slice but currently leaves the dataset dominated by seed/test timing and cold items.

Negative sampling must use eligible unseen catalog items, not all unobserved cells. Future options are bounded sampled unseen items, same-window impressions without action after a visibility window, hard negatives in the same category/topic, and popularity-aware samples. Unavailable, owned, already-reserved, or otherwise ineligible materials must not be ordinary negatives.

## 15. Feature Readiness

| Feature | Status | Reason |
|---|---|---|
| Learner interests | Ready with semantic review | Loaded by behavior/profile code; normalized interest path remains opt-in and taxonomy is inactive |
| Preferred city/area | Ready as bucket | Useful convenience feature; do not export exact addresses/coordinates |
| Free/delivery preferences | Ready | Existing profile/business fields; must respect eligibility |
| Material category | Ready | Controlled category field |
| Material type | Needs normalization | Stored as free text; current Phase 2 taxonomy is not active runtime evidence |
| Reviewed material tags | Sparse | Use only reviewed/normalized values |
| Typed taxonomy concepts | Sparse and deferred | Persisted foundation is inactive; mappings/compatibility are incomplete |
| Material free/paid, delivery, location bucket, condition | Ready with business constraints | Eligibility and cold-start features, not substitutes for interaction data |
| Project category/difficulty | Ready | Controlled/structured fields |
| Project tags | Sparse | Review and normalize before use |
| Project components | Needs normalization | Component vocabulary/compatibility gaps remain; do not infer semantic equivalence |
| User/item IDs | Rejected as semantic features | IDs encode identity, not meaning; stable pseudonymous IDs remain join keys only |

## 16. Model Readiness Gates

| Gate | Actual evidence | Result |
|---|---|---|
| LightFM: real users with at least five unique items | 0 | Fail |
| LightFM: items with multiple real users | 0 observed real item pairs | Fail |
| LightFM: valid temporal/leave-one-out test users | 0 | Fail |
| LightFM: usable features | Several structured features ready; taxonomy/components still sparse/deferred | Insufficient alone |
| ALS: real matrix density/overlap | 0 observed real pairs; density 0 | Fail |
| ALS: connected interaction graph | No real graph | Fail |
| ALS: repeated co-interaction patterns | None | Fail |
| Item-KNN: item co-occurrence | Seed/test maximum count 1; real maximum unavailable | Fail |
| Origin separation | Deterministic: 71 seed, 40 test, 0 real | Pass as a data-quality control, not a readiness pass |
| Catalog coverage | 119 of 199 materials and 23 of 30 projects have no current-row interaction; all real catalog rows are cold | Fail for promotion |

LightFM and ALS are not justified merely because a library can train on a small matrix. The exact selected decision is `COLLECT_MORE_REAL_INTERACTIONS`.

## 17. Data Collection Gaps

Before a first offline collaborative experiment, collect at least:

- 50 real learners with at least 5 distinct eligible positive items each (at least 250 deduplicated user-item pairs);
- at least 30 items with interactions from at least 2 real learners, plus a connected collaborative component covering at least 70% of real training users;
- at least 2–4 weeks of real activity across multiple days, with timestamp-valid per-user holdouts;
- recommendation impressions and direct/assisted actions with outbox delivery monitoring;
- enough completed reservations/build outcomes to calibrate the provisional confidence sensitivity ranges;
- a reliable project-view decision or explicit exclusion of project views from the first model;
- historical reversal/state events or a documented limitation that active-state tables are not historical labels.

ALS should wait for a stronger gate: at least 100 real learners with 10 distinct items, 50 items with at least 3 real users, and a connected graph with at least 80% largest-component share. These are proposed collection gates, not claims that the current data meets them.

## 18. Proposed Next Slice

The next slice is data collection and quality monitoring only: preserve the current deterministic recommender, enable/observe the existing durable recommendation event path only through its already-reviewed operational process, and re-run this profiler after real-user volume accumulates. Do not add synthetic rows, change scoring, activate taxonomy, or train a model as a shortcut.

## 19. Files Changed

- [`apps/backend/scripts/evaluate-interaction-readiness.ts`](../../apps/backend/scripts/evaluate-interaction-readiness.ts)
- [`apps/backend/scripts/evaluate-interaction-readiness.test.ts`](../../apps/backend/scripts/evaluate-interaction-readiness.test.ts)
- [`docs/recommendation/interaction-signal-policy.json`](./interaction-signal-policy.json)
- This report.

## 20. Repository State

Focused evaluator tests passed: 9/9. The live profiler completed read-only in approximately 0.77–0.93 seconds, scanned 12 scoped tables plus population queries, held at most 111 interaction rows in this run, used matrix dimensions of 8×199 and 8×30 for all-current diagnostics, and emitted an approximately 14.1 KB pseudonymized profile. No profiling output file remains.

Verification performed:

```text
git status --short
git diff --name-status
git diff --check
```

Confirmed: no production behavior changed; no schema, migration, seed, frontend, API, candidate-query, or scoring-weight file changed; no raw user dataset or database dump was exported; no temporary output remains; no commit was created.

## 21. Decision

`COLLECT_MORE_REAL_INTERACTIONS`

Stop at interaction-data and collaborative-model readiness evaluation. Do not train or deploy LightFM, ALS, item-KNN, Two-Tower, embeddings, vector search, or any learned ranker. Keep the current deterministic Learner Home recommender as the accepted default.
