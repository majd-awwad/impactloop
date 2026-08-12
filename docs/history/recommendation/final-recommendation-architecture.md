# Final Recommendation Architecture Freeze

> **Historical decision snapshot — 2026-07-18.** This document preserves the graduation-freeze evidence and decision as recorded on that date. Later experimental LightFM training, artifacts, TypeScript scoring, shadow, rank-fusion, and optional serving code do not rewrite this history. For current architecture see [../../architecture/recommendation-system.md](../../architecture/recommendation-system.md).

Date: 2026-07-18
Scope: graduation-project architecture and documentation freeze

## 1. Final Architecture

ImpactLoop freezes the following recommendation product state:

```text
Deterministic hybrid recommender: ACTIVE DEFAULT
Normalized interest scorer: IMPLEMENTED, OPT-IN ONLY
Typed taxonomy foundation: IMPLEMENTED, INACTIVE
Recommendation observability: ACTIVE
Impression/action attribution: ACTIVE
Real-user collection pipeline: READY
Real-user pilot: DEFERRED
LightFM/ALS/item-KNN: DEFERRED — INSUFFICIENT REAL DATA
```

The active runtime flow is:

```text
learner profile and interests
  -> deterministic candidate retrieval
  -> content and behavior scoring
  -> location/free/delivery/popularity/recency signals
  -> ranked Learner Home sections
  -> cached response
  -> recommendation impression
  -> optional direct action attribution
```

The deterministic hybrid recommender is the adopted default. It is explainable, versioned, reproducible, and preserves hard eligibility and business constraints before ranking. No compatibility edges, learned model, candidate-retrieval change, or weight change is part of this freeze.

## 2. Active Runtime Features


| Capability                       | Status                  | Runtime                    |
| -------------------------------- | ----------------------- | -------------------------- |
| Deterministic hybrid scoring     | Adopted                 | Active                     |
| Material/project content scoring | Adopted                 | Active                     |
| Behavior-profile scoring         | Adopted                 | Active                     |
| Location/free/delivery signals   | Adopted                 | Active                     |
| Recommendation caching           | Adopted                 | Active                     |
| Durable impression collection    | Adopted                 | Active when worker enabled |
| Action attribution               | Adopted                 | Active when worker enabled |
| Flutter impression propagation   | Adopted                 | Active                     |
| Typed taxonomy                   | Adopted with conditions | Inactive                   |
| Normalized interest scoring      | Feature flag only       | Legacy remains default     |
| Compatibility rules              | Deferred                | Inactive                   |
| Real-user pilot                  | Deferred operationally  | Not executed               |
| LightFM                          | Deferred                | Not implemented            |
| ALS                              | Deferred                | Not implemented            |
| Item-KNN                         | Deferred                | Not implemented            |


The default scorer remains `legacy-v1`. `normalized-interests-v2` remains an explicit opt-in mode only. Typed taxonomy concepts, aliases, and mappings remain an additive inactive foundation and are not read by current retrieval or scoring.

## 3. Collection and Attribution Status

Phase 3B’s technical result remains unchanged:

```text
READY_TO_START_REAL_USER_PILOT
```

The separate operational status is:

```text
REAL_USER_PILOT_EXECUTION = DEFERRED
```

Readiness means the collection path was verified. No real participant session occurred, no real-user interaction evidence was collected, and the offline-modeling gates remain unmet. The Phase 3B protocol and checklist are retained as future operational documentation.

Recommendation generation, exposure, impressions, and supported action attribution use the durable outbox contract and remain asynchronous, bounded, at-least-once, and idempotent. The worker is opt-in and disabled by default. Flutter impression context is item-scoped and optional; direct attribution remains backend-authoritative.

## 4. Evidence and Data Limitations

The Phase 3A evidence is preserved exactly:

```text
Resolved interactions: 111
Demo-seed: 71
Test-fixture: 40
Real-user: 0
Recommendation impressions in evaluated snapshot: 0
Recommendation actions in evaluated snapshot: 0
Real-user matrix density: 0
```

