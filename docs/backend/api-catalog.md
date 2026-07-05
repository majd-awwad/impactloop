# Backend API Catalog

HTTP endpoints **as mounted in code**. Derived from `apps/backend/src/app.ts` and `apps/backend/src/modules/**/*.routes.ts`.

**Not sourced from:** `docs/04-api-conventions.md` endpoint examples (many are aspirational).

Conventions for response shape: [04-api-conventions.md](../04-api-conventions.md).

## Static files

| Method | Path | Auth | Source |
|--------|------|------|--------|
| GET | `/uploads/materials/*` | Public | `app.ts` — `express.static(MATERIAL_UPLOADS_DIR)` |
| GET | `/uploads/profiles/*` | Public | `app.ts` — `express.static(PROFILE_UPLOADS_DIR)` |

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
| POST | `/api/auth/become-supplier` | Bearer JWT | `auth/auth.routes.ts` |
| POST | `/api/auth/switch-role` | Bearer JWT | `auth/auth.routes.ts` |

`GET /api/auth/me` returns `{ user }` including `roles`, `activeRole`, `canSwitchToLearner`, `canSwitchToSupplier`, `defaultPortalRoute`, profile summaries (including `supplierProfile.id` when present), `phoneVerifiedAt`, and `lastLoginAt` when present.

`POST /api/auth/become-supplier` adds `SUPPLIER` role and creates a supplier profile on the same account when missing; keeps existing `LEARNER` role; sets `activeRole` to `SUPPLIER`. Response matches login/register: new `accessToken`, optional `refreshToken`, and updated `user` so JWT roles stay in sync.

`POST /api/auth/switch-role` body: `{ "activeRole": "LEARNER" | "SUPPLIER" }`. Backend enforces portal switch rules (organization suppliers cannot switch to learner unless they already have `LEARNER`; student/individual suppliers may be granted `LEARNER` on first switch). Response includes refreshed auth tokens and updated `user`.

Validation schemas: `auth/auth.validation.ts`

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

`GET /api/notifications` query: `page`, `limit`, optional `isRead=true|false`. Returns `{ items[], unreadCount, pagination }` where each item includes `id`, `notificationType`, `title`, `body`, `relatedEntityType`, `relatedEntityId`, `isRead`, `createdAt`.

Reservation lifecycle writes persisted rows for supplier/learner recipients (`RESERVATION_REQUESTED`, `RESERVATION_ACCEPTED`, `RESERVATION_SCHEDULING_PROPOSAL`, `RESERVATION_DECLINED`, `RESERVATION_CANCELLED`, `RESERVATION_EXPIRED`). Admin moderation flows continue to write their own `notificationType` values.

Supplier **derived action inbox** remains at `GET /api/supplier/notifications` (category/price/reservation review cards). Generic `/api/notifications` covers persisted table rows for any authenticated user.

## Profile — `/api/profile`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| PATCH | `/api/profile` | Bearer JWT | `profile/profile.routes.ts` |
| PATCH | `/api/profile/learner` | Bearer JWT + `LEARNER` role | `profile/profile.routes.ts` |

`PATCH /api/profile` body (partial, at least one field): `{ displayName?, phone?, profileImageUrl? }`. Changing `phone` clears `phoneVerifiedAt`. `profileImageUrl` accepts `/uploads/profiles/...` or safe `https://` URLs only.

`PATCH /api/profile/learner` body: `{ learnerType, skillLevel, interests?, bio? }`. Upserts `learner_profiles` for users with the `LEARNER` role.

Both routes return `{ user }` using the same summary shape as `/api/auth/me`.

Validation schemas: `profile/profile.validation.ts`

## Uploads — `/api/uploads`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| POST | `/api/uploads/profile-image` | Bearer JWT | `uploads/uploads.routes.ts` |
| POST | `/api/uploads/material-images` | Bearer JWT + `SUPPLIER` | `uploads/uploads.routes.ts` |
| POST | `/api/uploads/supplier-verification-document` | Bearer JWT + `SUPPLIER` | `uploads/uploads.routes.ts` |

`POST /api/uploads/profile-image` accepts multipart field `image` (JPG/PNG/WebP, max 5 MB). Response: `{ image: { url, filename, mimeType, sizeBytes } }` with `url` under `/uploads/profiles/...`.

Verification document upload: PDF/JPG/JPEG/PNG, max 5MB. Returns `{ url, fileName }`.

