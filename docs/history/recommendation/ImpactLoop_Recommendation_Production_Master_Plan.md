# ImpactLoop Recommendation System — Production Completion Master Plan

**Prepared from:** `recommendation-repo(1).zip`, `recommendation-artifacts(1).zip`, the Central Problem Register v1, and the supplied recommendation-system lecture/design files.  
**Audit date:** 2026-07-23  
**Purpose:** make the recommendation system safe to deploy, then make learned material ranking eligible for shadow/canary/production through evidence—not merely by turning on feature flags.

---

## 1. Executive decision

This work must produce **two separate production releases**:

### Release A — production-safe recommendation product

Deploy the deterministic hybrid recommender as the champion after:

- canonical bilingual semantics are unified;
- taxonomy is maintained during material/project lifecycle changes;
- deterministic behavior is reproducible and performance-gated;
- recommendation event delivery is observable and trustworthy;
- deployment configuration has a fail-fast validation command;
- ML serving flags remain off.

This release can be completed through engineering and controlled testing without falsely claiming that collaborative personalization has been proven.

### Release B — production ML for materials

Material LightFM ranking can move from experimental code to shadow and then canary only after:

- real attributed interactions exist;
- the training representation exactly matches the portable runtime representation;
- critical feature coverage is complete;
- an immutable artifact passes startup compatibility checks;
- a challenger beats the deterministic champion across agreed metrics and slices;
- shadow health and latency gates pass;
- rollback is tested.

### Project ML is a later release

Project ML must remain later than material ML because the current project catalog/evaluation support is too small and required-component concept coverage is incomplete.

---

## 2. What the supplied repository currently contains

The codebase already has substantial infrastructure:

- deterministic learner-home ranking and section construction;
- an inactive typed taxonomy foundation;
- recommendation generation, impression, action, and outbox tables/services;
- a synthetic simulator and LightFM training/evaluation pipeline;
- portable JSON artifacts and a TypeScript LightFM scorer;
- material/project shadow orchestration, recent intent, confidence, and rank fusion;
- many recommendation-specific tests and reports.

It is **not** production-ready ML. The supplied central register contains **118 findings**:

- 15 Blockers
- 48 High
- 46 Medium
- 9 Low

The supplied artifacts confirm key blockers:

- both artifacts use 19 category-hash-based user interest features;
- the material artifact lacks `condition:NEEDS_REPAIR`;
- the material artifact lacks `pickup:0`;
- user mapping is not based on canonical learner-interest concepts;
- training evidence is synthetic;
- the runtime representation differs from the warm hybrid representation used for model selection.

Important code concentration:

- `ml-shadow.service.ts`: 1,547 lines;
- `learner-home.service.ts`: 1,714 lines;
- `learner-home.repository.ts`: 1,413 lines;
- `recommendation-events.service.ts`: 1,064 lines;
- `recommendation-events.outbox.worker.ts`: 858 lines.

Large-file refactoring is required, but **only after semantic and behavioral contracts are fixed**. Refactoring first would preserve wrong contracts behind cleaner code.

---

## 3. Non-negotiable implementation rules

Every Cursor task must follow these rules:

1. New chat per task.
2. Cursor Plan Mode first; no code until the plan is reviewed.
3. One vertical outcome per task.
4. Prefer 3–6 changed files.
5. **Stop before editing** if more than 8 files are required.
6. Explicit allowed files and forbidden changes.
7. No broad repository scan after the task context has been established.
8. No frontend, backend, database, ML, and docs changes mixed into one slice.
9. No dependency addition unless the task explicitly authorizes it.
10. No ranking-weight change hidden inside a refactor.
11. No user-visible ML serving until the relevant promotion gate passes.
12. Each task ends with changed files, commands run, results, risks, and remaining work.
13. Commit only after review and successful verification.

---

## 4. Release and promotion gates

### Gate A0 — repository truth

