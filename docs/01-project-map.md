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
        modules/            # feature modules (see below)
        services/           # cross-module services (AI price, geocoding)
        utils/
        constants/
    frontend/
      lib/
        app/                # app shell, router, theme, widgets
        core/               # network, auth, config, errors
        shared/             # shared models and widgets
        features/           # 14 feature folders (see below)
  docs/
  .cursor/                  # rules and skills
```

**Note:** `docs/02-architecture.md` previously listed a root `database/` folder and many unbuilt modules. That structure is **aspirational** — see [08-implementation-status.md](08-implementation-status.md).

## Backend modules

Derived **only** from `apps/backend/src/modules/`:

| Folder | Mounted in `app.ts` | Role (from routes/files) |
|--------|---------------------|---------------------------|
| `admin` | `/api/admin` | Admin dashboard, invitations, and parent router for admin operations |
| `admin-approvals` | `/api/admin/approvals/*` via `admin` | Category and price request review actions |
| `admin-learning-projects` | `/api/admin/learning-projects*` via `admin` | Learning project moderation |
| `admin-materials` | `/api/admin/materials*`, `/api/admin/material-reports*` via `admin` | Material moderation and material report review |
| `admin-people` | `/api/admin/people*` via `admin` | People list, summaries, suspend/reactivate |
| `admin-supplier-verifications` | `/api/admin/supplier-verifications*` via `admin` | Organization supplier verification review |
| `auth` | `/api/auth` | Register, login, tokens, `/me`, password flows |
| `categories` | `/api/categories` | List categories |
| `category-requests` | `/api/supplier/category-requests` | Supplier category requests + listing drafts |
| `deliveries` | `/api/deliveries` (+ learner request under `/api/reservations/:id/delivery`) | Learner delivery request/read API |
| `driver` | `/api/driver` | Internal driver jobs, assignment, status updates, location pings |
| `health` | `/health` | Health check |
| `invitations` | `/api/invitations` | Admin role invitations + accept |
| `learning-projects` | `/api/learning-projects` | Public read list/detail + learner submit + learner likes/saves/follows |
| `locations` | `/api/locations` | Authenticated forward/reverse geocode and private saved locations |
| `material-types` | `/api/material-types` | Search types + price rules |
| `materials` | `/api/materials` | Public discovery read + listing policy + price check |
| `price-rule-requests` | `/api/price-rule-requests`, `/api/supplier/price-rule-requests` | Create + supplier list/draft |
| `profile` | `/api/profile` | Authenticated user/profile updates |
| `reservations` | `/api/reservations` | Learner material reservation create/read |
| `supplier` | `/api/supplier` | Dashboard, profile, supplier materials |
| `supplier-notifications` | `/api/supplier/notifications` | Supplier action notifications list |
| `supplier-reservations` | `/api/supplier/reservations` | Supplier reservation list/accept/decline/complete |
| `supplier-verification` | Mounted through supplier/admin flows | Supplier verification submit/status support |
| `uploads` | `/api/uploads` | Supplier material image upload |

Detail: [backend/modules-map.md](backend/modules-map.md), [backend/api-catalog.md](backend/api-catalog.md)

### Backend modules **not** present as folders

These names appear in older docs or roadmap but **do not exist** under `apps/backend/src/modules/`:

`users`, `roles`, `ai-agent`, `notifications` (general), `moderator`, `reports`, `reviews`

Some concerns are partially covered (e.g. reservations via learner create + `supplier-reservations`; notifications via `supplier-notifications`; reports via `material_reports` and admin material report review, not a general reports module).

## Flutter features (14)

Derived **only** from `apps/frontend/lib/features/`:

| Feature | Primary routes | Data source (summary) |
|---------|----------------|------------------------|
| `admin_portal` | `/admin/*` | **Partial** — dashboard, invitations, approvals, supplier verification, materials moderation, learning project moderation, people management, impact/audit, and read-only operations monitors |
| `auth` | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/checking`, profile completion paths | **Implemented for auth MVP** — register/login/me/change-password/forgot-reset API and UI |
| `deliveries` | `/learner/deliveries/:id` | **Partial** — learner delivery status/detail, latest ping summary, polling map marker |
| `driver_portal` | `/driver/*` | **Partial** — job board, accept, active delivery detail/status/location pings |
| `health` | `/health` | API (`/health`) |
| `home` | `/home` | **Partial** — materials and learning spotlight via API; personalization pending |
| `invitations` | `/invite/accept` | **Implemented** — invitation validate/accept UI backed by API |
| `landing` | `/` | Static UI |
| `learning_hub` | `/learning`, `/learning/:id`, `/learning/add-draft` | **Partial** — read path API-backed; add-draft submits for admin review; search/filters, server-side page navigation, project likes/saves/follows, and admin moderation wired; AI/ratings/checklist/material linking pending |
| `material_discovery` | `/materials`, `/materials/:id` | API default (`ApiMaterialDiscoveryRepository`); detail reserve CTA calls reservations data layer |
| `materials` | (no dedicated routes) | Shared data layer for listing/taxonomy — used by supplier add material |
| `profile` | `/profile`, `/profile/edit`, `/profile/learner/edit`, `/profile/security` | **Implemented** — account/profile/security pages |
| `reservations` | `/learner/reservations` | Learner create/read API/repository/controllers; status page and material-detail state |
| `supplier_portal` | `/supplier/*` shell routes | **Partial** — API-backed; material read/create/update/delete and supplier reservations |

Detail: [frontend/routes-map.md](frontend/routes-map.md), [08-implementation-status.md](08-implementation-status.md)

### Flutter features **not** present as folders

`ai_agent`, `moderator`, `reports`, `reviews`

## Cross-cutting backend services

Not Express modules; live in `apps/backend/src/services/`:

- `reverse-geocoding.service.ts` — used by `locations` module
- `ai-price-suggestion.service.ts`, `gemini-price-suggestion.provider.ts`, `mock-price-suggestion.provider.ts` — price rule AI (backend-internal)
- `material-reference-matching.service.ts` — material reference matching
- `ai-price-lookup.repository.ts` — persists `ai_price_lookup_logs`

**Inspected:** `apps/backend/src/services/`

## Database

- **45** Prisma models → **45** PostgreSQL tables (see [database/schema-overview.md](database/schema-overview.md))
- Migrations: `apps/backend/prisma/migrations/` (40 migration folders)
- Seed: `apps/backend/prisma/seed.ts` + `prisma/seeds/*`

**Stale doc:** [03-database.md](03-database.md) lists tables not in schema — use `docs/database/*` instead.

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

**Phase 2A — core:** [roles-and-capabilities](features/roles-and-capabilities.md), [auth](features/auth.md), [material-discovery](features/material-discovery.md), [supplier-portal](features/supplier-portal.md), [learning-hub](features/learning-hub.md) — flows under [flows/](flows/).

**Phase 2B — supporting:** [materials-listing](features/materials-listing.md), [locations](features/locations.md), [invitations](features/invitations.md) + [invitation-flow](flows/invitation-flow.md), [landing](features/landing.md), [home-learner](features/home-learner.md).

**Phase 2C — gaps/partials:** [09-open-questions](09-open-questions.md), [reservations](features/reservations.md) + [learner-reservation-flow](flows/learner-reservation-flow.md), [delivery](features/delivery.md) + [delivery-flow](flows/delivery-flow.md), [ai-agent](features/ai-agent.md) + [ai-material-matching-flow](flows/ai-material-matching-flow.md), [admin](features/admin.md), [moderator](features/moderator.md).

Index with status summaries: [00-ai-docs-router.md](00-ai-docs-router.md#feature--flow-docs), [08-implementation-status.md](08-implementation-status.md#documentation-phase). Unresolved risks: [09-open-questions.md](09-open-questions.md).

## Tests (backend)

**Inspected:** `apps/backend/src/modules/**/*.test.ts`

19 backend module test files were found under `apps/backend/src/modules/`, including admin, auth, categories, deliveries, invitations, locations, materials, profile, reservations, supplier, and supplier-reservations tests.
