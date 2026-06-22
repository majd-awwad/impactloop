# Supplier Portal Feature

**Sources inspected:** `apps/frontend/lib/features/supplier_portal/`, `apps/frontend/lib/features/materials/` (listing data layer), `apps/backend/src/modules/supplier*`, `category-requests`, `price-rule-requests`, `uploads`, `locations`, `docs/backend/api-catalog.md`

## Purpose

Authenticated **SUPPLIER** workspace: dashboard, profile, list/create materials, handle incoming reservation requests, pickup schedule, notifications, and account security.

**Not in scope:** learner reservation creation, delivery driver workflow, material edit/delete API, admin/moderator tools.

## Current status

| Area | Status | Notes |
|------|--------|-------|
| Supplier shell + routes | **Implemented** | `/supplier/*` with role guard |
| Dashboard, profile, notifications | **Implemented** | API-backed |
| My materials list + detail | **Partial** | List/detail read; **no update/delete** |
| Add material | **Implemented** | Create + required image upload + price check + category/price-rule requests |
| Incoming reservations | **Partial** | Supplier accept/decline/complete only; reservations created via **seed**, not learner API |
| Pickup schedule | **Implemented** | API-backed (`supplier_pickup_schedule_api.dart`) |
| Mock repositories | **Not used** | `MockSupplier*Repository` files exist; providers wire API impl |

## Main user flow

1. Supplier logs in → redirect `/supplier` (dashboard).
2. Navigate via shell: materials, add material, reservations, pickup schedule, notifications, profile.
3. **Add material:** choose category → category-scoped material type/name autocomplete → price check → at least one image → `POST /api/supplier/materials`.
4. **Reservations:** review pending → accept with pickup window / decline / mark complete after pickup.
5. **Profile:** `PATCH /api/supplier/profile`, reverse geocode for location, change password via auth API.

Supplier API calls use the shared authenticated Dio client. When the access token expires, eligible Supplier JSON requests now refresh the token centrally through the auth/network layer and retry once. Material image uploads are not auto-retried because replaying multipart request bodies is unsafe; expired sessions during upload surface as an auth/API error.

Add-material uses category-scoped material type/name autocomplete backed by `GET /api/material-types?categoryId=&q=`. Suppliers can still type a custom `materialName`; selecting a reviewed type sends `materialTypeId` to price check only, while create continues to send `materialName` for backend material type/alias matching. `Listing title` remains display-only. The UI no longer asks for source type; backend derives `materials.sourceType` from `supplierProfile.supplierType` (`WORKSHOP` → `WORKSHOP_SURPLUS`, `FACTORY` → `FACTORY_SURPLUS`, `EDUCATIONAL_INSTITUTION` → `EDUCATIONAL_INSTITUTION`, `INDIVIDUAL_SUPPLIER` → `STUDENT_LEFTOVER`). The individual mapping is an MVP fallback and may need a more precise enum later.

**Pickup location on create:** Organization suppliers see a read-only profile pickup map; individual/student suppliers can use profile default or override per material. Backend always requires a profile default pickup, copies it into a dedicated `locations` row per material (or creates override row for individual/student). Organization suppliers cannot send `useDefaultPickupLocation: false` or `pickupLocation`.

## Frontend files

| Area | Path |
|------|------|
| Shell | `presentation/shell/supplier_shell.dart`, `supplier_sidebar.dart`, `supplier_mobile_nav.dart`, `supplier_nav_config.dart`, `supplier_top_bar.dart` |
| Pages | `presentation/pages/supplier_dashboard_page.dart`, `supplier_my_materials_page.dart`, `supplier_owned_material_detail_page.dart`, `add_material_page.dart`, `supplier_incoming_requests_page.dart`, `supplier_pickup_schedule_page.dart`, `supplier_notifications_page.dart`, `supplier_profile_page.dart`, `supplier_access_denied_page.dart` |
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
| Profile | `GET /profile`, `PATCH /profile` |
| Materials | `GET /materials`, `POST /materials` |
| Category requests | `POST/GET /category-requests`, `GET /category-requests/:id/draft` |
| Price rule requests | `GET /price-rule-requests`, `GET /price-rule-requests/:id/draft` |
| Reservations | `GET /reservations`, `PATCH /reservations/:id/accept|decline|complete` |
| Notifications | `GET /notifications` |
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

## Reusable components

- Shared: `AppMaterialCard` (where discovery-shaped data shown), material badges — see [reusable-widgets](../frontend/reusable-widgets.md)
- Supplier-specific: `SupplierMaterialCard`, dashboard charts, shell widgets — **not** for cross-feature reuse

## Known gaps / Needs verification

- **No** `PATCH/DELETE` supplier material endpoints.
- **Learner** cannot create reservations via API — test data from `prisma/seeds/seed-supplier-reservations.ts`.
- Accept reservation does **not** update `materials.status` to `RESERVED` in repository (only **complete** sets `REUSED`) — **Needs verification** if intentional.
- Delivery fields on `reservations` unused in supplier UI/API.
- `POST /api/price-rule-requests` has auth but no `SUPPLIER` role guard in route file.
