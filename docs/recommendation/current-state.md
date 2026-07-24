# Recommendation System Current State

Date: 2026-07-24
Scope: authoritative current implementation, adoption, and release status

This document is the first authority for the current state of ImpactLoop recommendations. Dated architecture freezes and slice reports remain evidence of what was true or accepted within their original scope, but they do not override this document's current-status classifications.

ImpactLoop's adopted and default recommender remains the deterministic hybrid using `legacy-v1`. A LightFM-based material/project path—including offline training, portable artifacts, in-process TypeScript scoring, shadow comparison, recent-intent channels, confidence-gated rank fusion, and optional feature-flagged serving hooks—exists as an experiment. Its implementation does not constitute production adoption or proven recommendation quality. User-visible ML promotion remains blocked by semantic, taxonomy, real-evidence, runtime/artifact, and operational gates.

## Status by Layer

| Layer | Current status | Included capabilities |
|---|---|---|
| Active production/default behavior | Adopted champion and fail-closed default | Deterministic hybrid candidate retrieval and ranking, hard eligibility and business rules, caching, `legacy-v1`, and deterministic fallback |
| Implemented but inactive foundation | Retained behind opt-in activation or not read by active ranking | Typed taxonomy concepts, aliases, and mappings; canonical learner-interest resolution with explicit unmapped diagnostics; pure material family/form assignment (active on free/paid supplier material create and title-changing supplier material update; read-only RP-02.5 coverage/staleness audit available; recommendation paths inactive); `normalized-interests-v2`; durable recommendation observability/outbox infrastructure; opt-in outbox materialization worker |
| Experimental ML/runtime capabilities | Implemented for offline, shadow, controlled-demo, and guarded runtime evaluation; not production-adopted | LightFM training and export, portable artifacts, TypeScript scoring, shadow comparison, recent intent, material and project rank fusion, privacy-safe diagnostics, controlled-demo preflight, and optional serving hooks |
| Evidence-dependent/deferred capabilities | Blocked pending explicit gates and a separate promotion decision | User-visible production ML serving, sufficient real attributed evidence, taxonomy lifecycle and crosswalk completion, reproducible artifact deployment, registry and monitoring readiness, canary rollout, and project ML promotion |

Recommendation observability envelopes can be enqueued through the durable outbox contract, but the materialization worker is opt-in and disabled by default. The infrastructure's existence does not establish sufficient real attributed evidence for model promotion.

The typed taxonomy foundation is implemented but inactive in the adopted ranking path. Experimental runtime code may hydrate taxonomy concepts when ML shadow is enabled; that use does not activate taxonomy in the deterministic champion.

The canonical learner-interest resolver reads the persisted typed-taxonomy registry and resolves stored profile values to active `INTEREST` canonical keys with deterministic provenance, status, type, ambiguity, and custom-interest diagnostics. It is not called by Learner Home, profile APIs, feature generation, or ML shadow in RP-01.3; deterministic and experimental recommendation outputs therefore remain unchanged.

Free and paid supplier material creation (`POST /api/supplier/materials`) now call the pure material-concept assignment engine after final category/materialType/title resolution, load category-owned `MATERIAL_FAMILY` authority and a bounded full taxonomy registry for diagnostics, apply evidence-scoped publish preflight (not a global taxonomy-health gate), and persist `MaterialConcept` family (and optional form) rows in the same create/idempotency transaction. Paid branches re-authorize price-rule / approved-request decisions inside that transaction and consume source requests with conditional unpublished updates. Supplier material update (`PATCH /api/supplier/materials/:id`) refreshes canonical `MaterialConcept` rows only when the final trimmed title differs from the stored title, using the immutable stored `categoryId` and `materialType` inside the same guarded update transaction; non-title updates preserve existing concept rows exactly (including historical gaps). The read-only RP-02.5 material taxonomy audit command (`npx tsx scripts/material-taxonomy-audit.ts`) reports assignment coverage, staleness, registry health, and rule coverage without repairing data. Recommendation consumption and ML shadow still do not call the assignment engine; historical repair remains a separate explicit decision.

## Configuration Defaults

These are code-defined defaults, not machine-local environment overrides:

| Configuration | Default | Meaning |
|---|---:|---|
| `RECOMMENDATION_SCORER_VERSION` | `legacy-v1` | Selects the adopted deterministic content scorer; `normalized-interests-v2` remains opt-in |
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
| `true` | `true` | `false` | Eligible material ordering may be returned; projects remain shadow-only |
| `true` | `false` | `true` | Materials remain shadow-only; project ordering may be returned only when scoring succeeds, runtime readiness is `READY`, and fused ranking keys exist |
| `true` | `true` | `true` | Each domain is independently gated; project serving still requires `READY` and fused ranking keys |

Artifact validation, candidate-boundary, scorer, fusion, readiness, and timeout failures return the existing deterministic response. The outbox worker and normalized scorer flags are independent of ML shadow and serving.

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

Verified on 2026-07-24 against:

- `apps/backend/src/config/env.ts` — recommendation defaults and worker settings.
- `apps/backend/src/modules/recommendations/ml-shadow.service.ts` — shadow-disabled behavior, independent material/project serving gates, project readiness requirements, and fail-closed fallback.
- `apps/backend/src/modules/taxonomy/learner-interest-resolver.ts` — inactive canonical stored-interest resolution contract.
- `apps/backend/src/modules/taxonomy/material-concept-assignment.ts` — pure category-owned material family/form assignment contract; integrated into free and paid supplier material create (RP-02.2 / RP-02.3) and title-changing supplier material update (RP-02.4).
- `apps/backend/scripts/material-taxonomy-audit.ts` — read-only RP-02.5 coverage/staleness audit; does not activate recommendation scoring or ML.
