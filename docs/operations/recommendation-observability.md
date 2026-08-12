# Recommendation observability

How to tell whether ML **served** a recommendation request vs fell back to deterministic ranking.

Architecture context: [architecture/recommendation-system.md](../architecture/recommendation-system.md).

---

## Core rule

```text
READY ≠ proof of ML serving
```

Startup may report domain `READY` while a specific request falls back. A healthy ML_PRIMARY request for a ranked surface should end:

```text
ML_RANKED → ML-owned visible order → ML_SERVED
```

---

## Serving health kinds

| Health | Meaning |
|--------|---------|
| `ML_SERVED` | ML ranked and owns final visible order |
| `FALLBACK_EXPECTED` | Intentional fallback (NOT_READY, policy) |
| `FALLBACK_UNEXPECTED` | READY but did not ML_RANK when expected |
| `EXPLICIT_DETERMINISTIC` | DETERMINISTIC mode |
| `SHADOW` | Shadow only; no served reorder |
| `EMPTY` | Empty pool |
| `NOT_APPLICABLE` | Non-ML section |

Implementation: `apps/backend/src/modules/recommendations/recommendation-serving-health.ts`

---

## Structured logs

| Operation | Content |
|-----------|---------|
| `recommendation.serving.outcome` | Domain, decision status, candidate counts, health |
| `recommendation.candidate_pool.audit` | Hard/surface/recall pool metrics (material) |

Log level: DEBUG for audits; WARN when unexpected fallback under ML_PRIMARY.

---

## Internal evaluation

`evaluateRequestServingHealth` / `servingTruth` on each Learner Home assembly — used by smoke and preflight, not exposed in Flutter responses.

---

## HTTP readiness

- `GET /health` — liveness
- `GET /health/ready` — app readiness (DB, workers, etc.)
- `ready.recommendationMl` — **informational** ML snapshot; does not flip `ready: false` on ML degradation

Application readiness and recommendation ML health are intentionally separate.

---

## Tooling

| Command | Purpose |
|---------|---------|
| `npm run recommendations:ml:smoke:local -w apps/backend` | End-to-end ML serving invariants |
| `npm run recommendations:demo:preflight -w apps/backend` | Demo graduation checks (default `both` mode) |

---

## Response stamps

Learner Home responses include algorithm version metadata (e.g. `sm=` material outcome, `sp=` project outcome) for exposure/outbox correlation — not shown as user-facing badges in Flutter.

See [recommendation/events.md](../recommendation/events.md) and [version-registry.md](../recommendation/version-registry.md).

---

## Flutter clients

Users do **not** see ML_RANKED/FALLBACK diagnostics. Observability is operator/backend concern.