Seeded interactions are suitable for functional testing but are not trustworthy evidence for collaborative learning. Training on them would learn seed-author assumptions rather than real learner preference. No model-quality claim is made, and no synthetic replacement evidence is introduced.

The current architecture is therefore ML-ready, not ML-trained. A model library executing successfully would not satisfy the evidence requirement.

## 5. Deferred Features

The following remain outside the frozen active product:

- LightFM, ALS, item-KNN, Two-Tower, and other learned collaborative models;
- normalized scoring as the default;
- typed taxonomy matching and compatibility edges;
- candidate retrieval, scoring-weight, or ranking changes;
- a real-user pilot during the current project execution;
- public analytics, model training jobs, and production experimentation.

These are deferred rather than rejected permanently. Any future activation requires new evidence, a separate decision, and preservation of the deterministic hybrid baseline for comparison and rollback.

## 6. Academic and Demo Positioning

ImpactLoop currently uses a hybrid rule-based recommender because it must support new users and a new platform without historical collaborative data.

The project also implements the event collection, attribution, taxonomy, evaluation, caching, and versioning infrastructure required for future learned models.

LightFM and ALS were evaluated architecturally but deliberately not trained on synthetic seed behavior, because that would not provide trustworthy evidence of real personalization quality.

The active system should be described as:

- hybrid deterministic recommendation;
- content- and behavior-aware recommendation;
- explainable personalized ranking;
- ML-ready recommendation architecture.

It should not be described as machine learning or as having demonstrated collaborative-model quality.

## 7. Reproducible Demo Scenario

The demo uses existing seeded demonstration accounts for functionality only. All personas below are explicitly seeded demonstration personas, not real-user evidence.

### Electronics/Robotics learner

Show selected electronics and Arduino interests, relevant materials, robotics projects, project-required materials, and the visible effects of location, free-delivery, and delivery-availability signals.

### Crafts/Textiles learner

Show crafts, fabric, and recycling interests, relevant materials and projects, and materials surfaced from saved projects.

### New learner

Show cold-start recommendations based on selected interests and location, with no dependency on prior interactions.

The demo must be narrated as a deterministic functionality walkthrough. It must not be presented as a ranking-quality benchmark or collaborative-learning result.

## 8. Future Modeling Gates

Collaborative modeling may resume only after all of the following project-specific provisional gates are addressed:

- at least 20 real learners have 5 unique eligible interactions;
- at least 10 real learners have 10 unique eligible interactions;
- activity spans at least 7 calendar days;
- multi-user item overlap exists;
- real-user graph connectivity is meaningful;
- temporal or leave-one-out evaluation is possible;
- direct attribution quality is acceptable;
- seed and test rows remain separated.

These are ImpactLoop project gates, not universal standards. Any future model experiment must compare against the frozen deterministic hybrid baseline and report cold-start, temporal, attribution, performance, and operational guardrails.

## 9. Files Changed

- `docs/recommendation/final-recommendation-architecture.md` — final architecture freeze.
- `docs/recommendation/README.md` — current freeze and documentation index update.
- `docs/recommendation/implementation-status.md` — final implementation status update.
- `docs/recommendation/phase-3b-real-interaction-pilot.md` — operational deferral note; technical readiness result preserved.

No runtime code changed. The Phase 3B evaluator, tests, pilot protocol, and collection checklist remain retained and unchanged by this phase.

## 10. Repository State

Verification requirements:

```text
git status --short
git diff --name-status
git diff --check
```

The final repository check must show documentation-only changes for this phase. No runtime code, schema, migration, seed, frontend, API, scorer, ranking weight, or candidate retrieval file changed. No model was trained, no synthetic interaction was added, no real-user claim was introduced, and no commit was created.

FINALIZE_DETERMINISTIC_RECOMMENDER_AND_DEFER_COLLABORATIVE_MODELING
