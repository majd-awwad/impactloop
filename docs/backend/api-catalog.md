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

Optional query `discoveryOnly=true` applies discovery name filtering and dedupe (`category-discovery-filter.ts`) for public browse UI only. Without it, supplier/admin category pickers receive the full active category list.

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

**`GET /api/materials` query:** `q`, `categoryId`, `condition`, `status` (default `AVAILABLE`), `priceType` (`FREE` \| `PAID` \| `ANY`, default `ANY`), `deliveryAvailable`, `pickupAllowed`, `city`, `area`, `sort` (`newest` \| `popular`, default `newest`), `page`, `limit`. Response: `{ items, pagination: { page, limit, total, totalPages } }`. Public item fields include `quantity`, `availableQuantity`, `unit`, `city`, `area`, `pickupAllowed`, `deliveryAvailable`, `viewsCount`; no `addressLine` / `latitude` / `longitude`.

**`GET /api/materials/:id`:** increments `viewsCount` on each successful public detail read (`404` does not increment). `viewsCount` is a total detail-view counter, not unique visitors. Same public field redaction as list items.

## Reservations — `/api/reservations`

| Method | Path | Auth | Roles | Source file |
|--------|------|------|-------|-------------|
| GET | `/api/reservations/my` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| PATCH | `/api/reservations/:id/cancel` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/delivery` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` + `deliveries` |

`GET /api/reservations/my` returns the authenticated learner's reservations newest first. Items include reservation status, `quantityRequested`, message, timestamps, safe material summary (including `unit` and approximate `city`/`area`), `material.deliveryAllowed`, `deliveryRequested`, supplier display name, pickup window fields, supplier note, rejection reason, and nullable `pickupLocationFull`. `pickupLocationFull` is populated only when the reservation status is `ACCEPTED` or `COMPLETED`; it is `null` for `PENDING`, `REJECTED`, `CANCELLED`, and `EXPIRED`. When present, `pickupLocationFull` includes `country`, `city`, `area`, `addressLine`, `latitude`, `longitude`, and `isApproximate` using the same decimal-to-number JSON convention as other location DTOs. Public material discovery endpoints continue to expose only approximate city/area.

`POST /api/reservations` creates a partial-quantity hold for an available material. Body: `{ materialId, quantityRequested, message? }`. The transaction validates `quantityRequested` against computed `availableQuantity`, blocks a second open reservation by the same learner on the same material, creates a `PENDING` reservation, writes status history, and recomputes material status. Material stays `AVAILABLE` while stock remains reservable.

`PATCH /api/reservations/:id/cancel` cancels a learner-owned `PENDING` reservation, sets `CANCELLED`, writes status history, and releases the held quantity. `ACCEPTED` / terminal statuses return `409 CONFLICT`.

Public material list/detail responses include `quantity` (remaining stock), `availableQuantity` (remaining minus active holds), and `unit`.

`POST /api/reservations/:id/delivery` creates an internal delivery attempt for an accepted learner-owned reservation. Body: `{ dropoffLocation, learnerNote? }`, where `dropoffLocation` includes country/city plus optional area/address/latitude/longitude. The route creates copied pickup/dropoff locations, a `Delivery` row with `WAITING_FOR_DRIVER`, and delivery status history. It rejects non-accepted reservations, delivery-disabled materials, and reservations with an active delivery.

## Deliveries — `/api/deliveries`

| Method | Path | Auth | Roles | Source file |
|--------|------|------|-------|-------------|
| GET | `/api/deliveries/my` | Bearer JWT | `LEARNER` | `deliveries/deliveries.routes.ts` |
| GET | `/api/deliveries/:id` | Bearer JWT | `LEARNER` | `deliveries/deliveries.routes.ts` |

Learner delivery responses include reservation summary, pickup/dropoff location snapshots, assigned driver summary when present, delivery status history, and `latestDriverPing` for deliveries requested by the authenticated learner. `latestDriverPing` is latest-only and does not include ping history. It includes `capturedAt` and optional `accuracyMeters`; `latitude`/`longitude` are included only by `GET /api/deliveries/:id` for learner-owned deliveries in tracking-eligible statuses (`DRIVER_ASSIGNED`, `ARRIVED_PICKUP`, `PICKED_UP`, `ON_THE_WAY`, `ARRIVED_DROPOFF`). `GET /api/deliveries/my` remains summary-only and does not include ping coordinates.

## Driver — `/api/driver`

