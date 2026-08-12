# Recommendation System Current State

Date: 2026-07-25
Scope: authoritative current implementation, adoption, and release status

This document is the first authority for the current state of ImpactLoop recommendations. Dated architecture freezes and slice reports remain evidence of what was true or accepted within their original scope, but they do not override this document's current-status classifications.

ImpactLoop's adopted and default recommender remains the deterministic hybrid using `legacy-v1`. A LightFM-based material/project path—including offline training, portable artifacts, in-process TypeScript scoring, shadow comparison, recent-intent channels, confidence-gated rank fusion, and optional feature-flagged serving hooks—exists as an experiment. Its implementation does not constitute production adoption or proven recommendation quality. User-visible ML promotion remains blocked by semantic, taxonomy, real-evidence, runtime/artifact, and operational gates.

## Status by Layer

| Layer | Current status | Included capabilities |
|---|---|---|
| Active production/default behavior | Adopted champion and fail-closed default | Deterministic hybrid candidate retrieval and ranking, hard eligibility and business rules, caching, `legacy-v1`, and deterministic fallback |
| Implemented but inactive foundation | Retained behind opt-in activation or not read by active ranking | Typed taxonomy concepts, aliases, and mappings; canonical learner-interest resolution with explicit unmapped diagnostics; pure material family/form assignment (active on free/paid supplier material create and title-changing supplier material update; read-only RP-02.5 coverage/staleness audit available); **`canonical-taxonomy-v3` opt-in material scoring (RP-03.1; default unchanged)**; `normalized-interests-v2`; durable recommendation observability/outbox infrastructure; opt-in outbox materialization worker |
| Experimental ML/runtime capabilities | Implemented for offline, shadow, controlled-demo, and guarded runtime evaluation; not production-adopted | LightFM training and export, portable artifacts, TypeScript scoring, shadow comparison with **canonical declared-interest user features (RP-01.4)** and **fail-closed feature readiness diagnostics (RP-01.5)**, recent intent, material and project rank fusion, privacy-safe diagnostics, controlled-demo preflight, and optional serving hooks that remain **unconditionally suppressed** while canonical/runtime artifact parity is incomplete |
| Evidence-dependent/deferred capabilities | Blocked pending explicit gates and a separate promotion decision | User-visible production ML serving, sufficient real attributed evidence, taxonomy lifecycle and crosswalk completion, reproducible artifact deployment, registry and monitoring readiness, canary rollout, and project ML promotion |

Recommendation observability envelopes can be enqueued through the durable outbox contract, but the materialization worker is opt-in and disabled by default. The infrastructure's existence does not establish sufficient real attributed evidence for model promotion.

The typed taxonomy foundation is implemented but inactive in the adopted ranking path by default. Experimental runtime code may hydrate taxonomy concepts when ML shadow is enabled. **Opt-in `canonical-taxonomy-v3`** (RP-03.1) consumes persisted material family/form assignments for deterministic material scoring only when explicitly selected; it does not change default ranking or retrieval.

The canonical learner-interest resolver reads the persisted typed-taxonomy registry and resolves stored profile values to active `INTEREST` canonical keys with deterministic provenance, status, type, ambiguity, and custom-interest diagnostics. **RP-01.4 activates that resolver for ML shadow user features only:** shadow builds candidate-independent exact canonical keys (for example `interest:arduino`) at weight 1.0 from resolver output. Serving remains unreachable: even when material/project serving flags are enabled, `rankedCandidateKeys` are never attached and diagnostics report `servingSuppressedReason = CANONICAL_USER_FEATURES_SHADOW_ONLY`. Deterministic Learner Home ordering remains authoritative. Current portable runtime-v2 artifacts still use legacy category-hash user vocabularies, so exact artifact overlap is typically `ZERO_OVERLAP`.

