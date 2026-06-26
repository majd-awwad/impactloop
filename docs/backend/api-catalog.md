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
| POST | `/api/materials/:id/reports` | Bearer JWT | `materials/materials.routes.ts` |

**Note:** Material **creation** is not on this router. Suppliers create via `POST /api/supplier/materials`.

**`POST /api/materials/:id/reports` body:** `{ reason: MaterialReportReason, note?: string }` — `note` required when `reason=OTHER`. Duplicate pending report by same user/material returns 409. Public discovery excludes `UNAVAILABLE` materials (default list status `AVAILABLE`).

## Reservations — `/api/reservations`

| Method | Path | Auth | Roles | Source file |
|--------|------|------|-------|-------------|
| GET | `/api/reservations/my` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/delivery` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` + `deliveries` |

`GET /api/reservations/my` returns the authenticated learner's reservations newest first. Items include reservation status, requested quantity, message, timestamps, safe material summary, `material.deliveryAllowed`, supplier display name, pickup window fields, supplier note, and rejection reason. It does not expose precise pickup coordinates.

`POST /api/reservations` creates an exclusive learner reservation request for an `AVAILABLE` material. The request body is `{ materialId, quantityRequested, message? }`. The transaction creates a `PENDING` reservation, writes reservation status history, and moves the material to `PENDING_RESERVATION`. Duplicate active reservations and unavailable material states return `409 CONFLICT`.

`POST /api/reservations/:id/delivery` creates an internal delivery attempt for an accepted learner-owned reservation. Body: `{ dropoffLocation, learnerNote? }`, where `dropoffLocation` includes country/city plus optional area/address/latitude/longitude. The route creates copied pickup/dropoff locations, a `Delivery` row with `WAITING_FOR_DRIVER`, and delivery status history. It rejects non-accepted reservations, delivery-disabled materials, and reservations with an active delivery.

## Deliveries — `/api/deliveries`

| Method | Path | Auth | Roles | Source file |
|--------|------|------|-------|-------------|
| GET | `/api/deliveries/my` | Bearer JWT | `LEARNER` | `deliveries/deliveries.routes.ts` |
| GET | `/api/deliveries/:id` | Bearer JWT | `LEARNER` | `deliveries/deliveries.routes.ts` |

Learner delivery responses include reservation summary, pickup/dropoff location snapshots, assigned driver summary when present, delivery status history, and `latestDriverPing` for deliveries requested by the authenticated learner. `latestDriverPing` is a latest-only tracking summary with `capturedAt` and optional `accuracyMeters`; it does not include ping history.

## Driver — `/api/driver`

All routes require Bearer JWT + `DRIVER` role and an active `DriverProfile`.

| Method | Path | Source file |
|--------|------|-------------|
| GET | `/api/driver/deliveries/available` | `driver/driver.routes.ts` |
| GET | `/api/driver/deliveries/active` | `driver/driver.routes.ts` |
| POST | `/api/driver/deliveries/:id/accept` | `driver/driver.routes.ts` |
| PATCH | `/api/driver/deliveries/:id/status` | `driver/driver.routes.ts` |
| POST | `/api/driver/deliveries/:id/location-pings` | `driver/driver.routes.ts` |

Available jobs return safe area-level pickup/dropoff data only. Accept is transactional and assigns only `WAITING_FOR_DRIVER` unassigned deliveries. Status updates are assigned-driver-only and must follow `DRIVER_ASSIGNED → ARRIVED_PICKUP → PICKED_UP → ON_THE_WAY → ARRIVED_DROPOFF → DELIVERED`. `DELIVERED` completes the reservation and marks the material `REUSED`. Location pings store decimal latitude/longitude for assigned active deliveries and return numeric coordinates to the driver caller; learner delivery reads expose only the latest ping summary. No realtime stream exists yet.

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
| POST | `/api/uploads/supplier-verification-document` | Bearer JWT | authenticated (org supplier registration) | `uploads/uploads.routes.ts` |

Static files: `GET /uploads/materials/*`, `GET /uploads/supplier-verification/*` (`app.ts`).

Verification document upload: PDF/JPG/JPEG/PNG, max 5MB. Returns `{ url, fileName }`.

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

## Admin — `/api/admin`

| Method | Path | Auth | Roles | Source file |
|--------|------|------|-------|-------------|
| GET | `/api/admin/dashboard` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/invitations` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| POST | `/api/admin/invitations` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| POST | `/api/admin/invitations/:id/resend` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/invitations/:id/revoke` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/supplier-verifications` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/supplier-verifications/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/supplier-verifications/:id/approve` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/supplier-verifications/:id/reject` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/supplier-verifications/:id/request-changes` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/approvals/summary` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/approvals/category-requests` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/approvals/category-requests/:id/approve` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/approvals/category-requests/:id/reject` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/approvals/price-requests` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/approvals/price-requests/:id/approve` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/approvals/price-requests/:id/reject` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/materials/summary` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/materials` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/materials/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/materials/:id/hide` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/materials/:id/mark-unavailable` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/materials/:id/restore` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/material-reports` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/material-reports/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/material-reports/:id/resolve` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/material-reports/:id/reject` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/material-reports/:id/hide-material` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |

**`GET /api/admin/supplier-verifications` query:** `status` (`PENDING` \| `APPROVED` \| `REJECTED` \| `CHANGES_REQUESTED`), `search`, `supplierType` (`WORKSHOP` \| `FACTORY` \| `EDUCATIONAL_INSTITUTION`), `city`, `page`, `limit`.

**`PATCH .../reject` and `.../request-changes` body:** `{ adminNote: string }` (required, min 3 chars). **`PATCH .../approve` body:** `{ adminNote?: string }`.