- One authoritative current-state document exists.
- Historical/deferred documents are labeled clearly.
- `decisions.md` records active decisions.
- No document claims both “LightFM not implemented” and “LightFM serving exists” without explaining experimental versus adopted status.

### Gate A1 — deterministic reproducibility

- Fixed personas and snapshot data produce stable rankings.
- Tie-breaking is deterministic.
- Candidate IDs, section membership, explanations, and latency are captured.
- A command exits non-zero on a deployment-blocking regression.

### Gate A2 — canonical semantics

- Interest identity uses canonical taxonomy keys, not labels or generated IDs.
- Arabic and English inputs map through Unicode-safe normalization and reviewed aliases.
- `NO_INTERESTS` and `UNMAPPED_INTERESTS` are distinct.
- Deterministic, taxonomy, offline ML, and runtime ML use one semantic contract.

### Gate A3 — catalog lifecycle

- Creating/updating a material maintains its taxonomy concepts.
- Creating/updating a project or required component maintains its concepts.
- Coverage audits surface unmapped/stale entities.
- Published project required-component concept coverage reaches the accepted threshold.

### Gate A4 — deployable deterministic champion

- Canonical scorer/retrieval changes are feature-flagged and evaluated against the frozen champion.
- Eligibility rules remain unchanged and execute before ranking.
- Performance and cache invalidation gates pass.
- Recommendation outbox health is visible.
- Production configuration validation passes with ML serving disabled.

### Gate B1 — trusted real data

- Test/seed/synthetic events are excluded by source.
- Served/impression/action semantics are explicit.
- Idempotency, reversals, and actor/outcome rules are verified.
- Attributed real-user evidence meets the provisional minimum-data gate.

### Gate B2 — valid model experiment

- Training uses real data and temporal evaluation.
- Runtime-parity metadata-only representation is a first-class selected model.
- Candidate universe reflects historical eligibility/exposure.
- Baselines, cold slices, language slices, coverage, diversity, latency, and stability are evaluated.
- Ablations show which feature groups add value.

### Gate B3 — runtime readiness

- Artifact is immutable and preloaded.
- Database/taxonomy/feature/runtime enum contracts are validated at startup.
- Empty or incomplete critical representations fail closed to deterministic ranking.
- Missing-feature totals and samples are accurate.
- Timeout/cache failures do not poison future requests.

### Gate B4 — shadow and canary

- Shadow has no user-visible impact.
- Error, fallback, mapping, coverage, and latency thresholds pass over real traffic.
- Canary is material-only, reversible, and has explicit guardrails.
- Rollback is exercised before broader serving.

---

## 5. Ordered epics and bounded Cursor slices

The IDs below are the persistent task identifiers. Only one task is active at a time.

## Epic 00 — control the work before changing behavior

### RP-00.1 — authoritative current state and decision ledger

**Outcome:** one source of truth that distinguishes active deterministic behavior, inactive taxonomy, experimental ML code/artifacts, and promotion blockers.  
**Fixes:** OP-08, OP-09, OP-10.  
**Files:** documentation only; maximum 6.  
**Gate:** A0.

### RP-00.2 — executable deterministic baseline snapshot

**Outcome:** a command captures frozen persona rankings, candidates, explanations, versions, and timing without invoking ML.  
**Fixes:** baseline/reproducibility prerequisite.  
**Files:** one script, one test, package script, one report/fixture file.  
**Gate:** A1.

### RP-00.3 — recommendation CI lane

**Outcome:** focused backend recommendation tests, ML contract tests, formatting/type checks, and artifact-schema validation run in CI.  
**Files:** workflow, package scripts, at most two helper files.  
**Gate:** A1.

### RP-00.4 — production configuration validator

**Outcome:** a deployment command validates DB connectivity, environment mode, outbox configuration, deterministic champion version, and disabled user-visible ML for Release A.  
**Files:** one script, one test, env docs/package script.  
**Gate:** A4.

---

## Epic 01 — define one canonical semantic contract

### RP-01.1 — feature-token contract v3

