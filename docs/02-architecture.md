# ImpactLoop Architecture

Code-derived architecture for the checked-out repository.

**Sources inspected:** `apps/backend/src/app.ts`, `apps/backend/src/modules/`, `apps/frontend/lib/`, `apps/backend/prisma/schema.prisma`, `package.json`

**Stale sections in older versions of this file** listed modules and features that do not exist on disk. This revision reflects **only what is present**. For ship status see [08-implementation-status.md](08-implementation-status.md).

## Repository layout

```
impactloop/
  AGENTS.md
  README.md
  package.json                 # npm workspace: apps/backend
  apps/
    backend/
      prisma/
      src/
        app.ts, server.ts
        config/, database/, middlewares/, utils/, constants/
        modules/               # 15 modules — see modules-map.md
        services/              # cross-cutting services
    frontend/
      lib/
        app/                   # shell, router, theme, widgets
        core/                  # network, auth, config, errors
        shared/                # shared models, widgets
        features/              # 10 features — see project-map.md
  docs/
  .cursor/
```

There is **no** top-level `database/` folder in the repo (older docs were aspirational).

## Backend architecture

### Stack

- Node.js, Express 5, TypeScript
- PostgreSQL + PostGIS
- Prisma ORM
- JWT access tokens + refresh tokens (`auth_tokens`)
- Zod validation (`validate.middleware.ts`)

### Style

- Modular monolith under `apps/backend/src/modules/`
- Thin controllers, logic in services
- `authMiddleware` + `requireRoles()` for protected routes
- Consistent JSON responses — see [04-api-conventions.md](04-api-conventions.md)

### Mounted API surface

From `apps/backend/src/app.ts`:

| Mount | Module |
|-------|--------|
| `/health` | health |
| `/api/auth` | auth |
| `/api/categories` | categories |
| `/api/material-types` | material-types |
| `/api/price-rule-requests` | price-rule-requests |
| `/api/invitations` | invitations |
| `/api/learning-projects` | learning-projects |
| `/api/materials` | materials |
| `/api/reservations` | reservations |
| `/api/uploads` | uploads |
| `/api/locations` | locations |
| `/api/supplier` | supplier (+ nested category-requests, price-rule-requests, notifications, reservations) |

Full endpoint list: [backend/api-catalog.md](backend/api-catalog.md)  
Module responsibilities: [backend/modules-map.md](backend/modules-map.md)

### Backend modules present (15)

`auth`, `categories`, `category-requests`, `health`, `invitations`, `learning-projects`, `locations`, `material-types`, `materials`, `price-rule-requests`, `reservations`, `supplier`, `supplier-notifications`, `supplier-reservations`, `uploads`

### Backend modules **not present**

These names appear in roadmap/requirements but **have no folder** under `modules/`:

`users`, `roles`, `ai-agent`, `notifications`, `admin`, `moderator`, `reports`, `reviews`, `delivery`, `driver`

### Cross-cutting services (`src/services/`)

- `reverse-geocoding.service.ts`
- `ai-price-suggestion.service.ts` (+ Gemini/mock providers)
- `material-reference-matching.service.ts`
- `ai-price-lookup.repository.ts`

## Frontend architecture

### Stack

- Flutter (mobile + web)
- Riverpod
- GoRouter
- Dio (`core/network/api_client.dart`)

### Style

- Feature-first under `apps/frontend/lib/features/`
- Layers: `data/`, `application/`, `presentation/`
- Widgets do not call APIs directly — repositories/providers in data/application layers
- Adaptive layouts per feature (mobile/web views where implemented)

### Features present (10)

`auth`, `health`, `home`, `landing`, `learning_hub`, `material_discovery`, `materials`, `reservations`, `supplier_portal`

### Features **not present**

`delivery`, `ai_agent`, `admin`, `moderator`, `reports`, `reviews`, `driver`

Routes: [frontend/routes-map.md](frontend/routes-map.md)  
Shared widgets: [frontend/reusable-widgets.md](frontend/reusable-widgets.md)

### Core folders

**Inspected:** `apps/frontend/lib/core/`

- `network/` — Dio client, API response unwrap
- `auth/` — token storage, interceptor
- `config/` — API base URL
- `errors/` — `ApiException`

## Database architecture

- 28 Prisma models → 28 PostgreSQL tables
- PostGIS on `locations.location`
- No `delivery_requests` table — delivery columns on `reservations`
- No `impact_logs` / `impact_summaries` tables in schema

Detail: [database/schema-overview.md](database/schema-overview.md)

**Note:** [03-database.md](03-database.md) is **stale** (claims 34 tables). Use `docs/database/*`.

## API examples (actually mounted)

These exist in route files today:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/materials`
- `GET /api/materials/:id`
- `POST /api/reservations`
- `POST /api/supplier/materials`
- `GET /api/supplier/reservations`
- `PATCH /api/supplier/reservations/:id/accept`
- `GET /api/learning-projects`

**Not mounted** (aspirational examples from older docs):

- `POST /api/materials` — use `POST /api/supplier/materials`
- `GET /api/reservations/my`
- `POST /api/ai/requests`

## Security rules (unchanged intent)

- Hash passwords; store token hashes only for reset/invitation/refresh
- Validate all input (Zod)
- Role checks via middleware
- Location privacy — **Needs verification** of exact field redaction in materials API responses

## Response format

See [04-api-conventions.md](04-api-conventions.md) for `{ success, message, data }` envelope.
