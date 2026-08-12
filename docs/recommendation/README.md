# ImpactLoop recommendation system

Index for recommendation **reference** documentation. For current architecture read **[architecture/recommendation-system.md](../architecture/recommendation-system.md)** first.

---

## Canonical (current)

| Document | Purpose |
|----------|---------|
| [../architecture/recommendation-system.md](../architecture/recommendation-system.md) | Authoritative serving architecture |
| [decisions.md](decisions.md) | Decision ledger (REC-*) |
| [../development/local-ml.md](../development/local-ml.md) | Local snapshot → train → validate → smoke |
| [../operations/recommendation-observability.md](../operations/recommendation-observability.md) | Serving health and logs |

---

## Contracts and data

| Document | Purpose |
|----------|---------|
| [taxonomy.md](taxonomy.md) | Typed taxonomy foundation |
| [feature-token-contract-v3.md](feature-token-contract-v3.md) | ML feature token contract |
| [material-taxonomy-audit.md](material-taxonomy-audit.md) | Material taxonomy audit methodology |
| [version-registry.md](version-registry.md) | Algorithm / stamp registry |
| [events.md](events.md) | Recommendation events |
| [outbox.md](outbox.md) | Outbox delivery |

---

## Evaluation (when designing experiments)

| Document | Purpose |
|----------|---------|
| [recommendation-evaluation-experiment-spec.ar.md](recommendation-evaluation-experiment-spec.ar.md) | Experiment spec |
| [real-interaction-collection-checklist.md](real-interaction-collection-checklist.md) | Real interaction collection |

Read the experiment spec only for metric design, shadow mode, or promotion reviews — not for routine feature work.

---

## History

Phase, slice, and master-plan documents: [../history/recommendation/README.md](../history/recommendation/README.md)

---

## Principles (unchanged)

1. PostgreSQL remains transactional source of truth.
2. Hard business eligibility precedes ranking.
3. ML must not override availability, quantity, or access rules.
4. Synthetic/fixture data is not proof of real-user quality.
5. Offline improvement alone is insufficient for production claims.

For mandatory engineering principles and observability domain details formerly in this README, see [architecture/recommendation-system.md](../architecture/recommendation-system.md) and [events.md](events.md).
