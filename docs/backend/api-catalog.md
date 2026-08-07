# Backend API Catalog

HTTP endpoints **as mounted in code**. Derived from `apps/backend/src/app.ts` and `apps/backend/src/modules/**/*.routes.ts`.

**Not sourced from:** `docs/04-api-conventions.md` endpoint examples (many are aspirational).

Conventions for response shape: [04-api-conventions.md](../04-api-conventions.md).

## Static files

| Method | Path | Auth | Source |
|--------|------|------|--------|
| GET | `/uploads/materials/*` | Public | `app.ts` — `express.static(MATERIAL_UPLOADS_DIR)` |
| GET | `/uploads/profiles/*` | Public | `app.ts` — `express.static(PROFILE_UPLOADS_DIR)` |
| GET | `/api/admin/supplier-verifications/:id/document` | Bearer JWT + `ADMIN` | Authenticated verification document download |
| GET | `/api/supplier/verification/document` | Bearer JWT + `SUPPLIER` (owner) | Authenticated owner verification document download |

## Health

| Method | Path | Auth | Handler module |
|--------|------|------|----------------|
| GET | `/health` | Public | `health` |

## Auth — `/api/auth`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| POST | `/api/auth/register` | Public (per-IP and per-email rate limits) | `auth/auth.routes.ts` |
| POST | `/api/auth/login` | Public (per-IP and per-email rate limits) | `auth/auth.routes.ts` |
| POST | `/api/auth/forgot-password` | Public | `auth/auth.routes.ts` |
| POST | `/api/auth/reset-password` | Public | `auth/auth.routes.ts` |
| POST | `/api/auth/refresh` | Public (per-IP and per-token rate limits) | `auth/auth.routes.ts` |
| POST | `/api/auth/logout` | Public | `auth/auth.routes.ts` |
| GET | `/api/auth/me` | Bearer JWT | `auth/auth.routes.ts` |
| PATCH | `/api/auth/change-password` | Bearer JWT | `auth/auth.routes.ts` |
| POST | `/api/auth/become-learner` | Bearer JWT | `auth/auth.routes.ts` |
| POST | `/api/auth/become-supplier` | Bearer JWT | `auth/auth.routes.ts` |
| POST | `/api/auth/switch-role` | Bearer JWT | `auth/auth.routes.ts` |

`GET /api/auth/me` returns `{ user }` including `roles`, `activeRole`, `canSwitchToLearner`, `canSwitchToSupplier`, `defaultPortalRoute`, profile summaries (including `supplierProfile.id` when present), `phoneVerifiedAt`, and `lastLoginAt` when present.

`POST /api/auth/become-learner` adds `LEARNER` role and creates a learner profile for personal suppliers (`STUDENT_SUPPLIER`, `INDIVIDUAL_SUPPLIER`) on the same account; sets `activeRole` to `LEARNER`. Rejects organization supplier types and restricted staff roles. Response matches login/register session shape.

`POST /api/auth/become-supplier` adds `SUPPLIER` role and creates a supplier profile on the same account when missing; keeps existing `LEARNER` role; sets `activeRole` to `SUPPLIER`. Allowed supplier types: `STUDENT_SUPPLIER`, `INDIVIDUAL_SUPPLIER` only. Rejects `WORKSHOP`, `FACTORY`, `EDUCATIONAL_INSTITUTION` with `Organization supplier types require a separate verification flow.` Returns `409` when a supplier profile already exists. Response matches login/register: new `accessToken`, optional `refreshToken`, and updated `user` so JWT roles stay in sync.

`POST /api/auth/switch-role` body: `{ "activeRole": "LEARNER" | "SUPPLIER" }`. Backend enforces portal switch rules (organization suppliers cannot switch to learner unless they already have `LEARNER`; student/individual suppliers may be granted `LEARNER` on first switch). Response includes refreshed auth tokens and updated `user`.

Validation schemas: `auth/auth.validation.ts`

`POST /api/auth/register`
- Public route with per-IP and per-email fixed-window rate limits.

`POST /api/auth/login`
- Public route with per-IP and per-email fixed-window rate limits.

`POST /api/auth/refresh`
- Public route with per-IP and per-hashed-refresh-token fixed-window rate limits.

`POST /api/auth/forgot-password`
- Public route with per-IP and per-email fixed-window rate limits.
- Body: `{ email: string }`.
- Response: generic success with `data: null` for both existing and non-existing emails. The API never returns reset tokens.
- For existing users, backend invalidates older unused password-reset tokens, stores a hashed new token in `auth_tokens`, expires it after `PASSWORD_RESET_EXPIRES_IN` (default `30m`), and sends an email reset link based on `APP_PUBLIC_BASE_URL`.

`POST /api/auth/reset-password`
- Public route with per-IP, per-token, and valid-token per-account rate limits.
- Body: `{ token: string, newPassword: string }`.
- Success: marks token used, updates `users.password_hash`, revokes active `REFRESH_TOKEN` rows for the user, sends a password-changed notification email, and returns `data: null`.
- Invalid, expired, or used tokens return a safe validation error. Reset does not create an auth session.

## Notifications — `/api/notifications`

| Method | Path | Auth | Module |
|--------|------|------|--------|
| GET | `/api/notifications` | Bearer JWT | `notifications/notifications.routes.ts` |
| GET | `/api/notifications/unread-count` | Bearer JWT | `notifications/notifications.routes.ts` |
| PATCH | `/api/notifications/read-all` | Bearer JWT | `notifications/notifications.routes.ts` |
| PATCH | `/api/notifications/:id/read` | Bearer JWT | `notifications/notifications.routes.ts` |

`GET /api/notifications` query: `page`, `limit`, optional `isRead=true|false`. Returns `{ items[], unreadCount, pagination }` where each item includes `id`, `notificationType`, `title`, `body`, `relatedEntityType`, `relatedEntityId`, `isRead`, `createdAt`. Legacy disallowed driver types (including `DRIVER_DELIVERY_AVAILABLE` / “New delivery job available”) are filtered from responses. `GET /api/notifications` may run an idempotent due-only reminder sync for assigned drivers (`DRIVER_PICKUP_TIME`, `DRIVER_DROPOFF_TIME` only — never `DRIVER_NEW_JOB`). `GET /api/driver/deliveries/available` and `GET /api/driver/deliveries/active` do not create notifications.

Reservation lifecycle writes persisted rows for supplier/learner recipients (`RESERVATION_REQUESTED`, `RESERVATION_ACCEPTED`, `RESERVATION_SCHEDULING_PROPOSAL`, `RESERVATION_DECLINED`, `RESERVATION_CANCELLED`, `RESERVATION_EXPIRED`). Driver notifications are limited to: `DRIVER_NEW_JOB` (once per eligible driver when a delivery is created in `WAITING_FOR_DRIVER`), `DRIVER_PICKUP_TIME` (assigned driver, pickup window due within 15 minutes), and `DRIVER_DROPOFF_TIME` (assigned driver after pickup, when `confirmedDeliveryWindowStart` is due within 15 minutes). No current Supplier-relevant producer for `DELIVERY_DRIVER_ASSIGNED` was found, so the Supplier contract does not claim that event. `GET /api/driver/deliveries/available` queries deliveries directly (not notifications). Unread `DRIVER_NEW_JOB` rows for a delivery are cleared when any driver accepts it. Reminder rows are idempotent via `createNotificationIfMissing` (`userId` + `notificationType` + `relatedEntityType` + `relatedEntityId`). `relatedEntityType` is `DELIVERY`; `relatedEntityId` is the delivery id.

Supplier notifications are persisted `Notification` rows and are the canonical source for `GET /api/supplier/notifications` and its unread/read routes. The endpoint does not concatenate the older computed category/price/reservation feed. A temporary `notifications` response alias is generated from the same persisted `items` for the current Flutter client.

Supplier notification endpoints:

| Method | Path | Query/body |
|--------|------|------------|
| GET | `/api/supplier/notifications` | Query: `page`, `limit`, optional `state`, `category`, `isRead`, `search`, `dateFrom`, `dateTo`, `entityType` |
| PATCH | `/api/supplier/notifications/:id/read` | none |
| PATCH | `/api/supplier/notifications/read-all` | none |
| GET | `/api/supplier/notifications/unread-count` | none |

The list response is `{ items, pagination, summary }` plus the compatibility `notifications` alias. Canonical items expose `id`, `rawType`, mutually exclusive `category` (`RESERVATION`, `MATERIAL_REVIEW`, `DELIVERY_RECOVERY`, `ACCOUNT`, `SYSTEM`, `UNKNOWN`), mutually exclusive `state` (`NEEDS_ACTION`, `WAITING`, `UPDATE`, `RESOLVED`, `UNKNOWN`), safe title/message, `createdAt`, `isRead`, `readAt`, semantic `iconKey`, entity summary, semantic action descriptor (`type`, allow-listed `destination`, and target IDs), `waitingOn`, `resolvedAt`, and safely derived `priority`. Unknown events and missing targets fail closed to non-actionable `UNKNOWN`.

`summary` counts the full filtered scope, not just the returned page: `total`, `unread`, `needsAction`, `waiting`, `updates`, `resolved`, `unknownState`, `reservations`, `materials`, `deliveryRecovery`, `account`, `system`, and `unknownCategory`. State/category counts reconcile to `total`; `unread` is orthogonal. Mark-read writes both `isRead = true` and `readAt`.

## Profile — `/api/profile`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| PATCH | `/api/profile` | Bearer JWT | `profile/profile.routes.ts` |
| PATCH | `/api/profile/learner` | Bearer JWT + `LEARNER` role | `profile/profile.routes.ts` |
| GET | `/api/profile/learner/interests/options` | Public (read-only) | `profile/profile.routes.ts` |

`PATCH /api/profile` body (partial, at least one field): `{ displayName?, phone?, profileImageUrl? }`. Changing `phone` clears `phoneVerifiedAt`. `profileImageUrl` accepts `/uploads/profiles/...` or safe `https://` URLs only.

`PATCH /api/profile/learner` body: `{ learnerType, skillLevel, interests?, bio? }`. Upserts `learner_profiles` for users with the `LEARNER` role. `interests` must be known taxonomy keys (e.g. `arduino`, `audio_media`); legacy display labels are normalized on save when mappable.

