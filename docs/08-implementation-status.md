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
| PostgreSQL + Prisma | **Implemented** | `schema.prisma`, migrations |
| PostGIS | **Implemented** | Migration `20260614145408_add_auth_schema` |
| Health check | **Implemented** | `GET /health`, Flutter `/health` |

---

## Backend modules (24 folders)

| Module | Status | Notes |
|--------|--------|-------|
| `auth` | **Implemented** | Register, login, refresh, logout, me (+ `phoneVerifiedAt`, `lastLoginAt`), change-password, forgot/reset API |
| `admin-approvals` | **Implemented** | Admin category and price request review endpoints |
| `admin-materials` | **Implemented** | Admin material moderation and material report review endpoints |
| `admin-people` | **Implemented** | Admin people list/detail/suspend/reactivate endpoints with safety guards |
| `admin-supplier-verifications` | **Implemented** | Admin organization supplier verification review endpoints |
| `health` | **Implemented** | |
| `categories` | **Implemented** | Read list |
| `material-types` | **Implemented** | Search + price rule |
| `materials` | **Partial** | Public read + price-check; no `POST /api/materials` |
| `uploads` | **Implemented** | Profile images + supplier material images + verification documents |
| `profile` | **Implemented** | Authenticated user + learner profile PATCH |
| `locations` | **Partial** | Reverse geocode only — no CRUD locations API |
| `learning-projects` | **Implemented** | Public read list + detail (`PUBLISHED` only); learner `POST /submit` → `PENDING_REVIEW`; admin moderation module |
| `invitations` | **Implemented** | Admin email invitations (mock/SMTP), validate/accept API, unified `driver_profiles` |
| `reservations` | **Partial** | Learner create/cancel + learner confirmation + request-reschedule + report-supplier-issue + report-no-driver + my reservations read with scheduling fields, `canLearnerReschedule`, `canLearnerReportSupplier`, `canReportNoDriverAvailable`, `pickupHandoverPhase`, `activeDelivery`, post-acceptance `pickupLocationFull`, derived overdue follow-up fields, reservation-scoped messages; partial-quantity holds; learner delivery request route mounted |
| `deliveries` | **Partial** | Learner delivery request/read backed by `deliveries`; Flutter learner request/status UI, latest ping summary, and polling map marker exist; driver jobs/status UI exists; no realtime stream |
| `driver` | **Partial** | Driver available/active jobs, accept, status updates, foreground auto-location sharing on active delivery detail page, and manual location pings; no background GPS |
| `admin` | **Partial** | Dashboard + invitations + supplier verification + approvals + materials moderation + people management + impact analytics + audit logs + reservations/deliveries monitoring (read-only) + reservation incident report queue (verify/reject/resolve); other admin pages placeholder |
| `supplier` | **Implemented** | Dashboard, profile, materials |
| `category-requests` | **Implemented** | Under `/api/supplier` |
| `price-rule-requests` | **Implemented** | Create + supplier drafts |
| `supplier-reservations` | **Partial** | Phase-based pickup follow-up (±30 min handover); supplier reschedule is always a proposal (`AWAITING_LEARNER_CONFIRMATION` + `reason`); learner reschedule request → `AWAITING_SUPPLIER_CONFIRMATION`; supplier `accept-learner-reschedule`; overdue close/report/reschedule; report form requires reason+note; admin report detail includes activity history; delivery handover codes unchanged |
| `fulfillment-failures` | **Implemented (Phase 5–7)** | Post-grace failure/no-show transitions for supplier and driver; creates incident reports for driver pickup/delivery failures; quantity hold rules (release on self-pickup report before handover; keep hold after driver pickup failures) |
| `admin-no-show-reports` | **Implemented (Phase 6–7)** | Admin reservation incident queue; verify/reject/resolve without strike; enriched detail (messages, history, strikes); 3 verified strikes auto-suspend + token revocation |
| `supplier-notifications` | **Implemented** | Derived supplier inbox |
| `supplier-verification` | **Implemented** | Supplier verification submit/status support for organization suppliers |

### Backend **not implemented** as modules

`users`, `roles`, `ai-agent`, `notifications` (general API), `moderator`, `reports`, `reviews`

(`profile` module handles authenticated user/learner profile updates; supplier org profile remains under `supplier`.)

---

## Flutter features (14 folders)

