# Backend Modules Map

Maps each folder under `apps/backend/src/modules/` to its responsibility and key files.

**Source:** directory listing of `apps/backend/src/modules/` and route/controller files.  
**Not sourced from:** aspirational module lists in older `docs/02-architecture.md`.

## Module index

| Module folder | API prefix | Nested under supplier? |
|---------------|------------|-------------------------|
| `auth` | `/api/auth` | No |
| `admin` | `/api/admin` | No |
| `admin-approvals` | `/api/admin/approvals/*` | Via `admin` |
| `admin-materials` | `/api/admin/materials*`, `/api/admin/material-reports*` | Via `admin` |
| `admin-people` | `/api/admin/people*` | Via `admin` |
| `admin-supplier-verifications` | `/api/admin/supplier-verifications*` | Via `admin` |
| `categories` | `/api/categories` | No |
| `category-requests` | `/api/supplier/category-requests` | Yes |
| `deliveries` | `/api/deliveries`, `/api/reservations/:id/delivery` | Partial |
| `driver` | `/api/driver` | No |
| `health` | `/health` | No |
| `invitations` | `/api/invitations` | No |
| `learning-projects` | `/api/learning-projects` | No |
| `locations` | `/api/locations` | No |
| `material-types` | `/api/material-types` | No |
| `materials` | `/api/materials` | No |
| `price-rule-requests` | `/api/price-rule-requests`, `/api/supplier/price-rule-requests` | Partial |
| `profile` | `/api/profile` | No |
| `reservations` | `/api/reservations` | No |
| `supplier` | `/api/supplier` | — (parent) |
| `supplier-notifications` | `/api/supplier/notifications` | Yes |
| `supplier-reservations` | `/api/supplier/reservations` | Yes |
| `supplier-verification` | `/api/supplier/verification*` | Yes |
| `uploads` | `/api/uploads` | No |

Mount order: `apps/backend/src/app.ts`

---

## `profile`

**Purpose:** Authenticated learner/user profile updates (`displayName`, `phone`, `profileImageUrl`, learner profile fields).

**Key files:** `profile.routes.ts`, `profile.controller.ts`, `profile.service.ts`, `profile.repository.ts`, `profile.validation.ts`, `profile.test.ts`

**Inspected:** `profile.routes.ts` — `PATCH /`, `PATCH /learner`

---

## `auth`

**Purpose:** User registration (LEARNER/SUPPLIER), login, JWT session, password reset, refresh tokens, `/me`.

**Key files:**
- `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.repository.ts`, `auth.validation.ts`
- `pickup-area.ts`, `auth-token-delivery.ts`

**Inspected:** `auth.routes.ts`, `auth.validation.ts` (`PUBLIC_SIGNUP_ROLES`)

---

## `categories`

**Purpose:** Read-only category listing (material and project taxonomy).

**Key files:** `categories.routes.ts`, `categories.controller.ts`, `categories.service.ts`, `categories.repository.ts`, `categories.validation.ts`

---

## `category-requests`

**Purpose:** Supplier-submitted requests for new categories; stores listing draft JSON; links to published material when approved.

**Mounted at:** `supplierRouter.use('/category-requests', …)` in `supplier/supplier.routes.ts`

**Key files:** `category-requests.routes.ts`, `category-requests.controller.ts`, `category-requests.service.ts`, `category-requests.repository.ts`, `category-requests.validation.ts`

**Prisma:** `CategoryRequest` model

---

## `deliveries`

**Purpose:** Learner delivery request/read APIs for accepted reservations. Creates delivery attempts, copied pickup/dropoff locations, and delivery status history.

**Mounts:**
- `POST /api/reservations/:id/delivery` through `reservations.routes.ts`
- `GET /api/deliveries/my`
- `GET /api/deliveries/:id`

**Key files:** `deliveries.routes.ts`, `deliveries.controller.ts`, `deliveries.service.ts`, `deliveries.validation.ts`, `deliveries.service.test.ts`

**Prisma:** `Delivery`, `DeliveryStatusHistory`, `Location`, `Reservation`, `Material`

---

## `driver`

**Purpose:** Internal driver job list, race-safe assignment, status updates, and location pings.

**Mounted at:** `/api/driver`

**Key files:** `driver.routes.ts`, `driver.controller.ts`, `driver.service.ts`, `driver.validation.ts`

**Prisma:** `DriverProfile`, `Delivery`, `DeliveryAssignment`, `DeliveryLocationPing`

---

## `health`

**Purpose:** Service health endpoint for ops and Flutter diagnostic page.

**Key files:** `health.routes.ts`, `health.controller.ts`, `health.service.ts`

---

## `invitations`

**Purpose:** Admin-created invitation links for DRIVER/MODERATOR/ADMIN; public validate + accept.

**Key files:** `invitations.routes.ts`, `invitations.controller.ts`, `invitations.service.ts`, `invitations.repository.ts`, `invitations.validation.ts`

