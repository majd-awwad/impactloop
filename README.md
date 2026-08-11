# ImpactLoop

ImpactLoop is a graduation software project for reusing surplus educational materials, browsing learning projects, reserving materials, and (planned) internal delivery.

**Source of truth for what exists today:** checked-out code and the inventory docs below — not older requirement drafts alone.

## Repository layout

```
impactloop/
  AGENTS.md                 # Agent and team coding rules
  apps/
    backend/                # Node.js + Express + Prisma API
    frontend/               # Flutter (mobile + web)
  docs/                     # Project documentation (see index below)
  .cursor/                  # Cursor rules and skills
```

**Inspected:** repository root, `package.json`, `apps/backend/package.json`, `apps/frontend/pubspec.yaml`

## Tech stack (as implemented)

| Layer | Stack |
|-------|--------|
| Backend | Node.js, Express 5, TypeScript, Prisma, PostgreSQL + PostGIS |
| Frontend | Flutter, Riverpod, GoRouter, Dio |
| Auth | JWT access tokens + refresh tokens (`auth_tokens`) |

## Quick start

### Backend

```bash
# From repo root
npm install
npm run backend:dev
```

Default API base: `http://localhost:4000` (see `apps/backend/src/config/env.ts` — port from `PORT`, default `4000`).

From **repo root** (npm workspace):

- `npm run backend:dev` — development server
- `npm run backend:build` — TypeScript build
- `npm run backend:typecheck` — typecheck

From repo root via workspace (`-w apps/backend`), or from `apps/backend/`:

- `npm run dev` — development server
- `npm run prisma:migrate` — run migrations
- `npm run prisma:seed` — destructive core seed (local reset)
- `npm run demo:seed` — graduation/community demo data (additive; see `docs/demo-data.md`)
- `npm test` — module tests

**Needs verification:** exact `.env` variables — inspect `apps/backend/.env.example` and `apps/backend/src/config/env.ts` before first run.

### Frontend

```bash
cd apps/frontend
flutter pub get
flutter run -d chrome   # or another device
```

Release builds require `--dart-define=API_BASE_URL=...` (or `API_USE_SAME_ORIGIN=true` for same-origin web proxy). See `apps/frontend/lib/core/config/api_config.dart` and `docs/deployment.md`.

### Health check

- Backend: `GET /health`
- Flutter route: `/health` (diagnostic page)

## Documentation index

Start here for agents and contributors:

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](AGENTS.md) | Coding rules and MVP decisions |
| [docs/local-development-and-ml.md](docs/local-development-and-ml.md) | Fresh local setup and local ML demo runbook |
| [docs/00-ai-docs-router.md](docs/00-ai-docs-router.md) | Which docs to read/update when changing code |
| [docs/01-project-map.md](docs/01-project-map.md) | Repo map and feature inventory |
| [docs/02-architecture.md](docs/02-architecture.md) | Architecture (code-derived) |
| [docs/08-implementation-status.md](docs/08-implementation-status.md) | What is implemented vs partial vs not built |
| [docs/09-open-questions.md](docs/09-open-questions.md) | Unresolved risks and **Needs verification** items |

### Inventories (code-derived)

| Doc | Purpose |
|-----|---------|
| [docs/backend/api-catalog.md](docs/backend/api-catalog.md) | HTTP endpoints |
| [docs/backend/modules-map.md](docs/backend/modules-map.md) | Backend modules |
| [docs/database/schema-overview.md](docs/database/schema-overview.md) | Prisma relationships |
| [docs/database/tables-catalog.md](docs/database/tables-catalog.md) | Tables and fields |
| [docs/database/enums.md](docs/database/enums.md) | Database enums |
| [docs/frontend/routes-map.md](docs/frontend/routes-map.md) | Flutter routes and guards |
| [docs/frontend/reusable-widgets.md](docs/frontend/reusable-widgets.md) | Shared UI widgets |
| [docs/frontend/state-management.md](docs/frontend/state-management.md) | Flutter Riverpod/provider organization |
| [docs/07-theme-system.md](docs/07-theme-system.md) | Flutter theme tokens, palettes, dark/light mode |

### Conventions and older docs

| Doc | Status |
|-----|--------|
| [docs/04-api-conventions.md](docs/04-api-conventions.md) | Conventions — verify endpoints against [api-catalog](docs/backend/api-catalog.md) |
| [docs/01-requirements.md](docs/01-requirements.md) | **Aspirational** product requirements |
| [docs/03-database.md](docs/03-database.md) | **Stale** — superseded by `docs/database/*` |
| [docs/archive/](docs/archive/) | **Historical** plans superseded by code-derived docs |
| [docs/05-roadmap.md](docs/05-roadmap.md) | **Aspirational** phased plan — see [implementation status](docs/08-implementation-status.md) |
| [docs/07-ui-style-guide.md](docs/07-ui-style-guide.md) | Legacy/auth-specific UI style reference |