Static files: `GET /uploads/materials/*`, `GET /uploads/profiles/*`, `GET /uploads/supplier-verification/*` (`app.ts`).

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
| POST | `/api/reservations` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| PATCH | `/api/reservations/:id/cancel` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| PATCH | `/api/reservations/:id/learner-confirmation` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| GET | `/api/reservations/:id/messages` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/messages` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/request-reschedule` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/report-supplier-issue` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/report-no-driver` | Bearer JWT | `LEARNER` (or supplier on same reservation) | `reservations/reservations.routes.ts` |
| POST | `/api/reservations/:id/delivery` | Bearer JWT | `LEARNER` | `reservations/reservations.routes.ts` + `deliveries` |

`GET /api/reservations/my` returns the authenticated learner's reservations newest first. Items include reservation status, `quantityRequested`, `fulfillmentMethod` (`PICKUP` | `DELIVERY`), learner preferred pickup/delivery window arrays (`{ start, end }` ISO datetimes), delivery address snapshot fields (`deliveryAddressText`, `safeDropoffAllowed`, `deliveryNote`), message, timestamps, safe material summary (including `unit` and approximate `city`/`area`), `material.deliveryAllowed`, legacy `deliveryRequested`, supplier display name, supplier-confirmed pickup window fields, awaiting-confirmation scheduling fields (`supplierProposedPickupWindowStart/End`, `supplierPickupWindowStart/End`, `confirmedDeliveryWindowStart/End`, `earliestDeliveryStart`, `schedulingConflictReason`), nullable `activeDelivery` (`id`, `status` only), nullable `selfPickupCode` (6-digit code for accepted `PICKUP` reservations only; owner learner only), supplier note, rejection reason, derived follow-up fields (`pickupWindowStatus`, `isOverdue`, `needsFollowUp`, `canSendMessage`, nullable `latestMessage`), and nullable `pickupLocationFull`. Overdue is derived when status is `ACCEPTED`, pickup window end is in the past, and the reservation is not completed/cancelled/declined; overdue does **not** auto-complete or release material. `pickupLocationFull` is populated only when the reservation status is `ACCEPTED` or `COMPLETED`; it is `null` for `PENDING`, `AWAITING_LEARNER_CONFIRMATION`, `REJECTED`, `CANCELLED`, and `EXPIRED`. When present, `pickupLocationFull` includes `country`, `city`, `area`, `addressLine`, `latitude`, `longitude`, and `isApproximate` using the same decimal-to-number JSON convention as other location DTOs. Public material discovery endpoints continue to expose only approximate city/area.

**Lazy `PENDING` expiry:** `GET /api/reservations/my`, `GET /api/reservations/:id`, `POST /api/reservations` (duplicate-open check), public material list/detail (`availableQuantity`), and supplier reservation reads auto-expire stale `PENDING` reservations before returning data. Expiry deadline is the latest preferred pickup/delivery window end (based on `fulfillmentMethod`); rows without parseable windows use `createdAt + 72h` (`PENDING_RESERVATION_FALLBACK_HOURS`). Expired rows become `EXPIRED`, release the quantity hold, and write status history. No background cron in MVP.

`GET/POST /api/reservations/:id/messages` expose reservation-scoped text follow-up (max 1000 chars) for participants on `PENDING`/`ACCEPTED` reservations only; not a general messenger. Messaging is disabled while a `PENDING_REVIEW` incident report is open.

`POST /api/reservations/:id/report-supplier-issue` (learner, accepted self-pickup after pickup window + 30 min grace): body `{ reason, note? }` where `reason` is `SUPPLIER_UNAVAILABLE` | `SUPPLIER_MATERIAL_NOT_READY` | `WRONG_PICKUP_INFO` | `OTHER`. Creates `NoShowReport` (`PENDING_REVIEW`, target `SUPPLIER`), sets reservation `AWAITING_RESOLUTION`, releases hold, does not decrement stock.

`POST /api/reservations/:id/report-no-driver` (learner or supplier, delivery `WAITING_FOR_DRIVER` after supplier pickup window + grace): optional `note`. Creates system-target report (`NO_DRIVER_AVAILABLE`), sets reservation/delivery `AWAITING_RESOLUTION`, keeps hold. No user strike on verify.