| Feature | Status | Backend | Frontend data | Feature doc |
|---------|--------|---------|---------------|-------------|
| `admin_portal` | **Partial** | `/api/admin/*` | Dashboard, invitations, supplier verification, approvals, materials moderation, people management; impact/audit placeholders | [admin.md](features/admin.md) |
| `auth` | **Implemented for auth MVP** | `/api/auth/*` (incl. forgot/reset API) | Register/login/session/change-password/forgot-reset UI | [auth.md](features/auth.md) |
| `health` | **Implemented** | `/health` | API | — |
| `landing` | **Implemented** | — | Static UI | [landing.md](features/landing.md) |
| `home` | **Partial** | — | Suggested materials + learning spotlight: API | [home-learner.md](features/home-learner.md) |
| `invitations` | **Implemented** | `/api/invitations` validate/accept; `/api/admin/invitations` | `/invite/accept` public page + admin invitations UI | [invitations.md](features/invitations.md) |
| `material_discovery` | **Implemented** | `GET /api/materials`, `POST /api/reservations` | API discovery + reservation CTA | — |
| `materials` | **Partial** | taxonomy/upload APIs | Data layer for supplier add-material; no routes | [materials-listing.md](features/materials-listing.md) |
| `reservations` | **Partial** | `POST/PATCH /api/reservations`, `PATCH /api/reservations/:id/learner-confirmation`, `GET /api/reservations/my` (incl. awaiting-confirmation scheduling + `activeDelivery` + `pickupLocationFull` after accept/complete), delivery request route | Partial-quantity reserve UI + PENDING/awaiting cancel + awaiting-confirmation panel + My Reservations pickup address reveal | [reservations.md](features/reservations.md) |
| `deliveries` | **Partial** | `/api/deliveries/my`, `/api/deliveries/:id`, `POST /api/reservations/:id/delivery` | Learner delivery request dialog/status page/latest ping summary/polling map marker; driver jobs/status portal with foreground auto-location sharing on active delivery detail; no realtime stream | [delivery.md](features/delivery.md) |
| `driver_portal` | **Partial** | `/api/driver/deliveries/*` | Driver job board, accept action, active delivery detail, ordered status updates, foreground auto-location sharing on detail page, manual location ping; no live map/background pings | [delivery.md](features/delivery.md) |
| `learning_hub` | **Partial** | `GET /api/learning-projects` + categories; `POST /api/learning-projects/submit` | List/detail + Home spotlight API-backed; add-draft submits for review; admin moderation at `/admin/learning-projects`; AI disabled; ratings hidden | [learning-hub.md](features/learning-hub.md) |
| `profile` | **Implemented** | `/api/profile`, `/api/uploads/profile-image` | Profile hub + edit/security pages | — |
| `supplier_portal` | **Partial** | `/api/supplier/*` + verification submit/status | API repositories; material CRUD with lifecycle + **org verification gating** (pending/rejected/changes block Add Material) | — |

**Dev seed admin (local testing):** `admin@impactloop.test` / `AdminPassword123!` — created idempotently by `prisma/seeds/seed-admin.ts`. After login, `postAuthRouteForUser` routes ADMIN users to `/admin`.

**Locations UI note:** there is no `features/locations` folder. Location behavior is partial through reverse geocode, supplier profile/map, profile PATCH, and learner pickup reveal on accepted reservations; see [locations.md](features/locations.md).

### Flutter **not implemented** as features

`ai_agent`, `moderator`, `reports`, `reviews` — gap docs: [ai-agent.md](features/ai-agent.md), [moderator.md](features/moderator.md); see [09-open-questions.md](09-open-questions.md). Delivery UI is partial: learner request/status/tracking map marker and driver jobs/status exist; realtime tracking does not.

---

## Cross-cutting capabilities

