# ImpactLoop documentation

Canonical documentation index. **Start here** before changing user-visible behavior, APIs, or schema.

**Source of truth order:** checked-in code → [product/implementation-status.md](product/implementation-status.md) → code-derived inventories → feature/flow docs → [archive/](archive/) (historical evidence only).

---

## Getting started

| Document | Purpose |
|----------|---------|
| [development/local-development.md](development/local-development.md) | Fresh checkout, database, backend, Flutter |
| [development/local-ml.md](development/local-ml.md) | LightFM snapshot, train, validate, smoke |
| [demo-data.md](demo-data.md) | Core seed vs community demo seed |
| [deployment.md](deployment.md) | Deployment and environment notes |

---

## Architecture

| Document | Purpose |
|----------|---------|
| [architecture/system-overview.md](architecture/system-overview.md) | Monorepo, modules, request flow |
| [architecture/recommendation-system.md](architecture/recommendation-system.md) | Learner Home ML_PRIMARY serving |
| [architecture/ai-system.md](architecture/ai-system.md) | Recommendation ML vs conversational AI |

---

## Product status

| Document | Purpose |
|----------|---------|
| [product/implementation-status.md](product/implementation-status.md) | Implemented / partial / not built |
| [product/open-questions.md](product/open-questions.md) | Unresolved risks |
| [features/roles-and-capabilities.md](features/roles-and-capabilities.md) | Role capability framing |

---

## Features and flows

| Index | Location |
|-------|----------|
| Features | [features/](features/) |
| User flows | [flows/](flows/) |

Key AI product docs: [features/ai-assistant.md](features/ai-assistant.md) (shipped assistant), [features/ai-material-matching.md](features/ai-material-matching.md) (planned matching — not built).

---

## API and database reference

| Document | Purpose |
|----------|---------|
| [04-api-conventions.md](04-api-conventions.md) | Response shape, auth, errors |
| [backend/api-catalog.md](backend/api-catalog.md) | HTTP endpoints |
| [backend/modules-map.md](backend/modules-map.md) | Backend modules |
| [database/schema-overview.md](database/schema-overview.md) | Prisma relationships |
| [frontend/routes-map.md](frontend/routes-map.md) | Flutter routes |
| [07-theme-system.md](07-theme-system.md) | Theme tokens and auth UI appendix |

---

## Operations

| Document | Purpose |
|----------|---------|
| [operations/recommendation-observability.md](operations/recommendation-observability.md) | Recommendation serving health |
| [operations/email-invitations-setup.md](operations/email-invitations-setup.md) | SMTP invitations |
| [driver-e2e-verification.md](driver-e2e-verification.md) | Driver E2E runbook |

---

## ADRs and archive

| Location | Purpose |
|----------|---------|
| [adr/](adr/) | Accepted architecture decisions |
| [archive/](archive/) | **Historical evidence — not current implementation source of truth** |

When changing behavior, update matching feature/flow docs and [product/implementation-status.md](product/implementation-status.md).
