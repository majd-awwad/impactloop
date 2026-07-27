# Recommendation Version Registry

| Algorithm | Version | Policy | Surfaces | Status |
|---|---|---|---|---|
| deterministic-hybrid | learner-home-v1:`<scorer-version>` | learner-home-policy-v1 | Learner Home and Learner Home sections | Current baseline; scorer defaults to `legacy-v1` |

Change the algorithm version for material candidate generation, eligibility, scoring weights, ranking, section selection, or fallback changes. Keep policy version separate for operational/configuration changes.

## Guarded scorer versions

| Environment variable | Allowed values | Default | Meaning |
|---|---|---|---|
| `RECOMMENDATION_SCORER_VERSION` | `legacy-v1`, `normalized-interests-v2` | `legacy-v1` | Selects the immutable process-lifetime content scorer mode |

Runtime generation and exposure metadata use `learner-home-v1:legacy-v1` or `learner-home-v1:normalized-interests-v2`. Changing this value requires a process restart; the restart clears the in-memory Learner Home cache. Normalized mode is guarded and must not become the default until its cache-miss and concurrency evidence passes the Phase 2E gates.

## Delivery schema versions

| Event | Schema version | Semantics |
|---|---|---|
| Generation outbox payload | `recommendation-generation-outbox-v1` | One ranking computation with bounded candidate traces |
| Exposure outbox payload | `recommendation-exposure-outbox-v1` | One HTTP exposure with fresh impression IDs |
| Action outbox payload | `recommendation-action-outbox-v1` | One supported learner action with direct/assisted resolution |

Changing payload shape, required fields, bounds, or worker validation requires a new outbox schema version and an explicit compatibility/deployment review. These delivery versions do not change ranking or the learner-home algorithm version.
