# ImpactLoop recommendation system

**Current architecture — authoritative.**  
Last updated: 2026-08-12.

This document describes how Learner Home recommendation surfaces are built, ranked, observed, and operated today. It is derived from the implemented codebase, not from historical phase plans.

For decision history see [decisions.md](../recommendation/decisions.md). For contracts see [feature-token-contract-v3.md](../recommendation/feature-token-contract-v3.md) and [taxonomy.md](../recommendation/taxonomy.md).

---

## 1. Purpose

ImpactLoop recommendations help learners discover **materials** and **learning projects** that are business-eligible, feasible to reserve, and aligned with interests and behavior. The system optimizes for useful reuse and project progress; clicks and likes are supporting signals.

Two primary ML-ranked surfaces:

- `suggested_materials`
- `suggested_projects`

Other Learner Home sections (saved projects, continue builds, popular projects, free materials near you, materials for saved projects) remain **deterministic or business-driven** unless explicitly documented otherwise.

---

## 2. Serving architecture (ML_PRIMARY)

Intended and implemented primary path:

```text
hard business eligibility
→ bounded candidate retrieval
→ explicit surface eligibility
→ ML candidate recall
→ ML ranking
→ business-safe post-processing
→ visible recommendations
```

When ML cannot safely rank a domain:

```text
deterministic fallback ranking
```

HTTP 200 with deterministic fallback is valid user experience; it is **not** proof that ML served the request.

### Runtime modes

| Mode | Role |
|------|------|
| `ML_PRIMARY` | Default. ML owns ordering when the domain is READY and safely rankable. Deterministic fallback on failure or NOT_READY. |
| `DETERMINISTIC` | Explicit rollback, debug, or comparison. Deterministic ranking only; ML does not affect visible order. |
| `SHADOW` | Evaluation only. Computes ML comparisons without changing served ordering. |

There is **no** active `ML_LOCAL` serving mode. Legacy per-domain `*_SERVING_ENABLED` flags were removed; use `RECOMMENDATION_ML_RUNTIME_MODE` and artifact paths instead.

Configuration: `apps/backend/src/config/env.ts` (`resolveRecommendationMlRuntimeConfig`).

---

## 3. Deterministic responsibilities

Deterministic logic did not disappear. It remains responsible for:

- authentication and access control,
- hard business eligibility (availability, quantity, publication, visibility),
- bounded candidate retrieval from PostgreSQL,
- explicit suggestion-surface eligibility,
- deterministic fallback ranking,
- deterministic-only Learner Home sections,
- business-safe post-processing (deduplication, section limits, saved-project bands).

**Deterministic business rules ≠ deterministic primary ranking.**

Under `ML_PRIMARY`, deterministic scoring still runs for explanations, diagnostics, fallback display, and evaluation tooling — but it must **not** gate which materials reach ML recall.

---

## 4. Material candidate flow (ML_PRIMARY)

```text
DB candidate retrieval
  cap = HOME_MATERIAL_POOL_CAP (120; browse-all section uses 400)
        ↓
hard eligible
  AVAILABLE + availableQuantity > 0 (at load)
        ↓
surface eligible
  explicit business checks only (not score > 0)
        ↓
neutral stable order
  material.id (catalog identity, not personalized deterministic score)
        ↓
ML recall pool
  cap = 120 (aligned with DB retrieval cap)
        ↓
feature mapping + containment retry
        ↓
LightFM rank (TypeScript runtime)
        ↓
post-processing / section assembly
        ↓
suggested_materials display cap = 4
```

### Removed from ML_PRIMARY (historical, not current)

These described an older path and must not be documented as healthy ML_PRIMARY behavior:

```text
score > 0 → deterministic sort → top 48 → ML reorder
```

`score > 0` and tiered deterministic ranking remain valid for:

- explicit `DETERMINISTIC` mode,
- ML failure fallback display,
- explanation/diagnostic scoring,
- ranking-delta evaluation tooling.

### Bounded retrieval (honest limitation)

ML does **not** scan the entire catalog unbounded. Materials are retrieved with a cap (`HOME_MATERIAL_POOL_CAP = 120`). Upstream retrieval may merge relevance, popular, and free buckets — that is **candidate retrieval infrastructure**, not the final personalized ranking owner.

As catalog scale grows, retrieval strategy may evolve; current docs must not promise full-catalog ML scoring.

Implementation: `learner-home.material-candidate-recall.ts`, `learner-home.repository.ts`, `learner-home.service.ts`.

---

## 5. Project candidate flow (ML_PRIMARY)

```text
published / business-eligible project pool
        ↓
ML recall (full eligible pool for suggested_projects)
        ↓
feature mapping + containment
        ↓
ML rank (unsaved project band)
        ↓
saved-project shortage-fill (preserves ML order within band)
        ↓
unmapped tail appended deterministically (containment)
        ↓
suggested_projects display cap = 4
```

Properties:

- Unsaved projects form the normal ML suggestion band.
- Saved projects may appear as shortage-fill; ML relative order within that band is preserved.
- Unmapped projects may appear in a deterministic containment tail — safe partial ML ranking is preferred over fabricated ML scores.
- No hidden deterministic post-ML re-sort of mapped ML-ranked keys.

Other project sections (`saved_projects`, `continue_projects`, `popular_projects`) are not ML-ranked.

---

## 6. ML runtime and artifacts

### Feature construction

Runtime builds weighted feature tokens from learner interests, behavior, taxonomy concepts, and candidate metadata. Contract: `recommendation-feature-token-contract-v3` (v3.0.0).