`GET /api/profile/learner/interests/options` returns grouped selectable interests for registration/profile edit: `{ groups: [{ key, label, items: [{ key, label }] }] }`. Does not expose scoring weights.

Both routes return `{ user }` using the same summary shape as `/api/auth/me`.

Validation schemas: `profile/profile.validation.ts`

## Uploads — `/api/uploads`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| POST | `/api/uploads/profile-image` | Bearer JWT | `uploads/uploads.routes.ts` |
| POST | `/api/uploads/material-images` | Bearer JWT + `SUPPLIER` | `uploads/uploads.routes.ts` |
| POST | `/api/uploads/supplier-verification-document` | Bearer JWT + `SUPPLIER` | `uploads/uploads.routes.ts` |

`POST /api/uploads/profile-image` accepts multipart field `image` (JPG/PNG/WebP, max 5 MB). Response: `{ image: { url, filename, mimeType, sizeBytes } }` with `url` under `/uploads/profiles/...`.

Verification document upload: PDF/JPG/JPEG/PNG, max 5MB. Returns `{ url, fileName }` with a private object key under `/uploads/supplier-verification/...` (not publicly served).

Static files: `GET /uploads/materials/*`, `GET /uploads/profiles/*` (`app.ts`). Supplier verification documents download only via authenticated owner/admin endpoints.

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

**`POST /api/materials/price-check`:** Paid listings require `condition`. Response includes `baseMaxPrice`, `selectedCondition`, `conditionMultiplier`, `adjustedMaxPrice`, `submittedPrice`, `isWithinAdjustedRange`, and `source` (`RULE` | `AI` | `ADMIN_REVIEW`). Supplier-facing `maxAllowedPrice` is the condition-adjusted max, not the raw rule/AI base.
| GET | `/api/materials` | Public, optional Bearer JWT | `materials/materials.routes.ts` |
| GET | `/api/materials/:id` | Public, optional Bearer JWT | `materials/materials.routes.ts` |
| POST | `/api/materials/:id/like` | Bearer JWT | `materials/materials.routes.ts` |
| DELETE | `/api/materials/:id/like` | Bearer JWT | `materials/materials.routes.ts` |
| POST | `/api/materials/:id/reports` | Bearer JWT | `materials/materials.routes.ts` |

**Note:** Material **creation** is not on this router. Suppliers create via `POST /api/supplier/materials`.

**`POST /api/materials/:id/reports` body:** `{ reason: MaterialReportReason, note?: string }` — `note` required when `reason=OTHER`. Duplicate pending report by same user/material returns 409. Public discovery excludes `UNAVAILABLE` materials (default list status `AVAILABLE`).

**`GET /api/materials` query:** `q`, `categoryId`, `condition`, `status` (default `AVAILABLE`), `priceType` (`FREE` \| `PAID` \| `ANY`, default `ANY`), `deliveryAvailable`, `pickupAllowed`, `city`, `area`, `sort` (`newest` \| `popular` \| `nearest`, default `newest`), `latitude`, `longitude`, `savedLocationId`, `page`, `limit`. `sort=nearest` requires either `latitude` + `longitude` or an authenticated `savedLocationId`; the two location sources are mutually exclusive. Response: `{ items, pagination: { page, limit, total, totalPages } }`. Public item fields include `quantity`, `availableQuantity`, `unit`, `city`, `area`, optional `approximateLatitude`, optional `approximateLongitude`, optional `approximateDistanceKm`, `pickupAllowed`, `deliveryAvailable`, `viewsCount`, `likesCount`, and `isLiked` (`false` without authenticated viewer); no `addressLine` / exact `latitude` / exact `longitude`.

**`GET /api/materials/:id`:** creates a `material_views` row and increments `viewsCount` on successful detail reads (`404` does not increment). Authenticated requests attach `viewerUserId` and are counted once per user/material; repeat opens by the same authenticated user return the existing count. Guest requests store a null viewer and are counted per request because there is no anonymous identity. Same public field redaction as list items.

**`POST /api/materials/:id/like` / `DELETE /api/materials/:id/like`:** Learner-only material like toggle. Both operations are idempotent. Response (`data`): `{ materialId, likesCount, isLiked }`. Liking own material is allowed.

## Reservations — `/api/reservations`