**RP-01.5 activates a fail-closed feature coverage/readiness contract in shadow diagnostics only.** Readiness derives from the parsed v3 feature-token contract (critical vs optional groups, closed enum/boolean universes, unknown/unsupported/invalid classifications, exact foundation taxonomy membership, and explicit artifact contract id/version/fingerprint) without activating portable serving or changing `aggregationBlocked` / `runtimeActivation`. Compatibility requires **explicit** artifact `feature_contract_id`, `feature_contract_version`, and taxonomy fingerprint matching the compiled contract—never inferred from historical `feature_schema_version` lists or vocabulary overlap. When a future contract revision selects an aggregation mode, eventual artifact readiness also requires an explicit `feature_aggregation_mode` matching that selected mode; while `selectedMode` remains null, no artifact aggregation declaration can unlock activation. Dynamic taxonomy tokens are v3-valid only when they are exact `TAXONOMY_CONCEPT_SEEDS` members for the namespace concept type; approved DB concepts outside that foundation remain runtime/catalog concepts until a future feature-contract revision. `coverageStatus` may be `READY` for complete synthetic coverage independently of activation; overall `status` remains `NOT_READY` while the current v3 contract is runtime-inactive, aggregation-blocked, and has no selected aggregation mode (RP-05.6 owns that experiment). Current v1/v2 artifacts declare no metadata and remain overall `NOT_READY`. Project recent-intent/fusion may still run for shadow evidence when mapping integrity is healthy, even while `projectReadinessStatus` / `featureReadiness.status` stay `NOT_READY`. True missing totals are separate from the scorer’s bounded `missingFeatures` sample. Deterministic serving remains authoritative; no serving or promotion gate is passed. RP-06.1 later finalizes scorer-level diagnostics; RP-06.2 later adds startup validation; RP-02.5 material-audit failure remains an independent catalog signal; no Gate B3 pass is implied merely because this contract exists in shadow.

Free and paid supplier material creation (`POST /api/supplier/materials`) now call the pure material-concept assignment engine after final category/materialType/title resolution, load category-owned `MATERIAL_FAMILY` authority and a bounded full taxonomy registry for diagnostics, apply evidence-scoped publish preflight (not a global taxonomy-health gate), and persist `MaterialConcept` family (and optional form) rows in the same create/idempotency transaction. Paid branches re-authorize price-rule / approved-request decisions inside that transaction and consume source requests with conditional unpublished updates. Supplier material update (`PATCH /api/supplier/materials/:id`) refreshes canonical `MaterialConcept` rows only when the final trimmed title differs from the stored title, using the immutable stored `categoryId` and `materialType` inside the same guarded update transaction; non-title updates preserve existing concept rows exactly (including historical gaps). The read-only RP-02.5 material taxonomy audit command (`npx tsx scripts/material-taxonomy-audit.ts`) reports assignment coverage, staleness, registry health, and rule coverage without repairing data. Historical repair remains a separate explicit decision. Item-side material assignment readiness remains incomplete (RP-02.5 catalog findings); that does not authorize item-feature integration in RP-01.4.

**RP-03.1 adds opt-in `canonical-taxonomy-v3` deterministic material scoring** behind `RECOMMENDATION_SCORER_VERSION`. Default remains `legacy-v1`; `normalized-interests-v2` is unchanged. Candidate retrieval, pool caps, and eligibility are unchanged. When selected, Learner Home hydrates `MaterialConcept` family/form profiles for the complete pre-score candidate pool (chunked queries; no 200-row truncation of candidates) plus liked/reserved/viewed behavior IDs under their existing caps, and captures one evaluation timestamp per pool so recency cannot diverge between candidates or pool orderings. There is **no** production learner-interest registry load for this mode: interest→material relations do not exist yet, so interest contribution is always zero with internal `CANONICAL_INTEREST_RELATION_UNAVAILABLE` (not a pretended match attempt). Saved-component lexical matching contributes **zero** under canonical (`CANONICAL_COMPONENT_RELATION_UNAVAILABLE`); RP-02.8–RP-02.10 remain prerequisites. Liked similarity uses exact canonical form (28) / family (14) overlap excluding self; multi-family profiles are fail-closed (`INVALID_FAMILY_CARDINALITY`); every canonical score's component breakdown is contribution-exact (an explicit `unavailablePenalty` field lets -1000 be derived from the breakdown rather than reporting zeros beside a nonzero score). Five legacy/normalized-only helpers (`buildMaterialRecommendationFeature`, `getOrBuildMaterialFeaturePool`, `scoreMaterialPoolWithFeatures`, `assessSuggestedMaterialRelevance`, `buildMaterialScoringSharedState`) are sealed against canonical-taxonomy-v3 via one shared resolver and throw `CanonicalScoringContextRequiredError` if ever invoked with a resolved canonical mode; only `preScoreMaterialPool` and the three direct canonical-aware scorers accept and require an explicit `CanonicalMaterialScoringContext`.