Admin incident review (`/api/admin/no-show-reports` and `/api/admin/reservation-reports` aliases): list/filter by status (`PENDING_REVIEW`, `VERIFIED`, `REJECTED`, `RESOLVED_NO_STRIKE`); `PATCH .../verify` adds a verified strike to strike-eligible targets (`LEARNER`/`SUPPLIER`/`DRIVER` only); 3 verified strikes → `accountStatus` `SUSPENDED` + auth token revocation; `PATCH .../reject` and `PATCH .../resolve` do not add strikes.

`POST /api/reservations` creates a partial-quantity hold for an available material. Body requires `materialId`, `quantityRequested`, and `fulfillmentMethod` (`PICKUP` | `DELIVERY`). For `PICKUP`, include at least one `learnerPreferredPickupWindows` entry (`{ start, end }` ISO datetimes); each pickup window must end at least 60 minutes from now so suppliers can still accept it. Too-short pickup windows return `Preferred pickup window is too close to ending. Choose a window with at least 60 minutes remaining.` For `DELIVERY`, include at least one `learnerPreferredDeliveryWindows` entry, `deliveryAddressText`, and `safeDropoffAllowed`; optional `deliveryNote`. Optional `message` remains supported. Validation requires all windows to end after start and be future-valid. The transaction validates `quantityRequested` against computed `availableQuantity`, rejects fulfillment methods the material does not allow, blocks a second open reservation by the same learner on the same material, creates a `PENDING` reservation (no `Delivery` row yet), writes status history, and recomputes material status. Material stays `AVAILABLE` while stock remains reservable.

`PATCH /api/reservations/:id/cancel` cancels a learner-owned `PENDING` or `AWAITING_LEARNER_CONFIRMATION` reservation, sets `CANCELLED`, writes status history, and releases the held quantity. Reservations with an existing delivery row return `409 CONFLICT`. `ACCEPTED` / terminal statuses return `409 CONFLICT`.

`PATCH /api/reservations/:id/learner-confirmation` resolves learner-owned reservations in `AWAITING_LEARNER_CONFIRMATION`. Body: `{ action, deliveryWindow? }` where `action` is `ACCEPT_PROPOSED_PICKUP` | `SUBMIT_DELIVERY_WINDOW` | `CANCEL`. Only the reservation owner may call this route; wrong status returns `409 CONFLICT`. **PICKUP:** `ACCEPT_PROPOSED_PICKUP` copies `supplierProposedPickupWindowStart/End` into `pickupWindowStart/End`, clears proposed fields, and sets `ACCEPTED` (no delivery row). **DELIVERY:** `SUBMIT_DELIVERY_WINDOW` requires `{ deliveryWindow: { start, end } }`; backend reuses the 60-minute buffer after `supplierPickupWindowEnd`. Feasible or partially overlapping windows → `ACCEPTED`, stores `confirmedDeliveryWindowStart/End`, sets `deliveryRequested`, creates one `Delivery` row `WAITING_FOR_DRIVER`. Infeasible window → `422 VALIDATION_ERROR`, reservation stays `AWAITING_LEARNER_CONFIRMATION`, no delivery row. **Both:** `CANCEL` sets `CANCELLED` and releases the hold when no delivery row exists. Returns the updated learner reservation list DTO.

Public material list/detail responses include `quantity` (remaining stock), `availableQuantity` (remaining minus active holds), and `unit`.

`POST /api/reservations/:id/delivery` creates an internal delivery attempt for an accepted learner-owned **pickup** reservation (`fulfillmentMethod = PICKUP`). Body: either `{ savedDropoffAddressId, learnerNote? }` or `{ dropoffLocation, learnerNote?, saveDropoffAddressLabel? }`. Inline `dropoffLocation` includes country/city plus optional area/address/latitude/longitude; optional `saveDropoffAddressLabel` persists the address for reuse (max 10 per learner). The route creates copied pickup/dropoff locations, a `Delivery` row with `WAITING_FOR_DRIVER`, and delivery status history. It rejects non-accepted reservations, delivery-fulfillment reservations, delivery-disabled materials, and reservations with an active delivery.

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
| POST | `/api/driver/deliveries/:id/pickup-failed` | `driver/driver.routes.ts` |
| POST | `/api/driver/deliveries/:id/delivery-failed` | `driver/driver.routes.ts` |
| POST | `/api/driver/deliveries/:id/driver-issue` | `driver/driver.routes.ts` |

