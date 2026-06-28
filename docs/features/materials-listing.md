# Materials Listing (Shared Data Layer)

**Sources inspected:** `apps/frontend/lib/features/materials/`, `apps/frontend/lib/features/supplier_portal/presentation/pages/add_material_page.dart`, `apps/backend/src/modules/categories/`, `material-types/`, `materials/`, `uploads/`, `category-requests/`, `price-rule-requests/`, `docs/features/supplier-portal.md`, `docs/flows/supplier-material-listing-flow.md`, `docs/backend/api-catalog.md`

## Purpose

Shared Flutter **data infrastructure** (API clients, models, repository facade, Riverpod providers) for material taxonomy, listing policy, price validation, image upload, and optional category/price-rule request workflows.

`features/materials` is **not** a standalone learner feature. It has **no presentation layer and no routes**. Public browse lives in `material_discovery`; supplier owned-material CRUD lives in `supplier_portal`.

| Consumer | Shared usage |
|----------|----------------|
| `supplier_portal` | Add-material taxonomy (`materialCategoriesProvider`), listing policy, price-check, category/price-rule requests, upload DTOs, `CreateMaterialRequest` / `CreatedMaterial` |
| `material_discovery` | `discoveryMaterialCategoriesProvider` for discovery category chips only — **not** public list/detail fetch |
| `admin_portal` | `materialCategoriesProvider` for admin approval and category-related flows |

Public material browse (`GET /api/materials`, filters, pagination) stays in `material_discovery` via `ApiMaterialDiscoveryRepository`. Supplier create/update/delete stays on `/api/supplier/materials/*` via supplier portal repositories.

**Not in scope for this feature:** discovery list/detail UI, learner material create, supplier edit/delete screens, shared material cards (`shared/widgets/materials/`).

## Current status

| Area | Status | Notes |
|------|--------|-------|
| Flutter `features/materials` data layer | **Partial** | API clients + `MaterialListingRepository`; no presentation routes |
| Categories + material types | **Implemented** | Public read APIs wired |
| Listing policy + price check | **Implemented** | Used before paid create |
| Image upload | **Implemented** | `POST /api/uploads/material-images` (SUPPLIER); create requires 1-5 image URLs |
| Category requests | **Implemented** | Create + list + draft under `/api/supplier/category-requests` |
| Price rule requests | **Partial** | Create (`/api/price-rule-requests`) + supplier drafts; AI suggestion internal to backend |
| Material create (`POST /api/supplier/materials`) | **Implemented** | Via `supplier_materials_repository.dart`, with required `Idempotency-Key` |
| Material update/delete | **Implemented** | `PATCH` / `DELETE` `/api/supplier/materials/:id` via `supplier_my_materials_api.dart`; lifecycle-gated by material status and active reservation history |

## Relation to supplier material create

End-to-end create flow is documented in [supplier-material-listing-flow](../flows/supplier-material-listing-flow.md) and [supplier-portal](supplier-portal.md). This feature supplies the **preflight** steps:

```
AddMaterialPage
  → material_listing_providers.dart
  → MaterialListingRepository
      → categories, listing-policy, price-check
      → category-requests, price-rule-requests (optional)
      → material-images upload
  → supplier_materials_repository → POST /api/supplier/materials
```

**Pickup location** for create uses the supplier profile’s `defaultPickupLocation` (set on profile page) — not a separate field on `CreateMaterialRequest`. Backend assigns `locationId` from `supplierProfile.defaultPickupLocationId` (`supplier.service.ts`).

**Source type** is no longer supplied by the add-material UI. Backend derives `materials.sourceType` from `supplierProfile.supplierType`: `WORKSHOP` → `WORKSHOP_SURPLUS`, `FACTORY` → `FACTORY_SURPLUS`, `EDUCATIONAL_INSTITUTION` → `EDUCATIONAL_INSTITUTION`, and `INDIVIDUAL_SUPPLIER` → `STUDENT_LEFTOVER` as an MVP fallback. Legacy client `sourceType` values may still be accepted by validation but are ignored on create.

**Material type/name** uses a searchable combobox backed by `GET /api/material-types?categoryId=&q=`. Suppliers can still type a custom name. Selecting a reviewed type sends its `id` as `materialTypeId` for price checks, while create still sends `materialName`; backend create resolves the saved `materialTypeId` / `customMaterialType` server-side. The separate `title` field is display copy only.

## Main user flow (supplier add material)

1. Load categories, listing policy, optional pending category requests.
2. Choose a category, then search or type material type/name (`materialName`) within that category.
3. For paid listings: run price check (`POST /api/materials/price-check`).
4. If taxonomy/price unknown: submit category request and/or price rule request; later resume from draft query params.
5. Upload at least one draft image (`POST /api/uploads/material-images`).
6. Submit create via supplier API (uses uploaded `imageUrls` + taxonomy fields).

Add Material generates one idempotency key per form session and sends it as the `Idempotency-Key` header on final create. The key remains stable across failed retries and is regenerated only for a new/reset form session. Backend idempotency stores the request hash and successful material response under scope `SUPPLIER_CREATE_MATERIAL`, so duplicate clicks or repeated same-key POSTs do not create duplicate rows. The protection does not compare title/material name/category and therefore does not block legitimate similar listings.

## Frontend files

