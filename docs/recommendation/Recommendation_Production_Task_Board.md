# ImpactLoop Recommendation Production Task Board

| ID | Task | Dependency | Release | Status |
|---|---|---|---|---|
| RP-00.1 | Authoritative current state and decisions | — | A | READY |
| RP-00.2 | Deterministic baseline snapshot | RP-00.1 | A | BLOCKED |
| RP-00.3 | Recommendation CI lane | RP-00.2 | A | BLOCKED |
| RP-00.4 | Production configuration validator | RP-03.5, RP-04.1 | A | BLOCKED |
| RP-01.1 | Feature-token contract v3 | RP-00.2 | A/B | BLOCKED |
| RP-01.2 | Category-to-canonical-concept ownership | RP-01.1 | A/B | BLOCKED |
| RP-01.3 | Canonical learner-interest resolver | RP-01.1 | A/B | BLOCKED |
| RP-01.4 | Canonical user features in ML shadow | RP-01.2, RP-01.3 | B | BLOCKED |
| RP-01.5 | Feature coverage/readiness contract | RP-01.4 | B | BLOCKED |
| RP-02.1 | Material concept assignment engine | RP-01.1, RP-01.2 | A | BLOCKED |
| RP-02.2 | Free material create integration | RP-02.1 | A | BLOCKED |
| RP-02.3 | Paid material create integration | RP-02.2 | A | BLOCKED |
| RP-02.4 | Material update taxonomy refresh | RP-02.3 | A | BLOCKED |
| RP-02.5 | Taxonomy coverage/staleness audit | RP-02.4 | A/B | BLOCKED |
| RP-02.6 | Project/component lifecycle integration | RP-02.1 | A | BLOCKED |
| RP-02.7 | Required-component mapping completion | RP-02.6 | A/B | BLOCKED |
| RP-02.8 | Taxonomy relation schema | RP-01.2 | A | BLOCKED |
| RP-02.9 | Reviewed compatibility seed | RP-02.8 | A | BLOCKED |
| RP-02.10 | Compatibility candidate query | RP-02.7, RP-02.9 | A | BLOCKED |
| RP-03.1 | Taxonomy-backed scoring mode | RP-01.3, RP-02.5 | A | BLOCKED |
| RP-03.2 | Taxonomy-backed retrieval mode | RP-02.10, RP-03.1 | A | BLOCKED |
| RP-03.3 | Controlled ranking delta evaluator | RP-03.1 | A | BLOCKED |
| RP-03.4 | Canonical deterministic activation | RP-03.2, RP-03.3 | A | BLOCKED |
| RP-03.5 | Performance/cache audit | RP-03.4 | A | BLOCKED |
| RP-04.1 | Outbox health/deployment contract | RP-00.1 | A/B | BLOCKED |
| RP-04.2 | Event origin/account exclusion | RP-04.1 | B | BLOCKED |
| RP-04.3 | Action reversal/outcome policy | RP-04.2 | B | BLOCKED |
| RP-04.4 | Served versus visible impressions | RP-04.1 | B | BLOCKED |
| RP-04.5 | Attribution quality audit | RP-04.2, RP-04.3, RP-04.4 | B | BLOCKED |
| RP-04.6 | Real training snapshot exporter | RP-04.5 | B | BLOCKED |
| RP-05.1 | Simulator demotion/contract-only use | RP-00.1 | B | BLOCKED |
| RP-05.2 | Real dataset loader/validation | RP-04.6 | B | BLOCKED |
| RP-05.3 | Runtime-parity feature matrices | RP-01.5, RP-05.2 | B | BLOCKED |
| RP-05.4 | Historical candidate/exposure evaluation | RP-05.2 | B | BLOCKED |
| RP-05.5 | Multi-objective model selection | RP-05.3, RP-05.4 | B | BLOCKED |
| RP-05.6 | Feature ablation/aggregation | RP-05.3 | B | BLOCKED |
| RP-05.7 | Artifact schema v2/export parity | RP-05.5, RP-05.6 | B | BLOCKED |
| RP-05.8 | Reproducible Linux training command | RP-05.7 | B | BLOCKED |
| RP-06.1 | Scorer diagnostics/fail-closed result | RP-01.5 | B | BLOCKED |
| RP-06.2 | Startup preload/compatibility | RP-05.7, RP-06.1 | B | BLOCKED |
| RP-06.3 | Artifact cache recovery/portable paths | RP-06.2 | B | BLOCKED |
| RP-06.4 | Timeout/cancellation policy | RP-06.3 | B | BLOCKED |
| RP-06.5 | Split ML shadow monolith | RP-06.1–RP-06.4 | B | BLOCKED |
| RP-06.6 | Shared fusion core/policy | RP-06.5 | B | BLOCKED |
| RP-06.7 | Diagnostic correctness/observability | RP-06.5 | B | BLOCKED |
| RP-06.8 | Candidate scale/latency policy | RP-06.5 | B | BLOCKED |
| RP-06.9 | Explicit serving modes | RP-06.2, RP-06.5 | B | BLOCKED |
| RP-07.1 | Minimal model registry | RP-05.7 | B | BLOCKED |
| RP-07.2 | Promotion gate CLI | RP-06.2, RP-07.1 | B | BLOCKED |
| RP-07.3 | Runtime monitoring thresholds | RP-04.5, RP-06.7 | B | BLOCKED |
| RP-07.4 | Retraining/taxonomy-change policy | RP-07.1 | B | BLOCKED |
| RP-07.5 | Real-traffic shadow report | RP-07.2, RP-07.3, RP-08.1 | B | BLOCKED |
| RP-07.6 | Material canary/rollback | RP-07.5 | B | BLOCKED |
| RP-08.1 | Real-user pilot execution | Release A + RP-04.5 | B | BLOCKED |
| RP-08.2 | Material challenger decision | RP-07.5 | B | BLOCKED |
| RP-08.3 | Project ML decision later | Material decision + project evidence | Later | DEFERRED |
