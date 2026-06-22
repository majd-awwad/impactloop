# Backend API Catalog

HTTP endpoints **as mounted in code**. Derived from `apps/backend/src/app.ts` and `apps/backend/src/modules/**/*.routes.ts`.

**Not sourced from:** `docs/04-api-conventions.md` endpoint examples (many are aspirational).

Conventions for response shape: [04-api-conventions.md](../04-api-conventions.md).

## Static files

| Method | Path | Auth | Source |
|--------|------|------|--------|
| GET | `/uploads/materials/*` | Public | `app.ts` — `express.static(MATERIAL_UPLOADS_DIR)` |

## Health

| Method | Path | Auth | Handler module |
|--------|------|------|----------------|
| GET | `/health` | Public | `health` |

## Auth — `/api/auth`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public | `auth/auth.routes.ts` |
| POST | `/api/auth/login` | Public | `auth/auth.routes.ts` |
| POST | `/api/auth/forgot-password` | Public | `auth/auth.routes.ts` |
| POST | `/api/auth/reset-password` | Public | `auth/auth.routes.ts` |
| POST | `/api/auth/refresh` | Public | `auth/auth.routes.ts` |
| POST | `/api/auth/logout` | Public | `auth/auth.routes.ts` |
| GET | `/api/auth/me` | Bearer JWT | `auth/auth.routes.ts` |
| PATCH | `/api/auth/change-password` | Bearer JWT | `auth/auth.routes.ts` |

Validation schemas: `auth/auth.validation.ts`

## Categories — `/api/categories`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| GET | `/api/categories` | Public | `categories/categories.routes.ts` |

Query validation: `categoriesQuerySchema`

## Material types — `/api/material-types`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| GET | `/api/material-types` | Public | `material-types/material-types.routes.ts` |
| GET | `/api/material-types/:id/price-rule` | Public | `material-types/material-types.routes.ts` |

## Materials — `/api/materials`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| GET | `/api/materials/listing-policy` | Public | `materials/materials.routes.ts` |
| POST | `/api/materials/price-check` | Bearer JWT | `materials/materials.routes.ts` |
| GET | `/api/materials` | Public | `materials/materials.routes.ts` |
| GET | `/api/materials/:id` | Public | `materials/materials.routes.ts` |

**Note:** Material **creation** is not on this router. Suppliers create via `POST /api/supplier/materials`.

## Price rule requests — `/api/price-rule-requests`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| POST | `/api/price-rule-requests` | Bearer JWT | `price-rule-requests/price-rule-requests.routes.ts` |

**Needs verification:** route uses `authMiddleware` only — no `requireRoles('SUPPLIER')` in route file.

## Learning projects — `/api/learning-projects`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| GET | `/api/learning-projects` | Public | `learning-projects/learning-projects.routes.ts` |
| GET | `/api/learning-projects/:id` | Public | `learning-projects/learning-projects.routes.ts` |

## Uploads — `/api/uploads`

| Method | Path | Auth | Roles | Source file |
|--------|------|------|-------|-------------|
| POST | `/api/uploads/material-images` | Bearer JWT | `SUPPLIER` | `uploads/uploads.routes.ts` |

Multipart middleware: `uploads/uploads.middleware.ts`

## Locations — `/api/locations`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| POST | `/api/locations/reverse-geocode` | Bearer JWT | `locations/locations.routes.ts` |

## Invitations — `/api/invitations`

| Method | Path | Auth | Roles | Source file |
|--------|------|------|-------|-------------|
| POST | `/api/invitations` | Bearer JWT | `ADMIN` | `invitations/invitations.routes.ts` |
| GET | `/api/invitations/validate/:token` | Public | — | `invitations/invitations.routes.ts` |
| POST | `/api/invitations/accept` | Public | — | `invitations/invitations.routes.ts` |

## Supplier — `/api/supplier`

All routes below require Bearer JWT + `SUPPLIER` role unless noted. Source: `supplier/supplier.routes.ts` and nested routers.

### Core supplier

