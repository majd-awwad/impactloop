# Recommendation Decision Ledger

Current as of: 2026-07-23
Authority: [`current-state.md`](current-state.md)

Implementation proves that a capability exists. Adoption requires explicit evidence and a recorded promotion decision. Dated phase and slice reports remain scoped evidence; they do not independently change production adoption status.

## Active Decisions

| ID | Date | Decision | Status |
|---|---|---|---|
| REC-001 | 2026-07-23 | Keep the deterministic hybrid recommender using `legacy-v1` as the adopted active/default champion. | ACTIVE |
| REC-002 | 2026-07-23 | Retain the normalized scorer and typed taxonomy as implemented foundations without activating them in the adopted default ranking. | ACTIVE_WITH_CONDITIONS |
| REC-003 | 2026-07-23 | Classify LightFM training, portable artifacts, TypeScript scoring, shadow comparison, recent intent, rank fusion, diagnostics, preflight, and serving hooks as experimental implementation rather than adopted production behavior. | CONTINUE_EXPERIMENT |
| REC-004 | 2026-07-23 | Block user-visible ML production promotion until semantic, taxonomy, real-evidence, runtime/artifact, and operational gates are explicitly accepted. | DEFER |
| REC-005 | 2026-07-23 | Evaluate and promote material ML before beginning any project ML promotion. | ACTIVE |
| REC-006 | 2026-07-23 | Require shadow evaluation before canary and canary before broader serving. | ACTIVE |
| REC-007 | 2026-07-23 | Retain the deterministic champion as the comparison baseline, fail-closed response, and immediate rollback path. | ACTIVE |
| REC-008 | 2026-07-23 | Keep recommendation outbox materialization opt-in until deployment, monitoring, and production-like operational evidence are accepted; do not treat infrastructure as sufficient attributed evidence. | ACTIVE_WITH_CONDITIONS |

## Decision Detail

### Deterministic Champion

The deterministic hybrid recommender may deploy after ordinary production hardening. Hard eligibility, availability, ownership, supplier, reservation, pickup, and delivery constraints remain authoritative and may not be overridden by an experimental model.

### Inactive Foundations

`normalized-interests-v2` remains opt-in and `legacy-v1` remains the default. Typed taxonomy concepts, aliases, and mappings remain inactive in the adopted ranking path. Experimental shadow hydration of taxonomy concepts does not constitute champion activation.

### Experimental ML Boundary

The repository contains an experimental LightFM path for materials and projects, including offline training/export, portable artifacts, in-process TypeScript scoring, recent-intent channels, confidence-gated fusion, privacy-safe diagnostics, controlled preflight, and optional serving hooks. These capabilities are disabled by default and do not establish production adoption or proven real-user recommendation quality.

Slice 4K is accepted only as controlled-demo operation of the experimental hooks. It is not a production-promotion decision.

### Promotion Gates

Production promotion remains blocked until a separate review accepts all applicable categories:

1. canonical semantic alignment between training, evaluation, stored user meaning, and runtime features;
2. taxonomy lifecycle, coverage, governance, and project-component/material crosswalk readiness;
3. sufficient real attributed interaction evidence separated from seed, fixture, and synthetic data;
4. reproducible artifact compatibility, deployment, readiness, latency, and fail-safe runtime evidence;
5. registry, monitoring, ownership, guardrail, canary, and rollback operations.

Offline improvement, local shadow success, controlled-demo behavior, or implementation completion alone is insufficient for adoption.

### Release and Rollback Order

Material ML must be evaluated and promoted before project ML. Each domain must proceed through shadow, explicit promotion review, canary, and only then broader serving. At every stage, disabling ML shadow returns the system to deterministic behavior without requiring a schema, API, or client change.

## Historical Context

[`final-recommendation-architecture.md`](final-recommendation-architecture.md) is the preserved 2026-07-18 graduation freeze. Its pre-implementation LightFM status remains historical truth for that snapshot. Later experimental implementation changes the current inventory, not the adopted champion or the meaning of the earlier decision.
