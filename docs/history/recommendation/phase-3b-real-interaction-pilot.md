# Recommendation Phase 3B — Real-Interaction Pilot Readiness

Date: 2026-07-18  
Scope: collection readiness and pilot protocol only

## 1. Executive State

Phase 3A correctly reported `COLLECT_MORE_REAL_INTERACTIONS`: the local database has 71 demo-seed rows, 40 test-fixture rows, and no real-user interaction rows. It also has no materialized recommendation impressions or recommendation actions at the final checkpoint. This is an evidence shortfall, not a failed capture pipeline.

Phase 3B verified that the existing collection path is ready to receive genuine non-seeded learner activity. The verification used read-only profiling plus isolated automated fixtures marked `TEST`; those fixture rows are not counted as pilot evidence and were removed by their test cleanup. No model was trained and no synthetic interaction was added to satisfy a gate.

The distinction is important: the system is ready to start a controlled human pilot, but it is not ready for offline recommendation-model evaluation.

## Phase 3C Operational Note

The collection pipeline passed technical readiness verification. Pilot execution is deferred because real participant recruitment and multi-day collection are outside the current project execution capacity. No real-user evidence was collected.

This operational status does not change the technical readiness result below: `READY_TO_START_REAL_USER_PILOT`.

## 2. Collection Architecture

The verified path is:

```text
Learner Home response
  -> bounded generation/exposure recommendation outbox envelopes
  -> opt-in worker claim and materialization
  -> recommendation impressions
  -> supported learner business action
  -> action outbox envelope
  -> direct or assisted RecommendationAction attribution
```

The request path does not synchronously materialize recommendation generations, requests, impressions, or actions. Outbox delivery is at-least-once and materialization is idempotent. Payloads are bounded and contain opaque identifiers plus bounded metadata; request and response bodies are not serialized.

The worker is intentionally disabled by default. A pilot deployment must enable it explicitly and retain the configured bounds: 2,000 ms poll interval, batch size 10, 30,000 ms lease, five maximum attempts, bounded exponential retry, and `DEAD` after the retry limit. Shutdown stops the worker before the database client disconnects.

## 3. Environment and Origin Rules

Origin is determined from durable event markers and account/item/source evidence, not from the environment name alone:

| Context | Required origin | Rule |
|---|---|---|
| Demo seed or known seeded account | `DEMO_SEED` | Known seed account or seed/content marker remains excluded from real evidence. |
| Automated test | `TEST_FIXTURE` | `eventSource=TEST`, test/fixture markers, or test-only account/content marker. |
| Load or benchmark run | `BENCHMARK` | `eventSource=LOAD_TEST` or an explicit benchmark marker. |
| Internal engineering verification | `TEST_FIXTURE` | Uses isolated accounts and test event source; never relabeled as pilot evidence. |
| Staging/pilot or production human learner | `REAL_USER` | Non-seeded, non-test account with real event source and no contradictory marker. |
| Missing or contradictory identity evidence | `UNKNOWN` | The evaluator does not silently promote an unidentified row to real-user evidence. |

The evaluator keeps seed, test, benchmark, real, and unknown counts separate. A future pilot account must not use known seed accounts, test naming conventions, load-test markers, or test-only event sources.

## 4. End-to-End Capture Verification

The controlled local production-like verification was performed with isolated `TEST_FIXTURE` fixtures and cleanup, so it verifies mechanics without fabricating pilot evidence:

| Stage | Evidence | Result |
|---|---|---|
| Learner Home request | `learner-home.outbox-runtime.test.ts` | Bounded exposure enqueue; no synchronous recommendation-domain write. |
| Generation and exposure materialization | `recommendation-events.outbox.worker.test.ts` | Generation, request, and impressions materialize in order and replay idempotently. |
| Supported learner action | `recommendation-events.action-attribution.test.ts` | Action outbox plan is emitted only after a successful supported learner response. |
| Action materialization | Same attribution suite | Direct and assisted attribution, retry-before-impression, isolation, and duplicate suppression pass. |
| Flutter propagation | `recommendation_impression_headers_test.dart` | Impression IDs survive Learner Home mapping and are carried only on the originating item action. |
| Post-test queue | Read-only evaluator | `PENDING=0`, `PROCESSING=0`, `RETRY=0`, `DEAD=0`; processed test rows were cleaned up. |

The three backend database suites were run independently because the test runner can execute database-backed files concurrently and their fixed fixture cleanup is not a production isolation guarantee. The combined run exposed cross-suite test interference; the isolated reruns passed. This is a test-harness concurrency observation, not a verified runtime capture defect.

## 5. Attribution Results

The action matrix supported by the current response-boundary implementation is:

