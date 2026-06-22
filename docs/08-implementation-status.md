# Implementation Status

What exists in the **checked-out codebase** vs partial, mock, or not built.

**Source:** `apps/backend/src/app.ts`, `apps/backend/src/modules/`, `apps/frontend/lib/features/`, `apps/frontend/lib/app/router/app_router.dart`, `apps/backend/prisma/schema.prisma`

**Status labels:**

| Label | Meaning |
|-------|---------|
| **Implemented** | End-to-end or complete for its scope in code |
| **Partial** | Some layers exist; gaps remain |
| **Mock-only** | UI or data uses local mock, not production API path |
| **Backend-only** | API/schema/seed without matching Flutter feature |
| **Frontend-only** | UI without matching backend API |
| **Not implemented** | No meaningful code |

For aspirational MVP scope see [01-requirements.md](01-requirements.md) and [05-roadmap.md](05-roadmap.md) — those are **not** status proof.

---

## Platform and tooling

| Area | Status | Evidence |
|------|--------|----------|
| Monorepo + backend dev scripts | **Implemented** | `package.json`, `apps/backend/package.json` |
| Flutter app (web/mobile) | **Implemented** | `apps/frontend/pubspec.yaml`, `lib/main.dart` |
| PostgreSQL + Prisma | **Implemented** | `schema.prisma`, 14 migrations |
| PostGIS | **Implemented** | Migration `20260614145408_add_auth_schema` |
| Health check | **Implemented** | `GET /health`, Flutter `/health` |

---

## Backend modules (14 folders)

| Module | Status | Notes |
|--------|--------|-------|
| `auth` | **Implemented** | Register, login, refresh, logout, me, change-password API; forgot/reset **API only** (no Flutter forgot-password UI) |
| `health` | **Implemented** | |
| `categories` | **Implemented** | Read list |
| `material-types` | **Implemented** | Search + price rule |
| `materials` | **Partial** | Public read + price-check; no `POST /api/materials` |
| `uploads` | **Implemented** | Supplier material images |
| `locations` | **Partial** | Reverse geocode only — no CRUD locations API |
| `learning-projects` | **Implemented** | Read list + detail |
| `invitations` | **Partial** | Admin create + accept API; no admin UI |
| `supplier` | **Implemented** | Dashboard, profile, materials |
| `category-requests` | **Implemented** | Under `/api/supplier` |
| `price-rule-requests` | **Implemented** | Create + supplier drafts |
| `supplier-reservations` | **Partial** | Supplier accept/decline/complete — no learner create |
| `supplier-notifications` | **Implemented** | Derived supplier inbox |

### Backend **not implemented** as modules

`users`, `roles`, `reservations` (learner), `ai-agent`, `notifications` (general API), `admin`, `moderator`, `reports`, `reviews`, `delivery`, `driver`

---

## Flutter features (9 folders)

| Feature | Status | Backend | Frontend data |
|---------|--------|---------|---------------|
| `auth` | **Partial** | `/api/auth/*` (incl. forgot/reset API) | API for register/login/me/change-password; forgot-password UI **not built** (`login_form.dart`) |
| `health` | **Implemented** | `/health` | API |
| `landing` | **Implemented** | — | Static UI |
| `home` | **Partial** | — | Suggested materials: API; learning spotlight: **mock** |
| `material_discovery` | **Implemented** | `GET /api/materials` | `ApiMaterialDiscoveryRepository` default |
| `materials` | **Partial** | taxonomy/upload APIs | Data layer for supplier add-material; no routes |
| `learning_hub` | **Partial** | `GET /api/learning-projects` implemented | **Frontend mock-only** — `learning_hub_mock_data.dart`, not wired to API |
| `supplier_portal` | **Partial** | `/api/supplier/*` | API repositories (mocks exist but providers use API); material **read/create** only — no update/delete API |

### Flutter **not implemented** as features

`reservations` (learner), `delivery`, `ai_agent`, `admin`, `moderator`, `reports`, `reviews`, `driver`

---

## Cross-cutting capabilities