All routes require Bearer JWT + `DRIVER` role and an active `DriverProfile`.

| Method | Path | Source file |
|--------|------|-------------|
| GET | `/api/driver/deliveries/available` | `driver/driver.routes.ts` |
| GET | `/api/driver/deliveries/active` | `driver/driver.routes.ts` |
| POST | `/api/driver/deliveries/:id/accept` | `driver/driver.routes.ts` |
| PATCH | `/api/driver/deliveries/:id/status` | `driver/driver.routes.ts` |
| POST | `/api/driver/deliveries/:id/location-pings` | `driver/driver.routes.ts` |

Available jobs return safe area-level pickup/dropoff data only. Accept is transactional and assigns only `WAITING_FOR_DRIVER` unassigned deliveries; active drivers can accept from `OFFLINE` or `AVAILABLE`, and accepting moves the profile to `ON_DELIVERY`. Status updates are assigned-driver-only and must follow `DRIVER_ASSIGNED → ARRIVED_PICKUP → PICKED_UP → ON_THE_WAY → ARRIVED_DROPOFF → DELIVERED`. `DELIVERED` completes the reservation, subtracts `quantityRequested` from `material.quantity`, and marks the material `REUSED` only when remaining quantity reaches `0`. Location pings store decimal latitude/longitude for assigned active deliveries and return numeric coordinates to the driver caller. Learner delivery reads expose only the latest ping, with coordinates limited to tracking-eligible statuses. No realtime stream exists yet.

## Price rule requests — `/api/price-rule-requests`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| POST | `/api/price-rule-requests` | Bearer JWT | `price-rule-requests/price-rule-requests.routes.ts` |

**Needs verification:** route uses `authMiddleware` only — no `requireRoles('SUPPLIER')` in route file.

## Learning projects — `/api/learning-projects`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| GET | `/api/learning-projects` | Public | `learning-projects/learning-projects.routes.ts` |
| GET | `/api/learning-projects/:id` | Public (`PUBLISHED` only) | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/submit` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |

Public list/detail return only `PUBLISHED` projects. Learner submit creates `PENDING_REVIEW` with `submittedAt`.

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
| GET | `/api/admin/audit-logs` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/reservations` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/reservations/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/deliveries` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/deliveries/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/learning-projects` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/learning-projects/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/learning-projects/:id/approve` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/learning-projects/:id/request-changes` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/learning-projects/:id/reject` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/learning-projects/:id/hide` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/learning-projects/:id/restore` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/learning-projects/:id/archive` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/invitations` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/invitations/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| POST | `/api/admin/invitations` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| POST | `/api/admin/invitations/:id/issue-link` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| POST | `/api/admin/invitations/:id/resend` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/invitations/:id/revoke` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |

**Admin invitation create:** Normalizes email (trim + lowercase). Returns `409 DUPLICATE_PENDING_INVITATION` when an active pending invite already exists for the same email + role (`status=PENDING`, `expiresAt > now`, not used/revoked). Does not create a row or send email on duplicate.