| Action | Business row | Impression | RecommendationAction | Attribution |
|---|---:|---:|---:|---|
| Material view | required | required | required | direct/assisted |
| Material like/unlike | required | required | required | direct/assisted |
| Reservation create | required | required | required | direct/assisted |
| Project like/unlike | required | required | required | direct/assisted |
| Project save/unsave | required | required | required | direct/assisted |
| Project follow/unfollow | required | required | required | direct/assisted |
| Project build start | required | required | required | direct/assisted |
| Build progress | required | required | direct/assisted | direct/assisted |

Direct attribution requires the authenticated learner, matching entity type and ID, allowed recommendation surface, and a recommendation impression within the bounded attribution window. Assisted attribution is the deterministic latest matching impression when direct context is absent. Foreign learners, mismatched entities, expired impressions, and disallowed surfaces do not create false direct actions. An action arriving while its matching exposure is pending retries as `IMPRESSION_NOT_READY`.

Project views are intentionally unsupported and must remain documented as unsupported rather than silently treated as recommendation actions.

The final live database snapshot contains zero actions, so no real-user direct/assisted ratio exists yet. The automated evidence covers direct attribution, assisted fallback, invalid references, action-before-impression retry, duplicate delivery, and foreign-learner/entity isolation.

## 6. Business-State Semantics

The Phase 3A resolver remains the governing interpretation:

- Likes, saves, and follows resolve to the latest active state; their reversal removes the active positive state while preserving the historical event.
- Reservations remain distinct at created, accepted, completed, cancelled, rejected, expired, and failed/no-show states.
- Project builds remain distinct at started, meaningful progress, completed, and stale/abandoned states.
- Views are capped at three per learner-item UTC day and repeat views receive bounded weaker confidence.
- Durable operation identities prevent duplicate business retries from becoming duplicate training events.

No runtime training weight, ranker, scorer, or model behavior changed in this phase.

## 7. Timestamp and Data Quality

The evaluator checks UTC day handling, future timestamps, duplicate timestamp keys, reservation ordering, build ordering, interaction-before-publication, impression-before-availability, and action-before-impression. The pure timestamp test detects all three invalid orderings; the current database snapshot reported:

- 0 future timestamps;
- 0 duplicate timestamp keys;
- 10 historical interactions before the corresponding catalog publication timestamp in the existing seeded/test data;
- 1 impossible reservation ordering in the existing seeded/test data;
- 0 real-user rows against which to measure pilot temporal quality;
- 0 action-before-impression recommendation actions.

The baseline activity is clustered across two UTC days and has no user or item active across multiple days. This is why it cannot support a temporal model split. Temporary outbox processing delay is acceptable only when the domain timestamps preserve the actual event order.

## 8. Privacy

The evaluator joins account and catalog fields internally to classify origins, but its JSON profile and progress output do not serialize names, emails, phone numbers, tokens, exact addresses, coordinates, reservation notes, project notes, or other free text. Graph relationships use one-way pseudonymous keys. The concise progress mode emits aggregate counts only.

No raw interaction export was created. No personal-data export, dashboard, or retention job was added.

## 9. Pilot Protocol

### Participants and accounts

Use a small group of genuine learners who consent to a controlled product-evaluation pilot. Create or use isolated non-seeded accounts in the selected pilot environment. Keep account ownership, access, and deletion handling under the project’s normal privacy process. Do not reuse demo, test, benchmark, or staff engineering-fixture accounts as external pilot evidence.

### Session setup

1. Confirm the worker is explicitly enabled with the documented bounds.
2. Confirm the baseline queue has no pending, processing, retry, or dead rows.
3. Confirm the selected inventory and projects are available/public and do not require changing unrelated reservations.
4. Give participants a short notice that recommendation impressions and supported actions are collected for product evaluation, with a contact for deletion or withdrawal requests.

### Natural journeys

Encourage normal exploration rather than quotas. Participants may open Learner Home, open a recommended material, like or unlike it where that reflects their actual intent, create a reservation only for agreed isolated inventory, open a recommended project, like/save/follow it, start a build, and record meaningful build progress. Do not instruct participants to repeat likes, views, saves, or follows solely to increase counts.

Project views remain an unsupported recommendation event. Bugs, accidental duplicate taps, and abandoned flows are recorded separately as QA observations and are not manually relabeled.

### Activity period and deletion

Run the initial pilot for at least seven calendar days, with natural activity on multiple days. A participant deletion request removes or quarantines that participant’s associated evidence according to the project’s approved data-retention process; the evaluator must then be rerun and the checkpoint documented. Do not copy raw participant rows into reports.

## 10. Readiness Gates

These are provisional ImpactLoop gates, not universal industry standards. They are sized to the current catalog of approximately 160 public available materials and 29 public projects.