**Outcome:** freeze token identity, namespaces, required/optional groups, normalization mode, and allowed runtime values.  
**Decisions:** canonical keys are identity; localized labels and generated DB IDs are not. Avoid doubled tokens such as `concept:material-form:*` and `component:component:*`.  
**Fixes:** RF-01, RF-02, RF-15, RF-16, TX-01.  
**Gate:** A2.

### RP-01.2 — category-to-canonical-concept ownership

**Outcome:** choose and implement one explicit mapping from each active category to a stable canonical taxonomy concept. Do not create a second parallel taxonomy.  
**Likely scope:** Prisma schema + migration + seed/backfill + focused test.  
**Fixes:** RF-15, TX-01, TX-10.  
**Gate:** A2.

### RP-01.3 — canonical learner-interest resolver

**Outcome:** resolve stored interest keys and aliases to active canonical interest concepts with explicit mapped/unmapped diagnostics.  
**Fixes:** RF-03, RF-04, RF-05, TX-09.  
**Gate:** A2.

### RP-01.4 — shadow runtime uses canonical user features

**Outcome:** ML shadow builds user features from the canonical resolver, independently of the candidate pool. Serving remains disabled.  
**Fixes:** RF-03–RF-07.  
**Gate:** A2.

### RP-01.5 — feature coverage/readiness contract

**Outcome:** define critical, optional, unknown, and unsupported features; report true totals and bounded samples; fail closed when critical coverage is below threshold.  
**Fixes:** RF-06, RF-07, RF-12–RF-14, RT-06, RT-07, RT-10, OP-03.  
**Gate:** B3.

---

## Epic 02 — make taxonomy survive real catalog changes

### RP-02.1 — pure material concept assignment engine

**Outcome:** deterministic, reviewable resolver returns canonical concept assignments and explicit unmatched evidence without writing DB rows.  
**Fixes:** TX-02, TX-04, TX-05.  
**Scope:** taxonomy module + focused tests only.

### RP-02.2 — free-material create lifecycle integration

**Outcome:** free material creation writes approved concept mappings in the same transaction.  
**Fixes:** TX-02.  
**Scope:** supplier create path + repository + tests; no paid-path changes.

### RP-02.3 — paid-material create lifecycle integration

**Outcome:** all paid material creation branches apply the same assignment contract without duplicating logic.  
**Fixes:** TX-02.  
**Depends on:** RP-02.2.

### RP-02.4 — material update taxonomy refresh

**Outcome:** relevant title/category/type changes replace stale assignments atomically while preserving reviewed assignments according to policy.  
**Fixes:** TX-03.  
**Gate:** A3.

### RP-02.5 — taxonomy coverage and staleness audit command

**Outcome:** command reports unmapped active materials, stale mappings, inactive concepts, ambiguous aliases, and rule coverage.  
**Fixes:** TX-04, TX-05, OP-11, OP-13, OP-14.

### RP-02.6 — project and required-component lifecycle integration

**Outcome:** project moderation/create/update paths maintain project-topic and component concepts. Split project and component work if more than 8 files are needed.  
**Fixes:** TX-06.

### RP-02.7 — required-component mapping completion

**Outcome:** review/backfill active published project components and enforce an accepted coverage threshold.  
**Fixes:** TX-06.  
**Gate:** A3.

### RP-02.8 — taxonomy relation schema

**Outcome:** represent reviewed relations such as `INTEREST_RELEVANT_TO` and `SATISFIED_BY`; do not overload `parentId`.  
**Scope:** schema/migration/model tests only.

### RP-02.9 — reviewed compatibility seed

**Outcome:** seed idempotent, reviewed interest relevance and component-to-material-form relationships.  
**Depends on:** RP-02.8.

### RP-02.10 — compatibility candidate query

**Outcome:** retrieve materials through reviewed component compatibility, then validate instance availability, quantity, unit, and constraints before ranking.  
**Gate:** A3.

---

