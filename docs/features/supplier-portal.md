# Supplier Portal Feature

**Sources inspected:** `apps/frontend/lib/features/supplier_portal/`, `apps/frontend/lib/features/materials/` (listing data layer), `apps/backend/src/modules/supplier*`, `category-requests`, `price-rule-requests`, `uploads`, `locations`, `docs/backend/api-catalog.md`

## Purpose

Authenticated **SUPPLIER** workspace: dashboard, profile, list/create materials, handle incoming reservation requests, pickup schedule, notifications, and account security.

**Not in current supplier scope:** learner reservation cancel, delivery driver workflow, admin/moderator tools, supplier followers, deep demand insights, and related-project suggestions for supplier materials.

## Current status

| Area | Status | Notes |
|------|--------|-------|
| Supplier shell + routes | **Implemented** | `/supplier/*` with role guard |
| Dashboard, profile, notifications | **Implemented** | API-backed |
| My materials list + detail | **Implemented** | List/detail read; edit/delete gated by lifecycle; detail shows engagement, active demand, lifetime interest score, and reuse history from backend metrics |
| Edit material | **Implemented** | `PATCH /api/supplier/materials/:id`; safe fields only; blocked when status/reservations unsafe |
| Delete material | **Implemented** | `DELETE /api/supplier/materials/:id`; same eligibility as edit |
| Add material | **Implemented** | Create + required image upload + price check + category/price-rule requests |
| Incoming reservations | **Partial** | Supplier accept/decline/self-pickup complete; delivery reservations complete through driver backend flow; supplier UI shows delivery status instead of manual complete |
| Pickup schedule | **Implemented** | API-backed schedule workspace at `GET /api/supplier/reservations/schedule`; server categories, summary counts, effective windows, grouped entries, filters, and pagination are rendered directly, and row actions navigate to Request Details |
| Mock repositories | **Not used** | `MockSupplier*Repository` files exist; providers wire API impl |

## Main user flow

1. Supplier logs in → redirect `/supplier` (dashboard).
2. Navigate via shell: desktop/tablet sidebar exposes materials, add material, reservations, pickup schedule, notifications, and profile; the mobile bar exposes Home, Materials, Add, Requests, and More, with Pickup Schedule, Notifications, and Profile grouped in the More sheet.
3. **Add material:** follow the four-section guided form (basic information, quantity/pricing, pickup/delivery, photos); choose category → category-scoped material type/name autocomplete → price check → at least one image → pickup/delivery options → `POST /api/supplier/materials` with `Idempotency-Key`. The live preview and completion checklist are presentation-only and do not replace validation.
4. **Reservations:** review pending → accept with pickup window / decline / mark complete after self-pickup. Delivery reservations show driver-delivery status and are completed by the driver flow.
5. **Edit material:** `/supplier/materials/:id/edit` → safe fields only when `canEdit`; price/category/images/location read-only.
6. **Delete material:** from My Materials or detail when `canDelete`.
7. **Profile:** `PATCH /api/supplier/profile`, reverse geocode for location, change password via auth API.

### Private Supplier Profile Management contract

`GET /api/supplier/profile/manage` is the canonical private management read. It is authenticated and Supplier-owned, returns exact owner-visible pickup location (`addressLine`, `latitude`, `longitude`) plus separate raw `visibility` (`PUBLIC`, `ORDER_ONLY`, `PRIVATE`) and `isApproximate`, and never uses `PUBLIC_APPROXIMATE` as a stored value.

The response owns Supplier identity, avatar/cover URLs, type, description, pickup location, optional organization details, informational working days/hours, verification summary/actions, and server-derived **essentials completion**. Essentials are public name, Supplier type, description, pickup country + city, and location visibility. Images are uploaded through `POST /api/uploads/profile-image` and stored under `/uploads/profiles`; the material-image endpoint is not a Supplier profile-image path. Existing legacy material-upload URLs remain readable but cannot be assigned by the new image patch validation.

The canonical response intentionally excludes account email/phone, metrics, followers/follower emails, latest materials, material reservation/likes/views, and Material-level `pickupAllowed`, `deliveryAllowed`, and `pickupNotes`. Working schedule data is optional and informational; it does not affect reservation validation or availability. The public Supplier Profile endpoint is deferred. The old mixed profile response remains temporarily for Flutter migration and is planned for deprecation after the redesigned Profile stops consuming its legacy fields. Followers remain incomplete and require a separate privacy/product decision; they should not be a main Profile tab.