| Capability | Status | Evidence |
|------------|--------|----------|
| JWT + refresh tokens | **Implemented** | `auth` module, `AuthTokenType.REFRESH_TOKEN` |
| Role middleware | **Implemented** | `role.middleware.ts`, supplier routes |
| Public LEARNER/SUPPLIER registration | **Implemented** | `auth.validation.ts`, `UnifiedRegisterForm` with `RegistrationIntent.both` |
| Forgot / reset password | **Partial** | Backend: `auth.routes.ts`; Flutter: login shows “coming soon” (`login_form.dart`) |
| Role invitations (DRIVER/MODERATOR/ADMIN) | **Backend-only** | `invitations` module; no Flutter accept UI found |
| Material discovery (public) | **Implemented** | Backend + Flutter |
| Supplier list/create materials | **Implemented** | |
| Supplier reservations workflow | **Partial** | Supplier side only; seeded data may exist |
| Learner create reservation | **Not implemented** | No `/api/reservations` router |
| Delivery workflow | **Not implemented** | `Reservation` delivery columns in schema only |
| Driver portal | **Not implemented** | |
| AI material matching agent | **Not implemented** | No `ai-agent` module; no `ai_requests` table |
| AI price suggestions (listing) | **Partial** | `ai-price-suggestion.service.ts`, `AiPriceLookupLog` — internal to price rules |
| Learning hub API → Flutter | **Backend-only** | API mounted; UI mock |
| Reviews | **Not implemented** | `reviews` table; no API/UI |
| General notifications API | **Not implemented** | `notifications` table; supplier-derived notifications only |
| Admin / moderator dashboards | **Not implemented** | |
| Impact analytics | **Not implemented** | No impact tables in schema |

---

## Schema vs API coverage

| Table / domain | In schema | REST API | Flutter UI |
|----------------|-----------|----------|------------|
| Users, roles, auth | Yes | Yes | Partial (no forgot-password UI) |
| Learner/supplier profiles | Yes | Partial (register + supplier profile) | Yes (onboarding) |
| Locations | Yes | Partial (reverse geocode) | Yes (supplier profile/map) |
| Materials discovery | Yes | Yes | Yes |
| Reservations | Yes | Partial (supplier) | Partial (supplier portal) |
| Delivery fields on reservation | Yes | No | No |
| Learning projects | Yes | Yes | **Mock-only** |
| Reviews | Yes | No | No |
| Notifications (generic) | Yes | No | No |
| Price/category requests | Yes | Yes | Yes (supplier add flow) |

---

## Roadmap phase mapping (informative)

Mapped from [05-roadmap.md](05-roadmap.md) to **code reality** — roadmap text unchanged.

| Phase | Roadmap goal | Code status |
|-------|--------------|-------------|
| 0 Setup | Monorepo, health | **Implemented** |
| 1 Auth | Register/login/me | **Partial** — core flows yes; forgot-password UI **not implemented** |
| 2 Profiles/locations | Profile + location screens | **Partial** — profiles yes; saved locations API **not implemented** |
| 3 Materials | Supply + discovery | **Implemented** (supplier create + public browse) |
| 4 Reservations | Learner reserve, supplier accept | **Partial** — supplier side only |
| 5 Learning hub + AI | Projects + AI matching | **Partial** — projects read API; hub UI mock; AI agent **not implemented** |
| 6 Delivery | Internal delivery | **Not implemented** (schema fields only) |
| 7 Admin/moderator | Dashboards, moderation | **Not implemented** (invitation API fragment only) |

---

## Tests

| Area | Status | Files |
|------|--------|-------|
| Backend module tests | **Partial** | 4 test files under `modules/` |
| Flutter tests | **Needs verification** | e.g. `apps/frontend/test/supplier_pickup_schedule_models_test.dart` |

---

## Documentation phase

| Doc set | Status |
|---------|--------|
| Phase 0–1 inventories (this file, api-catalog, database/*, routes-map) | **Implemented** |
| Phase 2A feature docs (`docs/features/`) | **Partial** — 4 core features documented (see table below) |
| Phase 2A flow docs (`docs/flows/`) | **Partial** — 5 flows documented (see table below) |
| ADRs (`docs/adr/`) | **Not implemented** |

### Phase 2A canonical docs (code-derived)

| Area | Feature doc | Flow doc(s) | Code status (unchanged) |
|------|-------------|-------------|-------------------------|
| Auth | [features/auth.md](features/auth.md) | [flows/auth-flow.md](flows/auth-flow.md) | **Partial** |
| Material discovery | [features/material-discovery.md](features/material-discovery.md) | [flows/material-discovery-flow.md](flows/material-discovery-flow.md) | **Implemented** |
| Supplier portal | [features/supplier-portal.md](features/supplier-portal.md) | [flows/supplier-material-listing-flow.md](flows/supplier-material-listing-flow.md), [flows/supplier-reservation-flow.md](flows/supplier-reservation-flow.md) | **Partial** |
| Learning hub | [features/learning-hub.md](features/learning-hub.md) | [flows/learning-hub-browse-flow.md](flows/learning-hub-browse-flow.md) | **Partial** — UI **mock-only**; API **backend-only** |

**Not covered as implemented:** learner reservations, delivery, AI agent, admin, moderator.