## Epic 03 — upgrade the deterministic champion safely

### RP-03.1 — taxonomy-backed scoring mode

**Outcome:** add `canonical-taxonomy-v3` behind a flag; no candidate retrieval changes.  
**Fixes:** TX-01 and deterministic/ML semantic divergence.

### RP-03.2 — taxonomy-backed retrieval mode

**Outcome:** retrieve by canonical interest and compatibility relations while preserving hard eligibility.  
**Depends on:** RP-03.1, RP-02.10.

### RP-03.3 — controlled ranking delta evaluator

**Outcome:** compare legacy, normalized-v2, and canonical-v3 for frozen personas; report gains, losses, explanations, coverage, and section changes.  
**Gate:** A4.

### RP-03.4 — canonical deterministic activation

**Outcome:** change the default only after the controlled evaluator and focused tests pass; keep legacy fallback.  
**Gate:** A4.

### RP-03.5 — post-semantic performance and cache audit

**Outcome:** verify candidate load, request latency, query count, cache hit/miss behavior, and invalidation after interest/material/project changes.  
**Gate:** A4.

---

## Epic 04 — make behavioral evidence trustworthy

### RP-04.1 — outbox worker health and deployment contract

**Outcome:** startup logs/health expose enabled state, polling, retry/dead counts, and graceful shutdown; no silent “ready” claim while disabled.  
**Fixes:** OP-12.

### RP-04.2 — event origin and account exclusion policy

**Outcome:** real, demo-seed, test, load-test, and synthetic origins are unambiguous and enforced in exporters/evaluators.  
**Fixes:** TR-23, OP-12.

### RP-04.3 — action state/reversal policy

**Outcome:** define and test Like→Unlike, Save→Unsave, Follow→Unfollow, repeated views, reservation actor/reason, and business outcome treatment.  
**Fixes:** SIM-20, TR-15, TR-16.

### RP-04.4 — served versus visible impression contract

**Outcome:** keep served impressions correctly named; add rendered/viewable tracking only through a separate backend and frontend slice.  
**Fixes:** exposure ambiguity, TR-17.

### RP-04.5 — attribution quality audit

**Outcome:** command reports direct/assisted attribution, orphan actions, duplication, source mix, coverage, and time lag with fail thresholds.  
**Fixes:** OP-11, OP-12.  
**Gate:** B1.

### RP-04.6 — real training snapshot exporter

**Outcome:** immutable, hashed snapshot of eligible real interactions, exposures, user/item features, source filters, temporal cutoff, and catalog state.  
**Gate:** B1.

---

## Epic 05 — rebuild offline training around runtime parity

### RP-05.1 — demote simulator to contract/load testing

**Outcome:** synthetic data is explicitly prohibited as promotion evidence. Do not spend project time attempting to simulate human truth. Remove or mark behaviorally dead fields and keep only reproducibility/contract scenarios.  
**Addresses:** SIM-01–SIM-28 by scope decision rather than pretending they prove quality.

### RP-05.2 — real dataset loader and validation

**Outcome:** consume RP-04.6 snapshots; validate sources, time order, IDs, eligibility, sparsity, overlap, and minimum evidence.  
**Gate:** B2.

### RP-05.3 — runtime-parity feature matrices

**Outcome:** train/evaluate the exact metadata-only representation the TypeScript runtime serves; identity-enhanced models may be separate challengers but cannot stand in for portable evaluation.  
**Fixes:** TR-03, TR-04.

### RP-05.4 — historical candidate universe and exposure-aware evaluation

**Outcome:** evaluate against eligible candidates at the event cutoff; separate unobserved from exposed-and-ignored; document WARP limitations.  
**Fixes:** TR-01, TR-02, TR-08, TR-16, TR-17.

### RP-05.5 — multi-objective model selection

**Outcome:** compare deterministic, popularity, recency, structured-content, and LightFM using NDCG/Recall/MRR/coverage/diversity/cold/language/latency/stability—not positive mean delta alone.  
**Fixes:** TR-05–TR-14, TR-20.