**Approvals list queries:** `status` (`PENDING` \| `APPROVED` \| `REJECTED`), `search`, `page`, `limit`.

**`PATCH /api/admin/approvals/category-requests/:id/approve` body:** `{ finalName: string, parentCategoryId?: string, adminNote?: string }`

**`PATCH /api/admin/approvals/category-requests/:id/reject` body:** `{ adminNote: string, suggestedCategoryId?: string }` — `suggestedCategoryId` is required when at least one active material category exists.

**Admin category list item fields:** `requestedName`, `status`, supplier fields, `materialTitle`, `materialDescription`, `quantity`, `unit`, `condition`, `locationLabel`, `categoryRequestReason`, `similarCategories`, `adminNote`, `createdAt`.

**`PATCH /api/admin/approvals/price-requests/:id/approve` body:** `{ adminNote?: string }`

**`PATCH /api/admin/approvals/price-requests/:id/reject` body:** `{ adminNote: string, maxAllowedPrice: number }`

**Admin materials list query:** `search`, `status`, `categoryId`, `supplierId`, `city`, `isFree`, `verificationStatus`, `reportStatus` (`PENDING` \| `HAS_REPORTS` \| `NONE`), `page`, `limit`.

**`PATCH /api/admin/materials/:id/hide` body:** `{ reason: string }` (required). Sets material `status=UNAVAILABLE`, stores moderation reason, notifies supplier. Blocked when active reservation exists.

**`PATCH /api/admin/material-reports/:id/hide-material` body:** `{ adminNote: string }` (required). Resolves report and hides material in one transaction.

**Response (`data`) for list:** `{ items, summary: { pending, approved, rejected, changesRequested }, pagination }`. Detail includes supplier profile, organization profile, owner, location, document info, review metadata.

**Supplier notification:** each approve/reject/request-changes creates a `notifications` row (`notificationType=SUPPLIER_VERIFICATION_UPDATE`, `relatedEntityType=SUPPLIER_PROFILE`).

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

### Supplier verification — `/api/supplier/verification`

Organization suppliers (`WORKSHOP`, `FACTORY`, `EDUCATIONAL_INSTITUTION`) must submit a verification document before publishing materials. Individual/student suppliers use `verificationStatus=NOT_REQUIRED`.

| Method | Path | Source file |
|--------|------|-------------|
| GET | `/api/supplier/verification/status` | `supplier-verification/supplier-verification.routes.ts` |
| POST | `/api/supplier/verification/submit` | `supplier-verification/supplier-verification.routes.ts` |
| POST | `/api/supplier/verification/resubmit` | `supplier-verification/supplier-verification.routes.ts` |

`POST .../submit` body: organization fields + `verificationDocumentUrl`, `verificationDocumentName`. Sets `verificationStatus=PENDING`. `POST .../resubmit` allowed when status is `REJECTED` or `CHANGES_REQUESTED`.

`POST /api/supplier/materials` returns **403** when organization supplier is not `APPROVED` (`SUPPLIER_VERIFICATION_REQUIRED`).

`POST /api/supplier/materials` body (pickup/delivery related): `useDefaultPickupLocation` (boolean, default `true`); `pickupLocation` (location object, required when `useDefaultPickupLocation` is `false`); `deliveryAllowed` (boolean, default `false`). Organization suppliers must use profile default; override is rejected with `ORG_PICKUP_OVERRIDE_NOT_ALLOWED`. Each create stores a **new** `locations` row on the material (copy or override), not the profile row id.


`PATCH /api/supplier/materials/:id` updates safe listing fields only (`title`, `description`, `quantity`, `unit`, `condition`, `pickupAllowed`, `deliveryAllowed`, `pickupNotes`, `suggestedUses`). Edit is allowed only when `canEdit` is true (same lifecycle rules as delete). List/detail responses include `canEdit` / `editBlockedReason` and `canDelete` / `deleteBlockedReason`.

`DELETE /api/supplier/materials/:id` removes an owned listing when `canDelete` is true (409 when blocked).

### Category requests — `/api/supplier/category-requests`

| Method | Path | Source file |
|--------|------|-------------|
| POST | `/api/supplier/category-requests` | `category-requests/category-requests.routes.ts` |
| GET | `/api/supplier/category-requests` | `category-requests/category-requests.routes.ts` |
| GET | `/api/supplier/category-requests/:id/draft` | `category-requests/category-requests.routes.ts` |

**`POST /api/supplier/category-requests` body:** `{ requestedName: string, listingDraftJson: { materialName, title, description, categoryRequestReason, condition, quantity, unit, isFree, ... } }`. Server rejects requests missing material name/title, description (min 10 chars), or category request reason (min 10 chars). Material context is stored in `listing_draft_json`.

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

Accept moves a pending reservation to `ACCEPTED` and the material to `RESERVED`. Decline moves the reservation to `REJECTED` and returns the material to `AVAILABLE` when no other active reservation exists. Complete moves a self-pickup reservation to `COMPLETED` and the material to `REUSED`; it is blocked when an active or delivered delivery exists.

## Endpoints documented elsewhere but **not mounted**

These appear in `docs/04-api-conventions.md` or `docs/02-architecture.md` examples but have **no route file** in the current codebase:

| Example | Status |
|---------|--------|
| `POST /api/materials` | **Not implemented** — use `POST /api/supplier/materials` |
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
/api/reservations                → reservationsRouter
/api/deliveries                  → deliveriesRouter
/api/driver                      → driverRouter
/api/uploads                     → uploadsRouter
/api/locations                   → locationsRouter
/api/supplier                    → supplierRouter
/api/admin                       → adminRouter
```
