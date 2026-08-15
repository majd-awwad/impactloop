# Historical recommendation documentation

> Historical document — not a source of truth for the current implementation. See [architecture/recommendation-system.md](../../architecture/recommendation-system.md).

> **Historical corpus** — these files record earlier design, evaluation, and implementation phases. They are **not** current runtime truth.

**Current architecture:** [architecture/recommendation-system.md](../../architecture/recommendation-system.md)

**Current decisions:** [recommendation/decisions.md](../../recommendation/decisions.md)

---

## What belongs here

Documents moved here describe past work such as:

- deterministic productionization phases,
- taxonomy and normalized-scoring validation,
- LightFM experimentation and slice reports,
- shadow/fusion/release-readiness investigations,
- performance and concurrency studies,
- master plans and task boards superseded by implemented ML_PRIMARY serving.

When a filename contains `slice-`, `phase-`, `master`, or `final`, treat it as historical unless explicitly linked from current docs.

---

## Groups (approximate)

### Deterministic productionization

- `phase-1*.md`, `phase-2*.md` — observability, taxonomy foundation, normalized scoring validation
- `final-recommendation-architecture.md` — 2026-07-18 graduation freeze snapshot
- `ImpactLoop_Recommendation_Production_Master_Plan.md`, `Recommendation_Production_Task_Board.md`
- `implementation-status.md`, `current-state.md` — cumulative logs superseded by canonical architecture doc

### ML experimentation and promotion evidence

- `slice-1-*` through `slice-4e-*` — simulators, baselines, LightFM eval, shadow, runtime alignment, fusion experiments, release readiness
- `slice-4k-controlled-demo-runbook.md` — controlled demo preflight era (pre–ML_PRIMARY default)

### Investigations

- `performance-investigation.md`, `performance-baseline.md`
- `multi-user-concurrency-investigation.md`
- `observability-benchmark.md`
- `taxonomy-investigation.md`

---

## Using historical files

- Cite them for **why** a decision changed, not **what** production does today.
- Prefer [decisions.md](../../recommendation/decisions.md) for durable decision records (REC-* entries).
- Do not copy stale env flags (`*_SERVING_ENABLED`, `ML_LOCAL`) into new runbooks.
