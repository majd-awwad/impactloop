# Materials Listing (Shared Data Layer)

**Sources inspected:** `apps/frontend/lib/features/materials/`, `apps/frontend/lib/features/supplier_portal/presentation/pages/add_material_page.dart`, `apps/backend/src/modules/categories/`, `material-types/`, `materials/`, `uploads/`, `category-requests/`, `price-rule-requests/`, `docs/features/supplier-portal.md`, `docs/flows/supplier-material-listing-flow.md`, `docs/backend/api-catalog.md`

## Purpose

Shared Flutter **data layer** and Riverpod providers that power **supplier material create** (add-material flow). Supplies taxonomy, listing policy, price validation, image upload, and optional category/price-rule request workflows.

The `materials` feature folder has **no routes** — it is consumed by `supplier_portal` only. It does **not** feed the `material_discovery` repository or `ApiMaterialDiscoveryRepository`. Any overlap with discovery UI is limited to shared widgets, models, or patterns where applicable (e.g. `AppMaterialCard`), not this data layer.

**Not in scope:** public material discovery (`material_discovery` feature), learner material create, material image/location/price/category edit on update.

## Current status

| Area | Status | Notes |
|------|--------|-------|
| Flutter `features/materials` data layer | **Partial** | API clients + `MaterialListingRepository`; no presentation routes |
| Categories + material types | **Implemented** | Public read APIs wired |
| Listing policy + price check | **Implemented** | Used before paid create |
| Image upload | **Implemented** | `POST /api/uploads/material-images` (SUPPLIER); create requires 1-5 image URLs |
| Category requests | **Implemented** | Create + list + draft under `/api/supplier/category-requests` |
| Price rule requests | **Partial** | Create (`/api/price-rule-requests`) + supplier drafts; AI suggestion internal to backend |
| Material create (`POST /api/supplier/materials`) | **Implemented** | Via `supplier_materials_repository.dart`, not in this feature folder |
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

## Frontend files

| Area | Path |
|------|------|
| Repository | `data/material_listing_repository.dart` |
| Providers | `application/material_listing_providers.dart` |
| APIs | `data/categories_api.dart`, `material_types_api.dart`, `material_listing_policy_api.dart`, `material_price_check_api.dart`, `category_requests_api.dart`, `price_rule_requests_api.dart`, `material_upload_api.dart` |
| Models | `data/models/*` (`category.dart`, `material_type.dart`, `create_material_request.dart`, `created_material.dart`, `material_listing_policy.dart`, `material_price_check_*`, `category_request.dart`, `price_rule_request*.dart`, `material_draft_image.dart`) |
| Consumer UI | `features/supplier_portal/presentation/pages/add_material_page.dart` + add-material widgets |

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
| GET | `/api/material-types/:id/price-rule` | Public | Active rule lookup |
| GET | `/api/materials/listing-policy` | Public | Policy caps/rules |
| POST | `/api/materials/price-check` | Bearer JWT | Paid listing validation |
| POST | `/api/uploads/material-images` | Bearer JWT + **SUPPLIER** | Image upload |
| POST | `/api/supplier/category-requests` | Bearer JWT + **SUPPLIER** | New category request |
| GET | `/api/supplier/category-requests` | Bearer JWT + **SUPPLIER** | List requests |
| GET | `/api/supplier/category-requests/:id/draft` | Bearer JWT + **SUPPLIER** | Resume draft |
| POST | `/api/price-rule-requests` | Bearer JWT (no explicit SUPPLIER role in route) | Price review request |
| GET | `/api/supplier/price-rule-requests` | Bearer JWT + **SUPPLIER** | List drafts |
| GET | `/api/supplier/price-rule-requests/:id/draft` | Bearer JWT + **SUPPLIER** | Resume draft |
| POST | `/api/supplier/materials` | Bearer JWT + **SUPPLIER** | Final create (supplier module) |

Static: `GET /uploads/materials/*`

## Reservation Lifecycle Interaction

Learner reservation creation (`POST /api/reservations`) moves a material from `AVAILABLE` to `PENDING_RESERVATION`. Supplier accept moves it to `RESERVED`; supplier reject returns it to `AVAILABLE` when no other active reservation exists; supplier complete moves it to `REUSED`.

Supplier edit/delete eligibility blocks `PENDING_RESERVATION`, `RESERVED`, and `REUSED` materials, and also blocks materials with `PENDING`, `ACCEPTED`, or `COMPLETED` reservations.

## Database tables

| Table | Role |
|-------|------|
| `categories`, `material_types`, `material_price_rules` | Taxonomy and pricing |
| `materials`, `material_images`, `material_tags` | Created listing (via supplier create; at least one material image is required) |
| `category_requests` | Pending/approved category proposals + `listingDraftJson` |
| `price_rule_requests` | Pending price reviews + AI result JSON |
| `ai_price_lookup_logs` | Internal AI price lookups — **Needs verification** when written |
| `locations` | Linked via supplier `defaultPickupLocationId` on create |

## Reusable components

- **Shared widgets** (not in this feature): `AppMaterialCard`, material badges — see [reusable-widgets](../frontend/reusable-widgets.md)
- **Supplier-only UI**: add-material preview/verification cards under `supplier_portal/presentation/widgets/`

## Known gaps / Needs verification

- `POST /api/price-rule-requests` requires auth but **not** `requireRoles('SUPPLIER')` in route file.
- Moderator approval for category/price requests — **backend workflow**; no moderator UI.
- AI price suggestion operational only when `isAiProviderOperational` — env-dependent.
- Paid listings in “Other” category blocked server-side (`PAID_OTHER_NOT_ALLOWED`).

## Related docs

- [Supplier portal](supplier-portal.md)
- [Supplier material listing flow](../flows/supplier-material-listing-flow.md)
- [Material discovery](material-discovery.md) — public browse, separate feature