### RP-05.6 — feature ablation and aggregation experiment

**Outcome:** test category/family, forms, concepts, logistics, difficulty/components, sum versus L1/L2/average, and support thresholds.  
**Fixes:** RF-10, RF-11, TR-18, TR-19.

### RP-05.7 — artifact schema v2 and export parity

**Outcome:** immutable artifact includes feature contract version, taxonomy version/hash, data cutoff/hash, allowed enum/boolean token matrix, aggregation mode, support counts, metrics, and content hash.  
**Fixes:** TX-07, TX-10, OP-02–OP-05, OP-07.

### RP-05.8 — reproducible Linux training command

**Outcome:** pinned environment, one command, deterministic seed/thread policy, artifact verification, and clean output directory. LightFM remains an offline dependency; Node runtime does not depend on Python.  
**Gate:** B2.

---

## Epic 06 — harden and refactor the TypeScript ML runtime

### RP-06.1 — scorer diagnostics and fail-closed result

**Outcome:** scorer returns true missing totals, bounded samples, group coverage, unsupported features, nonfinite checks, and readiness result.  
**Fixes:** RF-12–RF-14, RT-06, RT-07, RT-10.

### RP-06.2 — startup artifact preload and compatibility validation

**Outcome:** active artifacts load before serving readiness; runtime rejects incompatible taxonomy/feature/schema/enum contracts.  
**Fixes:** RT-01, RT-05, TX-10, OP-03–OP-05.

### RP-06.3 — artifact cache failure recovery and portable paths

**Outcome:** rejected promises are evicted; retries are safe; paths resolve relative to deployment configuration; no absolute Windows assumption.  
**Fixes:** RT-02, RT-26.

### RP-06.4 — timeout and cancellation policy

**Outcome:** timeout is configurable and bounded; timed-out work does not continue consuming CPU without control.  
**Fixes:** RT-03, RT-04.

### RP-06.5 — split the shadow monolith

**Outcome:** extract feature building, artifact service, readiness, material orchestration, project orchestration, and diagnostics without behavior changes.  
**Fixes:** RT-14, RT-15.  
**Important:** do this only after RP-06.1–RP-06.4 freeze the contracts.

### RP-06.6 — shared fusion core and explicit policy

**Outcome:** deduplicate material/project fusion mechanics while retaining domain policy adapters; remove unused linear blend from served path or make it diagnostic-only.  
**Fixes:** RT-16, RT-17, RT-21–RT-24.

### RP-06.7 — diagnostic correctness and observability

**Outcome:** correct rank correlation, rename misleading fields, remove duplicate/dead fields/logging, and expose stable aggregate metrics.  
**Fixes:** RT-11–RT-13, RT-18, RT-19, RT-25.

### RP-06.8 — candidate scale and latency policy

**Outcome:** replace unexplained whole-request fallback over 200 candidates with an evaluated cap/chunk/retrieval contract and explicit budgets.  
**Fixes:** RT-09.

### RP-06.9 — explicit serving modes

**Outcome:** `DETERMINISTIC`, `SHADOW`, `CANARY`, and `SERVED` are independent states; serving is not accidentally dependent on the shadow flag.  
**Fixes:** RT-27.

---

## Epic 07 — operations, promotion, monitoring, and rollback

### RP-07.1 — minimal model registry

**Outcome:** immutable versioned manifests record domain, status, hashes, code/data/taxonomy/feature versions, metrics, parent, and deployment state. Avoid MLflow unless measured complexity justifies it.  
**Fixes:** OP-07.

### RP-07.2 — promotion gate CLI

**Outcome:** one command validates artifact integrity, coverage, runtime compatibility, evidence minimums, offline metrics, latency, and rollback target.  
**Fixes:** OP-02–OP-05, OP-07.

### RP-07.3 — runtime monitoring thresholds