**Prisma:** `RoleInvitation`

**Frontend:** `features/invitations` provides `/invite/accept`.

---

## `admin`

**Purpose:** Admin dashboard, invitation management, supplier verification review, approvals, material moderation/report review, and people management.

**Key files:** `admin.routes.ts`, `admin.controller.ts`, `admin.service.ts`, `admin.repository.ts`, `admin.dashboard.test.ts`

**Auth:** `authMiddleware` + `requireRoles('ADMIN')` on all `/api/admin/*` routes.

**Prisma:** Aggregates and operations across existing tables (`users`, `user_roles`, `materials`, `material_reports`, `reservations`, `categories`, `role_invitations`, `category_requests`, `price_rule_requests`, supplier verification tables). No admin-only tables.

**Frontend:** `features/admin_portal` — `/admin` overview, users, supplier verification, materials, approvals, invitations, and placeholders for impact/audit logs inside `AdminShell`.

---

## `admin-approvals`

**Purpose:** Admin review of supplier category requests and price rule requests.

**Key files:** `admin-approvals.controller.ts`, `admin-approvals.service.ts`, `admin-approvals.repository.ts`, `admin-approvals.validation.ts`, `admin-approvals.test.ts`

**Mounted through:** `admin.routes.ts`

---

## `admin-materials`

**Purpose:** Admin material list/detail moderation, material report list/detail, report resolve/reject, and hide material from report.

**Key files:** `admin-materials.controller.ts`, `admin-materials.service.ts`, `admin-materials.repository.ts`, `admin-materials.validation.ts`

**Mounted through:** `admin.routes.ts`

---

## `admin-people`

**Purpose:** Admin people summaries, user list/detail, suspend, and reactivate.

**Key files:** `admin-people.controller.ts`, `admin-people.service.ts`, `admin-people.repository.ts`, `admin-people.validation.ts`

**Mounted through:** `admin.routes.ts`

---

## `admin-supplier-verifications`

**Purpose:** Admin review of organization supplier verification documents.

**Key files:** `admin-supplier-verifications.controller.ts`, `admin-supplier-verifications.service.ts`, `admin-supplier-verifications.repository.ts`, `admin-supplier-verifications.validation.ts`

**Mounted through:** `admin.routes.ts`

---

## `learning-projects`

**Purpose:** Public read API for learning hub projects (list + detail), learner project likes/saves/follows/reviews, and learner project submit-for-review.

**Key files:** `learning-projects.routes.ts`, `learning-projects.controller.ts`, `learning-projects.service.ts`, `learning-projects.repository.ts`, `learning-projects.validation.ts`

**Prisma:** `LearningProject`, `ProjectLike`, `ProjectSave`, `ProjectFollow`, `ProjectUserReview`, and related project tables

**Frontend:** Learning hub list/detail, home spotlight, and add-draft submission are API-backed; admin moderation lives under `/api/admin/learning-projects*` — see [08-implementation-status.md](../08-implementation-status.md)

---

## `locations`

**Purpose:** Authenticated reverse geocoding for supplier location input and private user saved-location CRUD.

**Key files:** `locations.routes.ts`, `locations.controller.ts`, `locations.service.ts`, `locations.repository.ts`, `locations.validation.ts`, `locations.test.ts`

**Cross-cutting:** `apps/backend/src/services/reverse-geocoding.service.ts`

**Prisma:** `Location` (PostGIS `geography(Point,4326)` on column `location`), `UserSavedLocation`

---

## `material-types`

**Purpose:** Search material types within categories; fetch active price rule for a type.

**Key files:** `material-types.routes.ts`, `material-types.controller.ts`, `material-types.service.ts`, `material-types.repository.ts`, `material-types.validation.ts`

**Prisma:** `MaterialType`, `MaterialTypeAlias`, `MaterialPriceRule`

---

## `materials`

**Purpose:** Public material discovery (list/detail, nearest sort, approximate map pins), listing policy, authenticated price check before listing, and learner material engagement (views/likes).

**Key files:** `materials.routes.ts`, `materials.controller.ts`, `materials.service.ts`, `materials.repository.ts`, `materials.validation.ts`, `materials.price.test.ts`

**Constants:** `apps/backend/src/constants/material-listing-policy.ts`

**Prisma:** `Material`, `MaterialImage`, `MaterialTag`, `MaterialView`, `MaterialLike`

---

## `price-rule-requests`

**Purpose:** Create price rule review requests; supplier views requests and listing drafts.

**Mounts:**
- `POST /api/price-rule-requests` — `price-rule-requests.routes.ts`
- `GET /api/supplier/price-rule-requests*` — `price-rule-requests.supplier.routes.ts`

**Key files:** `price-rule-requests.controller.ts`, `price-rule-requests.service.ts`, `price-rule-requests.repository.ts`, `price-rule-requests.validation.ts`, `price-rule-request-pricing.ts`

