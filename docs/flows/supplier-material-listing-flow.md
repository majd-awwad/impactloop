# Supplier Material Listing Flow

**Sources inspected:** `add_material_page.dart`, `material_listing_providers.dart`, `features/materials/data/*`, `supplier.service.ts`, `supplier.controller.ts`, `category-requests.*`, `price-rule-requests.*`, `uploads.*`, `materials.service.ts`

## Trigger

Supplier chooses **Add material** (`/supplier/materials/new`) or resumes from approved request query params (`categoryRequestId`, `priceRuleRequestId`).

---

## Flow — Standard add material

### User path

1. Open add material form in supplier shell.
2. Choose a category, then select or type material type/name, listing title, condition, quantity, price/free, pickup options, and whether internal delivery is allowed.
3. Run price check (paid listings).
4. Upload at least one image.
5. Review pickup location — organization: read-only profile pickup; individual/student: profile default or optional per-material override.
6. Submit → material created → navigate to my materials or detail.

### Frontend path

`AddMaterialPage` → Riverpod providers:

- `material_listing_providers.dart` → categories, material type search, listing policy, price check
- `material_upload_api.dart` → `POST /api/uploads/material-images`
- `supplier_materials_repository.dart` → `POST /api/supplier/materials`
- Optional: `category_requests_api.dart`, `price_rule_requests_api.dart`

### Backend path

1. `GET /api/categories`, `GET /api/materials/listing-policy`
2. `GET /api/material-types?categoryId=&q=` for category-scoped combobox suggestions
3. `POST /api/materials/price-check` (authenticated; receives `materialName` and selected `materialTypeId` when available)
4. `POST /api/uploads/material-images` (SUPPLIER)
5. `POST /api/supplier/materials` → `supplier.service.createSupplierMaterial` → resolves material pickup location (copy or override) → `supplier.repository.createSupplierMaterial`

Pickup/body delivery fields: `pickupAllowed`, `deliveryAllowed`, `useDefaultPickupLocation` (default `true`), optional `pickupLocation` when false (individual/student only; organization override rejected).

May link `sourceCategoryRequestId` / `sourcePriceRuleRequestId` to mark request published.

`materialName` remains the create-contract field used for backend material type/alias matching. The Add Material UI now offers category-scoped autocomplete from active material types and aliases; selecting a result passes `materialTypeId` to price check only. `title` is display-only. `sourceType` is derived server-side from the supplier profile and legacy client values are ignored.

### Database changes

Insert/update:

- `materials`, `material_images`, `material_tags`
- `locations` — new row per material create (copy of profile default or override payload)
- `category_requests` / `price_rule_requests` → `publishedMaterialId`, `publishedAt` when sourced from request

### Success state

`CreatedMaterial` returned; UI shows success feedback; dashboard/materials providers invalidated.

### Error states

- Validation 400 → field errors on form
- Missing images → frontend block and backend create validation rejection
- Price above max allowed → price check / create rejection
- Upload failure → image section error
- 403 if not SUPPLIER

### Files involved

`add_material_page.dart`, `add_material_pickup_section.dart`, `material_listing_providers.dart`, `create_material_request.dart`, `supplier_materials_api.dart`, `supplier.service.ts`, `supplier.repository.ts`, `materials.service.ts` (price-check), `uploads.controller.ts`

---

## Flow — Category request (unknown category)

### Trigger

Supplier enables “request new category” on add material form.

### Path

`POST /api/supplier/category-requests` with `listingDraftJson` → pending moderator approval — **Backend workflow**; supplier may later resume via `GET .../draft` and query param `categoryRequestId`.

### Status

**Partial** — request + draft retrieval implemented; **moderator approval UI not implemented**.

---

## Flow — Price rule request (unknown type / price)

### Trigger

Material type not in taxonomy or price needs review.

### Path

`POST /api/price-rule-requests` → optional AI suggestion (`ai-price-suggestion.service.ts`) → supplier lists drafts via `GET /api/supplier/price-rule-requests/:id/draft`.

---

## Flow — My materials (read)

### User path

`/supplier/materials` → filter/search → tap row → `/supplier/materials/:id` detail. **Edit** (`/supplier/materials/:id/edit`) and **delete** available when API returns `canEdit` / `canDelete`.

### Frontend path

`supplier_my_materials_providers.dart` → `GET /api/supplier/materials` with query params. Edit/delete via `supplier_my_materials_api.dart`.

### Backend path

`supplier.service` list with owner scope. Responses include `canEdit`, `editBlockedReason`, `canDelete`, `deleteBlockedReason`.

### Database changes

Read-only for list/detail. `PATCH` updates safe material fields; `DELETE` removes material row when allowed.

---

## Flow — Edit material

### User path

Open edit from My Materials or detail when `canEdit`. Update title, description, quantity, unit, condition, pickup notes, pickup allowed. Save → `PATCH /api/supplier/materials/:id`.

### Eligibility

Allowed: `AVAILABLE`, `UNAVAILABLE` with no blocking reservations (`PENDING`, `ACCEPTED`, or `COMPLETED`). Blocked: `PENDING_RESERVATION`, `RESERVED`, `REUSED`, or any blocking reservation count.

### Not editable

Price, category, material type/name, images, pickup location, and status.

---

## Flow — Delete material

### User path

Delete from My Materials or detail when `canDelete` → confirm → `DELETE /api/supplier/materials/:id`.

### Eligibility

Same rules as edit.

---

## Open questions

- When does price-rule AI write to `ai_price_lookup_logs`?
- Organization supplier type: extra `organization_profiles` fields on create?