**Outcome:** defined alerts/health failures for artifact load, zero/unmapped users, critical missing features, fallback rate, latency, candidate mismatch, outbox lag/dead rows, and source contamination.  
**Fixes:** OP-11.

### RP-07.4 — retraining and taxonomy-change policy

**Outcome:** accepted scheduled/volume/drift/change triggers, challenger evaluation, and non-automatic promotion.  
**Fixes:** OP-01, OP-13, OP-14.

### RP-07.5 — shadow report over real traffic

**Outcome:** compare deterministic champion and material challenger over a fixed real period without serving impact.  
**Gate:** B4.

### RP-07.6 — material canary and rollback

**Outcome:** stable assignment, small percentage, guardrails, automatic/manual rollback path, and post-canary decision record.  
**Gate:** B4.

---

## Epic 08 — evidence-dependent work that code alone cannot complete

### RP-08.1 — real-user pilot execution

Recruit/identify eligible real learners, collect multi-day attributed behavior, and verify data quality. This cannot be replaced by seed data or a better simulator.

### RP-08.2 — material challenger decision

Run RP-05 and RP-07 gates on real data. Outcome must be `ADOPT`, `ADOPT_WITH_CONDITIONS`, `CONTINUE_EXPERIMENT`, `DEFER`, or `REJECT`.

### RP-08.3 — project ML decision later

Resume only after project catalog size, component coverage, interaction overlap, and evaluation support are adequate.

---

## 6. First execution sequence

Do not begin with `ml-shadow.service.ts` refactoring or hyperparameter tuning. Start in this order:

1. RP-00.1 — current-state truth.
2. RP-00.2 — deterministic baseline.
3. RP-01.1 — feature contract v3.
4. RP-01.2 — category/concept ownership.
5. RP-01.3 — interest resolver.
6. RP-02.1 — material assignment engine.
7. RP-02.2 — free create integration.
8. RP-02.3 — paid create integration.
9. RP-02.4 — update refresh.
10. RP-02.5 — coverage audit.
11. RP-01.4 — canonical shadow user features.
12. RP-01.5 — readiness/coverage contract.
13. RP-03.1 — canonical deterministic scorer.
14. RP-03.3 — controlled delta evaluation.
15. Continue through Release A gate before working on real model promotion.

---

## 7. Cursor review loop

For every task:

### Step 1 — Plan prompt

Cursor must read only the named files and return:

1. current flow/root cause;
2. decisions and tradeoffs;
3. exact affected files;
4. implementation steps;
5. tests and commands;
6. migration/rollback concerns;
7. anything that would force the task beyond 8 files.

No code.

### Step 2 — external review

Review the plan against:

- issue IDs;
- task boundaries;
- hard eligibility invariants;
- existing tests/contracts;
- Prisma transaction patterns;
- production failure modes;
- hidden ranking changes.

### Step 3 — bounded implementation prompt

Authorize only the accepted plan and exact files. Require Cursor to stop on scope expansion.

### Step 4 — verification review

Require:

- changed-file list;
- concise diff explanation;
- exact commands/results;
- failed/skipped checks;
- known risks;
- no commit yet.

### Step 5 — commit

Commit only after review. One task, one commit.

---

## 8. What “done” means

The recommendation system is not “production done” when:

- tests pass on synthetic data;
- an artifact loads;
- a feature flag can be enabled;
- code is refactored;
- NDCG improves on simulator-generated behavior.

It is done for Release A when the deterministic champion is semantically correct, reproducible, observable, performant, and deployment-gated.

It is done for Release B when a real-data material challenger passes offline, runtime, shadow, canary, and rollback gates. A valid outcome may still be to keep the deterministic champion if LightFM does not prove an improvement.

---

## 9. Audit limitations

This plan is based on static inspection of the supplied archive, artifacts, reports, and problem register. Dependency installation/test execution was not completed in the sandbox, so Cursor must run the repository’s actual typecheck, focused tests, migrations, and DB-backed scripts in the user’s development environment for every implementation slice.