**Services:** `ai-price-suggestion.service.ts` (Gemini or mock provider via `env.ts`)

**Prisma:** `PriceRuleRequest`, `AiPriceLookupLog`

---

## `reservations`

**Purpose:** Learner-side material reservation creation and read model.

**Mounted at:** `/api/reservations`

**Key files:** `reservations.routes.ts`, `reservations.controller.ts`, `reservations.service.ts`, `reservations.repository.ts`, `reservations.validation.ts`, `reservations.create.test.ts`

**Prisma:** `Reservation`, `ReservationStatusHistory`, `Material`

**Behavior:** `POST /api/reservations` requires a `LEARNER`, validates the material and requested quantity, prevents own-material reservations, enforces one open reservation per learner/material, creates a `PENDING` reservation hold, and recomputes material status from held/remaining quantity. `GET /api/reservations/my` returns the current learner's reservations newest first with safe material, supplier, status, delivery, and pickup-window summary fields. `PATCH /api/reservations/:id/cancel` supports learner cancellation while `PENDING`.

**Not implemented:** Payment and reviews.

---

## `notifications`

**Purpose:** Authenticated persisted inbox backed by the `notifications` table.

**Mounted at:** `/api/notifications`

**Key files:** `notifications.routes.ts`, `notifications.controller.ts`, `notifications.service.ts`, `notifications.repository.ts`, `reservation-notifications.ts`, `notifications.test.ts`

**Prisma:** `Notification`

**Behavior:** List with pagination/unread summary, mark one read, mark all read. Reservation lifecycle hooks write supplier/learner notification rows.

---

## `supplier`

**Purpose:** Supplier dashboard, profile CRUD, list/create own materials; mounts nested supplier routers.

**Key files:** `supplier.routes.ts`, `supplier.controller.ts`, `supplier.service.ts`, `supplier.repository.ts`, `supplier.validation.ts`, `supplier.materials.test.ts`, `dto/supplier-profile.dto.ts`, `dto/supplier-dashboard.dto.ts`

**Prisma:** `SupplierProfile`, `OrganizationProfile`

---

## `supplier-notifications`

**Purpose:** Derived “action notifications” for supplier inbox (not general `notifications` table API).

**Mounted at:** `supplierRouter.use('/notifications', …)`

**Key files:** `supplier-notifications.routes.ts`, `supplier-notifications.controller.ts`, `supplier-notifications.service.ts`

**Prisma:** Reads from reservations/materials/etc. — **Needs verification** of exact query sources in service file.

---

## `supplier-reservations`

**Purpose:** Supplier-side reservation workflow: list, accept, decline, complete pickup.

**Key files:** `supplier-reservations.routes.ts`, `supplier-reservations.controller.ts`, `supplier-reservations.service.ts`, `supplier-reservations.repository.ts`, `supplier-reservations.validation.ts`, `supplier-reservations.complete.test.ts`

**Prisma:** `Reservation`, `ReservationStatusHistory`

**Status behavior:** Accept sets reservation `ACCEPTED` and material `RESERVED`; decline sets reservation `REJECTED` and safely returns material to `AVAILABLE`; complete sets reservation `COMPLETED` and material `REUSED`.

Status behavior is quantity-aware. Accept keeps the hold; decline releases it; complete subtracts `quantityRequested`. Delivery reservations complete through driver `DELIVERED` rather than supplier manual completion.

---

## `supplier-verification`

**Purpose:** Supplier organization verification submit/status support used by supplier portal and admin review workflows.

**Key files:** `supplier-verification.routes.ts`, `supplier-verification.controller.ts`, `supplier-verification.service.ts`, `supplier-verification.repository.ts`, `supplier-verification.validation.ts`

---

## `uploads`

**Purpose:** Multipart upload of material images, profile images, and supplier verification documents.

**Key files:** `uploads.routes.ts`, `uploads.controller.ts`, `uploads.service.ts`, `uploads.middleware.ts`, `uploads.storage.ts`

**Static serving:** `/uploads/materials` configured in `app.ts`

---

## Shared backend infrastructure (outside `modules/`)

| Path | Role |
|------|------|
| `apps/backend/src/middlewares/` | `auth.middleware.ts`, `role.middleware.ts`, `validate.middleware.ts`, `error.middleware.ts` |
| `apps/backend/src/database/prisma.ts` | Prisma client |
| `apps/backend/src/config/env.ts` | Port, CORS, AI provider, geocoding |
| `apps/backend/src/utils/` | JWT, passwords, tokens, errors, async handler |
| `apps/backend/src/services/` | AI price suggestion, reverse geocoding, material reference matching |

## Seeds

`apps/backend/prisma/seed.ts` orchestrates demo data via `prisma/seeds/*` (materials, supplier reservations, notifications, taxonomy).
