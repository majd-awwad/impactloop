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

## Backend modules (15 folders)

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
| `invitations` | **Implemented** | Admin email invitations (mock/SMTP), validate/accept API, `driver_profiles` |
| `admin` | **Partial** | Dashboard + admin invitations + supplier verification review; other admin pages placeholder |
| `supplier` | **Implemented** | Dashboard, profile, materials |
| `category-requests` | **Implemented** | Under `/api/supplier` |
| `price-rule-requests` | **Implemented** | Create + supplier drafts |
| `supplier-reservations` | **Partial** | Supplier accept/decline/complete — no learner create |
| `supplier-notifications` | **Implemented** | Derived supplier inbox |

### Backend **not implemented** as modules

`users`, `roles`, `reservations` (learner), `ai-agent`, `notifications` (general API), `moderator`, `reports`, `reviews`, `delivery`, `driver`

---

## Flutter features (10 folders)

| Feature | Status | Backend | Frontend data | Feature doc |
|---------|--------|---------|---------------|-------------|
| `auth` | **Partial** | `/api/auth/*` (incl. forgot/reset API) | API for register/login/me/change-password; forgot-password UI **not built** (`login_form.dart`) | — |
| `health` | **Implemented** | `/health` | API | — |
| `landing` | **Implemented** | — | Static UI | [landing.md](features/landing.md) |
| `home` | **Partial** | — | Suggested materials: API; learning spotlight: **mock** | [home-learner.md](features/home-learner.md) |
| `material_discovery` | **Implemented** | `GET /api/materials` | `ApiMaterialDiscoveryRepository` default | — |
| `materials` | **Partial** | taxonomy/upload APIs | Data layer for supplier add-material; no routes | [materials-listing.md](features/materials-listing.md) |
| `learning_hub` | **Partial** | `GET /api/learning-projects` implemented | **Frontend mock-only** — `learning_hub_mock_data.dart`, not wired to API | — |
| `supplier_portal` | **Partial** | `/api/supplier/*` + verification submit/status | API repositories; material CRUD with lifecycle + **org verification gating** (pending/rejected/changes block Add Material) | — |
| `admin_portal` | **Partial** | Dashboard + `/admin/invitations` + `/admin/supplier-verification` (live review UI) | [admin.md](features/admin.md) |

**Dev seed admin (local testing):** `admin@impactloop.test` / `AdminPassword123!` — created idempotently by `prisma/seeds/seed-admin.ts`. After login, `postAuthRouteForUser` routes ADMIN users to `/admin`.
| `locations` *(supplier UI; no `features/locations` folder)* | **Partial** | reverse geocode + profile PATCH | `supplier_portal` profile/map | [locations.md](features/locations.md) |
| `invitations` | **Implemented** | `/api/invitations` validate/accept; admin `/api/admin/invitations` | `/invite/accept` public page + admin invitations UI | [invitations.md](features/invitations.md) |

### Flutter **not implemented** as features

`reservations` (learner), `delivery`, `ai_agent`, `moderator`, `reports`, `reviews`, `driver` — gap docs: [reservations.md](features/reservations.md), [delivery.md](features/delivery.md), [ai-agent.md](features/ai-agent.md), [moderator.md](features/moderator.md); see [09-open-questions.md](09-open-questions.md).

---

## Cross-cutting capabilities