| Method | Path | Auth | Roles | Source file |
|--------|------|------|-------|-------------|
| GET | `/api/reservations/my` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| GET | `/api/reservations/:id` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/quote` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| PATCH | `/api/reservations/:id/cancel` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| PATCH | `/api/reservations/:id/learner-confirmation` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| GET | `/api/reservations/:id/messages` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/messages` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/request-reschedule` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/report-supplier-issue` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/report-no-driver` | Bearer JWT | `LEARNER` (or supplier on same reservation) | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/delivery` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` + `deliveries` |

`GET /api/reservations/my` returns the authenticated learner's reservations newest first. Items include reservation status, `quantityRequested`, `fulfillmentMethod` (`PICKUP` | `DELIVERY`), learner preferred pickup/delivery window arrays (`{ start, end }` ISO datetimes), delivery address snapshot fields (`deliveryAddressText`, `safeDropoffAllowed`, `deliveryNote`), message, timestamps, safe material summary (including `unit` and approximate `city`/`area`), `material.deliveryAllowed`, supplier display name, supplier-confirmed pickup window fields, awaiting-confirmation scheduling fields (`supplierProposedPickupWindowStart/End`, `supplierPickupWindowStart/End`, `confirmedDeliveryWindowStart/End`, `earliestDeliveryStart`, `schedulingConflictReason`), nullable `activeDelivery` (`id`, `status` only), nullable `selfPickupCode` (6-digit code for accepted `PICKUP` reservations only; owner learner only), supplier note, rejection reason, derived follow-up fields (`pickupWindowStatus`, `isOverdue`, `needsFollowUp`, `canSendMessage`, nullable `latestMessage`), nullable `incidentReviewStatus` (`PENDING_REVIEW` \| `VERIFIED` \| `REJECTED` \| `RESOLVED_NO_STRIKE` when reservation-linked `no_show_reports` exist; null otherwise), and nullable `pickupLocationFull`. Overdue is derived when status is `ACCEPTED`, pickup window end is in the past, and the reservation is not completed/cancelled/declined; overdue does **not** auto-complete or release material. `pickupLocationFull` is populated only when the reservation status is `ACCEPTED` or `COMPLETED`; it is `null` for `PENDING`, `AWAITING_LEARNER_CONFIRMATION`, `REJECTED`, `CANCELLED`, and `EXPIRED`. When present, `pickupLocationFull` includes `country`, `city`, `area`, `addressLine`, `latitude`, `longitude`, and `isApproximate` using the same decimal-to-number JSON convention as other location DTOs. Public material discovery endpoints continue to expose only approximate city/area.

**Lazy `PENDING` expiry:** `GET /api/reservations/my`, `GET /api/reservations/:id`, `POST /api/reservations` (duplicate-open check), public material list/detail (`availableQuantity`), and supplier reservation reads auto-expire stale `PENDING` reservations before returning data. Expiry deadline is the earlier of `createdAt + 48h` (`PENDING_SUPPLIER_RESPONSE_HOURS`) and the latest preferred pickup/delivery window end (based on `fulfillmentMethod`); rows without parseable windows use the 48-hour timeout only. Expired rows become `EXPIRED`, release the quantity hold, and write status history. No background cron in MVP.

**Lazy missed-pickup cleanup:** Accepted `PICKUP` reservations with no delivery rows auto-expire to `EXPIRED` when `now > pickupWindowEnd + 72h` (`MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS`). `rejectionReason` is set to `PICKUP_WINDOW_MISSED`. Hold is released; no automatic strikes. Same lazy read paths as pending expiry plus supplier complete/cancel/report/reschedule attempts.

`GET/POST /api/reservations/:id/messages` expose reservation-scoped text follow-up (max 1000 chars) for participants on `PENDING`/`ACCEPTED` reservations only; not a general messenger. Messaging is disabled while a `PENDING_REVIEW` incident report is open.

`POST /api/reservations/:id/report-supplier-issue` (learner, accepted self-pickup after pickup window + 30 min grace): body `{ reason, note? }` where `reason` is `SUPPLIER_UNAVAILABLE` | `SUPPLIER_MATERIAL_NOT_READY` | `WRONG_PICKUP_INFO` | `OTHER`. Creates `NoShowReport` (`PENDING_REVIEW`, target `SUPPLIER`), sets reservation `AWAITING_RESOLUTION`, releases hold, does not decrement stock.

`POST /api/reservations/:id/report-no-driver` (learner or supplier, delivery `WAITING_FOR_DRIVER` after supplier pickup window + grace): optional `note`. Creates system-target report (`NO_DRIVER_AVAILABLE`), sets reservation/delivery `AWAITING_RESOLUTION`, keeps hold. No user strike on verify. If nobody reports within **24 hours** after supplier pickup window end, lazy read paths auto-escalate to the same state with a system note.

When a driver **was** assigned but pickup never completes (`DRIVER_ASSIGNED` or `ARRIVED_PICKUP` after supplier pickup window + 30 min grace): supplier may report driver no-show (`POST /api/supplier/reservations/:id/mark-driver-no-show`); driver may report pickup failed (`POST /api/driver/deliveries/:id/mark-pickup-failed`). Learner/supplier/driver list DTOs expose `assignedDriverPickupOverdue` after grace. If nobody reports within **24 hours** after supplier pickup window end, lazy read paths auto-escalate: `DRIVER_ASSIGNED` creates a pending **DRIVER**-target report; `ARRIVED_PICKUP` creates a **SYSTEM** investigation report (`NO_RESPONSE_AFTER_PICKUP_WINDOW`). Both set reservation/delivery `AWAITING_RESOLUTION`, release the driver assignment, keep the material hold, and create a driver notification `DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW`. Drivers can resolve removed jobs via `GET /api/driver/deliveries/:id/inactive-context`. Learner reservation DTO includes `pendingIncidentReasonCode` for post-escalation labels.

Admin incident review (`/api/admin/no-show-reports` and `/api/admin/reservation-reports` aliases): list/detail responses add computed `workflowType` (`ACCOUNTABILITY` | `SYSTEM_RECOVERY` | `ACCOUNTABILITY_AND_RECOVERY`), `operationalState` (`NOT_REQUIRED` | `REQUIRES_RESOLUTION` | `RESOLVED`), `availableActions`, and `strikeImpact` (`NONE` | `STRIKE_IF_VERIFIED`). These are derived server-side from the report family plus current reservation/delivery recovery context; write endpoints use the same classifier transactionally and return `409 REPORT_ACTION_NOT_AVAILABLE` when the requested action is absent. The response also retains `deliveryId`, pickup-window snapshots, reviewed metadata, reservation pending-reschedule context, and detail-only delivery timeline and quantity status.

`ACCOUNTABILITY` reports expose verify/reject/resolve only while pending. `SYSTEM_RECOVERY` reports expose only eligible recovery actions while admin recovery is required; successful recovery sets the report to `RESOLVED_NO_STRIKE`. `ACCOUNTABILITY_AND_RECOVERY` keeps accountability and recovery separate: while recovery is required, a pending valid individual target can be verified and recovery actions remain available, but reject/generic resolve are unavailable. If recovery happens first, the report remains `PENDING_REVIEW`, operational state becomes `RESOLVED`, and the remaining accountability actions become available. If verification happens first, later recovery preserves `VERIFIED`. A malformed individual target with no `targetUserId` is fail-closed: it has no strike impact or verify action, but its recovery and later resolve-without-strike path remain available.

Pickup recovery reports use the delivery-linked `NO_DRIVER_AVAILABLE`, `NO_RESPONSE_AFTER_PICKUP_WINDOW`, `DRIVER_DID_NOT_ARRIVE`, and `PICKUP_FAILED` families. Operational actions accept optional `adminNote` only; admin never sets supplier pickup times. `POST .../request-supplier-reschedule` moves reservation to `AWAITING_SUPPLIER_CONFIRMATION` with `pendingRescheduleReason` `NO_DRIVER_ADMIN_REQUEST` or `STALE_PICKUP_ADMIN_REQUEST`, releases active assignment, keeps delivery/material hold for supplier follow-up, and notifies supplier. `POST .../cancel-release-hold` expires reservation (`rejectionReason` `NO_DRIVER_UNAVAILABLE` or `PICKUP_NOT_COMPLETED`), cancels delivery, and releases material hold. Supplier resubmission via `POST /api/supplier/reservations/:id/submit-no-driver-pickup-window` returns the reservation to `ACCEPTED` and delivery to `WAITING_FOR_DRIVER`.

`POST /api/reservations/quote` calculates a reservation price preview without creating a row. Body: `materialId`, `quantity`, `fulfillmentMethod` (`PICKUP` | `DELIVERY`). For `DELIVERY`, also require `dropoffCity`, at least one `learnerPreferredDeliveryWindows` entry, and optional `dropoffArea`, `combineWithDeliveryGroupId`. Returns `unitPrice`, `materialSubtotal`, `deliveryFee`, `totalAmount`, `currency` (`NIS`), `deliveryZone` (`SAME_CITY` | `WEST_BANK` | `JERUSALEM` | `INSIDE_48`), `groupingAvailable`, `groupingApplied`, optional `deliveryGroupCandidate`, and `messages`. Unknown drop-off locations return `400 DELIVERY_PRICING_ERROR`. Invalid quantity returns `400 INVALID_QUANTITY`.

`POST /api/reservations` creates a partial-quantity hold for an available material. Body requires `materialId`, `quantityRequested`, and `fulfillmentMethod` (`PICKUP` | `DELIVERY`). For `PICKUP`, include at least one `learnerPreferredPickupWindows` entry (`{ start, end }` ISO datetimes). Centralized pickup validation (`pickup-window-validation.ts`) rejects invalid windows before insert: start in the past, end in the past, end before/equal start, start sooner than `MIN_PICKUP_LEAD_TIME_MINUTES` (30), or end sooner than `MIN_REMAINING_PICKUP_WINDOW_MINUTES` (30) from now. Pickup validation failures return `400` with specific codes such as `PICKUP_START_IN_PAST`, `PICKUP_END_IN_PAST`, `PICKUP_END_BEFORE_START`, `PICKUP_START_TOO_SOON`, and `PICKUP_WINDOW_TOO_CLOSE_TO_ENDING` plus a clear message. For `DELIVERY`, include at least one `learnerPreferredDeliveryWindows` entry, `deliveryAddressText`, `dropoffCity`, and `safeDropoffAllowed`; optional `deliveryNote`, `dropoffArea`, `combineWithDeliveryGroupId`. Optional `message` remains supported. Optional `buildItemId` links the created reservation to a learner-owned build checklist item when `linkedMaterialId` matches `materialId` in the same transaction (`404 NOT_FOUND` for invalid/unowned item, `400 BUILD_ITEM_MATERIAL_MISMATCH`, `409 ACTIVE_BUILD_ITEM_RESERVATION` when an active linked reservation already exists on that item). Backend recalculates pricing at create time (does not trust client totals), stores snapshot fields on the reservation (`unitPriceAtReservation`, `materialSubtotal`, `deliveryFee`, `totalAmount`, `pricingCurrency`, `deliveryZone`, `deliveryGroupId`), and for delivery may create or join a `DeliveryGroup` so grouped reservations share one delivery fee. The transaction validates `quantityRequested` against computed `availableQuantity`, rejects fulfillment methods the material does not allow, blocks a second open reservation by the same learner on the same material, creates a `PENDING` reservation (no `Delivery` row yet), writes status history, and recomputes material status. Material stays `AVAILABLE` while stock remains reservable. List/detail DTOs include pricing snapshot fields plus `groupedDelivery` when `deliveryFee` is zero on a grouped reservation.

`PATCH /api/reservations/:id/cancel` cancels a learner-owned `PENDING` or `AWAITING_LEARNER_CONFIRMATION` reservation, sets `CANCELLED`, writes status history, and releases the held quantity. Reservations with an existing delivery row return `409 CONFLICT`. `ACCEPTED` / terminal statuses return `409 CONFLICT`.

`PATCH /api/reservations/:id/learner-confirmation` resolves learner-owned reservations in `AWAITING_LEARNER_CONFIRMATION`. Body: `{ action, deliveryWindow? }` where `action` is `ACCEPT_PROPOSED_PICKUP` | `SUBMIT_DELIVERY_WINDOW` | `CANCEL`. Only the reservation owner may call this route; wrong status returns `409 CONFLICT`. **PICKUP:** `ACCEPT_PROPOSED_PICKUP` copies `supplierProposedPickupWindowStart/End` into `pickupWindowStart/End`, clears proposed fields, and sets `ACCEPTED` (no delivery row). **DELIVERY:** `SUBMIT_DELIVERY_WINDOW` requires `{ deliveryWindow: { start, end } }`; backend reuses the 60-minute buffer after `supplierPickupWindowEnd`. Feasible or partially overlapping windows → `ACCEPTED`, stores `confirmedDeliveryWindowStart/End`, creates one `Delivery` row `WAITING_FOR_DRIVER`. Infeasible window → `422 VALIDATION_ERROR`, reservation stays `AWAITING_LEARNER_CONFIRMATION`, no delivery row. **Both:** `CANCEL` sets `CANCELLED` and releases the hold when no delivery row exists. Returns the updated learner reservation list DTO.

Public material list/detail responses include `quantity` (remaining stock), `availableQuantity` (remaining minus active holds), and `unit`.

`POST /api/reservations/:id/delivery` creates an internal delivery attempt for an accepted learner-owned **pickup** reservation (`fulfillmentMethod = PICKUP`). Body: either `{ savedDropoffAddressId, learnerNote? }` or `{ dropoffLocation, learnerNote?, saveDropoffAddressLabel? }`. Inline `dropoffLocation` includes country/city plus optional area/address/latitude/longitude; optional `saveDropoffAddressLabel` persists the address for reuse (max 10 per learner). The route creates copied pickup/dropoff locations, a `Delivery` row with `WAITING_FOR_DRIVER`, and delivery status history. It rejects non-accepted reservations, delivery-fulfillment reservations, delivery-disabled materials, and reservations with an active delivery.

## Learner home — `/api/learner`

| Method | Path | Auth | Roles | Source file |
|--------|------|------|-------|-------------|
| GET | `/api/learner/home` | Bearer JWT | `LEARNER` | `learner-home/learner-home.routes.ts` |

Returns a personalized learner home feed: `profileCompletion` (`hasInterests`, `hasSavedLocation`, `hasSavedProjects`) plus ordered sections (`suggested_materials`, `materials_for_saved_projects`, `suggested_projects`, `continue_projects`, `saved_projects`, `free_materials_near_you`, `popular_projects`). Each recommended item includes `score`, `reasons[]`, and a typed payload (`material`, `project`, or `continue_project` with nested `build`). Ranking uses deterministic weighted scoring from learner interests, saved projects/components, default saved location, material availability, popularity, and recency — no AI or vector search.

| GET | `/api/learner/home/sections/:sectionKey` | Bearer JWT | `LEARNER` | `learner-home/learner-home.routes.ts` |

Returns one ranked section for Browse-all pages. Supported `sectionKey` values match the home feed section keys. Query: `limit` (optional, default 20, max 50). Response includes `key`, `title`, `subtitle`, `items[]`, `emptyState`, `nextCursor` (always `null` in this slice). Uses the same scoring as `GET /api/learner/home`. Invalid `sectionKey` → `400 INVALID_SECTION_KEY`.

## Learner saved dropoff addresses — `/api/learner/saved-dropoff-addresses`

| Method | Path | Auth | Roles | Source file |
|--------|------|------|-------|-------------|
| GET | `/api/learner/saved-dropoff-addresses` | Bearer JWT | `LEARNER` | `saved-dropoff-addresses/saved-dropoff-addresses.routes.ts` |
| POST | `/api/learner/saved-dropoff-addresses` | Bearer JWT | `LEARNER` | `saved-dropoff-addresses/saved-dropoff-addresses.routes.ts` |
| PATCH | `/api/learner/saved-dropoff-addresses/:id` | Bearer JWT | `LEARNER` | `saved-dropoff-addresses/saved-dropoff-addresses.routes.ts` |
| DELETE | `/api/learner/saved-dropoff-addresses/:id` | Bearer JWT | `LEARNER` | `saved-dropoff-addresses/saved-dropoff-addresses.routes.ts` |

List/create/update/delete learner-owned saved dropoff locations (`user_saved_locations` + dedicated `locations` rows with `locationType = LEARNER_SAVED_DROPOFF`). Create body: `{ label, location, isDefault? }`. Update accepts any subset of `label`, `location`, `isDefault`. Max 10 saved addresses per learner.

## Deliveries — `/api/deliveries`

| Method | Path | Auth | Roles | Source file |
|--------|------|------|-------|-------------|
| GET | `/api/deliveries/my` | Bearer JWT | `LEARNER` | `deliveries/deliveries.routes.ts` |
| GET | `/api/deliveries/:id` | Bearer JWT | `LEARNER` | `deliveries/deliveries.routes.ts` |
| GET | `/api/deliveries/:id/tracking` | Bearer JWT | `LEARNER` | `deliveries/deliveries.routes.ts` |

Learner delivery responses include reservation summary (including `supplierPickupWindowStart/End` when set), pickup/dropoff location snapshots, assigned driver summary when present, `assignedDriverPickupOverdue`, `canTrack`, `trackingMessage`, delivery status history, and `latestDriverPing` only when `canTrack` is true (`PICKED_UP`, `ON_THE_WAY`, `ARRIVED_DROPOFF`). Before pickup and after terminal states, `latestDriverPing` is `null` and learners never receive driver coordinates. `GET /api/deliveries/:id/tracking` returns `{ deliveryId, reservationId, materialTitle, status, canTrack, trackingMessage, driverDisplayName, latestDriverLocation, isLocationStale, pickupCity, pickupArea, dropoffCity, dropoffArea, dropoffLatitude, dropoffLongitude }`; `latestDriverLocation` is `null` unless `canTrack` is true. Driver location pings are accepted only after `PICKED_UP`. `GET /api/deliveries/my` remains summary-only and does not include driver coordinates.

## Driver — `/api/driver`

All routes require Bearer JWT + `DRIVER` role and an active `DriverProfile`.

| Method | Path | Source file |
|--------|------|-------------|
| GET | `/api/driver/deliveries/available` | `driver/driver.routes.ts` |
| GET | `/api/driver/deliveries/active` | `driver/driver.routes.ts` |
| GET | `/api/driver/deliveries/:id/inactive-context` | `driver/driver.routes.ts` |
| POST | `/api/driver/deliveries/:id/accept` | `driver/driver.routes.ts` |
| PATCH | `/api/driver/deliveries/:id/status` | `driver/driver.routes.ts` |
| POST | `/api/driver/deliveries/:id/location-pings` | `driver/driver.routes.ts` |
| POST | `/api/driver/deliveries/:id/pickup-failed` | `driver/driver.routes.ts` |
| POST | `/api/driver/deliveries/:id/delivery-failed` | `driver/driver.routes.ts` |
| POST | `/api/driver/deliveries/:id/driver-issue` | `driver/driver.routes.ts` |

Available jobs support query filters `city`, `area`, `maxDistanceKm`, and `sortBy` (`nearest` | `newest`). Distance/radius uses Haversine from the driver's recent location ping to the **pickup** location. Responses include `deliveries` plus queue meta (`activeDeliveryCount`, `maxActiveDeliveries`, `canAcceptMore`, `driverProfileCity`, `driverProfileArea`, `driverHasRecentLocation`, `nearbyAvailableCount`, `totalAvailableCount`). `nearbyAvailableCount` is the filtered list length after city/area/radius; `totalAvailableCount` is the count after city/area only (before radius), so clients can explain jobs outside the current radius. Unassigned job DTOs return safe area-level pickup/dropoff data, optional `distanceKm` / `distanceLabel`, and never exact coordinates. Distance uses Haversine from the driver's recent location ping when available. **Combined delivery:** when reservations share a `DeliveryGroup`, one operational `Delivery` row exists per group (`deliveryGroupId` unique on `deliveries`). Job DTOs include `deliveryGroupId`, `groupedDelivery`, `itemCount`, `items[]` (`reservationId`, `materialId`, `title`, `quantity`, `unit`, `condition`, `materialSubtotal`), and optional `groupDeliveryFee` / `groupCurrency`. Grouped jobs use a summary material title (for example `2 items from this supplier`) and list all accepted group reservations in `items`. Single-reservation deliveries return `items` with one entry for backward compatibility. Accept is transactional and assigns only `WAITING_FOR_DRIVER` unassigned deliveries; drivers may hold up to `3` active assigned deliveries (`DRIVER_ASSIGNED` through `ARRIVED_DROPOFF`). Active drivers can accept from `OFFLINE`, `AVAILABLE`, or while already `ON_DELIVERY` until the limit is reached; exceeding the limit returns `409` with *You have reached the active delivery limit.* Profile availability returns to `AVAILABLE` only when no in-progress assigned deliveries remain after `DELIVERED`. `GET /api/driver/deliveries/:id/inactive-context` explains why a previously assigned delivery is no longer active (for example auto-escalated to admin review). Status updates are assigned-driver-only and must follow `DRIVER_ASSIGNED → ARRIVED_PICKUP → PICKED_UP → ON_THE_WAY → ARRIVED_DROPOFF → DELIVERED`. `ARRIVED_*` transitions do not require a code. `PICKED_UP` requires body `{ status, confirmationCode?, note? }` with the supplier handover code. `DELIVERED` requires the learner delivery code in `confirmationCode`. Wrong or missing codes return `400 VALIDATION_ERROR`. Driver DTOs never include plain codes. `DELIVERED` completes all accepted reservations in the group (when `deliveryGroupId` is set) or the primary reservation otherwise, subtracts `quantityRequested` from each material, and marks materials `REUSED` only when remaining quantity reaches `0`. Location pings store decimal latitude/longitude for assigned active deliveries and return numeric coordinates to the driver caller. Learner delivery reads expose only the latest ping, with coordinates limited to tracking-eligible statuses, and include `learnerDeliveryCode` for active deliveries (owner learner only). No realtime stream exists yet.

## Price rule requests — `/api/price-rule-requests`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| POST | `/api/price-rule-requests` | Bearer JWT | `price-rule-requests/price-rule-requests.routes.ts` |

**Needs verification:** route uses `authMiddleware` only — no `requireRoles('SUPPLIER')` in route file.

## Learning projects — `/api/learning-projects`

| Method | Path | Auth | Role | Source file |
|--------|------|------|------|-------------|
| GET | `/api/learning-projects` | Public, optional Bearer JWT | — | `learning-projects/learning-projects.routes.ts` |
| GET | `/api/learning-projects/me/saved` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| GET | `/api/learning-projects/me/followed` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| GET | `/api/learning-projects/mine` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| GET | `/api/learning-projects/mine/:id` | Bearer JWT | `LEARNER` owner-only | `learning-projects/learning-projects.routes.ts` |
| PATCH | `/api/learning-projects/mine/:id` | Bearer JWT | `LEARNER` owner-only | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/mine/:id/resubmit` | Bearer JWT | `LEARNER` owner-only | `learning-projects/learning-projects.routes.ts` |
| GET | `/api/learning-projects/:id` | Public, optional Bearer JWT (`PUBLISHED` only) | — | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/:id/like` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| DELETE | `/api/learning-projects/:id/like` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/:id/save` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| DELETE | `/api/learning-projects/:id/save` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/:id/follow` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| DELETE | `/api/learning-projects/:id/follow` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| PUT | `/api/learning-projects/:id/review` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| DELETE | `/api/learning-projects/:id/review` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| GET | `/api/learning-projects/:id/builds/me` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/:id/builds/start` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| PATCH | `/api/learning-projects/:id/builds/me/items/:itemId` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| GET | `/api/learning-projects/:id/builds/me/items/:itemId/material-candidates` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/:id/builds/me/items/:itemId/link-material` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| DELETE | `/api/learning-projects/:id/builds/me/items/:itemId/link-material` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/:id/builds/me/items/:itemId/link-reservation` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/submit` | Bearer JWT + `Idempotency-Key` | `LEARNER` | `learning-projects/learning-projects.routes.ts` |

Public list/detail return only `PUBLISHED` projects and include `likesCount`, `followersCount`, nullable `ratingSummary` (`{ average, count }`), plus viewer-specific `isLiked`, `isSaved`, and `isFollowing` (`false` without authenticated viewer). Learner saved/followed list endpoints accept the same `page`, `limit`, `q`, `categoryId`, `difficulty`, and `tag` query params as the public list and return the same `{ items, pagination }` shape filtered to the viewer's saved or followed projects. Detail additionally includes `recentReviews[]` and nullable `viewerReview` when the authenticated learner has reviewed the project. Learner like/unlike is idempotent and returns `{ projectId, likesCount, isLiked }`. Learner save/unsave is idempotent and returns `{ projectId, isSaved }`; save counts are not exposed publicly. Learner follow/unfollow is idempotent and returns `{ projectId, followersCount, isFollowing }`. Learner review upsert body: `{ rating: 1..5, comment?: string }`; response includes `{ projectId, review, ratingSummary }`. Deleting the viewer's review is idempotent and returns `{ projectId, viewerReview: null, ratingSummary }`.

Learner build checklist endpoints are manual and do not perform AI matching. `GET /api/learning-projects/:id/builds/me` returns the viewer's build checklist or `data: null` before start. `POST /api/learning-projects/:id/builds/start` is idempotent per learner/project and initializes one `project_build_items` row per required component. `PATCH /api/learning-projects/:id/builds/me/items/:itemId` body: `{ status: "MISSING" | "ALREADY_OWNED" | "AVAILABLE" | "RESERVED" | "ALTERNATIVE", learnerNote?: string | null }`.

Build item DTOs include optional `linkedMaterial` (privacy-safe summary), optional `linkedReservation` summary, `isReadyForBuild`, and `readinessLabel`. `progress.ready` uses `isReadyForBuild` per item: manual `ALREADY_OWNED` / `AVAILABLE` / `ALTERNATIVE`, or a linked reservation with status `COMPLETED`. Linking a material alone does **not** make an item ready; `RESERVED` and in-flight reservations are not ready.

`GET .../material-candidates` returns up to 10 deterministic `AVAILABLE` platform materials for the learner's build item (category-first, then text fallback). Candidates are ranked in-memory from a larger eligible pool by relevance (name/keyword/category/type/tag match), convenience (learner default saved city/area, pickup/delivery), cost (free preferred, then lower price), condition, mild supplier-trust tie-breakers (verification + completed handovers), then freshness. `TOOL` components return an empty list. Candidate rows include `matchHints[]` (e.g. `Strong match`, `Free`, `Same city`, `Pickup available`) and public-safe material fields only; numeric scores are not exposed. `POST .../link-material` body: `{ materialId }`. Re-validates availability, rejects learner-owned listings (`OWN_MATERIAL`), and is idempotent when linking the same material again. Does not create reservations or auto-change checklist status. `POST .../link-reservation` body: `{ reservationId }` — repair/recovery path to set `linkedReservationId` when the learner already owns a reservation for the linked material; same ownership/material/active-link validations as reservation create with `buildItemId`. `DELETE .../link-material` clears `linkedMaterialId`; rejects unlink when an active linked reservation exists (`ACTIVE_LINKED_RESERVATION`), otherwise also clears `linkedReservationId` when terminal.

Learner submit creates `PENDING_REVIEW` with `submittedAt`. `POST /api/learning-projects/submit` requires an `Idempotency-Key` header and uses scope `LEARNING_PROJECT_SUBMIT`; same learner + same key + identical body returns the stored response without creating another project. Optional `requiredComponents[]` entries support structured learner input: `name` (required), `quantity`, `unit`, `notes`, `isRequired`, `componentRole` (`REQUIRED_MATERIAL` | `TOOL` | `CONSUMABLE`), `materialType`, `categoryId` (active MATERIAL/BOTH category only), `searchKeywords` (max 5), `canBeSubstituted`. Backend stores `providedByUser=true`, `confirmedByUser=false`, derives `searchKeywords` including component name, and no longer hardcodes `materialType: General`. Duplicate component names (case-insensitive) are rejected.

Learner submission owner endpoints are separate from public detail and must be registered before `/:id` routes. `GET /api/learning-projects/mine` supports `page`, `limit`, and optional `status`; it returns only rows where `createdBy` is the authenticated learner, with lightweight cards, moderation reason preview, and `availableActions`. `GET /mine/:id` returns full owner detail including components with ids, steps, links, `reviewNote`, `changesRequestedReason`, `rejectionReason`, and `reviewedAt`. `PATCH /mine/:id` accepts the same structured project body as submit plus optional component `id` values; it is allowed only for `DRAFT`, `PENDING_REVIEW`, and `CHANGES_REQUESTED`. Saving a `PENDING_REVIEW` submission keeps that status. Existing components with ids are updated in place, new components are created, and removed components are deleted only for editable unpublished submissions. `POST /mine/:id/resubmit` is allowed only for `CHANGES_REQUESTED`; it sets `status=PENDING_REVIEW`, updates `submittedAt`, clears `reviewedBy`, `reviewedAt`, `reviewNote`, `changesRequestedReason`, and `rejectionReason`, and preserves project content/component enrichment.

## Locations — `/api/locations`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| POST | `/api/locations/reverse-geocode` | Bearer JWT | `locations/locations.routes.ts` |
| POST | `/api/locations/geocode` | Bearer JWT | `locations/locations.routes.ts` |
| GET | `/api/locations/saved` | Bearer JWT | `locations/locations.routes.ts` |
| POST | `/api/locations/saved` | Bearer JWT | `locations/locations.routes.ts` |
| PATCH | `/api/locations/saved/:id` | Bearer JWT | `locations/locations.routes.ts` |
| DELETE | `/api/locations/saved/:id` | Bearer JWT | `locations/locations.routes.ts` |

`POST /api/locations/geocode` body: `{ country?, city, area?, addressLine? }`. It resolves typed private location text through the configured geocoding provider and returns `{ latitude, longitude, country, city, area, addressLine, displayName, provider }`. It is authenticated because typed saved-location address text and resulting exact coordinates are private account data.

Saved locations are private to the authenticated user. Response rows include `label`, `city`, `area`, private `addressLine`, exact `latitude`/`longitude`, and `isDefault`. Public Materials Discovery may use `savedLocationId` only for server-side distance sorting; it does not expose saved-location private fields.

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
| GET | `/api/admin/reservations/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` — detail includes `linkedReport` (`id`, `status`, `reasonCode`, `targetRole`) when a no-show report exists (prefers `PENDING_REVIEW`) |
| GET | `/api/admin/no-show-reports` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/no-show-reports/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/no-show-reports/:id/verify` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/no-show-reports/:id/reject` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/no-show-reports/:id/resolve` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| POST | `/api/admin/no-show-reports/:id/request-supplier-reschedule` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| POST | `/api/admin/no-show-reports/:id/cancel-release-hold` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/reservation-reports` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` (alias of no-show-reports) |
| GET | `/api/admin/reservation-reports/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/reservation-reports/:id/verify` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/reservation-reports/:id/reject` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/reservation-reports/:id/resolve` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| POST | `/api/admin/reservation-reports/:id/request-supplier-reschedule` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| POST | `/api/admin/reservation-reports/:id/cancel-release-hold` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
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
| PATCH | `/api/admin/learning-projects/:id/components/:componentId` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |

