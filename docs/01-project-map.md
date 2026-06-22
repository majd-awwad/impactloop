# ImpactLoop Project Map

Code-derived map of the repository as checked out. **Source of truth:** folders and files on disk, not older requirement documents.

**Inspected:** `AGENTS.md`, `package.json`, `apps/backend/src/app.ts`, `apps/backend/src/modules/`, `apps/frontend/lib/features/`, `apps/frontend/lib/app/router/app_router.dart`, `apps/backend/prisma/schema.prisma`

## Monorepo layout

```
impactloop/
  AGENTS.md
  README.md
  package.json              # npm workspaces: apps/backend only
  apps/
    backend/
      prisma/               # schema, migrations, seeds
      src/
        app.ts              # Express app + route mounts
        server.ts
        config/
        database/
        middlewares/
        modules/            # 14 feature modules (see below)
        services/           # cross-module services (AI price, geocoding)
        utils/
        constants/
    frontend/
      lib/
        app/                # app shell, router, theme, widgets
        core/               # network, auth, config, errors
        shared/             # shared models and widgets
        features/           # 9 feature folders (see below)
  docs/
  .cursor/                  # rules and skills
```

**Note:** `docs/02-architecture.md` previously listed a root `database/` folder and many unbuilt modules. That structure is **aspirational** — see [08-implementation-status.md](08-implementation-status.md).

## Backend modules (14)

Derived **only** from `apps/backend/src/modules/`:

| Folder | Mounted in `app.ts` | Role (from routes/files) |
|--------|---------------------|---------------------------|
| `auth` | `/api/auth` | Register, login, tokens, `/me`, password flows |
| `categories` | `/api/categories` | List categories |
| `category-requests` | `/api/supplier/category-requests` | Supplier category requests + listing drafts |
| `health` | `/health` | Health check |
| `invitations` | `/api/invitations` | Admin role invitations + accept |
| `learning-projects` | `/api/learning-projects` | Public read list/detail |
| `locations` | `/api/locations` | Authenticated reverse geocode |
| `material-types` | `/api/material-types` | Search types + price rules |
| `materials` | `/api/materials` | Public discovery read + listing policy + price check |
| `price-rule-requests` | `/api/price-rule-requests`, `/api/supplier/price-rule-requests` | Create + supplier list/draft |
| `supplier` | `/api/supplier` | Dashboard, profile, supplier materials |
| `supplier-notifications` | `/api/supplier/notifications` | Supplier action notifications list |
| `supplier-reservations` | `/api/supplier/reservations` | Supplier reservation list/accept/decline/complete |
| `uploads` | `/api/uploads` | Supplier material image upload |

Detail: [backend/modules-map.md](backend/modules-map.md), [backend/api-catalog.md](backend/api-catalog.md)

### Backend modules **not** present as folders

These names appear in older docs or roadmap but **do not exist** under `apps/backend/src/modules/`:

`users`, `roles`, `reservations` (learner API), `ai-agent`, `notifications` (general), `admin`, `moderator`, `reports`, `reviews`, `delivery`, `driver`

Some concerns are partially covered (e.g. reservations via `supplier-reservations`; notifications via `supplier-notifications`).

## Flutter features (9)

Derived **only** from `apps/frontend/lib/features/`:

| Feature | Primary routes | Data source (summary) |
|---------|----------------|------------------------|
| `auth` | `/login`, `/register`, `/auth/checking`, profile completion paths | **Partial** — API for register/login/me/change-password; forgot-password UI not built |
| `health` | `/health` | API (`/health`) |
| `home` | `/home` | Mixed — materials via API; learning spotlight mock |
| `landing` | `/` | Static UI |
| `learning_hub` | `/learning`, `/learning/:id`, `/learning/add-draft` | **Partial** — backend read API exists; UI uses mock data only |
| `material_discovery` | `/materials`, `/materials/:id` | API default (`ApiMaterialDiscoveryRepository`) |
| `materials` | (no dedicated routes) | Shared data layer for listing/taxonomy — used by supplier add material |
| `supplier_portal` | `/supplier/*` shell routes | **Partial** — API-backed; material read/create (no update/delete API) |

Detail: [frontend/routes-map.md](frontend/routes-map.md), [08-implementation-status.md](08-implementation-status.md)

### Flutter features **not** present as folders

`reservations`, `delivery`, `ai_agent`, `admin`, `moderator`, `reports`, `reviews`, `driver`

## Cross-cutting backend services

Not Express modules; live in `apps/backend/src/services/`:

- `reverse-geocoding.service.ts` — used by `locations` module
- `ai-price-suggestion.service.ts`, `gemini-price-suggestion.provider.ts`, `mock-price-suggestion.provider.ts` — price rule AI (backend-internal)
- `material-reference-matching.service.ts` — material reference matching
- `ai-price-lookup.repository.ts` — persists `ai_price_lookup_logs`

**Inspected:** `apps/backend/src/services/`

## Database

- **28** Prisma models → **28** PostgreSQL tables (see [database/schema-overview.md](database/schema-overview.md))
- Migrations: `apps/backend/prisma/migrations/` (14 migration folders)
- Seed: `apps/backend/prisma/seed.ts` + `prisma/seeds/*`

**Stale doc:** [03-database.md](03-database.md) claims 34 tables and lists tables not in schema — use `docs/database/*` instead.

## Documentation map

| When you change… | Read/update |
|------------------|-------------|
| Anything | `AGENTS.md`, this file, [00-ai-docs-router.md](00-ai-docs-router.md) |
| Backend API | [backend/api-catalog.md](backend/api-catalog.md), [backend/modules-map.md](backend/modules-map.md) |
| Prisma schema | [database/schema-overview.md](database/schema-overview.md), [database/tables-catalog.md](database/tables-catalog.md), [database/enums.md](database/enums.md) |
| Flutter routes | [frontend/routes-map.md](frontend/routes-map.md) |
| Shared widgets | [frontend/reusable-widgets.md](frontend/reusable-widgets.md) |
| Ship status | [08-implementation-status.md](08-implementation-status.md) |
| Unresolved risks | [09-open-questions.md](09-open-questions.md) |

### Feature & flow docs (code-derived)

**Phase 2A — core:** [auth](features/auth.md), [material-discovery](features/material-discovery.md), [supplier-portal](features/supplier-portal.md), [learning-hub](features/learning-hub.md) — flows under [flows/](flows/).

**Phase 2B — supporting:** [materials-listing](features/materials-listing.md), [locations](features/locations.md), [invitations](features/invitations.md) + [invitation-flow](flows/invitation-flow.md), [landing](features/landing.md), [home-learner](features/home-learner.md).

**Phase 2C — gaps:** [09-open-questions](09-open-questions.md), [reservations](features/reservations.md) + [learner-reservation-flow](flows/learner-reservation-flow.md), [delivery](features/delivery.md) + [delivery-flow](flows/delivery-flow.md), [ai-agent](features/ai-agent.md) + [ai-material-matching-flow](flows/ai-material-matching-flow.md), [admin](features/admin.md), [moderator](features/moderator.md).

Index with status summaries: [00-ai-docs-router.md](00-ai-docs-router.md#feature--flow-docs), [08-implementation-status.md](08-implementation-status.md#documentation-phase). Unresolved risks: [09-open-questions.md](09-open-questions.md).

## Tests (backend)

**Inspected:** `apps/backend/src/modules/**/*.test.ts`

- `locations/locations.test.ts`
- `supplier/supplier.materials.test.ts`
- `materials/materials.price.test.ts`
- `supplier-reservations/supplier-reservations.complete.test.ts`