Project scoring under this mode force-delegates to `legacy-v1` (RP-02.6/RP-02.7 incomplete). Algorithm identity is domain-truthful and generation-scoped, tracked internally as a `LearnerHomeModeDecision` (requested/effective material mode, effective project mode, fallback code, cacheable) that is never exposed on the public response. **Project-only section requests (`suggested_projects`, `popular_projects`, `saved_projects`, `continue_projects`) never hydrate `MaterialConcept` rows** under a canonical request, because project scoring already force-delegates to `legacy-v1` and would derive no benefit from that hydration; only full Learner Home and the material sections (`suggested_materials`, `materials_for_saved_projects`, `free_materials_near_you`) perform canonical material hydration. The canonical weak-only fallback gate (location/free/popularity/recency) is based only on canonical-supported material activity (liked/reserved/viewed materials); saved/liked/followed-project and in-progress-build activity does not suppress it, since that project→material semantics is disabled under canonical-taxonomy-v3. Every liked/reserved/viewed behavior signal ID must exist in its respective profile map; a missing map entry is a context invariant (whole-request legacy fallback), while a present entry with `MISSING_CANONICAL_ASSIGNMENT` remains canonical and contributes zero overlap. The exact stamps are:

- material canonical section (`suggested_materials`, `materials_for_saved_projects`, `free_materials_near_you`) on success: `learner-home-v1:canonical-taxonomy-v3`;
- project section (`suggested_projects`, `continue_projects`, `saved_projects`, `popular_projects`) under a canonical request: always `learner-home-v1:legacy-v1`, never canonical;
- successful full-home generation when material is canonical and project is legacy: the explicit mixed stamp `learner-home-v1:material=canonical-taxonomy-v3;project=legacy-v1`;
- whole-request material fallback (canonical loader/context/scorer failure): `learner-home-v1:legacy-v1` for every section and the full-home stamp, with `cacheable=false` and an internal fallback code (`CANONICAL_LOADER_FALLBACK_LEGACY_V1` / `CANONICAL_CONTEXT_INVARIANT_FALLBACK` / `CANONICAL_SCORER_INVARIANT_FALLBACK`) that is never dropped and never exposed publicly.

A fallback result is never written to the Learner Home cache under the canonical mode key; only a successful canonical or legacy/normalized generation is cacheable. Catalog-side concept writes do not invalidate Learner Home caches; scores may be TTL-stale for up to 45s. A bounded current-database dry run (frozen dev persona, identical pre-score candidate pool, legacy-v1 vs canonical-taxonomy-v3) confirmed candidate-ID parity across modes with zero whole-request fallbacks and only factual top-order differences; no promotion decision was made. No Gate A4 pass; RP-03.3 must evaluate ranking deltas before any RP-03.4 default activation. No material repair or exclusion occurred in RP-03.1.

**RP-03.3 adds a read-only, evaluation-only ranking-delta evaluator** (`apps/backend/scripts/evaluate-ranking-delta.ts`, run via `npm run recommendations:evaluate:ranking-delta` for an explicitly supplied `--user-id`/`--email`; never a default or full-table run). It retrieves each learner's material and project candidate pool exactly once, in unmodified retrieval order, and reuses that identical frozen pool to score `legacy-v1`, `normalized-interests-v2`, and requested `canonical-taxonomy-v3` without mutating `process.env.RECOMMENDATION_SCORER_VERSION`, by calling the existing explicit-mode seams (`resolveMaterialModeDecisionAndContext`, `preScoreMaterials`) and the real, now-exported project ranking combinator (`rankProjects`, exported from `learner-home.service.ts` for this reuse; no other change to that file). It reports top-K ranking-delta evidence, canonical taxonomy coverage (reused from the existing `CanonicalMaterialScoringContext` profile map, never a second loader call), and fallback/delegation truthfully, separating a candidate's raw "scoring identity" from production ranking-eligibility filtering so a scorer defect is never mistaken for expected filtering. Because project retrieval is ordered only by `createdAt DESC` with no id tiebreak, the evaluator detects `createdAt` ties in the frozen project pool and fails project ranking-delta evidence closed (`INVALID_NONDETERMINISTIC_RETRIEVAL_ORDER`) rather than publishing an unproven order as reproducible; material evidence, whose retrieval order is fully deterministic at the SQL level, is unaffected. Output is a machine-readable JSON envelope (stdout by default, or an explicit `--report` path never implying repository tracking) with a stable content hash; no report is committed by default. RP-03.3 makes no default-scorer, rollout, retrieval, taxonomy-repair, or ML change, and does not itself constitute a promotion decision.