| Area | Path |
|------|------|
| Repository | `data/material_listing_repository.dart` |
| Providers | `application/material_listing_providers.dart` |
| APIs | `data/categories_api.dart`, `material_types_api.dart`, `material_listing_policy_api.dart`, `material_price_check_api.dart`, `category_requests_api.dart`, `price_rule_requests_api.dart`, `material_upload_api.dart`, `material_reports_api.dart` (public report endpoint; discovery detail consumer) |
| Models | `data/models/*` (`category.dart`, `material_type.dart`, `create_material_request.dart`, `created_material.dart`, `material_listing_policy.dart`, `material_price_check_*`, `category_request.dart`, `price_rule_request*.dart`, `material_draft_image.dart`, `material_price_rule.dart` — model retained; active rule lookup uses price-check in UI) |
| Primary consumer UI | `features/supplier_portal/presentation/pages/add_material_page.dart` + add-material widgets |
| Other consumers | `material_discovery` (category provider only), `admin_portal` (approvals categories) |

## Backend modules (separation)

| Module | Role |
|--------|------|
| `categories` | Taxonomy list; optional `discoveryOnly` filter for public browse chips |
| `material-types` | Type search; `GET /api/material-types/:id/price-rule` exists but add-material uses `POST /api/materials/price-check` |
| `materials` | Public read/list, listing policy, price-check, material reports |
| `category-requests` / `price-rule-requests` | Supplier approval workflows |
| `supplier` | Owned material create/update/delete and inventory facets |
| `uploads` | Multipart image storage (URLs persisted on create) |

## Backend files

| Module | Path | Role |
|--------|------|------|
| Categories | `modules/categories/*` | Material category list |
| Material types | `modules/material-types/*` | Search + active price rule |
| Materials | `modules/materials/*` | Listing policy, price-check |
| Uploads | `modules/uploads/*` | Multipart image storage |
| Category requests | `modules/category-requests/*` | Supplier category approval workflow |
| Price rule requests | `modules/price-rule-requests/*` | Create + AI-assisted review data |
| Supplier create | `modules/supplier/supplier.service.ts`, `supplier.repository.ts` | Persists material row |

## API endpoints

| Method | Path | Auth | Used by |
|--------|------|------|---------|
| GET | `/api/categories` | Public | Categories |
| GET | `/api/material-types` | Public | Type search |
| GET | `/api/material-types/:id/price-rule` | Public | Backend endpoint; Flutter add-material uses price-check instead |
| GET | `/api/materials/listing-policy` | Public | Policy caps/rules |
| POST | `/api/materials/price-check` | Bearer JWT | Paid listing validation |
| POST | `/api/uploads/material-images` | Bearer JWT + **SUPPLIER** | Image upload |
| POST | `/api/supplier/category-requests` | Bearer JWT + **SUPPLIER** | New category request |
| GET | `/api/supplier/category-requests` | Bearer JWT + **SUPPLIER** | List requests |
| GET | `/api/supplier/category-requests/:id/draft` | Bearer JWT + **SUPPLIER** | Resume draft |
| POST | `/api/price-rule-requests` | Bearer JWT (no explicit SUPPLIER role in route) | Price review request |
| GET | `/api/supplier/price-rule-requests` | Bearer JWT + **SUPPLIER** | List drafts |
| GET | `/api/supplier/price-rule-requests/:id/draft` | Bearer JWT + **SUPPLIER** | Resume draft |
| POST | `/api/supplier/materials` | Bearer JWT + **SUPPLIER** + `Idempotency-Key` | Final create (supplier module) |
| POST | `/api/materials/:id/reports` | Bearer JWT | Material report from discovery detail (`material_reports_api.dart`) |

Static: `GET /uploads/materials/*`

## Reservation Lifecycle Interaction

Learner reservation creation (`POST /api/reservations`) places a partial-quantity hold. Material status stays `AVAILABLE` while `availableQuantity > 0`; it may become `PENDING_RESERVATION` when all stock is held. Supplier accept keeps the hold without decrementing stock; supplier decline releases the hold; supplier complete subtracts `quantityRequested` and marks `REUSED` only when remaining quantity reaches `0`.

Supplier edit is blocked only for `REUSED` materials and when the new quantity is below active held amount. Delete still blocks materials with `PENDING` or `ACCEPTED` reservations and materials with `COMPLETED` reservation history.

## Database tables

| Table | Role |
|-------|------|
| `categories`, `material_types`, `material_price_rules` | Taxonomy and pricing |
| `materials`, `material_images`, `material_tags` | Created listing (via supplier create; at least one material image is required) |
| `category_requests` | Pending/approved category proposals + `listingDraftJson` |
| `price_rule_requests` | Pending price reviews + AI result JSON |
| `ai_price_lookup_logs` | Internal AI price lookups — **Needs verification** when written |
| `locations` | Linked via supplier `defaultPickupLocationId` on create |
| `idempotency_records` | Final create request keys, hashes, statuses, and stored successful responses |

## Reusable components

- **Shared widgets** (not in this feature): `AppMaterialCard`, material badges — see [reusable-widgets](../frontend/reusable-widgets.md)
- **Supplier-only UI**: add-material preview/verification cards under `supplier_portal/presentation/widgets/`

## Known gaps / Needs verification

- `POST /api/price-rule-requests` requires auth but **not** `requireRoles('SUPPLIER')` in route file.
- Moderator approval for category/price requests — **backend workflow**; no moderator UI.
- AI price suggestion operational only when `isAiProviderOperational` — env-dependent.
- Paid listings in “Other” category blocked server-side (`PAID_OTHER_NOT_ALLOWED`).
- Riverpod API providers are defined in `material_listing_repository.dart` alongside the repository — acceptable for now; optional follow-up to extract to `application/` or `data/providers.dart`.

## Related docs

- [Supplier portal](supplier-portal.md)
- [Supplier material listing flow](../flows/supplier-material-listing-flow.md)
- [Material discovery](material-discovery.md) — public browse, separate feature