| Method | Path | Source file |
|--------|------|-------------|
| GET | `/api/supplier/dashboard` | `supplier/supplier.routes.ts` |
| GET | `/api/supplier/profile` | `supplier/supplier.routes.ts` |
| PATCH | `/api/supplier/profile` | `supplier/supplier.routes.ts` |
| GET | `/api/supplier/materials` | `supplier/supplier.routes.ts` |
| GET | `/api/supplier/materials/:id` | `supplier/supplier.routes.ts` |
| PATCH | `/api/supplier/materials/:id` | `supplier/supplier.routes.ts` |
| POST | `/api/supplier/materials` | `supplier/supplier.routes.ts` |
| DELETE | `/api/supplier/materials/:id` | `supplier/supplier.routes.ts` |

`POST /api/supplier/materials` body (pickup-related): `useDefaultPickupLocation` (boolean, default `true`); `pickupLocation` (location object, required when `useDefaultPickupLocation` is `false`). Organization suppliers must use profile default; override is rejected with `ORG_PICKUP_OVERRIDE_NOT_ALLOWED`. Each create stores a **new** `locations` row on the material (copy or override), not the profile row id.

`PATCH /api/supplier/materials/:id` updates safe listing fields only (`title`, `description`, `quantity`, `unit`, `condition`, `pickupAllowed`, `pickupNotes`, `suggestedUses`). `deliveryAllowed` is forced `false` on update. Edit is allowed only when `canEdit` is true (same lifecycle rules as delete). List/detail responses include `canEdit` / `editBlockedReason` and `canDelete` / `deleteBlockedReason`.

`DELETE /api/supplier/materials/:id` removes an owned listing when `canDelete` is true (409 when blocked).

### Category requests — `/api/supplier/category-requests`

| Method | Path | Source file |
|--------|------|-------------|
| POST | `/api/supplier/category-requests` | `category-requests/category-requests.routes.ts` |
| GET | `/api/supplier/category-requests` | `category-requests/category-requests.routes.ts` |
| GET | `/api/supplier/category-requests/:id/draft` | `category-requests/category-requests.routes.ts` |

### Price rule requests (supplier) — `/api/supplier/price-rule-requests`

| Method | Path | Source file |
|--------|------|-------------|
| GET | `/api/supplier/price-rule-requests` | `price-rule-requests/price-rule-requests.supplier.routes.ts` |
| GET | `/api/supplier/price-rule-requests/:id/draft` | `price-rule-requests/price-rule-requests.supplier.routes.ts` |

### Notifications — `/api/supplier/notifications`

| Method | Path | Source file |
|--------|------|-------------|
| GET | `/api/supplier/notifications` | `supplier-notifications/supplier-notifications.routes.ts` |

### Reservations — `/api/supplier/reservations`

| Method | Path | Source file |
|--------|------|-------------|
| GET | `/api/supplier/reservations` | `supplier-reservations/supplier-reservations.routes.ts` |
| PATCH | `/api/supplier/reservations/:id/accept` | `supplier-reservations/supplier-reservations.routes.ts` |
| PATCH | `/api/supplier/reservations/:id/decline` | `supplier-reservations/supplier-reservations.routes.ts` |
| PATCH | `/api/supplier/reservations/:id/complete` | `supplier-reservations/supplier-reservations.routes.ts` |

## Endpoints documented elsewhere but **not mounted**

These appear in `docs/04-api-conventions.md` or `docs/02-architecture.md` examples but have **no route file** in the current codebase:

| Example | Status |
|---------|--------|
| `POST /api/materials` | **Not implemented** — use `POST /api/supplier/materials` |
| `POST /api/reservations` | **Not implemented** |
| `GET /api/reservations/my` | **Not implemented** |
| `PATCH /api/reservations/:id/accept` | **Not implemented** — supplier path is `/api/supplier/reservations/:id/accept` |
| `POST /api/ai/requests` | **Not implemented** |
| `GET /api/ai/credits/me` | **Not implemented** |

## Route mount reference

From `apps/backend/src/app.ts`:

```
/health                          → healthRouter
/api/auth                        → authRouter
/api/categories                  → categoriesRouter
/api/material-types              → materialTypesRouter
/api/price-rule-requests         → priceRuleRequestsRouter
/api/invitations                 → invitationsRouter
/api/learning-projects           → learningProjectsRouter
/api/materials                   → materialsRouter
/api/uploads                     → uploadsRouter
/api/locations                   → locationsRouter
/api/supplier                    → supplierRouter
```