| Capability | Status | Evidence |
|------------|--------|----------|
| JWT + refresh tokens | **Implemented** | `auth` module, `AuthTokenType.REFRESH_TOKEN` |
| Role middleware | **Implemented** | `role.middleware.ts`, supplier routes |
| Public LEARNER/SUPPLIER registration | **Implemented** | `auth.validation.ts`, `UnifiedRegisterForm` with `RegistrationIntent.both` |
| Same-account learner/supplier role switching | **Implemented** | `activeRole` on `users`, `POST /api/auth/switch-role`, `POST /api/auth/become-supplier`, portal switch UI |
| Forgot / reset password | **Implemented** | Backend: `auth.routes.ts`; Flutter: `/forgot-password` and `/reset-password` |
| Role invitations (DRIVER/MODERATOR/ADMIN) | **Implemented** | Admin email invitations + `/invite/accept` registration; `EMAIL_PROVIDER=mock` or SMTP |
| Material discovery (public) | **Implemented** | Backend + Flutter, including material view tracking and learner material likes |
| Supplier list/create/update/delete materials | **Implemented** | Create is idempotent with required `Idempotency-Key`; edit/delete gated by status + reservation history |
| Supplier reservations workflow | **Partial** | Supplier list/accept/decline/self-pickup complete with confirmation code; overdue follow-up actions + reservation messages; delivery reservations show supplier handover code + driver-delivery status instead of supplier complete — [reservations.md](features/reservations.md), [supplier-reservation-flow](flows/supplier-reservation-flow.md) |
| Learner reservation status UX | **Partial** | Partial-quantity reserve/cancel, awaiting-confirmation actions, accepted pickup confirmation code display, material `availableQuantity`, `/learner/reservations` with overdue warning, follow-up messages, delivery request/status + learner delivery code — [reservations.md](features/reservations.md), [learner-reservation-flow](flows/learner-reservation-flow.md) |
| Delivery workflow | **Partial** | Delivery domain, learner/driver APIs, handover confirmation codes on pickup/delivery with window timing enforcement (`HANDOVER_GRACE_MINUTES`), status history, pings; learner request/status/tracking summary/map marker and driver jobs/status/code prompts UI exist; no realtime stream — [delivery.md](features/delivery.md) |
| Driver portal | **Partial** | Flutter `/driver/jobs` and `/driver/deliveries/:id` use driver APIs for available jobs, active assignments, accept, status updates with supplier/learner code prompts on `PICKED_UP`/`DELIVERED`, foreground auto-location sharing on the active delivery detail page, and manual foreground location ping — [delivery.md](features/delivery.md) |
| AI material matching agent | **Not implemented** | No `ai-agent` module; no `ai_requests` table — [ai-agent.md](features/ai-agent.md) |
| AI price suggestions (listing) | **Partial** | `ai-price-suggestion.service.ts`, `AiPriceLookupLog` — internal to price rules; **not** material-matching agent |
| Learning hub API → Flutter | **Partial** | Read path wired: `/learning`, `/learning/:id`, Home spotlight; add-draft/AI/ratings/review pending |
| Reviews | **Not implemented** | `reviews` table; no API/UI |
| General notifications API | **Not implemented** | `notifications` table; supplier-derived notifications only |
| Admin / moderator dashboards | **Partial** | Admin overview dashboard **Partial** ([admin.md](features/admin.md)); moderator **Not implemented** |
| Impact analytics | **Partial** | Computed from `materials`/`reservations` in admin dashboard; counts whole `REUSED` materials (not per-reservation quantity yet) |

---

## Schema vs API coverage

| Table / domain | In schema | REST API | Flutter UI |
|----------------|-----------|----------|------------|
| Users, roles, auth | Yes | Yes | Implemented for auth MVP |
| Learner/supplier profiles | Yes | Partial (register + supplier profile) | Yes (onboarding) |
| Locations | Yes | Partial (reverse geocode) | Yes (supplier profile/map) |
| Materials discovery | Yes | Yes | Yes |
| Material reports | Yes | Yes (submit + admin review) | Partial (discovery detail submit + admin review UI) |
| Reservations | Yes | Partial (learner create/read + supplier workflow) | Partial (learner detail CTA + My Reservations + supplier portal) |
| Delivery domain | Yes | Yes | Partial |
| Legacy delivery fields on reservation | Yes | Deprecated compatibility only | No |
| Learning projects | Yes | Yes (PUBLISHED only) | **Partial** — browse/detail/spotlight API-backed; add-draft mock-only |
| Reviews | Yes | No | No |
| Notifications (generic) | Yes | No | No |
| Price/category requests | Yes | Yes | Yes (supplier add flow) |

---

## Roadmap phase mapping (informative)

Mapped from [05-roadmap.md](05-roadmap.md) to **code reality** — roadmap text unchanged.

| Phase | Roadmap goal | Code status |
|-------|--------------|-------------|
| 0 Setup | Monorepo, health | **Implemented** |
| 1 Auth | Register/login/me | **Implemented for auth MVP** — forgot/reset UI and API exist |
| 2 Profiles/locations | Profile + location screens | **Partial** — profiles yes; saved locations API **not implemented** |
| 3 Materials | Supply + discovery | **Implemented** (supplier create + public browse) |
| 4 Reservations | Learner reserve, supplier accept | **Partial** — partial-quantity holds, learner PENDING cancel, supplier accept/reject/self-pickup complete |
| 5 Learning hub + AI | Projects + AI matching | **Partial** — read API wired (Hub list/detail + Home spotlight); add-draft/AI/ratings/review **not implemented** |
| 6 Delivery | Internal delivery | **Partial** — schema + learner/driver APIs; learner request/status/tracking summary and polling map marker UI; driver jobs/status/manual ping UI; no realtime stream |
| 7 Admin/moderator | Dashboards, moderation | **Partial** — admin dashboard/invitations/approvals/material moderation/people management exist; moderator portal not implemented |