**Admin invitation list/detail fields:** `recipientEmail`, `role`, `status`, `createdAt`, `expiresAt`, `acceptedAt`, `revokedAt`, `createdBy`, `canCopyLink`. Use `POST .../issue-link` to obtain `invitationUrl` for active pending invites only (token hash rotated; raw token never stored).
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
| GET | `/api/admin/people/summary` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/people` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/people/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/people/:id/suspend` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/people/:id/reactivate` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |

**Admin people list query:** `tab` (`ALL` \| `LEARNERS` \| `SUPPLIERS` \| `DRIVERS` \| `MODERATORS` \| `ADMINS`), `search`, `status`, `page`, `limit`.

**Summary counts:** unique `users` rows per role filter (`prisma.user.count`); `learners` = users with `LEARNER` role and without `SUPPLIER`/`DRIVER`/`MODERATOR`/`ADMIN`. Invitations are not counted as users.

**People management safety (MVP):** No delete-user or manual role-edit endpoints. `suspend` / `reactivate` are blocked for the acting admin (self), any user with `ADMIN` role, and the last active admin account. Admin tab is view-only in Flutter (no suspend button). Pending admin invitations are still revoked via `/api/admin/invitations/:id/revoke`. Future admin suspension should require `SUPER_ADMIN` (not implemented).

**`PATCH /api/admin/people/:id/suspend` body:** `{ reason: string }` (required, min 3 chars). Persists `suspensionReason`, `suspendedAt`, `suspendedById` on `users`. Logs `USER_SUSPENDED` to `admin_activity_logs`.

**`PATCH /api/admin/people/:id/reactivate`:** Sets `accountStatus=ACTIVE`, `reactivatedAt`, `reactivatedById`; keeps prior suspension fields for history. Logs `USER_REACTIVATED`.

**People list/detail suspension fields:** `suspensionReason`, `suspendedAt`, `suspendedBy` (`{ id, displayName, email }`), `reactivatedAt`, `reactivatedBy`, `suspensionReasonPreview` (list, when suspended).

**`GET /api/admin/dashboard` extras:** `supplierVerificationPendingCount`, `supplierVerificationPreview` (pending org verifications, max 5), `recentActivity` (latest `admin_activity_logs`, max 5). `pendingActions.supplierVerifications` and `pendingActions.reports` use real pending counts.

**`GET /api/admin/audit-logs` query:** `page`, `limit`, `search`, `action`, `targetType`, `actorId`, `dateFrom`, `dateTo` (ISO date strings; `dateTo` inclusive end-of-day UTC). **Supported actions:** `USER_SUSPENDED`, `USER_REACTIVATED`, `SUPPLIER_VERIFICATION_APPROVED`, `SUPPLIER_VERIFICATION_REJECTED`, `SUPPLIER_VERIFICATION_CHANGES_REQUESTED`, `INVITATION_CREATED`, `INVITATION_REVOKED`, `INVITATION_RESENT`, `MATERIAL_HIDDEN`, `MATERIAL_MARKED_UNAVAILABLE`, `MATERIAL_RESTORED`, `MATERIAL_REPORT_RESOLVED`, `MATERIAL_REPORT_REJECTED`, `MATERIAL_REPORT_HIDE_MATERIAL`, `CATEGORY_REQUEST_APPROVED`, `CATEGORY_REQUEST_REJECTED`, `PRICE_REQUEST_APPROVED`, `PRICE_REQUEST_REJECTED`. **Supported target types:** `USER`, `SUPPLIER_PROFILE`, `INVITATION`, `MATERIAL`, `MATERIAL_REPORT`, `CATEGORY_REQUEST`, `PRICE_RULE_REQUEST`. **Response (`data`):** `{ items[{ id, action, actionLabel, actorUserId, actorName, actorEmail, targetType, targetId, targetLabel, metadata, createdAt }], pagination: { page, limit, total, totalPages }, filterOptions: { actions[{ value, label }], targetTypes[{ value, label }], actors[{ id, displayName, email }] }, summary: { total, today, thisWeek, mostRecentAt } }`. Filter options union known actions/target types with distinct DB values. Newest first. Search matches action, readable action label, actor name/email, target label, and target type.

**Admin audit logging (side effect on success):** People suspend/reactivate, supplier verification decisions, invitation create/resend/revoke, material hide/unavailable/restore, material report resolve/reject/hide-material, category/price approval decisions each append one row to `admin_activity_logs` via `logAdminActivity`.

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

`POST /api/supplier/materials` requires an `Idempotency-Key` header (safe random string, 16–128 chars). The backend stores the key with scope `SUPPLIER_CREATE_MATERIAL` and the authenticated `userId` in `idempotency_records` (`unique(userId, scope, key)`). The idempotency row, material/location writes, source request publish updates, and stored success response are committed in one transaction. A first successful request creates one material and stores the successful response. A repeat with the same key and identical request body returns the stored material with no new insert. Reusing the same key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`; a simultaneous same-key request still in progress returns `409 IDEMPOTENCY_IN_PROGRESS`. Failed creates roll back the material and idempotency writes, so retrying the same form key is safe.

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

`GET /api/supplier/reservations` returns supplier reservation cards by status tab. Items include material and learner summaries, `quantityRequested`, `unit`, pickup window fields, `deliveryRequested`, nullable `activeDelivery` (`id`, `status` only), and `canSupplierComplete`. `canSupplierComplete` is true only for accepted self-pickup reservations that the supplier may manually complete. Reservations with `deliveryRequested` or any `Delivery` row, including cancelled or failed delivery attempts, return false so the UI can show driver-delivery status instead of a complete button.

Accept keeps the held quantity and recomputes material status. Decline rejects a pending reservation and releases the hold. Complete subtracts `quantityRequested` from `material.quantity` for self-pickup; material becomes `REUSED` only when remaining quantity reaches `0`. Complete is blocked when `deliveryRequested` is true or any delivery row exists for the reservation.

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