Available jobs return safe area-level pickup/dropoff data only. Accept is transactional and assigns only `WAITING_FOR_DRIVER` unassigned deliveries; active drivers can accept from `OFFLINE` or `AVAILABLE`, and accepting moves the profile to `ON_DELIVERY`. Status updates are assigned-driver-only and must follow `DRIVER_ASSIGNED → ARRIVED_PICKUP → PICKED_UP → ON_THE_WAY → ARRIVED_DROPOFF → DELIVERED`. `ARRIVED_*` transitions do not require a code. `PICKED_UP` requires body `{ status, confirmationCode?, note? }` with the supplier handover code. `DELIVERED` requires the learner delivery code in `confirmationCode`. Wrong or missing codes return `400 VALIDATION_ERROR`. Driver DTOs never include plain codes. `DELIVERED` completes the reservation, subtracts `quantityRequested` from `material.quantity`, and marks the material `REUSED` only when remaining quantity reaches `0`. Location pings store decimal latitude/longitude for assigned active deliveries and return numeric coordinates to the driver caller. Learner delivery reads expose only the latest ping, with coordinates limited to tracking-eligible statuses, and include `learnerDeliveryCode` for active deliveries (owner learner only). No realtime stream exists yet.

## Price rule requests — `/api/price-rule-requests`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| POST | `/api/price-rule-requests` | Bearer JWT | `price-rule-requests/price-rule-requests.routes.ts` |

**Needs verification:** route uses `authMiddleware` only — no `requireRoles('SUPPLIER')` in route file.

## Learning projects — `/api/learning-projects`

| Method | Path | Auth | Source file |
|--------|------|------|-------------|
| GET | `/api/learning-projects` | Public, optional Bearer JWT | `learning-projects/learning-projects.routes.ts` |
| GET | `/api/learning-projects/:id` | Public, optional Bearer JWT (`PUBLISHED` only) | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/:id/like` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| DELETE | `/api/learning-projects/:id/like` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/:id/save` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| DELETE | `/api/learning-projects/:id/save` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/:id/follow` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| DELETE | `/api/learning-projects/:id/follow` | Bearer JWT | `LEARNER` | `learning-projects/learning-projects.routes.ts` |
| POST | `/api/learning-projects/submit` | Bearer JWT + `Idempotency-Key` | `LEARNER` | `learning-projects/learning-projects.routes.ts` |

Public list/detail return only `PUBLISHED` projects and include `likesCount`, `followersCount`, plus viewer-specific `isLiked`, `isSaved`, and `isFollowing` (`false` without authenticated viewer). Learner like/unlike is idempotent and returns `{ projectId, likesCount, isLiked }`. Learner save/unsave is idempotent and returns `{ projectId, isSaved }`; save counts are not exposed publicly. Learner follow/unfollow is idempotent and returns `{ projectId, followersCount, isFollowing }`. Learner submit creates `PENDING_REVIEW` with `submittedAt`. `POST /api/learning-projects/submit` requires an `Idempotency-Key` header and uses scope `LEARNING_PROJECT_SUBMIT`; same learner + same key + identical body returns the stored response without creating another project.

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
| GET | `/api/admin/reservations/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/no-show-reports` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/no-show-reports/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/no-show-reports/:id/verify` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/no-show-reports/:id/reject` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/no-show-reports/:id/resolve` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| GET | `/api/admin/reservation-reports` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` (alias of no-show-reports) |
| GET | `/api/admin/reservation-reports/:id` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/reservation-reports/:id/verify` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/reservation-reports/:id/reject` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
| PATCH | `/api/admin/reservation-reports/:id/resolve` | Bearer JWT | `ADMIN` | `admin/admin.routes.ts` |
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

**`GET /api/supplier/dashboard` response extras:** `stats.engagement` (`totalViews`, `totalLikes`, `followersCount` from `MaterialView`, `MaterialLike`, and `SupplierFollower` counts scoped to the supplier), `stats.operational` (`scheduledPickups`, `activeMaterials`), `mostViewedMaterial` (highest `MaterialView` count; null when `totalViews` is 0), `highDemandMaterials` (top 3 by pending+accepted reservations). `recentReservationRequests` is always an empty array (not shown on overview UI). Engagement view counts use the `MaterialView` table consistently (not cached `material.viewsCount` alone).
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
| PATCH | `/api/supplier/reservations/:id/reschedule` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/accept-learner-reschedule` | `supplier-reservations/supplier-reservations.routes.ts` |
| PATCH | `/api/supplier/reservations/:id/cancel` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/no-show-report` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/mark-no-show` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/mark-delivery-pickup-expired` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/report-no-driver` | `supplier-reservations/supplier-reservations.routes.ts` |
| GET | `/api/supplier/reservations/:id/messages` | `supplier-reservations/supplier-reservations.routes.ts` |
| POST | `/api/supplier/reservations/:id/messages` | `supplier-reservations/supplier-reservations.routes.ts` |

