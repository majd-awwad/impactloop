# ImpactLoop system overview

Code-derived architecture for the checked-out repository.

**Ship status:** [product/implementation-status.md](../product/implementation-status.md)
**Recommendation serving:** [recommendation-system.md](recommendation-system.md)

---

## Repository layout

```
impactloop/
  README.md
  package.json                 # npm workspace: apps/backend
  apps/
    backend/
      prisma/                  # schema, migrations, seeds
      src/
        app.ts                 # Express app + route mounts
        modules/               # feature modules
        services/              # cross-module services (geocoding, price AI)
    frontend/
      lib/
        app/                   # shell, router, theme
        core/                  # network, auth, config
        shared/                # shared models/widgets
        features/              # feature folders
  docs/
  ml/recommendation/           # Python LightFM training utilities
```

There is **no** top-level application `database/` folder. Schema documentation lives under `docs/database/`.

---

## Request and data flow

```text
Flutter (Riverpod + GoRouter + Dio)
        ↓ HTTPS / JSON
Express modules (auth, materials, reservations, payments, deliveries, learner-home, ai, admin, …)
        ↓
Prisma → PostgreSQL (+ PostGIS geography on locations)
```

Learner Home ranking is computed server-side. Flutter consumes `GET /api/learner/home` and does not implement ML logic locally.

---

## Backend

- **Stack:** Node.js, Express 5, TypeScript, PostgreSQL + PostGIS, Prisma, JWT auth, Zod validation
- **Style:** Modular monolith under `apps/backend/src/modules/`
- **API catalog:** [backend/api-catalog.md](../backend/api-catalog.md)
- **Modules map:** [backend/modules-map.md](../backend/modules-map.md)

### Major module groups

| Group | Examples | Mount prefix |
|-------|----------|--------------|
| Identity | `auth`, `profile`, `invitations` | `/api/auth`, `/api/profile`, `/api/invitations` |
| Catalog | `materials`, `categories`, `material-types`, `learning-projects` | `/api/materials`, `/api/categories`, `/api/learning-projects` |
| Commerce | `reservations`, `payments`, `supplier-reservations` | `/api/reservations`, `/api/payments`, `/api/supplier/reservations` |
| Fulfillment | `deliveries`, `driver`, `fulfillment-failures`, `handover-credentials` | `/api/deliveries`, `/api/driver` |
| Learner | `learner-home`, `learner-builds`, `learner-material-requests`, `saved-dropoff-addresses` | `/api/learner` |
| Supplier | `supplier`, `supplier-verification`, `category-requests`, `price-rule-requests` | `/api/supplier` |
| Admin | `admin`, `admin-approvals`, `admin-materials`, `admin-people`, `admin-no-show-reports`, … | `/api/admin` |
| AI | `ai` | `/api/ai/v1` |
| Platform | `health`, `notifications`, `uploads`, `locations` | `/health`, `/api/notifications`, `/api/uploads`, `/api/locations` |

Module folders **not** present (roadmap names only): `users`, `roles`, `ai-agent`, `moderator`, `reports`, `reviews`.

### Cross-cutting services (`apps/backend/src/services/`)

- `reverse-geocoding.service.ts` — locations module
- `ai-price-suggestion.service.ts` — internal price-rule review AI
- `material-reference-matching.service.ts` — deterministic material reference matching

### Learner Home and recommendations

`learner-home` serves `GET /api/learner/home` and section endpoints. **Suggested materials** and **suggested projects** use **ML_PRIMARY** LightFM ranking when artifacts are READY; other sections use deterministic or business rules.

Details: [recommendation-system.md](recommendation-system.md). Configuration: `RECOMMENDATION_ML_RUNTIME_MODE` and artifact paths in `apps/backend/src/config/env.ts`.

---

## Frontend

- **Stack:** Flutter, Riverpod, GoRouter, Dio
- **Features:** 15 folders under `apps/frontend/lib/features/`
- **Routes:** [frontend/routes-map.md](../frontend/routes-map.md)

| Feature | Primary routes | Summary |
|---------|----------------|---------|
| `auth` | `/login`, `/register`, profile completion | Auth MVP |
| `home` | `/home` | Personalized learner feed |
| `material_discovery` | `/materials`, `/materials/:id` | Public discovery |
| `learning_hub` | `/learning`, builds, submissions | Browse, engagement, checklists |
| `reservations` | `/learner/reservations` | Learner reservation UX |
| `payments` | reservation payment read/requirement | CASH settlement active; dormant CARD checkout not mounted |
| `deliveries` / `driver_portal` | learner + driver delivery surfaces | Partial — polling, not realtime stream |
| `ai` | `/ai/assistant` | ImpactLoop Assistant |
| `supplier_portal` | `/supplier/*` | Supplier materials and reservations |
| `admin_portal` | `/admin/*` | Admin operations and exports |

Folders **not** present: `ai_agent` (use `features/ai`), `moderator`, `reports`, `reviews`.

---

## Database

- **46** Prisma models (see [database/schema-overview.md](../database/schema-overview.md))
- **PostGIS:** `locations.location` uses `geography(Point,4326)` with GiST index for nearest/radius queries
- Migrations: `apps/backend/prisma/migrations/`
- Seeds: `apps/backend/prisma/seed.ts`, `prisma/seeds/*`, `prisma/demo-data/*`

---

## AI subsystems (distinct)

| Subsystem | Purpose | Doc |
|-----------|---------|-----|
| Recommendation ML | Learner Home ranking (LightFM) | [recommendation-system.md](recommendation-system.md) |
| ImpactLoop Assistant | Conversational learning + build guide + project authoring | [features/ai-assistant.md](../features/ai-assistant.md) |
| Material-matching agent | Planned product capability — **not implemented** | [features/ai-material-matching.md](../features/ai-material-matching.md) |

Boundary: [ai-system.md](ai-system.md)

---

## Security and API conventions

- Role middleware, hashed secrets, Zod input validation
- Response envelope: [04-api-conventions.md](../04-api-conventions.md)

---

## Documentation map

| When you change… | Update |
|------------------|--------|
| Ship status | [product/implementation-status.md](../product/implementation-status.md) |
| Backend API | [backend/api-catalog.md](../backend/api-catalog.md) |
| Prisma schema | [database/](../database/) |
| Flutter routes | [frontend/routes-map.md](../frontend/routes-map.md) |
| Unresolved risks | [product/open-questions.md](../product/open-questions.md) |

---

## Deployment

[deployment.md](../deployment.md) — uploads persistence, Docker, ML_PRIMARY production configuration.
