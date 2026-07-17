# Recommendation Version Registry

| Algorithm | Version | Policy | Surfaces | Status |
|---|---|---|---|---|
| deterministic-hybrid | learner-home-v1 | learner-home-policy-v1 | Learner Home and Learner Home sections | Current baseline |

Change the algorithm version for material candidate generation, eligibility, scoring weights, ranking, section selection, or fallback changes. Keep policy version separate for operational/configuration changes.

## Delivery schema versions

| Event | Schema version | Semantics |
|---|---|---|
| Generation outbox payload | `recommendation-generation-outbox-v1` | One ranking computation with bounded candidate traces |
| Exposure outbox payload | `recommendation-exposure-outbox-v1` | One HTTP exposure with fresh impression IDs |
| Action outbox payload | `recommendation-action-outbox-v1` | One supported learner action with direct/assisted resolution |

Changing payload shape, required fields, bounds, or worker validation requires a new outbox schema version and an explicit compatibility/deployment review. These delivery versions do not change ranking or the learner-home algorithm version.
