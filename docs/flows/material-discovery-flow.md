# Material Discovery Flow

**Sources inspected:** `material_discovery_providers.dart`, `materials_discovery_page.dart`, `material_details_page.dart`, `api_material_discovery_repository.dart`, `materials_discovery_view.dart`, `materials.service.ts`, `materials.repository.ts`

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

`MaterialsDiscoveryPage` loads categories via `discoveryMaterialCategoriesProvider` and materials via `materialDiscoveryRepositoryProvider` → `ApiMaterialDiscoveryRepository.fetchMaterials(query)` → `GET /api/materials` with query params and optional auth → `MaterialDiscoveryApiMapper` → `MaterialsDiscoveryView`.

Filter changes rebuild `MaterialDiscoveryQuery` and refetch page 1. Load more increments `page` and appends items.

### Backend path

`listMaterials` → `materials.repository` with Prisma filters (`q`, `categoryId`, `condition`, `status`, `priceType`, `deliveryAvailable`, `pickupAllowed`, `city`, `area`, `sort`, `page`, `limit`).

### Database changes

**None** on list reads.

### Success state

Grid renders `AppMaterialCard` rows with optional **Popular** badge when `viewsCount >= 10` and read-only like counts.

### Error states

- Initial network/API error with no cached results → centered error state + **Try again**.
- Refetch error with cached results → inline retry banner while current results stay visible.
- Empty list without active filters → “No materials available yet.”
- Empty list with active search/filters → “No materials matched this combination yet.”

### Files involved

`material_discovery_providers.dart`, `materials_discovery_page.dart`, `api_material_discovery_repository.dart`, `material_discovery_api_mapper.dart`, `materials_discovery_view.dart`, `material_search_filters.dart`, `app_material_card.dart`, `materials.controller.ts`, `materials.repository.ts`

---

## Flow — Material detail

### Trigger

User opens `/materials/:id` or lands from home suggested materials.

### Frontend path

`MaterialDetailsPage` → `getMaterialById(id)` → `GET /api/materials/:id` → mapper → detail layout. The detail summary shows views, likes, and an authenticated learner like toggle. Reserve CTA unchanged.

### Backend path

`getMaterial` loads public material, records a material view, returns DTO with city/area only plus `likesCount` and viewer-specific `isLiked`.

### Database changes

Read + material view recording on successful detail fetch. Authenticated viewers are counted once per user/material; repeat opens by the same user do not create another `material_views` row or increment `viewsCount`. Guest opens still count per request because guests have no stable viewer identity.

Learner like/unlike uses `POST /api/materials/:id/like` and `DELETE /api/materials/:id/like`, both idempotent. These mutate `material_likes` and return `{ materialId, likesCount, isLiked }`.

### Success state

Detail renders views and likes; Popular badge when threshold met; location privacy panel explains map is future work.

### Error states

- 404 / material no longer public → “Material not found” + **Back to materials**.
- Network/server error → “Unable to load material details right now” + **Try again** and **Back to materials**.

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