## Configuration Defaults

These are code-defined defaults, not machine-local environment overrides:

| Configuration | Default | Meaning |
|---|---:|---|
| `RECOMMENDATION_SCORER_VERSION` | `legacy-v1` | Selects the adopted deterministic content scorer; `normalized-interests-v2` remains opt-in; **`canonical-taxonomy-v3` is opt-in material scoring only (RP-03.1)** and is not the default |
| `RECOMMENDATION_ML_SHADOW_ENABLED` | `false` | Skips ML scoring and preserves the deterministic response |
| `RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED` | `false` | Does not permit material ML ordering to be returned |
| `RECOMMENDATION_ML_PROJECT_SERVING_ENABLED` | `false` | Does not permit project ML ordering to be returned |
| `RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH` | empty | No environment-specific material artifact path override |
| `RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH` | empty | No environment-specific project artifact path override |
| `RECOMMENDATION_OUTBOX_WORKER_ENABLED` | `false` | Does not start outbox materialization processing |
| `RECOMMENDATION_OUTBOX_POLL_INTERVAL_MS` | `2000` | Worker polling interval when enabled |
| `RECOMMENDATION_OUTBOX_BATCH_SIZE` | `10` | Maximum rows claimed per worker batch |
| `RECOMMENDATION_OUTBOX_MAX_ATTEMPTS` | `5` | Maximum delivery attempts before dead-letter state |
| `RECOMMENDATION_OUTBOX_LEASE_MS` | `30000` | Worker claim lease duration |

The scorer version is process-scoped. A version or recommendation flag change requires a process restart so configuration and in-memory Learner Home caches are aligned.

## ML Flag Matrix

The three ML booleans are fail-closed. Material and project serving are independently gated.

| Shadow | Material serving | Project serving | Effective behavior |
|---:|---:|---:|---|
| `false` | `false` | `false` | Deterministic response; ML diagnostics report disabled |
| `false` | `true` | `false` | Deterministic response; material serving flag is inert while shadow is off |
| `false` | `false` | `true` | Deterministic response; project serving flag is inert while shadow is off |
| `false` | `true` | `true` | Deterministic response; both serving flags are inert while shadow is off |
| `true` | `false` | `false` | Both domains may score for shadow comparison; no ML ordering is returned |
| `true` | `true` | `false` | Shadow may score materials; **RP-01.4 suppresses serve keys** (`CANONICAL_USER_FEATURES_SHADOW_ONLY`); deterministic order preserved |
| `true` | `false` | `true` | Shadow may score projects; **RP-01.4/RP-01.5 suppress serve keys** even if mapping integrity would previously have been `READY`; current artifacts keep `featureReadiness` / `projectReadinessStatus` as `NOT_READY` |
| `true` | `true` | `true` | Both domains may shadow-score; **no domain returns `rankedCandidateKeys`**; readiness may be `READY` only for synthetic compatible fixtures and still does not attach serve keys |

When shadow is enabled and the learner has non-empty stored interests, each domain shadow invocation loads the learner-interest taxonomy registry once (`loadLearnerInterestResolutionRegistry`). A full Learner Home request that shadows both domains with non-empty interests therefore incurs up to **+2** registry queries in addition to existing ML concept hydration. True `NO_INTERESTS` (`null` / `undefined` / `[]`) short-circuits before taxonomy loading and incurs **zero** registry queries.

