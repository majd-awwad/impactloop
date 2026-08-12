# ImpactLoop documentation

Developer documentation index. **Start here** before editing code.

For agent coding rules see [AGENTS.md](../AGENTS.md) at the repository root.

---

## Start here

| Topic | Document |
|-------|----------|
| Project overview | [01-project-map.md](01-project-map.md) |
| System architecture | [architecture/system-overview.md](architecture/system-overview.md) |
| Local development | [development/local-development.md](development/local-development.md) |
| Recommendation architecture | [architecture/recommendation-system.md](architecture/recommendation-system.md) |
| Conversational AI | [ai/01-general-learning-chat.md](ai/01-general-learning-chat.md) |
| Demo data | [demo-data.md](demo-data.md) |
| Deployment | [deployment.md](deployment.md) |
| What is implemented | [08-implementation-status.md](08-implementation-status.md) |

---

## Architecture

| Document | Purpose |
|----------|---------|
| [architecture/system-overview.md](architecture/system-overview.md) | Monorepo, backend modules, frontend features |
| [architecture/recommendation-system.md](architecture/recommendation-system.md) | **Authoritative** Learner Home ML_PRIMARY serving |
| [architecture/ai-system.md](architecture/ai-system.md) | Recommendation ML vs conversational AI boundary |

Legacy numbered overview: [02-architecture.md](02-architecture.md) redirects to system-overview.

---

## Development

| Document | Purpose |
|----------|---------|
| [development/local-development.md](development/local-development.md) | Fresh checkout, DB, backend, Flutter |
| [development/local-ml.md](development/local-ml.md) | Snapshot, train, validate, smoke, preflight |

Legacy combined runbook: [local-development-and-ml.md](local-development-and-ml.md) redirects to local-ml.

---

## Recommendation (reference index)

Router: [recommendation/README.md](recommendation/README.md)

| Document | Purpose |
|----------|---------|
| [architecture/recommendation-system.md](architecture/recommendation-system.md) | Current architecture (canonical) |
| [recommendation/decisions.md](recommendation/decisions.md) | Decision ledger |
| [recommendation/taxonomy.md](recommendation/taxonomy.md) | Typed taxonomy foundation |
| [recommendation/feature-token-contract-v3.md](recommendation/feature-token-contract-v3.md) | ML feature tokens |
| [recommendation/events.md](recommendation/events.md) | Recommendation events |
| [recommendation/outbox.md](recommendation/outbox.md) | Outbox delivery |
| [recommendation/version-registry.md](recommendation/version-registry.md) | Version stamps |
| [operations/recommendation-observability.md](operations/recommendation-observability.md) | Serving health and logs |

**Historical recommendation work:** [history/recommendation/README.md](history/recommendation/README.md) — not current runtime truth.

---

## Backend, frontend, database, API

| Area | Entry |
|------|-------|
| API conventions | [04-api-conventions.md](04-api-conventions.md) |
| API catalog | [backend/api-catalog.md](backend/api-catalog.md) |
| Modules | [backend/modules-map.md](backend/modules-map.md) |
| Observability | [backend/observability.md](backend/observability.md) |
| Schema | [database/schema-overview.md](database/schema-overview.md) |
| Flutter routes | [frontend/routes-map.md](frontend/routes-map.md) |
| Theme | [07-theme-system.md](07-theme-system.md) |

---

## Features and flows

| Index | Location |
|-------|----------|
| Features | [features/](features/) |
| User flows | [flows/](flows/) |
| Driver ops | [driver-e2e-verification.md](driver-e2e-verification.md) |

When changing user-visible behavior, update the matching feature/flow doc and [08-implementation-status.md](08-implementation-status.md).

---

## Historical material

| Location | Contents |
|----------|----------|
| [history/recommendation/](history/recommendation/) | Phase/slice reports, old plans, investigations |
| [history/ai/](history/ai/) | Early AI architecture plan |
| [archive/README.md](archive/README.md) | Aspirational product docs, gap stubs |

Historical documents are **not** current architecture. They are kept for archaeology.

---

## Editing guide (quick)

| If you change… | Read/update |
|----------------|-------------|
| Recommendation ranking/serving | [architecture/recommendation-system.md](architecture/recommendation-system.md), [recommendation/decisions.md](recommendation/decisions.md) |
| Flutter UI | [frontend/routes-map.md](frontend/routes-map.md), matching [features/](features/) |
| Backend API | [backend/api-catalog.md](backend/api-catalog.md) |
| Prisma schema | [database/](database/) |
| Local ML artifacts | [development/local-ml.md](development/local-ml.md) |

Legacy router: [00-ai-docs-router.md](00-ai-docs-router.md) — superseded by this index for navigation.