Supplier API calls use the shared authenticated Dio client. When the access token expires, eligible Supplier JSON requests now refresh the token centrally through the auth/network layer and retry once. Material image uploads are not auto-retried because replaying multipart request bodies is unsafe; expired sessions during upload surface as an auth/API error.

### Pickup Schedule backend contract

The schedule read is distinct from Incoming Requests. It returns deduplicated Supplier handover entries with stable schedule ordering, entry-based pagination, mutually exclusive categories (`UNSCHEDULED_ACTION`, `ADMIN_REVIEW`, `OVERDUE`, `IN_PROGRESS`, `TODAY`, `UPCOMING`, `COMPLETED`, `CLOSED`), and an overlapping `needsAttention` flag. Active reads use client-provided absolute `dayStart`/`dayEnd` instants and bounded optional ranges.

The canonical appointment is the confirmed self-pickup window for self pickup or the Supplier-to-driver pickup window for delivery. Learner delivery/drop-off windows and delivery `deliveredAt` are not Supplier schedule appointments. Grouped deliveries are one schedule entry before totals and pagination; grouped entries expose bounded context and no unsafe group-wide mutation actions. The Flutter workspace uses the returned category, summary, effective window, next actor, and available actions without local category inference or the retired schedule-details dialog; `View` opens `/supplier/reservations/:reservationId`.

Add-material uses category-scoped material type/name autocomplete backed by `GET /api/material-types?categoryId=&q=`. Suppliers can still type a custom `materialName`; selecting a reviewed type sends `materialTypeId` to price check only, while create continues to send `materialName` for backend material type/alias matching. `Listing title` remains display-only. The UI no longer asks for source type; backend derives `materials.sourceType` from `supplierProfile.supplierType` (`WORKSHOP` → `WORKSHOP_SURPLUS`, `FACTORY` → `FACTORY_SURPLUS`, `EDUCATIONAL_INSTITUTION` → `EDUCATIONAL_INSTITUTION`, `INDIVIDUAL_SUPPLIER` → `STUDENT_LEFTOVER`). The individual mapping is an MVP fallback and may need a more precise enum later.

**Price governance:** paid listings are checked against accepted price rules or review workflows before publish. The current AI support is price-reference assistance for rule/request review; broader AI description/category/use suggestions are planned future scope.

**Pickup and delivery on create:** Organization suppliers see a read-only profile pickup map; individual/student suppliers can use profile default or override per material. Backend always requires a profile default pickup, copies it into a dedicated `locations` row per material (or creates override row for individual/student). Organization suppliers cannot send `useDefaultPickupLocation: false` or `pickupLocation`. Suppliers can also set `deliveryAllowed`; accepted learner reservations for those materials can request internal delivery. Supplier reservation responses include `fulfillmentMethod`, `fulfillmentLabel`, `activeDelivery` (`id`, `status`), and `canSupplierComplete`; the UI uses these fields to show manual completion only for accepted self-pickup reservations. Reservations with `fulfillmentMethod = DELIVERY` or any `Delivery` row, including cancelled or failed delivery attempts, remain driver-delivery handled and do not expose supplier manual completion.

**Duplicate submit protection on create:** Add Material generates one `Idempotency-Key` per form session and sends it with `POST /api/supplier/materials`. The page locks publish/request-review actions while publishing, keeps the same key across failed retries, invalidates supplier material/dashboard/notification providers on success, and navigates to `/supplier/materials`. Backend idempotency is the durable protection: same user + scope + key + identical body returns the original created material instead of inserting another row. Similar valid listings are allowed when they use a new form/key.

## Frontend files

| Area | Path |
|------|------|
| Shell | `presentation/shell/supplier_shell.dart`, `supplier_sidebar.dart`, `supplier_mobile_nav.dart`, `supplier_nav_config.dart`, `supplier_top_bar.dart` |
| Pages | `presentation/pages/supplier_dashboard_page.dart`, `supplier_my_materials_page.dart`, `supplier_owned_material_detail_page.dart`, `supplier_edit_material_page.dart`, `add_material_page.dart`, `supplier_incoming_requests_page.dart`, `supplier_pickup_schedule_page.dart`, `supplier_notifications_page.dart`, `supplier_profile_page.dart`, `supplier_access_denied_page.dart` |
| Pickup on add material | `presentation/widgets/add_material_pickup_section.dart` |
| Controllers | `presentation/controllers/supplier_*_providers.dart` |
| Data APIs | `data/supplier_dashboard_repository.dart`, `supplier_profile_api.dart`, `supplier_my_materials_api.dart`, `supplier_materials_repository.dart`, `supplier_requests_api.dart`, `supplier_pickup_schedule_api.dart`, `supplier_notifications_api.dart`, `locations_api.dart` |
| Theme | `presentation/theme/supplier_*` |
| Listing support | `features/materials/data/*` (categories, types, price-check, uploads, category-requests) |

