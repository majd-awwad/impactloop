# Backend Modules Map

Maps each folder under `apps/backend/src/modules/` to its responsibility and key files.

**Source:** directory listing of `apps/backend/src/modules/` and route/controller files.  
**Not sourced from:** aspirational module lists in older `docs/02-architecture.md`.

## Module index

| Module folder | API prefix | Nested under supplier? |
|---------------|------------|-------------------------|
| `auth` | `/api/auth` | No |
| `admin` | `/api/admin` | No |
| `categories` | `/api/categories` | No |
| `category-requests` | `/api/supplier/category-requests` | Yes |
| `health` | `/health` | No |
| `invitations` | `/api/invitations` | No |
| `learning-projects` | `/api/learning-projects` | No |
| `locations` | `/api/locations` | No |
| `material-types` | `/api/material-types` | No |
| `materials` | `/api/materials` | No |
| `price-rule-requests` | `/api/price-rule-requests`, `/api/supplier/price-rule-requests` | Partial |
| `supplier` | `/api/supplier` | — (parent) |
| `supplier-notifications` | `/api/supplier/notifications` | Yes |
| `supplier-reservations` | `/api/supplier/reservations` | Yes |
| `uploads` | `/api/uploads` | No |

Mount order: `apps/backend/src/app.ts`

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

## `health`

**Purpose:** Service health endpoint for ops and Flutter diagnostic page.

**Key files:** `health.routes.ts`, `health.controller.ts`, `health.service.ts`

---

## `invitations`

**Purpose:** Admin-created invitation links for DRIVER/MODERATOR/ADMIN; public validate + accept.

**Key files:** `invitations.routes.ts`, `invitations.controller.ts`, `invitations.service.ts`, `invitations.repository.ts`, `invitations.validation.ts`

**Prisma:** `RoleInvitation`

**Frontend:** No invitation acceptance UI found — **backend-only** for accept flow.

---

## `admin`

**Purpose:** Admin portal read-only dashboard aggregates (overview metrics, impact snapshot, charts data).

**Key files:** `admin.routes.ts`, `admin.controller.ts`, `admin.service.ts`, `admin.repository.ts`, `admin.dashboard.test.ts`

**Auth:** `authMiddleware` + `requireRoles('ADMIN')` on all `/api/admin/*` routes.

**Prisma:** Aggregates from existing tables (`users`, `user_roles`, `materials`, `reservations`, `categories`, `role_invitations`, `category_requests`, `price_rule_requests`). No new tables.

**Frontend:** `features/admin_portal` — `/admin` overview + placeholders inside `AdminShell`.

---

## `learning-projects`

**Purpose:** Public read API for learning hub projects (list + detail).

**Key files:** `learning-projects.routes.ts`, `learning-projects.controller.ts`, `learning-projects.service.ts`, `learning-projects.repository.ts`, `learning-projects.validation.ts`

**Prisma:** `LearningProject` and related project tables

**Frontend:** Learning hub UI still uses mock data — see [08-implementation-status.md](../08-implementation-status.md)

---

## `locations`

**Purpose:** Authenticated reverse geocoding for supplier location input.

**Key files:** `locations.routes.ts`, `locations.controller.ts`, `locations.service.ts`, `locations.validation.ts`, `locations.test.ts`

**Cross-cutting:** `apps/backend/src/services/reverse-geocoding.service.ts`

**Prisma:** `Location` (PostGIS `geography(Point,4326)` on column `location`)

---

## `material-types`

**Purpose:** Search material types within categories; fetch active price rule for a type.

**Key files:** `material-types.routes.ts`, `material-types.controller.ts`, `material-types.service.ts`, `material-types.repository.ts`, `material-types.validation.ts`

**Prisma:** `MaterialType`, `MaterialTypeAlias`, `MaterialPriceRule`

---

## `materials`

**Purpose:** Public material discovery (list/detail), listing policy, authenticated price check before listing.

**Key files:** `materials.routes.ts`, `materials.controller.ts`, `materials.service.ts`, `materials.repository.ts`, `materials.validation.ts`, `materials.price.test.ts`

**Constants:** `apps/backend/src/constants/material-listing-policy.ts`

**Prisma:** `Material`, `MaterialImage`, `MaterialTag`

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

**Not implemented:** Learner-side reservation creation API.

---

## `uploads`

**Purpose:** Multipart upload of material images for suppliers.

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