| Capability | Status | Evidence |
|------------|--------|----------|
| JWT + refresh tokens | **Implemented** | `auth` module, `AuthTokenType.REFRESH_TOKEN` |
| Role middleware | **Implemented** | `role.middleware.ts`, supplier routes |
| Public LEARNER/SUPPLIER registration | **Implemented** | `auth.validation.ts`, `UnifiedRegisterForm` with `RegistrationIntent.both` |
| Forgot / reset password | **Partial** | Backend: `auth.routes.ts`; Flutter: login shows “coming soon” (`login_form.dart`) |
| Role invitations (DRIVER/MODERATOR/ADMIN) | **Implemented** | Admin email invitations + `/invite/accept` registration; `EMAIL_PROVIDER=mock` or SMTP |
| Material discovery (public) | **Implemented** | Backend + Flutter |
| Supplier list/create/update/delete materials | **Implemented** | Edit/delete gated by status + reservation history |
| Supplier reservations workflow | **Partial** | Supplier side only; seeded data may exist — [reservations.md](features/reservations.md), [supplier-reservation-flow](flows/supplier-reservation-flow.md) |
| Learner create reservation | **Not implemented** | No `/api/reservations` router — [reservations.md](features/reservations.md), [learner-reservation-flow](flows/learner-reservation-flow.md) |
| Delivery workflow | **Not implemented** | `Reservation` delivery columns **schema-only** — [delivery.md](features/delivery.md) |
| Driver portal | **Not implemented** | [delivery.md](features/delivery.md) |
| AI material matching agent | **Not implemented** | No `ai-agent` module; no `ai_requests` table — [ai-agent.md](features/ai-agent.md) |
| AI price suggestions (listing) | **Partial** | `ai-price-suggestion.service.ts`, `AiPriceLookupLog` — internal to price rules; **not** material-matching agent |
| Learning hub API → Flutter | **Backend-only** | API mounted; UI mock |
| Reviews | **Not implemented** | `reviews` table; no API/UI |
| General notifications API | **Not implemented** | `notifications` table; supplier-derived notifications only |
| Admin / moderator dashboards | **Partial** | Admin overview dashboard **Partial** ([admin.md](features/admin.md)); moderator **Not implemented** |
| Impact analytics | **Partial** | Computed from `materials`/`reservations` in admin dashboard; no impact tables |

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
| Phase 2A feature docs (`docs/features/`) | **Partial** — 4 core features documented |
| Phase 2A flow docs (`docs/flows/`) | **Partial** — 5 flows documented |
| Phase 2B supporting docs (`docs/features/`, `docs/flows/`) | **Partial** — 5 features + 1 flow documented (see tables below) |
| Phase 2C gap docs + [09-open-questions.md](09-open-questions.md) | **Partial** — 5 gap features + 3 stub flows + open-question index |
| ADRs (`docs/adr/`) | **Not implemented** |

Unresolved risks and **Needs verification** items: [09-open-questions.md](09-open-questions.md).

### Phase 2A canonical docs (code-derived)

| Area | Feature doc | Flow doc(s) | Code status (unchanged) |
|------|-------------|-------------|-------------------------|
| Auth | [features/auth.md](features/auth.md) | [flows/auth-flow.md](flows/auth-flow.md) | **Partial** |
| Material discovery | [features/material-discovery.md](features/material-discovery.md) | [flows/material-discovery-flow.md](flows/material-discovery-flow.md) | **Implemented** |
| Supplier portal | [features/supplier-portal.md](features/supplier-portal.md) | [flows/supplier-material-listing-flow.md](flows/supplier-material-listing-flow.md), [flows/supplier-reservation-flow.md](flows/supplier-reservation-flow.md) | **Partial** |
| Learning hub | [features/learning-hub.md](features/learning-hub.md) | [flows/learning-hub-browse-flow.md](flows/learning-hub-browse-flow.md) | **Partial** — UI **mock-only**; API **backend-only** |

**Not covered as implemented:** learner reservations, delivery, AI agent, admin portal, moderator portal.

### Phase 2B supporting docs (code-derived)

| Area | Feature doc | Flow doc(s) | Code status (unchanged) |
|------|-------------|-------------|-------------------------|
| Materials listing | [features/materials-listing.md](features/materials-listing.md) | — | **Partial** |
| Locations | [features/locations.md](features/locations.md) | — | **Partial** — public redaction **Needs verification** |
| Invitations | [features/invitations.md](features/invitations.md) | [flows/invitation-flow.md](flows/invitation-flow.md) | **Backend-only** |
| Landing | [features/landing.md](features/landing.md) | — | **Implemented** — static; no API |
| Home (learner) | [features/home-learner.md](features/home-learner.md) | — | **Partial** — materials API; learning spotlight **mock-only** |

### Phase 2C gap docs (stubs — not implemented proof)

| Area | Feature doc | Flow doc(s) | Code status (unchanged) |
|------|-------------|-------------|-------------------------|
| Open questions | [09-open-questions.md](09-open-questions.md) | — | Unresolved / **Needs verification** index |
| Reservations (learner) | [features/reservations.md](features/reservations.md) | [flows/learner-reservation-flow.md](flows/learner-reservation-flow.md) | Learner **not implemented**; supplier **Partial** |
| Delivery | [features/delivery.md](features/delivery.md) | [flows/delivery-flow.md](flows/delivery-flow.md) | **Schema-only** / **not implemented** |
| AI material matching | [features/ai-agent.md](features/ai-agent.md) | [flows/ai-material-matching-flow.md](flows/ai-material-matching-flow.md) | **Not implemented** (price AI **Partial**, separate) |
| Admin portal | [features/admin.md](features/admin.md) | — | **Not implemented** |
| Moderator portal | [features/moderator.md](features/moderator.md) | — | **Not implemented** |