Artifact validation, candidate-boundary, scorer, fusion, readiness, and timeout failures return the existing deterministic response. Exact artifact user-feature overlap is reported on shadow diagnostics (`canonicalUserFeatureCount`, `artifactMatchedUserFeatureCount`, `artifactMissingUserFeatureCount`, `artifactUserFeatureOverlapStatus`). Nested `featureReadiness` (RP-01.5) is the fail-closed coverage/readiness authority for shadow; legacy `featureCoverage.activeUserFeatures` / `zeroFeatureUser` describe runtime input list length only and do not control readiness. The outbox worker and normalized scorer flags are independent of ML shadow and serving.

## Promotion Blockers

User-visible ML serving is not approved for production while any applicable blocker remains:

1. **Canonical semantic alignment** — training, evaluation, persisted learner meaning, and runtime features must use the same reviewed semantics without synthetic-only proxies.
2. **Taxonomy lifecycle** — vocabulary ownership, mapping coverage, activation rules, compatibility governance, and the project-component/material crosswalk remain incomplete.
3. **Real attributed evidence** — current synthetic, seed, fixture, and local shadow results are engineering evidence, not proof of real-user recommendation quality; real attributed evidence remains insufficient.
4. **Runtime and artifact readiness** — portable artifact compatibility, reproducible deployment, candidate coverage, latency, readiness checks, and fail-safe behavior require production-like verification.
5. **Operations, registry, and monitoring** — version registration, ownership, guardrails, alerting, promotion records, and rollback monitoring must be operationally ready.

## Release Policy

- The deterministic champion may deploy after ordinary production hardening.
- Material ML must be evaluated and promoted before project ML.
- Shadow evaluation must precede canary rollout, and canary rollout must precede broader serving.
- No user-visible ML promotion occurs until all relevant gates are explicitly accepted in a separate decision.
- The deterministic champion remains the comparison baseline and immediate rollback path throughout experimentation and any future rollout.
- Slice 4K is a controlled-demo runbook for exercising experimental serving hooks; it is not production approval.

## Authoritative Reading Order

1. `current-state.md` — current implementation, adoption, and release status.
2. `decisions.md` — active decision ledger and promotion policy.
3. `implementation-status.md` — cumulative implementation history with dated status snapshots.
4. `final-recommendation-architecture.md` — historical 2026-07-18 graduation freeze; preserve its original evidence and decision in that date's context.
5. Dated phase and slice reports — scoped engineering evidence. In particular, `slice-4k-controlled-demo-runbook.md` documents controlled-demo operation, not adopted production behavior.

Use `recommendation-evaluation-experiment-spec.ar.md` when designing experiments, datasets, metrics, or promotion evidence.

## Last Verified Against Code

Verified on 2026-07-25 against:

- `apps/backend/src/config/env.ts` — recommendation defaults and worker settings.
- `apps/backend/src/modules/recommendations/ml-shadow.service.ts` — shadow-disabled behavior, unconditional RP-01.4 serve-key suppression, canonical user features, RP-01.5 `featureReadiness` attachment, project readiness conjunction, and fail-closed fallback.
- `apps/backend/src/modules/recommendations/recommendation-feature-readiness.ts` — compiled v3-derived feature coverage/readiness evaluator (shadow diagnostics only; current artifacts remain NOT_READY).
- `apps/backend/src/modules/recommendations/canonical-shadow-user-features.ts` — candidate-independent canonical user-feature projection and exact artifact overlap helpers.
- `apps/backend/src/modules/taxonomy/learner-interest-resolver.ts` — canonical stored-interest resolution contract (active for ML shadow user features only).
- `apps/backend/src/modules/taxonomy/material-concept-assignment.ts` — pure category-owned material family/form assignment contract; integrated into free and paid supplier material create (RP-02.2 / RP-02.3) and title-changing supplier material update (RP-02.4).
- `apps/backend/scripts/material-taxonomy-audit.ts` — read-only RP-02.5 coverage/staleness audit; does not activate recommendation scoring or ML.
- `apps/backend/scripts/evaluate-ranking-delta.ts` — read-only RP-03.3 controlled ranking-delta evaluator; reuses existing explicit-mode scorer/ranking seams (including the newly exported `rankProjects`) on one frozen candidate pool; does not change default scorer configuration, retrieval, or taxonomy.