**Admin learning project detail:** `GET .../:id` includes `componentQuality` (project-level hard/soft warnings) and per-component `quality` warnings. `canEditComponents` is true only when status is `PENDING_REVIEW` or `CHANGES_REQUESTED`.

**Admin delivery monitor contract:** `GET /api/admin/deliveries` accepts `search`, every persisted delivery `status`, legacy `assignment` (`ASSIGNED` | `UNASSIGNED`), contract assignment states (`ACTIVE` | `RELEASED` | `HISTORICAL`), `scope` (`SINGLE` | `GROUPED`), bounded `incidentState`, `dateFrom`, `dateTo`, `page`, and `limit`. Its filter-aware `summary` is `{ total, waitingForDriver, activeInProgress, needsAdminReview, delivered, failedCancelled }`; the five non-total values are mutually exclusive `kpiBucket` counts across the complete filtered result, independent of pagination. Each item and detail expose an exclusive `kpiBucket`, `lifecyclePhase`, `adminAttentionState`, `assignmentState`, `scope`, `availableMutations`, and navigation-only `availableLinks`. Details also return bounded assignment and incident histories, plus a deterministic primary incident (operational recovery first, then pending accountability, then terminal; newest `createdAt`, then id).

**Admin delivery incident safety:** grouped deliveries deliberately expose no recovery mutations until group-level recovery semantics are implemented. Direct recovery endpoints reclassify their transaction context and return `409 REPORT_ACTION_NOT_AVAILABLE` when that action is unavailable.