### LightFM portable artifacts

- Schema: `impactloop-lightfm-portable-v2`
- Current local model lineage: `lm-06-local-lightfm-v1`
- Aggregation: `weighted-sum`
- Taxonomy fingerprint validated semantically on load

Artifacts are integrity-validated. **Never manually edit** semantic content hashes, taxonomy fingerprints, or artifact hashes in generated JSON. When taxonomy or the feature contract changes: export snapshot → retrain → regenerate → validate.

### Local lifecycle (summary)

```text
local DB → snapshot export → runtime-parity features → LightFM train (Linux/WSL)
→ portable v2 artifacts → validate → env paths → preload → READY → ML_PRIMARY
→ smoke → demo preflight
```

Details: [local-ml.md](../development/local-ml.md).

Training writes under `ml/recommendation/generated/` (gitignored). Configure `RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH` and `RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH`.

---

## 7. Candidate containment

ML ranking returns an ordered key list. The runtime:

1. Ranks only safely mapped candidates.
2. Retries by removing unmapped keys when diagnostics identify mapping gaps.
3. Appends unmapped candidates in deterministic tail order when necessary.
4. Never fabricates ML scores for unmapped candidates.

ML-ranked relative order among mapped candidates is preserved. Unmapped tail behavior is explicit and deterministic.

---

## 8. Serving health

**`READY` ≠ proof of ML serving.** A domain can be READY at startup yet fall back per request.

Per-request health kinds (internal / logs / tooling):

| Health | Meaning |
|--------|---------|
| `ML_SERVED` | ML_RANKED + ML-owned visible final order |
| `FALLBACK_EXPECTED` | Intentional fallback (NOT_READY, explicit policy) |
| `FALLBACK_UNEXPECTED` | READY domain expected ML but did not ML_RANK |
| `EXPLICIT_DETERMINISTIC` | DETERMINISTIC mode |
| `SHADOW` | Shadow comparison only |
| `EMPTY` | Empty candidate pool |
| `NOT_APPLICABLE` | Non-recommendation section |

Healthy ML_PRIMARY request for a ranked surface should end: **`ML_RANKED` → ML-owned visible order → `ML_SERVED`**.

Application readiness (`/health/ready`) and recommendation ML health are **intentionally separate**. `/health/ready.recommendationMl` is informational and does not flip process readiness when ML degrades.

Implementation: `recommendation-serving-health.ts`, structured logs `recommendation.serving.outcome`.

---

## 9. Observability

Recommendation serving truth is available through:

- structured logs (`recommendation.serving.outcome`, `recommendation.candidate_pool.audit`),
- internal `servingTruth` evaluation per request,
- startup READY / NOT_READY diagnostics,
- `/health/ready` recommendationMl component (informational),
- `recommendations:ml:smoke:local`,
- demo preflight,
- generation/exposure domain stamps on responses,
- algorithm version stamps (`sm=` material outcome, `sp=` project outcome).

**Flutter users do not see ML diagnostics** (no ML_RANKED/FALLBACK badges in the client).

Details: [recommendation-observability.md](../operations/recommendation-observability.md).

---

## 10. SHADOW, recent intent, and rank fusion

- **SHADOW:** comparison/evaluation only; does not change served ordering.
- **Recent intent / rank fusion:** evaluation-only unless code explicitly proves otherwise. Not active serving logic in ML_PRIMARY today.

Do not document fusion or recent-intent channels as production ranking owners.

---

## 11. Quality and evaluation stance

Evidence supports:

- ML changes final order under ML_PRIMARY,
- final order is ML-owned when ML_SERVED,
- controlled serving coverage is healthy,
- inspected results are plausible.

We have **not** established statistical superiority of ML over deterministic ranking in production. ML is the **current primary serving ranker**; quality tuning remains an empirical process. Offline metrics and shadow comparisons inform decisions; they do not auto-promote behavior.

Experiment spec: [recommendation-evaluation-experiment-spec.ar.md](../recommendation/recommendation-evaluation-experiment-spec.ar.md).

---

## 12. Production configuration (conceptual)

Production-capable serving:

```text
RECOMMENDATION_ML_RUNTIME_MODE=ML_PRIMARY
+ valid material and project artifact paths
+ feature contract / taxonomy compatibility
```

Explicit rollback:

```text
RECOMMENDATION_ML_RUNTIME_MODE=DETERMINISTIC
```

Missing or incompatible artifacts → per-domain NOT_READY → deterministic fallback (process still starts).

See [deployment.md](../deployment.md) and `validate-production-config.ts`.

---

## 13. Related documentation

| Topic | Document |
|-------|----------|
| Local ML runbook | [development/local-ml.md](../development/local-ml.md) |
| Demo data (separate from artifact training) | [demo-data.md](../demo-data.md) |
| Events / outbox | [events.md](../recommendation/events.md), [outbox.md](../recommendation/outbox.md) |
| Decisions | [decisions.md](../recommendation/decisions.md) |
| Historical phases | [history/recommendation/README.md](../history/recommendation/README.md) |

---

## 14. Recommendation vs conversational AI

**Recommendation ML** (LightFM, Learner Home ranking) and **conversational AI** (ImpactLoop Assistant / chat) are separate subsystems. Do not describe them as one model or runtime.

- Recommendation: this document and [ai-system.md](ai-system.md) (boundary section).
- Chat: [01-general-learning-chat.md](../ai/01-general-learning-chat.md).
