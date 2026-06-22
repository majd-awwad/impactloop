# Material Discovery Flow

**Sources inspected:** `materials_discovery_page.dart`, `material_details_page.dart`, `api_material_discovery_repository.dart`, `materials_discovery_view.dart`, `materials.service.ts`, `materials.repository.ts`

## Trigger

User navigates to **Material Discovery** (`/materials`) or opens a shared material link (`/materials/:id`).

---

## Flow — Browse list

### User path

1. Open `/materials`.
2. See hero, stats, search, category chips, quick filters, grid of cards.
3. Optionally type search or change filters (local).
4. Tap material → detail route.

### Frontend path

`MaterialsDiscoveryPage.initState` → `ApiMaterialDiscoveryRepository.getMaterials()` → `GET /api/materials` → unwrap `data.items` → `MaterialDiscoveryApiMapper` → `MaterialsDiscoveryView(materials)`.

Client filter: `_filteredMaterials` in `materials_discovery_view.dart` (search string, category index, quick filter index).

### Backend path

`listMaterials` → `materials.repository` query with category active + status in allowed set.

### Database changes

**None** (read-only). `views_count` increment — **Needs verification** on detail only.

### Success state

Grid renders `AppMaterialCard` rows; tap calls `onMaterialTap` → `context.go('/materials/$id')`.

### Error states

- Network/API error → error UI in page — **Needs verification** of exact widget path.
- Empty list → empty state copy from `material_discovery_content.dart`.
- Active filters with no matches → filtered empty state.

### Files involved

`materials_discovery_page.dart`, `api_material_discovery_repository.dart`, `material_discovery_api_mapper.dart`, `materials_discovery_view.dart`, `app_material_card.dart`, `materials.controller.ts`, `materials.repository.ts`

---

## Flow — Material detail

### Trigger

User opens `/materials/:id` or lands from home suggested materials.

### User path

View images, description, condition, price, status, supplier area summary → back to list.

### Frontend path

`MaterialDetailsPage` → `getMaterialById(id)` → `GET /api/materials/:id` → mapper → detail layout.

### Backend path

`getMaterial` by id with same visibility rules as list — **Needs verification** for single-item 404 when not public.

### Database changes

Read-only.

### Success state

Detail renders; 404 → null material handling in page.

### Error states

`ApiException` 404 → treated as null in repository (`getMaterialById`).

### Files involved

`material_details_page.dart`, `api_material_discovery_repository.dart`, `materials.controller.ts`

---

## Flow — Mock repository (tests / fallback)

### Status

`MockMaterialDiscoveryRepository` + `mock_materials.dart` exist; **not** default in production page (default is API).

### Trigger

Pass `repository:` override into `MaterialsDiscoveryPage` / `MaterialDetailsPage` (tests).

---

## Not implemented

- **Learner reservation** from detail screen — no `POST /api/reservations`.
- **Server-side search** from discovery filters.
- **Live map** distance browse.

---

## Open questions

- Which location fields are returned on public material DTOs?
- Is pagination exposed in the Flutter UI?
- Does detail view increment `materials.views_count`?
