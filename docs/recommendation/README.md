# ImpactLoop Recommendation System

## Purpose

This directory contains the authoritative architecture, evaluation rules, decisions, and implementation status for the ImpactLoop learner recommendation system.

The recommendation system must optimize for useful and feasible material reuse, successful reservations, and project progress. Clicks, views, likes, and saves are supporting signals, not the final product objective.

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

## Decision Outcomes

Every experimental phase must end with one of:

- `ADOPT`
- `ADOPT_WITH_CONDITIONS`
- `CONTINUE_EXPERIMENT`
- `DEFER`
- `REJECT`

“Implementation completed” is not sufficient evidence for adoption.