**Admin component enrichment PATCH:** Partial body may include `componentName`, `quantity`, `unit`, `componentRole`, `categoryId`, `materialType`, `searchKeywords`, `alternativeKeywords`, `canBeSubstituted`, `isRequired`, `notes`, `reviewStatus`. Rejected when project is `PUBLISHED`, `HIDDEN`, `ARCHIVED`, or `REJECTED`. Validates active `MATERIAL`/`BOTH` categories, keyword limits, and case-insensitive duplicate names within the project. On success sets `confirmedByUser=true`, defaults `reviewStatus` to `ACCEPTED`, logs `LEARNING_PROJECT_COMPONENT_ENRICHED`.

**Admin approve:** `PATCH .../approve` blocks on hard component quality issues (`COMPONENT_QUALITY_HARD_ISSUES`); soft warnings are returned in detail for frontend confirmation but do not block approve.
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
| GET | `/api/admin/supplier-verifications/:id/document` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/supplier-verifications/:id/approve` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/supplier-verifications/:id/reject` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/supplier-verifications/:id/request-changes` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/approvals/summary` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/approvals/category-requests` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/approvals/category-requests/:id/approve` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/approvals/material-family-options` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/approvals/material-category-options` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
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

**Summary counts:** unique `users` rows per role filter (`prisma.user.count`); `learners` = users with `LEARNER` role and without `SUPPLIER`/`DRIVER`/`MODERATOR`/`ADMIN`. Invitations are not counted as users. **Additional summary KPIs:** `activeUsers` (`users.account_status = ACTIVE`), `verifiedSuppliers` (`supplier_profiles.verification_status IN ('APPROVED','VERIFIED')`), `newThisMonth` (`users.created_at >=` start of current UTC calendar month). Returned by both `GET /people/summary` and the nested `summary` on `GET /people`.

**People management safety (MVP):** No delete-user or manual role-edit endpoints. `suspend` / `reactivate` are blocked for the acting admin (self), any user with `ADMIN` role, and the last active admin account. Admin tab is view-only in Flutter (no suspend button). Pending admin invitations are still revoked via `/api/admin/invitations/:id/revoke`. Future admin suspension should require `SUPER_ADMIN` (not implemented).

**People list/detail extras:** each user item includes `verifiedStrikeCount` — count of `no_show_reports` where this user is `targetUserId`, `status=VERIFIED`, and `targetRole` is `LEARNER`/`SUPPLIER`/`DRIVER` (not a separate strikes table).

**People list activity metrics (list items only):** `materialsCount` (`materials.owner_id`), `reservationsAsRequesterCount` (`reservations.requester_id`), `reservationsAsOwnerCount` (`reservations.owner_id`), `submittedLearningProjectsCount` (`learning_projects.created_by` where `submitted_at IS NOT NULL`), `projectBuildsCount` (`project_builds.learner_id`), `assignedDeliveriesCount` (`deliveries.assigned_driver_profile_id` mapped back to the driver user via loaded `driverProfile.id`). Computed per page via bounded `groupBy` on the current list user IDs or driver profile IDs (not per-user N+1). Omitted users default to `0`.

**People detail activity metrics (`GET /people/:id`):** same list metrics as above, plus `pendingNoShowReportsCount` (`no_show_reports` where `target_user_id` matches, `status=PENDING_REVIEW`, eligible `target_role`). Resolved via the same aggregate helpers scoped to the single requested user (bounded parallel counts, not N+1).

**People list location labels (list items):** optional `locationCity`, `locationArea`, `locationLabel` (`City · Area` when both exist). Resolved from existing includes only — supplier organization `businessLocation`, else supplier `defaultPickupLocation`, else driver profile `city`/`area`, else a learner's single saved location when exactly one `user_saved_locations` row exists. No lat/long, `addressLine`, or coordinates. Omitted when unknown or ambiguous (multiple saved learner locations).