| Gate | Proposed threshold before offline modeling | Rationale |
|---|---:|---|
| Real learner depth | 20 real learners with at least 5 unique eligible items; 10 with at least 10 | Separates a small pilot from a few power users and gives leave-one-out evaluation some support. |
| Multi-day activity | 10 real learners active on at least 2 UTC days; at least 7 calendar days represented | Prevents a single-session temporal split. |
| Material coverage | 10 materials seen/acted on by at least 3 real learners; cold public-material share at or below 60% | Provides repeated evidence without demanding full coverage of a 160-item catalog. |
| Project coverage | 5 projects seen/acted on by at least 3 real learners; cold public-project share at or below 60% | Avoids declaring project recommendations supported by one learner or one cluster. |
| Graph quality | Largest real-user/item component at least 70%; at least 5 non-zero item co-occurrences | Requires overlap beyond isolated users and one synthetic-looking group. |
| Split eligibility | At least 10 real learners qualify for material leave-one-out; at least 5 have 10 unique items | Makes both a conservative and a deeper split possible. |
| Attribution quality | At least 90% of recommendation-attributed actions direct; assisted actions reported separately; invalid references 0 | Direct context is the stronger signal and must dominate the modeling dataset. |
| Queue health | Pending, processing, retry, and dead all 0 at each checkpoint; no unexplained enqueue-loss incident | Ensures observed absence is not an operational delivery failure. |

The pilot can start before these modeling gates are met because the purpose of this phase is collection readiness. The modeling gates must not be waived merely because a model library can execute.

## 11. Progress Command

From the repository root, run:

```text
node --import tsx apps/backend/scripts/evaluate-interaction-readiness.ts --progress
```

The command is read-only and prints aggregate counters for real users with interactions, real users with 2/5/10 unique items, real active days, material/project observed pairs, matrix density, item multi-user coverage at 2/3/5 users, direct/assisted attribution, queue backlog/dead count, split eligibility, and the current Phase 3A readiness decision. It excludes `DEMO_SEED`, `TEST_FIXTURE`, and `BENCHMARK` rows from real-user progress counters.

The full JSON profile remains available through the existing evaluator for detailed internal review. Do not publish it or attach raw database extracts to pilot reports.

## 12. Checkpoints

Rerun the progress command and record only aggregate results:

1. After the first human pilot session.
2. After the first five real pilot users.
3. After seven calendar days with multi-day activity.
4. After the provisional depth and coverage gates are plausibly met.
5. Immediately before any offline model experiment.

At every checkpoint verify the queue status, origin counts, attribution counts, temporal checks, and privacy-safe output. No automated model-training job is scheduled by this phase.

## 13. Known Gaps

- The live database has no real-user evidence yet; this cannot be manufactured by code.
- Project views and some non-learner lifecycle events are intentionally unsupported.
- The worker is disabled by default and requires explicit pilot deployment configuration.
- Enqueue failures are non-fatal to the business response, so lost telemetry must be monitored operationally.
- Retention cleanup is not automated.
- The baseline has too few real rows for meaningful temporal, graph, cold-item, or attribution-rate conclusions.
- The combined database test invocation is unsafe because fixture cleanup can overlap; the scoped suites should be run independently in verification runs.

## 14. Files Changed

- `apps/backend/scripts/evaluate-interaction-readiness.ts` — added queue status profiling, temporal ordering counters, threshold metrics, and `--progress` output; no writes added.
- `apps/backend/scripts/evaluate-interaction-readiness.test.ts` — added collection-readiness, timestamp, progress determinism, and privacy-output tests.
- `docs/recommendation/phase-3b-real-interaction-pilot.md` — this report and protocol.
- `docs/recommendation/real-interaction-collection-checklist.md` — operational checklist.

No production runtime module, schema, migration, seed, scorer, ranker, or UI file changed.

## 15. Repository State

Verification completed:

- `git status --short` shows only the two evaluator files modified plus the two Phase 3B documentation files added by this phase.
- `git diff --name-status` shows only the evaluator edits; newly added documentation is untracked until the user stages it.
- `git diff --check` is clean.
- No model was trained.
- No synthetic interaction was added to satisfy a gate.
- No seed, schema, or migration changed.
- No raw user export or temporary profile artifact remains.
- The isolated database-backed test fixtures cleaned up and the final queue snapshot is empty except for any retained processed rows permitted by the existing policy; this local snapshot had no remaining outbox backlog or dead rows.
- No commit was created.

## 16. Decision

The collection path is ready for a controlled human pilot. The current evaluator will continue to report `COLLECT_MORE_REAL_INTERACTIONS` until genuine non-seeded activity satisfies the separate offline-modeling gates above.

READY_TO_START_REAL_USER_PILOT