`GET /api/supplier/reservations` returns supplier reservation cards by status tab. Query `status` supports `all`, `pending`, `needs_learner`, `accepted`, `declined`, `completed`, `cancelled`. `accepted` includes only `ACCEPTED`; `needs_learner` includes only `AWAITING_LEARNER_CONFIRMATION`; `cancelled` includes `CANCELLED` and `EXPIRED`. Stale `PENDING` rows are auto-expired on this read path before filtering. Items include material and learner summaries, `quantityRequested`, `unit`, reserve-time fulfillment fields (`fulfillmentMethod`, `fulfillmentLabel`, preferred windows, delivery address/safe drop-off/note), confirmed/proposed scheduling fields (`pickupWindowStart/End`, `supplierProposedPickupWindowStart/End`, `supplierPickupWindowStart/End`, `confirmedDeliveryWindowStart/End`, `earliestDeliveryStart`, `schedulingConflictReason`), `deliveryRequested`, nullable `activeDelivery` (`id`, `status` only), nullable `supplierHandoverCode` (6-digit code for accepted delivery reservations with an active delivery; supplier owner only), derived follow-up fields (`pickupWindowStatus`, `isOverdue`, `needsFollowUp`, `canSupplierReschedule`, `canSupplierCancelOverdue`, `canSupplierReportNoShow`, `canSendMessage`, nullable `latestMessage`, nullable `noShowReport`), and `canSupplierComplete`. `canSupplierComplete` is true only for accepted self-pickup reservations that the supplier may manually complete. Reservations with `fulfillmentMethod = DELIVERY`, `deliveryRequested`, or any `Delivery` row return false so the UI can show driver-delivery status instead of a complete button.

`PATCH /api/supplier/reservations/:id/accept` auto-expires the reservation first; if it is already due for expiry, returns `409 CONFLICT` (`This reservation expired before it could be accepted.`).
`PATCH /api/supplier/reservations/:id/accept` for delivery reservations accepts optional `selectedPreferredWindowIndex` (learner preferred delivery window) and/or `proposedDeliveryWindowStart`/`proposedDeliveryWindowEnd` (custom delivery proposal outside learner preferences). Feasible selected learner windows → `ACCEPTED` + `Delivery` `WAITING_FOR_DRIVER` without learner re-entry. Infeasible selected learner window or custom proposal outside preferences → `AWAITING_LEARNER_CONFIRMATION` (no delivery row until learner confirms). Supplier pickup window fields (`pickupWindowStart`/`pickupWindowEnd`) always represent the supplier/driver pickup window.

`PATCH /api/supplier/reservations/:id/complete` requires `{ confirmationCode }` (6-digit). Correct code alone is insufficient: completion is allowed only when `now` is inside `pickupWindowStart`–`pickupWindowEnd` plus a 30-minute grace period (`HANDOVER_GRACE_MINUTES`). Early completion returns `400` with `Pickup window has not started yet.`; late completion returns `Pickup window has expired.`

Driver `PATCH /api/driver/deliveries/:id/status` requires `confirmationCode` for `PICKED_UP` and `DELIVERED`. After code verification, `PICKED_UP` is allowed only inside `supplierPickupWindowStart`–`supplierPickupWindowEnd` (+ grace); `DELIVERED` only inside `confirmedDeliveryWindowStart`–`confirmedDeliveryWindowEnd` (+ grace). Wrong code returns `400` regardless of time. Failure actions create admin-visible `NoShowReport` records: `POST .../pickup-failed` body `{ reason, note }` (report against supplier); `POST .../delivery-failed` body `{ reason, note }` (report against learner when `LEARNER_UNAVAILABLE`); `POST .../driver-issue` body `{ note }` after pickup when driver cannot continue (report against driver, hold kept). Active driver delivery responses include `canDriverReportPickupFailed`, `canDriverReportDeliveryFailed`, and `canDriverReportDriverIssue`.