**`PATCH /api/admin/people/:id/suspend` body:** `{ reason: string }` (required, min 3 chars). Persists `suspensionReason`, `suspendedAt`, `suspendedById` on `users`. Logs `USER_SUSPENDED` to `admin_activity_logs`.

**`PATCH /api/admin/people/:id/reactivate`:** Sets `accountStatus=ACTIVE`, `reactivatedAt`, `reactivatedById`; keeps prior suspension fields for history. Logs `USER_REACTIVATED`.

**People list/detail suspension fields:** `suspensionReason`, `suspendedAt`, `suspendedBy` (`{ id, displayName, email }`), `reactivatedAt`, `reactivatedBy`, `suspensionReasonPreview` (list, when suspended).

**`GET /api/admin/dashboard` extras:** `supplierVerificationPendingCount`, `supplierVerificationPreview` (pending org verifications, max 5), `recentActivity` (latest `admin_activity_logs`, max 5). `pendingActions.supplierVerifications` and `pendingActions.reports` use real pending counts.

**`GET /api/admin/audit-logs` query:** `page`, `limit`, `search`, `action`, `targetType`, `actorId`, `dateFrom`, `dateTo` (ISO date strings; `dateTo` inclusive end-of-day UTC). **Supported actions:** `USER_SUSPENDED`, `USER_REACTIVATED`, `SUPPLIER_VERIFICATION_APPROVED`, `SUPPLIER_VERIFICATION_REJECTED`, `SUPPLIER_VERIFICATION_CHANGES_REQUESTED`, `INVITATION_CREATED`, `INVITATION_REVOKED`, `INVITATION_RESENT`, `MATERIAL_HIDDEN`, `MATERIAL_MARKED_UNAVAILABLE`, `MATERIAL_RESTORED`, `MATERIAL_REPORT_RESOLVED`, `MATERIAL_REPORT_REJECTED`, `MATERIAL_REPORT_HIDE_MATERIAL`, `CATEGORY_REQUEST_APPROVED`, `CATEGORY_REQUEST_REJECTED`, `PRICE_REQUEST_APPROVED`, `PRICE_REQUEST_REJECTED`. **Supported target types:** `USER`, `SUPPLIER_PROFILE`, `INVITATION`, `MATERIAL`, `MATERIAL_REPORT`, `CATEGORY_REQUEST`, `PRICE_RULE_REQUEST`. **Response (`data`):** `{ items[{ id, action, actionLabel, actorUserId, actorName, actorEmail, targetType, targetId, targetLabel, metadata, createdAt }], pagination: { page, limit, total, totalPages }, filterOptions: { actions[{ value, label }], targetTypes[{ value, label }], actors[{ id, displayName, email }] }, summary: { total, today, thisWeek, mostRecentAt } }`. Filter options union known actions/target types with distinct DB values. Newest first. Search matches action, readable action label, actor name/email, target label, and target type.

**Admin audit logging (side effect on success):** People suspend/reactivate, supplier verification decisions, invitation create/resend/revoke, material hide/unavailable/restore, material report resolve/reject/hide-material, category/price approval decisions each append one row to `admin_activity_logs` via `logAdminActivity`.

**`GET /api/admin/supplier-verifications` query:** `status` (`PENDING` \| `APPROVED` \| `REJECTED` \| `CHANGES_REQUESTED`), `search`, `supplierType` (`WORKSHOP` \| `FACTORY` \| `EDUCATIONAL_INSTITUTION`), `city`, `page`, `limit`.

**`PATCH .../reject` and `.../request-changes` body:** `{ adminNote: string }` (required, min 3 chars). **`PATCH .../approve` body:** `{ adminNote?: string }`.

**Approvals list queries:** `status` (`PENDING` \| `APPROVED` \| `REJECTED`), `search`, `page`, `limit`.

**`PATCH /api/admin/approvals/category-requests/:id/approve` body:** a strict resolution union. Use an existing marketplace category with `{ resolution: "USE_EXISTING_CATEGORY", existingCategoryId: string }`, or create an owned bilingual category with `{ resolution: "CREATE_NEW_CATEGORY", nameEn: string, nameAr: string, materialFamilyConceptId: string, adminJustification?: string, sharedNameAcknowledged?: boolean }`. The supplier's `requestedName` is suggestion context only and is not an approval input. Legacy `finalName`, mixed resolution fields, and incomplete bodies are rejected. `adminJustification` is required (10–500 characters) only when the deterministic suggestion is an `EXACT_NAME` match; a `PARTIAL_TOKEN` suggestion is lower-confidence context. When the reviewed bilingual fields contain the same allowed shared technical term, `sharedNameAcknowledged: true` is required and recorded in the activity log; otherwise it must be absent or false. Missing confirmation returns the field-level code `SHARED_CATEGORY_NAME_ACKNOWLEDGEMENT_REQUIRED`. Both paths atomically update the request, supplier notification, and admin activity log; the create path also creates the category in the same serializable transaction.

**Create-category naming rules:** `nameEn` and `nameAr` are independently required display values of 2–120 characters. Before validation and persistence, safe display normalization trims the value and replaces line breaks, tabs, and repeated whitespace with one ordinary space; it preserves wording, letters, capitalization, and valid punctuation. Structural validation rejects remaining control/format characters, leading/trailing punctuation or symbols, consecutive repeated words, and description-like values over 80 characters or 12 words. English requires meaningful Latin-letter content. Arabic requires meaningful Arabic-letter content and permits only bounded, non-dominant Latin acronyms, except when both fields contain the same plausible shared technical term. That exception is limited to compact uppercase technical tokens (2–12 characters with at least two Latin letters) and the reviewed terms `Arduino`, `Raspberry Pi`, and `3D Printing`; the Admin UI displays an identical-name warning and requires explicit acknowledgement before submission. Ordinary identical English phrases still fail Arabic-field validation.

These deterministic checks detect obvious structural and language-placement problems only. They do not prove grammatical correctness, translation equivalence, or semantic category-name quality; the Admin must review both final marketplace names. Conflict matching remains separate from stored display normalization and compares every proposed language field against both stored language columns: English comparison uses Unicode NFKC, whitespace collapse, and case folding; Arabic comparison uses Unicode NFKC, whitespace collapse, and comparison-only removal of tatweel and Arabic diacritics. Existing stored category names are not rewritten, and conflict responses return their actual bilingual display values.

**`GET /api/admin/approvals/material-family-options` response data:** `{ items: Array<{ id: string, canonicalKey: string, conceptType: "MATERIAL_FAMILY", status: "ACTIVE", labelEn: string, labelAr: string }> }`

**`GET /api/admin/approvals/material-category-options` response data:** `{ items: Array<{ id: string, nameEn: string, nameAr: string, categoryType: "MATERIAL" | "BOTH", status: "ACTIVE", materialCount: number, materialFamily: { id: string, canonicalKey: string, labelEn: string, labelAr: string } }> }`. Only active, material-capable categories with active material-family ownership are returned.

**`PATCH /api/admin/approvals/category-requests/:id/reject` body:** `{ adminNote: string, suggestedCategoryId?: string }` — `suggestedCategoryId` is required when at least one active material category exists.

**Admin category list item fields:** `requestedName`, `status`, supplier fields, `materialTitle`, `materialDescription`, `quantity`, `unit`, `condition`, `locationLabel`, `categoryRequestReason`, `similarCategories`, `suggestedCategory`, `adminNote`, `createdAt`. `suggestedCategory`, when present, is the same safe category projection used by the resolution workflow plus `matchType: "EXACT_NAME" | "PARTIAL_TOKEN"`. Matching loads the bounded active owned material-category set once per page, compares `requestedName` against both `nameEn` and `nameAr` with their reviewed language-specific normalization, retains exact matches first, and uses only deterministic token overlap for lower-confidence partial matches. No fuzzy, AI, embedding, translation, or semantic matching is performed.

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

**`GET /api/supplier/dashboard` response extras:** `stats.engagement` (`totalViews`, `totalLikes`, `followersCount` from `MaterialView`, `MaterialLike`, and `SupplierFollower` counts scoped to the supplier), `stats.operational` (`scheduledPickups`, `activeMaterials`), `mostViewedMaterial` (highest `MaterialView` count; null when `totalViews` is 0), `highDemandMaterials` (top 3 by pending+accepted reservations). `recentReservationRequests` is always an empty array (not shown on overview UI). Engagement view counts use the `MaterialView` table consistently (not cached `material.viewsCount` alone). `projectSupport` reports derived Learning Hub impact from completed build-linked reservations only: `projectsSupported`, `projectComponentsSupported`, `learnerBuildsHelped`, `completedLinkedReservations`, and up to 3 privacy-safe `latestSupportedProjects` entries (`projectId`, `title`, `categoryName`, `completedAt` — no learner identity).
| GET | `/api/supplier/profile` | `supplier/supplier.routes.ts` |
| GET | `/api/supplier/profile/manage` | `supplier/supplier.routes.ts` |
| PATCH | `/api/supplier/profile` | `supplier/supplier.routes.ts` |
| GET | `/api/supplier/materials` | `supplier/supplier.routes.ts` |
| GET | `/api/supplier/materials/:id` | `supplier/supplier.routes.ts` |
| PATCH | `/api/supplier/materials/:id` | `supplier/supplier.routes.ts` |
| POST | `/api/supplier/materials` | `supplier/supplier.routes.ts` |
| DELETE | `/api/supplier/materials/:id` | `supplier/supplier.routes.ts` |

`GET /api/supplier/profile/manage` is the canonical authenticated private Supplier Profile Management read. It returns only `identity`, exact owner-visible `pickupLocation`, optional `organization`, `verification`, and server-derived `completion` (`completedCount`, `totalCount=5`, `percentage`, and stable missing keys). It does not return account email/phone, followers, metrics, latest materials, material fulfillment fields, or public/shared-cache data. Exact pickup address and coordinates are permitted only on this owner-scoped route.

Essentials are `PUBLIC_NAME`, `SUPPLIER_TYPE`, `DESCRIPTION`, `PICKUP_LOCATION` (country + city), and `LOCATION_VISIBILITY`. Working days/hours are informational metadata only. The legacy mixed `GET/PATCH /profile` contract remains temporarily for Flutter compatibility while Flutter migrates; its metrics/followers/material-preview fields are not concatenated into the canonical response.

