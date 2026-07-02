# Material Discovery Flow

**Sources inspected:** `materials_discovery_page.dart`, `material_details_page.dart`, `api_material_discovery_repository.dart`, `materials_discovery_view.dart`, `materials.service.ts`, `materials.repository.ts`

## Trigger

User navigates to **Material Discovery** (`/materials`) or opens a shared material link (`/materials/:id`).

---

## Flow — Browse list

### User path

1. Open `/materials`.
2. See hero, search, category chips (from API), quick filters, sort, condition, city/area fields, and material grid.
3. Change search or filters → debounced or immediate backend refetch from page 1.
4. Tap **Load more** to append the next page.
5. Tap material → detail route.

### Frontend path

`MaterialsDiscoveryPage` loads categories via `materialCategoriesProvider` and materials via `ApiMaterialDiscoveryRepository.fetchMaterials(query)` → `GET /api/materials` with query params → `MaterialDiscoveryApiMapper` → `MaterialsDiscoveryView`.

Filter changes rebuild `MaterialDiscoveryQuery` and refetch page 1. Load more increments `page` and appends items.

### Backend path

`listMaterials` → `materials.repository` with Prisma filters (`q`, `categoryId`, `condition`, `status`, `priceType`, `deliveryAvailable`, `pickupAllowed`, `city`, `area`, `sort`, `page`, `limit`).

### Database changes

**None** on list reads.

### Success state

Grid renders `AppMaterialCard` rows with optional **Popular** badge when `viewsCount >= 10`.

### Error states

- Network/API error → centered error message when no cached results.
- Empty list → empty state copy from `material_discovery_content.dart`.

### Files involved

`materials_discovery_page.dart`, `api_material_discovery_repository.dart`, `material_discovery_api_mapper.dart`, `materials_discovery_view.dart`, `material_search_filters.dart`, `app_material_card.dart`, `materials.controller.ts`, `materials.repository.ts`

---

## Flow — Material detail

### Trigger

User opens `/materials/:id` or lands from home suggested materials.

### Frontend path

`MaterialDetailsPage` → `getMaterialById(id)` → `GET /api/materials/:id` → mapper → detail layout. Reserve CTA unchanged.

### Backend path

`getMaterial` loads public material, increments `viewsCount`, returns DTO with city/area only.

### Database changes

Read + `viewsCount` increment on successful detail fetch.

### Success state

Detail renders views count; Popular badge when threshold met; location privacy panel explains map is future work.

---

## Location privacy panel

`DiscoveryLocationPrivacyPanel` replaces the old map placeholder. Copy states map browsing is coming later and public results show city/area until reservation acceptance.

---

## Not implemented

- Real public map pins.
- Distance / nearest-first browse.
- Similar materials.
- Account-wide saved materials.

---

## Open questions

None for this slice. Bilingual material fields remain a future schema/API improvement.