**Unwired:** `supplier_coming_soon_page.dart`

## Backend files

| Module | Path |
|--------|------|
| Supplier core | `modules/supplier/supplier.*` |
| Reservations | `modules/supplier-reservations/supplier-reservations.*` |
| Notifications | `modules/supplier-notifications/supplier-notifications.*` |
| Category requests | `modules/category-requests/*` (mounted under supplier) |
| Price rule requests | `modules/price-rule-requests/*` |
| Uploads | `modules/uploads/*` |
| Locations | `modules/locations/*` (reverse geocode) |
| Materials (shared) | `modules/materials/*` (price-check, listing-policy) |
| Taxonomy | `modules/categories/*`, `modules/material-types/*` |

## API endpoints

All under `/api/supplier` require JWT + **SUPPLIER** role unless noted.

| Area | Endpoints |
|------|-----------|
| Dashboard | `GET /dashboard` |
| Profile | `GET /profile/manage` (canonical private read), `GET /profile`, `PATCH /profile` (legacy compatibility) |
| Materials | `GET /materials`, `GET /materials/:id`, `PATCH /materials/:id`, `POST /materials`, `DELETE /materials/:id` |
| Category requests | `POST/GET /category-requests`, `GET /category-requests/:id/draft` |
| Price rule requests | `GET /price-rule-requests`, `GET /price-rule-requests/:id/draft` |
| Reservations | `GET /reservations`, `PATCH /reservations/:id/accept|decline|complete` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `GET /notifications/unread-count` |
| Supporting | `POST /api/uploads/material-images`, `POST /api/materials/price-check`, `POST /api/price-rule-requests`, `POST /api/locations/reverse-geocode`, `GET /api/categories`, `GET /api/material-types` |

Static images: `GET /uploads/materials/*`

## Database tables

| Table | Role |
|-------|------|
| `supplier_profiles`, `organization_profiles` | Profile |
| `locations` | Pickup / business locations |
| `materials`, `material_images`, `material_tags` | Listings |
| `categories`, `material_types`, `material_price_rules` | Taxonomy / pricing |
| `category_requests`, `price_rule_requests` | Approval workflows + listing drafts |
| `reservations`, `reservation_status_history` | Incoming requests |
| `users` | Owner/requester relations |
| `ai_price_lookup_logs` | Internal AI price lookups during listing — **Needs verification** when triggered |
| `idempotency_records` | Supplier create idempotency keys and stored successful responses |

## Reusable components

- Shared: `AppMaterialCard` (where discovery-shaped data shown), material badges — see [reusable-widgets](../frontend/reusable-widgets.md)
- Supplier-specific: `SupplierMaterialCard`, `SupplierProjectImpactPanel`, dashboard charts, shell widgets — **not** for cross-feature reuse

## Known gaps / Needs verification

- **Learner** cannot create reservations via API — test data from `prisma/seeds/seed-supplier-reservations.ts`.
- Accept reservation recomputes material status from holds; material may stay `AVAILABLE` when partial stock remains.
- Admin impact metrics still count whole `REUSED` materials; partial depletion may need reservation-level impact later.
- Supplier dashboard `GET /dashboard` includes reuse stats (`stats.impact.reusedMaterials`) and **project-linked impact** (`projectSupport`) derived from completed build-linked reservations. Counts only `Reservation.status = COMPLETED` on linked `project_build_items`; does not expose learner identity.
- `POST /api/price-rule-requests` has auth but no `SUPPLIER` role guard in route file.
- Supplier followers, follower impact, saves/likes analytics, category demand insights, and "related projects for this material" are planned/future.
- Supplier owned material detail shows backend-computed demand metrics: active demand (unfinished reservations only), lifetime `demandScorePercent` (views, likes, active reservations, completed reuses), and reuse history (`completedReservationsCount`, `reusedCount`, `lastCompletedAt`).

### Supplier notification contract

The supplier inbox is backed by persisted `notifications` rows. Producers use deterministic `eventKey` values for reservation lifecycle/recovery events, category and price review decisions, moderation updates, supplier verification decisions, and listing publication. The classifier revalidates the current reservation/request/material/profile in bounded batches at read time; missing or unknown targets are returned as non-actionable `UNKNOWN` rather than guessed routes. The old computed feed is retained only as unused compatibility code, and the endpoint does not read it. Flutter bell migration remains a separate follow-up; this backend verification does not change Flutter files.