Supplier avatar/cover files use `POST /api/uploads/profile-image` (`image`, JPG/JPEG/PNG/WebP, max 5 MB), whose returned `/uploads/profiles/...` URL is accepted by `PATCH /api/supplier/profile/images`. New material-upload URLs, HTTP URLs, and unrelated local paths are rejected; legacy stored values remain readable. Public Supplier Profile is deferred pending a redacted DTO, approximate-location rules, public material visibility, and a follower product decision.

### Supplier verification — `/api/supplier/verification`

Organization suppliers (`WORKSHOP`, `FACTORY`, `EDUCATIONAL_INSTITUTION`) must submit a verification document before publishing materials. Individual/student suppliers use `verificationStatus=NOT_REQUIRED`.

| Method | Path | Source file |
|--------|------|-------------|
| GET | `/api/supplier/verification/status` | `supplier-verification/supplier-verification.routes.ts` |
| GET | `/api/supplier/verification/document` | `supplier-verification/supplier-verification.routes.ts` |
| POST | `/api/supplier/verification/submit` | `supplier-verification/supplier-verification.routes.ts` |
| POST | `/api/supplier/verification/resubmit` | `supplier-verification/supplier-verification.routes.ts` |

`POST .../submit` body: organization fields + `verificationDocumentUrl`, `verificationDocumentName`. Sets `verificationStatus=PENDING`. `POST .../resubmit` allowed when status is `REJECTED` or `CHANGES_REQUESTED`.

`POST /api/supplier/materials` returns **403** when organization supplier is not `APPROVED` (`SUPPLIER_VERIFICATION_REQUIRED`).

`POST /api/supplier/materials` requires an `Idempotency-Key` header (safe random string, 16–128 chars). The backend stores the key with scope `SUPPLIER_CREATE_MATERIAL` and the authenticated `userId` in `idempotency_records` (`unique(userId, scope, key)`). The idempotency row, material/location writes, source request publish updates, and stored success response are committed in one transaction. A first successful request creates one material and stores the successful response. A repeat with the same key and identical request body returns the stored material with no new insert. Reusing the same key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`; a simultaneous same-key request still in progress returns `409 IDEMPOTENCY_IN_PROGRESS`. Failed creates roll back the material and idempotency writes, so retrying the same form key is safe.

Supplier creates additionally resolve canonical taxonomy concepts inside the same transaction. A category that is not ownership-ready for material publishing returns **409** `CATEGORY_TAXONOMY_NOT_READY` with a safe supplier-facing message (no concept IDs or internal taxonomy evidence). Current materialType evidence that hits incomplete or inconsistent reviewed taxonomy configuration returns **409** `MATERIAL_TAXONOMY_NOT_READY`. Unexpected assignment/contract invariant failures return **500** `INTERNAL_ERROR` without leaking concept IDs, evidence text, stack traces, or private supplier data. Request body and successful response shape are unchanged.

`POST /api/supplier/materials` body (pickup/delivery related): `useDefaultPickupLocation` (boolean, default `true`); `pickupLocation` (location object, required when `useDefaultPickupLocation` is `false`); `deliveryAllowed` (boolean, default `false`). Organization suppliers must use profile default; override is rejected with `ORG_PICKUP_OVERRIDE_NOT_ALLOWED`. Each create stores a **new** `locations` row on the material (copy or override), not the profile row id.


`PATCH /api/supplier/materials/:id` updates safe listing fields only (`title`, `description`, `quantity`, `unit`, `condition`, `pickupAllowed`, `deliveryAllowed`, `pickupNotes`, `suggestedUses`). `categoryId`, `materialType`, free/paid state, price, location, and images are not writable on update. Edit is allowed when `canEdit` is true (`REUSED` is blocked; active reservations do not block edit when quantity stays at or above held amount). List/detail responses include `canEdit` / `editBlockedReason` and `canDelete` / `deleteBlockedReason`.

When the final trimmed `title` differs from the stored title, the update recomputes canonical taxonomy concepts from the stored `categoryId` / `materialType` and the new title, then synchronizes `MaterialConcept` rows in the same interactive transaction as the Material write. Title-unchanged updates preserve existing concept rows exactly (including historical missing or malformed assignments). Concurrent stale writes are rejected with **409** `CONFLICT` via an `updatedAt` optimistic guard. Category ownership failures return **409** `CATEGORY_TAXONOMY_NOT_READY`; current materialType evidence that hits incomplete reviewed taxonomy configuration returns **409** `MATERIAL_TAXONOMY_NOT_READY`; assignment contract invariants return **500** `INTERNAL_ERROR` without leaking concept IDs or evidence text. Update does not use `Idempotency-Key`.

`GET /api/supplier/materials` and `GET /api/supplier/materials/:id` include engagement and demand metrics on each material: `viewsCount`, `likesCount`, `pendingReservationsCount`, `reservedReservationsCount`, `activeRequestsCount`, `completedReservationsCount`, `reusedCount`, optional `lastCompletedAt`, `activeDemandScore`, `demandScore` (lifetime raw score), and `demandScorePercent` (0–100). `demandScore`/`demandScorePercent` include views, likes, active reservations, and completed reuses; `activeDemandScore` counts only unfinished reservations. `reservationsCount` remains an alias of `activeRequestsCount` for backward compatibility. Detail additionally returns `reservations[]` summaries for the material.

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
| GET | `/api/supplier/reservations/:id` | `supplier-reservations/supplier-reservations.routes.ts` |
| PATCH | `/api/supplier/reservations/:id/accept` | `supplier-reservations/supplier-reservations.routes.ts` |
| PATCH | `/api/supplier/reservations/:id/decline` | `supplier-reservations/supplier-reservations.routes.ts` |
| PATCH | `/api/supplier/reservations/:id/complete` | `supplier-reservations/supplier-reservations.routes.ts` |
| PATCH | `/api/supplier/reservations/:id/reschedule` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/accept-learner-reschedule` | `supplier-reservations/supplier-reservations.routes.ts` |
| PATCH | `/api/supplier/reservations/:id/cancel` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/no-show-report` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/mark-no-show` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/mark-delivery-pickup-expired` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/report-no-driver` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/submit-no-driver-pickup-window` | `supplier-reservations/supplier-reservations.routes.ts` |
| GET | `/api/supplier/reservations/:id/messages` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/messages` | `supplier-reservations/supplier-reservations.routes.ts` |

`GET /api/supplier/reservations` returns supplier reservation cards by status tab. Query `status` supports `all`, `pending`, `needs_learner`, `accepted`, `declined`, `completed`, `cancelled`. `accepted` includes only `ACCEPTED`; `needs_learner` includes only `AWAITING_LEARNER_CONFIRMATION`; `cancelled` includes `CANCELLED` and `EXPIRED`. Stale `PENDING` rows are auto-expired on this read path before filtering. Items include material and learner summaries, `quantityRequested`, `unit`, reserve-time fulfillment fields (`fulfillmentMethod`, `fulfillmentLabel`, preferred windows, delivery address/safe drop-off/note), confirmed/proposed scheduling fields (`pickupWindowStart/End`, `supplierProposedPickupWindowStart/End`, `supplierPickupWindowStart/End`, `confirmedDeliveryWindowStart/End`, `earliestDeliveryStart`, `schedulingConflictReason`), nullable `activeDelivery` (`id`, `status` only), nullable `supplierHandoverCode` (6-digit code for accepted delivery reservations with an active delivery; supplier owner only), derived follow-up fields (`pickupWindowStatus`, `isOverdue`, `needsFollowUp`, `canSupplierReschedule`, `canSupplierCancelOverdue`, `canSupplierReportNoShow`, `canSendMessage`, nullable `latestMessage`, nullable `noShowReport`), and `canSupplierComplete`. `canSupplierComplete` is true only for accepted self-pickup reservations that the supplier may manually complete. Reservations with `fulfillmentMethod = DELIVERY`, `deliveryRequested`, or any `Delivery` row return false so the UI can show driver-delivery status instead of a complete button.

The supplier list contract is paginated. Query parameters are `page` (default `1`), `limit` (default `20`, max `100`), `search`, `status` (the legacy tabs above or any raw `ReservationStatus`), `attentionState`, `fulfillmentMethod`, `historyScope` (`ACTIVE`, `TERMINAL`, `ALL`), `materialId`, `dateFrom`, and `dateTo` (ISO timestamps; `dateFrom <= dateTo`). Raw statuses are `PENDING`, `AWAITING_LEARNER_CONFIRMATION`, `AWAITING_SUPPLIER_CONFIRMATION`, `ACCEPTED`, `AWAITING_RESOLUTION`, `REJECTED`, `CANCELLED`, `COMPLETED`, `EXPIRED`, `NO_SHOW`, and `FULFILLMENT_FAILED`; `EXPIRED` remains distinct from `CANCELLED`. The response keeps `data.reservations` as a compatibility alias and adds `data.items`, `data.pagination` (`page`, `limit`, `total`, `totalPages`), and `data.summary` (counts for `NEEDS_SUPPLIER_RESPONSE`, `WAITING_FOR_LEARNER`, `FULFILLMENT_IN_PROGRESS`, `ADMIN_REVIEW`, `COMPLETED`, and `CLOSED`). Every card also has canonical `workflowPhase`, `attentionState`, `nextActor`, `summaryBucket`, and supplier-safe `availableActions`, plus compact schedule, delivery, group, message, and incident summaries. The server applies all filters before pagination; action availability is computed from existing backend eligibility rules, not inferred from the raw status alone.

`GET /api/supplier/reservations/:id` is owner-scoped and returns `404` when the reservation is not owned by the authenticated supplier. It exposes the same card contract plus canonical state, material/learner identity, request and schedule snapshots, the latest five messages, current delivery/group summary, primary incident summary, and up to fifty newest status-history entries. Delivery recovery rows add `schedule.recoveryContext` with `initiatedBy: ADMIN`, reason, and note; the older `pendingReschedule.requestedBy` value is retained for compatibility. It never returns exact pickup/drop-off locations. This route is the intended backend contract for a future supplier reservation-detail page; the current Flutter focus query may remain a no-op until that migration is built.

