# Supplier Material Listing Flow

**Sources inspected:** `add_material_page.dart`, `material_listing_providers.dart`, `features/materials/data/*`, `supplier.service.ts`, `supplier.controller.ts`, `category-requests.*`, `price-rule-requests.*`, `uploads.*`, `materials.service.ts`

## Trigger

Supplier chooses **Add material** (`/supplier/materials/new`) or resumes from approved request query params (`categoryRequestId`, `priceRuleRequestId`).

---

## Flow — Standard add material

### User path

1. Open add material form in supplier shell.
2. Select category, material type/name, condition, quantity, price/free, source type, pickup options.
3. Run price check (paid listings).
4. Upload images.
5. Set pickup location (map / reverse geocode).
6. Submit → material created → navigate to my materials or detail.

### Frontend path

`AddMaterialPage` → Riverpod providers:

- `material_listing_providers.dart` → categories, listing policy, material types, price check
- `material_upload_api.dart` → `POST /api/uploads/material-images`
- `supplier_materials_repository.dart` → `POST /api/supplier/materials`
- `locations_api.dart` → `POST /api/locations/reverse-geocode` when coordinates used
- Optional: `category_requests_api.dart`, `price_rule_requests_api.dart`

### Backend path

1. `GET /api/categories`, `GET /api/material-types`, `GET /api/materials/listing-policy`
2. `POST /api/materials/price-check` (authenticated)
3. `POST /api/uploads/material-images` (SUPPLIER)
4. `POST /api/supplier/materials` → `supplier.service.createMaterial` → `supplier.repository.createSupplierMaterial`

May link `sourceCategoryRequestId` / `sourcePriceRuleRequestId` to mark request published.

### Database changes

Insert/update:

- `materials`, `material_images`, `material_tags` (if any)
- `locations` (if new location created inline — **Needs verification**)
- `category_requests` / `price_rule_requests` → `publishedMaterialId`, `publishedAt` when sourced from request

### Success state

`CreatedMaterial` returned; UI shows success feedback; dashboard/materials providers invalidated.

### Error states

- Validation 400 → field errors on form
- Price above max allowed → price check / create rejection
- Upload failure → image section error
- 403 if not SUPPLIER

### Files involved

`add_material_page.dart`, `material_listing_providers.dart`, `create_material_request.dart`, `supplier_materials_api.dart`, `supplier.service.ts`, `supplier.repository.ts`, `materials.service.ts` (price-check), `uploads.controller.ts`

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

`/supplier/materials` → filter/search → tap row → `/supplier/materials/:id` detail (read-only).

### Frontend path

`supplier_my_materials_providers.dart` → `GET /api/supplier/materials` with query params.

### Backend path

`supplier.service` list with owner scope.

### Database changes

Read-only.

---

## Not implemented

- Edit or delete existing material via API/UI.
- Learner-facing publish moderation in Flutter.

---

## Open questions

- Exact payload for `CreateMaterialRequest` and required location fields?
- When does price-rule AI write to `ai_price_lookup_logs`?
- Organization supplier type: extra `organization_profiles` fields on create?