### Feature & flow docs (Phase 2A — code-derived)

| Feature | Doc | Flow(s) | Status (summary) |
|---------|-----|---------|------------------|
| Auth | [docs/features/auth.md](docs/features/auth.md) | [auth-flow](docs/flows/auth-flow.md) | **Implemented for auth MVP** |
| Material discovery | [docs/features/material-discovery.md](docs/features/material-discovery.md) | [material-discovery-flow](docs/flows/material-discovery-flow.md) | **Implemented** |
| Supplier portal | [docs/features/supplier-portal.md](docs/features/supplier-portal.md) | [supplier-material-listing-flow](docs/flows/supplier-material-listing-flow.md), [supplier-reservation-flow](docs/flows/supplier-reservation-flow.md) | **Partial** |
| Learning hub | [docs/features/learning-hub.md](docs/features/learning-hub.md) | [learning-hub-browse-flow](docs/flows/learning-hub-browse-flow.md) | **Partial** — browse/detail/spotlight API-backed; builds, moderation, engagement wired; AI material matching pending |
| ImpactLoop Assistant (AI) | [docs/ai/01-general-learning-chat.md](docs/ai/01-general-learning-chat.md) | — | **Partial** — `/api/ai/v1` + Flutter `/ai/assistant`; general learning + build-guide + project authoring waves; material-matching agent still **not implemented** |

ADRs live in [docs/adr/](docs/adr/) for accepted architecture decisions.

### Feature & flow docs (Phase 2B — supporting)

| Area | Doc | Flow(s) | Status (summary) |
|------|-----|---------|------------------|
| Materials listing | [docs/features/materials-listing.md](docs/features/materials-listing.md) | — | **Partial** |
| Locations | [docs/features/locations.md](docs/features/locations.md) | — | **Partial** — public redaction **Needs verification** |
| Invitations | [docs/features/invitations.md](docs/features/invitations.md) | [invitation-flow](docs/flows/invitation-flow.md) | **Backend-only** |
| Landing | [docs/features/landing.md](docs/features/landing.md) | — | **Implemented** — static; no API |
| Home (learner) | [docs/features/home-learner.md](docs/features/home-learner.md) | — | **Partial** — personalized home feed (7 sections) **API-backed** |

### Gap docs and open questions (Phase 2C)

| Area | Doc | Flow(s) | Status (summary) |
|------|-----|---------|------------------|
| Open questions | [docs/09-open-questions.md](docs/09-open-questions.md) | — | Index of unresolved / **Needs verification** items |
| Reservations (learner) | [docs/features/reservations.md](docs/features/reservations.md) | [learner-reservation-flow](docs/flows/learner-reservation-flow.md) | Learner create/read **Partial**; supplier workflow **Partial** |
| Payments (Mock) | [docs/features/payments.md](docs/features/payments.md) | [payment-flow](docs/flows/payment-flow.md) | **Implemented** for local Mock + enforcement-ON; real PSP / Admin Payment Center **not implemented** |
| Delivery | [docs/features/delivery.md](docs/features/delivery.md) | [delivery-flow](docs/flows/delivery-flow.md) | **Partial** — learner request/status/tracking UI + driver portal + admin monitoring; no realtime stream |
| AI material matching agent | [docs/features/ai-agent.md](docs/features/ai-agent.md) | [ai-material-matching-flow](docs/flows/ai-material-matching-flow.md) | **Not implemented** (distinct from ImpactLoop Assistant and price suggestion **Partial**) |
| Admin portal | [docs/features/admin.md](docs/features/admin.md) | — | **Partial** — dashboard, invitations, approvals, moderation, people, impact/audit, delivery/reservation monitors |
| Moderator portal | [docs/features/moderator.md](docs/features/moderator.md) | — | **Not implemented** (role exists; moderation queues owned by admin today) |

### Supplementary docs (context — not canonical inventories)

| Doc | Status |
|-----|--------|
| [docs/00-vision.md](docs/00-vision.md) | **Aspirational** product vision |
| [docs/06-cursor-codex-workflow.md](docs/06-cursor-codex-workflow.md) | Agent workflow notes |
| [docs/api/materials-api-contract.md](docs/api/materials-api-contract.md) | Materials discovery contract (see also [api-catalog](docs/backend/api-catalog.md)) |
| [docs/frontend/material-discovery-handoff.md](docs/frontend/material-discovery-handoff.md) | Historical handoff notes |
| [docs/tasks/](docs/tasks/) | Task snapshots — not canonical behavior |
| [docs/archive/](docs/archive/) | **Historical** plans superseded by code-derived docs |
| [docs/ai/00-ai-system-architecture-plan.md](docs/ai/00-ai-system-architecture-plan.md) | **Historical** Phase 0 AI plan — see [01-general-learning-chat](docs/ai/01-general-learning-chat.md) and [08-implementation-status](docs/08-implementation-status.md) for current state |