#### Additive Pickup Schedule read — `GET /api/supplier/reservations/schedule`

This endpoint is a schedule-entry projection and does not change the semantics of `GET /api/supplier/reservations` or the reservation detail route. Query parameters are `page`, `limit` (max `100`), `scope` (`ACTIVE`, `HISTORY`, `ALL`), `category`, `needsAttention`, `fulfillmentMethod`, `search`, optional `materialId`, `rangeStart`, `rangeEnd`, and the required absolute `dayStart`/`dayEnd` boundaries for active classification. All date values are ISO instants supplied by the client; ranges are bounded to 31 days and `rangeEnd`/`dayEnd` are exclusive.

The mutually exclusive category precedence is `COMPLETED`, `CLOSED`, `ADMIN_REVIEW`, `UNSCHEDULED_ACTION`, `OVERDUE`, `IN_PROGRESS`, `TODAY`, then `UPCOMING`. `needsAttention` is orthogonal and may overlap those categories. Its count is not included in category reconciliation. The response is `{ items, pagination, summary }`; the summary reflects the filtered universe before `page`/`limit`, and its eight category counts sum to `total`.

Each item selects only the canonical Supplier handover window: `CONFIRMED_PICKUP` for self pickup and `SUPPLIER_DELIVERY_PICKUP` for delivery. Learner preferences, pending proposals, learner delivery/drop-off windows, `earliestDeliveryStart`, `deliveredAt`, and `createdAt` are never used as Supplier appointment times. Completed delivery history uses `delivery.pickedUpAt`; terminal fallback timestamps are explicitly labeled. Delivery groups are deduplicated by `DeliveryGroup` before pagination, totals, category counts, and attention counts; grouped entries return a representative reservation, bounded reservation IDs, group count, and no unsafe group-wide mutation actions.

`PATCH /api/supplier/reservations/:id/accept` auto-expires the reservation first; if it is already due for expiry, returns `409 CONFLICT` (`This reservation expired before it could be accepted.`).
`PATCH /api/supplier/reservations/:id/accept` for delivery reservations accepts optional `selectedPreferredWindowIndex` (learner preferred delivery window) and/or `proposedDeliveryWindowStart`/`proposedDeliveryWindowEnd` (custom delivery proposal outside learner preferences). Feasible selected learner windows → `ACCEPTED` + `Delivery` `WAITING_FOR_DRIVER` without learner re-entry. Infeasible selected learner window or custom proposal outside preferences → `AWAITING_LEARNER_CONFIRMATION` (no delivery row until learner confirms). Supplier pickup window fields (`pickupWindowStart`/`pickupWindowEnd`) always represent the supplier/driver pickup window.

`PATCH /api/supplier/reservations/:id/complete` requires `{ confirmationCode }` (6-digit). Correct code alone is insufficient: completion is allowed only when `now` is inside `pickupWindowStart`–`pickupWindowEnd` plus a 30-minute grace period (`HANDOVER_GRACE_MINUTES`). Early completion returns `400` with `Pickup window has not started yet.`; late completion returns `Pickup window has expired.`

Driver `PATCH /api/driver/deliveries/:id/status` requires `confirmationCode` for `PICKED_UP` and `DELIVERED`. After code verification, `PICKED_UP` is allowed only inside `supplierPickupWindowStart`–`supplierPickupWindowEnd` (+ grace); `DELIVERED` only inside `confirmedDeliveryWindowStart`–`confirmedDeliveryWindowEnd` (+ grace). Wrong code returns `400` regardless of time. Failure actions create admin-visible `NoShowReport` records: `POST .../pickup-failed` body `{ reason, note }` (report against supplier); `POST .../delivery-failed` body `{ reason, note }` (report against learner when `LEARNER_UNAVAILABLE`); `POST .../driver-issue` body `{ note }` after pickup when driver cannot continue (report against driver, hold kept). Active driver delivery responses include `canDriverReportPickupFailed`, `canDriverReportDeliveryFailed`, and `canDriverReportDriverIssue`.

`POST /api/supplier/reservations/:id/report-no-driver` body `{ note }` creates a SYSTEM-target incident report when delivery is `WAITING_FOR_DRIVER` after supplier pickup window + grace. Supplier list DTO includes `canReportNoDriverAvailable`, `canSupplierMarkDeliveryPickupExpired` (same eligibility window), `canSupplierReportDriverNoShow`, and `canSubmitNoDriverPickupWindow` (after admin `request-supplier-reschedule` for `NO_DRIVER_AVAILABLE`). Supplier UI shows **Driver not assigned in time** warning and **Report no driver available** when eligible.

`POST /api/supplier/reservations/:id/submit-no-driver-pickup-window` body `{ pickupWindowStart, pickupWindowEnd, supplierNote? }` lets the supplier choose a new pickup window after admin requests reschedule for a no-driver incident. Allowed when reservation is `AWAITING_SUPPLIER_CONFIRMATION` with `pendingRescheduleReason` `NO_DRIVER_ADMIN_REQUEST` and delivery `AWAITING_RESOLUTION`. On success: reservation `ACCEPTED`, delivery `WAITING_FOR_DRIVER`, driver assignment cleared, linked `NO_DRIVER_AVAILABLE` report resolved `RESOLVED_NO_STRIKE`, hold kept.

`POST /api/supplier/reservations/:id/mark-delivery-pickup-expired` (no body) legacy supplier action with the same end state as report-no-driver when no driver was assigned. Sets reservation and delivery to `AWAITING_RESOLUTION`, creates a SYSTEM `NO_DRIVER_AVAILABLE` report when missing, and **keeps the material hold**. Returns updated supplier reservation card DTO with incident flags cleared.

`PATCH /api/supplier/reservations/:id/accept` body remains `{ pickupWindowStart, pickupWindowEnd, supplierNote?, selectedPreferredWindowIndex? }`. For `PICKUP`, optional `selectedPreferredWindowIndex` selects an exact learner preferred pickup window from stored JSON. A selected learner pickup window may already have started, but it must still have at least 30 minutes remaining (`MIN_REMAINING_PICKUP_WINDOW_MINUTES`); otherwise the API returns `400` / `PICKUP_WINDOW_TOO_CLOSE_TO_ENDING`. Without an index, `pickupWindowStart/End` are treated as a custom supplier proposal and must pass the same centralized pickup validation (`PICKUP_START_TOO_SOON` when start is under 30 minutes away). Accept re-checks pickup rules at request time because windows may have aged since learner creation. Only `PENDING` reservations can be accepted; other statuses return `409` with codes such as `RESERVATION_ALREADY_ACCEPTED`, `RESERVATION_ALREADY_DECLINED`, `RESERVATION_CANCELLED`, or `RESERVATION_EXPIRED`. Legacy pickup reservations with null preferred windows accept directly to `ACCEPTED` when the custom proposal rule passes. For `DELIVERY`, the same pickup fields represent the **driver pickup window from supplier**; backend validates delivery address/windows/material delivery allowance, applies a 60-minute buffer to compute a confirmed delivery window when feasible (`ACCEPTED` + optional `Delivery` row `WAITING_FOR_DRIVER`), or sets `AWAITING_LEARNER_CONFIRMATION` with `schedulingConflictReason` when no learner delivery window fits.

Accept keeps the held quantity and recomputes material status. Decline rejects a pending reservation and releases the hold. `PATCH /api/supplier/reservations/:id/complete` body requires `{ confirmationCode }` (6 digits). Supplier enters the learner's self-pickup code to complete; wrong/missing code returns `400 VALIDATION_ERROR`. Complete subtracts `quantityRequested` from `material.quantity` for self-pickup; material becomes `REUSED` only when remaining quantity reaches `0`. Complete is blocked when `fulfillmentMethod` is `DELIVERY` or any delivery row exists for the reservation. Legacy accepted pickup rows without stored hashes lazily generate a hash on authorized read; completion still requires the derived code once stored.

Overdue accepted self-pickup reservations use a phase-based supplier UI (`pickupHandoverPhase`: `BEFORE_ALLOWED`, `DURING_ALLOWED`, `AFTER_ALLOWED`) with handover flexibility ±30 minutes (`HANDOVER_EARLY_MINUTES` / `HANDOVER_GRACE_MINUTES`). **Before** allowed start: supplier may `PATCH .../reschedule` only (proposal → `AWAITING_LEARNER_CONFIRMATION`, requires `reason` + proposed window; hold kept). Supplier custom reschedule proposals must start at least 30 minutes in the future. **During** allowed handover: supplier may `PATCH .../complete` only. **After** allowed end: supplier may `PATCH .../cancel` (close, releases hold), `POST .../no-show-report` (requires `reasonCode` + `note`; self-pickup releases hold → `AWAITING_RESOLUTION`), or `PATCH .../reschedule` (proposal). Learner may `POST /api/reservations/:id/request-reschedule` before/after handover (not during) → `AWAITING_SUPPLIER_CONFIRMATION`; body requires `pickupWindowStart`, `pickupWindowEnd`, and `reason` (`400 PICKUP_WINDOW_REQUIRED` when the window is missing). Supplier reservation cards expose `learnerProposedPickupWindowStart/End` and `pendingReschedule` (`reason`, `note`, proposed window); `canSupplierAcceptLearnerReschedule` is true only when a learner proposed window exists. Learner pickup reschedule proposals must pass the same centralized pickup validation, and supplier acceptance rechecks remaining window time before confirming. Schedule changes never silently update confirmed windows on `ACCEPTED` without the other party accepting. `GET /api/admin/no-show-reports/:id` includes messages and `activityHistory` (reservation status history).

### Supplier deliveries — `/api/supplier/deliveries`

| Method | Path | Module |
|--------|------|--------|
| POST | `/api/supplier/deliveries/:id/driver-no-show` | `fulfillment-failures/fulfillment-failures.routes.ts` |

No-show report verify counts as a strike. At **3 verified reports** the verify response sets `targetSuspended: true` and automatically suspends the target account (`accountStatus: SUSPENDED`). Reject resolves without a strike.

**Auth suspension:** `POST /api/auth/login`, `POST /api/auth/refresh`, and all Bearer-protected routes reject `SUSPENDED`/`DISABLED` accounts with `403` / `ACCOUNT_SUSPENDED` and message *Your account has been suspended. Contact support for help.*

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