---

## Tests

| Area | Status | Files |
|------|--------|-------|
| Backend module tests | **Partial** | 19 test files under `apps/backend/src/modules/` |
| Flutter tests | **Needs verification** | e.g. `apps/frontend/test/supplier_pickup_schedule_models_test.dart` |

---

## Documentation phase

| Doc set | Status |
|---------|--------|
| Phase 0–1 inventories (this file, api-catalog, database/*, routes-map) | **Implemented** |
| Phase 2A feature docs (`docs/features/`) | **Partial** — core feature docs plus role capability framing documented |
| Phase 2A flow docs (`docs/flows/`) | **Partial** — 5 flows documented |
| Phase 2B supporting docs (`docs/features/`, `docs/flows/`) | **Partial** — 5 features + 1 flow documented (see tables below) |
| Phase 2C gap docs + [09-open-questions.md](09-open-questions.md) | **Partial** — 5 gap features + 3 stub flows + open-question index |
| ADRs (`docs/adr/`) | **Implemented** — accepted decision records exist for stack, roles, delivery, docs, theme, and delivery domain |

Unresolved risks and **Needs verification** items: [09-open-questions.md](09-open-questions.md).

### Phase 2A canonical docs (code-derived)

| Area | Feature doc | Flow doc(s) | Code status (unchanged) |
|------|-------------|-------------|-------------------------|
| Roles and capabilities | [features/roles-and-capabilities.md](features/roles-and-capabilities.md) | — | Product role framing with implemented vs planned capabilities |
| Auth | [features/auth.md](features/auth.md) | [flows/auth-flow.md](flows/auth-flow.md) | **Implemented for auth MVP** |
| Material discovery | [features/material-discovery.md](features/material-discovery.md) | [flows/material-discovery-flow.md](flows/material-discovery-flow.md) | **Implemented** |
| Supplier portal | [features/supplier-portal.md](features/supplier-portal.md) | [flows/supplier-material-listing-flow.md](flows/supplier-material-listing-flow.md), [flows/supplier-reservation-flow.md](flows/supplier-reservation-flow.md) | **Partial** |
| Learning hub | [features/learning-hub.md](features/learning-hub.md) | [flows/learning-hub-browse-flow.md](flows/learning-hub-browse-flow.md) | **Partial** — read path API-backed; add-draft/AI/ratings/review pending |

**Not covered as implemented:** AI agent, moderator portal, saved projects, followed content, project likes, build checklist, project submission/review, realtime driver tracking stream, reservation expiry, and reservation detail page remain pending.

### Phase 2B supporting docs (code-derived)

| Area | Feature doc | Flow doc(s) | Code status (unchanged) |
|------|-------------|-------------|-------------------------|
| Materials listing | [features/materials-listing.md](features/materials-listing.md) | — | **Partial** |
| Locations | [features/locations.md](features/locations.md) | — | **Partial** — public redaction **Needs verification** |
| Invitations | [features/invitations.md](features/invitations.md) | [flows/invitation-flow.md](flows/invitation-flow.md) | **Implemented** — admin UI + accept UI exist; email provider setup varies by environment |
| Landing | [features/landing.md](features/landing.md) | — | **Implemented** — static; no API |
| Home (learner) | [features/home-learner.md](features/home-learner.md) | — | **Partial** — materials + learning spotlight API-backed |

### Phase 2C gap docs (stubs — not implemented proof)

| Area | Feature doc | Flow doc(s) | Code status (unchanged) |
|------|-------------|-------------|-------------------------|
| Open questions | [09-open-questions.md](09-open-questions.md) | — | Unresolved / **Needs verification** index |
| Reservations (learner) | [features/reservations.md](features/reservations.md) | [flows/learner-reservation-flow.md](flows/learner-reservation-flow.md) | Learner create/read **Partial**; supplier **Partial** |
| Delivery | [features/delivery.md](features/delivery.md) | [flows/delivery-flow.md](flows/delivery-flow.md) | **Partial** — learner request/status/tracking summary/map marker UI and driver jobs/status/manual ping UI; no realtime stream |
| AI material matching | [features/ai-agent.md](features/ai-agent.md) | [flows/ai-material-matching-flow.md](flows/ai-material-matching-flow.md) | **Not implemented** (price AI **Partial**, separate) |
| Admin portal | [features/admin.md](features/admin.md) | — | **Partial** — dashboard, invitations, supplier verification, approvals, material moderation, people management |
| Moderator portal | [features/moderator.md](features/moderator.md) | — | **Not implemented** |
