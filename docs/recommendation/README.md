# ImpactLoop Recommendation System

## Purpose

This directory contains the authoritative architecture, evaluation rules, decisions, and implementation status for the ImpactLoop learner recommendation system.

The recommendation system must optimize for useful and feasible material reuse, successful reservations, and project progress. Clicks, views, likes, and saves are supporting signals, not the final product objective.

## Phase 3C — Final Architecture Freeze

The graduation-project recommendation architecture is frozen as a deterministic hybrid recommender with the legacy scorer as the active default. Recommendation observability and supported impression/action attribution remain active when the opt-in outbox worker is enabled. The normalized interest scorer remains opt-in only, and the typed taxonomy foundation remains inactive.

The collection pipeline is technically ready, but real-user pilot execution is deferred because participant recruitment and multi-day collection are outside the current project execution capacity. No real-user evidence exists, and LightFM, ALS, item-KNN, and other collaborative models remain deferred for insufficient real data. See [`final-recommendation-architecture.md`](final-recommendation-architecture.md) and [`phase-3b-real-interaction-pilot.md`](phase-3b-real-interaction-pilot.md).

## Mandatory Principles

1. PostgreSQL remains the transactional source of truth.
2. Material and project eligibility must be validated before results are returned.
3. Availability, remaining quantity, ownership, supplier status, reservation holds, pickup, and delivery constraints are hard business rules. ML models may not override them.
4. Current database performance must be fixed and benchmarked before replacing the recommendation algorithm.
5. Recommendation requests, impressions, visible impressions, actions, algorithm versions, and experiment variants must be recorded before training a production learned ranker.
6. Synthetic data may be used for load testing and controlled simulation, but it must not be presented as proof of real-user recommendation quality.
7. New approaches must be compared against the optimized current rule-based recommender, popularity, recency, and structured knowledge baselines.
8. Model evaluation must use temporal splits, cold-start slices, language slices, category slices, performance measurements, and operational guardrails.
9. Offline metric improvement alone is not sufficient for production adoption.
10. Every new infrastructure dependency must justify its operational complexity through measured quality, performance, or scalability improvement.

## Current Decisions

- Image and multimodal retrieval are outside the current scope.
- Typed domain models are preferred over an unrestricted generic knowledge graph.
- Semantic text retrieval is an experiment, not a guaranteed permanent component.
- LightFM and implicit ALS are experimental collaborative baselines.
- LightFM is not assumed to be the final recommendation architecture.
- Two-Tower retrieval is conditional on real data, catalog scale, quality gains, or demonstrated full-scoring performance limits.
- LambdaMART or another learned ranker is conditional on request-grouped impression data.
- Qdrant and pgvector require a benchmark before adoption.
- Redis online features and a separate Python recommendation service are conditional on a demonstrated online inference requirement.
- The existing weighted recommender is a versioned baseline and reliability fallback, not a protected final design.

The Phase 3C freeze supersedes the current-project execution status of the experimental collaborative-baseline planning items above: they remain future work, are not implemented or trained, and cannot replace the deterministic default without new real-user evidence and a separate decision.

## Official Execution Order

1. Diagnose and fix current Learner Home database performance.
2. Add recommendation request, impression, and action instrumentation.
3. Version the current baseline and explanation codes.
4. Build typed taxonomy, component capabilities, compatibility, aliases, and project requirements.
5. Build a human-labeled material relevance dataset.
6. Compare structured, lexical, and semantic retrieval.
7. Compare LightFM and implicit ALS against the baselines.
8. Review the evidence and decide whether vector retrieval, Two-Tower retrieval, or a separate recommendation service is justified.
9. Train a learned ranker only after sufficient request-grouped impression data exists.
10. Use shadow mode, canary rollout, guardrails, and rollback before production promotion.

Phase 2B establishes the inactive typed taxonomy foundation in [`taxonomy.md`](taxonomy.md). Its validation evidence and activation conditions are recorded in [`phase-2b-validation.md`](phase-2b-validation.md). The foundation is additive only: current recommendation behavior does not read taxonomy concepts, aliases, or mappings.

Phase 2E adds a guarded, scoring-only learner-interest normalization path. It uses a static reviewed learner-interest vocabulary, preserves candidate retrieval and component behavior, and defaults to `legacy-v1`. Validation and activation conditions are recorded in [`phase-2e-normalized-scoring-validation.md`](phase-2e-normalized-scoring-validation.md).

## Phase 1 Observability Domain

Recommendation generation, HTTP exposure, bounded candidate trace, impression, and attributed-action models remain available in normalized PostgreSQL tables. Learner Home and section requests enqueue bounded generation/exposure envelopes through `RecommendationEventOutbox`; supported learner actions enqueue `recommendation-action-outbox-v1` envelopes after successful business responses. An opt-in worker materializes the retained rows with at-least-once idempotent delivery and direct/assisted attribution. The awaited synchronous request-path integration remains rejected. `X-Recommendation-Impression-Id` is an optional CORS-allowed request header; the additive response field remains optional and cache-safe. See `events.md`, `outbox.md`, and `version-registry.md` for the delivery contract and baseline versions.

## Required Reading Rules

For any recommendation-system task, read this file first.

Read `recommendation-evaluation-experiment-spec.ar.md` only when the task involves:

- experiment design;
- metric or dataset definitions;
- semantic retrieval evaluation;
- LightFM, ALS, Two-Tower, or ranking models;
- model comparison or promotion;
- shadow mode or A/B testing;
- performance or operational acceptance gates.

Read `decisions.md` when changing architecture or reversing a prior decision.

Read `implementation-status.md` before claiming that a feature or phase is implemented.

Do not read the complete experiment specification for unrelated frontend, reservation, delivery, authentication, supplier, or administration tasks.

## Slice 4K — Controlled Demo Preflight

Controlled demo preflight command, operator runbook, and accepted policy freeze: [`slice-4k-controlled-demo-runbook.md`](slice-4k-controlled-demo-runbook.md)

## Decision Outcomes

Every experimental phase must end with one of:

- `ADOPT`
- `ADOPT_WITH_CONDITIONS`
- `CONTINUE_EXPERIMENT`
- `DEFER`
- `REJECT`

“Implementation completed” is not sufficient evidence for adoption.

## Phase 1D — Flutter Impression Propagation

The Flutter client treats `recommendationImpressionId` as an optional,
item-scoped field on the existing material and learning-project domain models.
Learner Home recommendation cards pass that value through GoRouter `extra`
when opening the matching detail page. Supported learner actions copy the
same transient value into `X-Recommendation-Impression-Id`; ordinary discovery,
deep links, refreshes without route context, and unrelated actions do not send
the header. The client does not persist the value, place it in URLs, add a
global interceptor, or send a surface header. See `phase-1d-validation.md`
for the journey matrix, isolation guarantees, and validation evidence.