`POST /api/supplier/reservations/:id/report-no-driver` body `{ note }` creates a SYSTEM-target incident report when delivery is `WAITING_FOR_DRIVER` after supplier pickup window + grace. Supplier list DTO includes `canReportNoDriverAvailable`, `canSupplierMarkDeliveryPickupExpired` (same eligibility window; supplier UI uses mark-expired action), and `canSupplierReportDriverNoShow`.

`POST /api/supplier/reservations/:id/mark-delivery-pickup-expired` (no body) closes a delivery still `WAITING_FOR_DRIVER` with no assigned driver after supplier pickup window + grace. Sets reservation and delivery to `AWAITING_RESOLUTION`, creates a SYSTEM `NO_DRIVER_AVAILABLE` report when missing, and releases the operational hold path for admin review. Returns updated supplier reservation card DTO with `canSupplierMarkDeliveryPickupExpired: false`.

`PATCH /api/supplier/reservations/:id/accept` body remains `{ pickupWindowStart, pickupWindowEnd, supplierNote?, selectedPreferredWindowIndex? }`. For `PICKUP`, optional `selectedPreferredWindowIndex` selects an exact learner preferred pickup window from stored JSON. A selected learner pickup window may already have started, but it must still have at least 60 minutes remaining (`pickupWindowEnd >= now + MIN_PICKUP_NOTICE_MINUTES`); otherwise the API returns `400` with `This pickup window is too close to ending. Propose a new time.` Without an index, `pickupWindowStart/End` are treated as a custom supplier proposal and `pickupWindowStart` must be at least 30 minutes in the future; otherwise the API returns `Proposed pickup time must start in the future.` Legacy pickup reservations with null preferred windows accept directly to `ACCEPTED` when the custom proposal rule passes. For `DELIVERY`, the same pickup fields represent the **driver pickup window from supplier**; backend validates delivery address/windows/material delivery allowance, applies a 60-minute buffer to compute a confirmed delivery window when feasible (`ACCEPTED` + optional `Delivery` row `WAITING_FOR_DRIVER`), or sets `AWAITING_LEARNER_CONFIRMATION` with `schedulingConflictReason` when no learner delivery window fits.

Accept keeps the held quantity and recomputes material status. Decline rejects a pending reservation and releases the hold. `PATCH /api/supplier/reservations/:id/complete` body requires `{ confirmationCode }` (6 digits). Supplier enters the learner's self-pickup code to complete; wrong/missing code returns `400 VALIDATION_ERROR`. Complete subtracts `quantityRequested` from `material.quantity` for self-pickup; material becomes `REUSED` only when remaining quantity reaches `0`. Complete is blocked when `deliveryRequested` is true or any delivery row exists for the reservation. Legacy accepted pickup rows without stored hashes lazily generate a hash on authorized read; completion still requires the derived code once stored.

Overdue accepted self-pickup reservations use a phase-based supplier UI (`pickupHandoverPhase`: `BEFORE_ALLOWED`, `DURING_ALLOWED`, `AFTER_ALLOWED`) with handover flexibility ±30 minutes (`HANDOVER_EARLY_MINUTES` / `HANDOVER_GRACE_MINUTES`). **Before** allowed start: supplier may `PATCH .../reschedule` only (proposal → `AWAITING_LEARNER_CONFIRMATION`, requires `reason` + proposed window; hold kept). Supplier custom reschedule proposals must start at least 30 minutes in the future. **During** allowed handover: supplier may `PATCH .../complete` only. **After** allowed end: supplier may `PATCH .../cancel` (close, releases hold), `POST .../no-show-report` (requires `reasonCode` + `note`; self-pickup releases hold → `AWAITING_RESOLUTION`), or `PATCH .../reschedule` (proposal). Learner may `POST /api/reservations/:id/request-reschedule` before/after handover (not during) → `AWAITING_SUPPLIER_CONFIRMATION`; learner pickup reschedule proposals must have at least 60 minutes remaining, and supplier acceptance rechecks this before confirming. Schedule changes never silently update confirmed windows on `ACCEPTED` without the other party accepting. `GET /api/admin/no-show-reports/:id` includes messages and `activityHistory` (reservation status history).

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
