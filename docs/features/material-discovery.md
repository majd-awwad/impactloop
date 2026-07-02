# Material Discovery Feature

**Sources inspected:** `apps/frontend/lib/features/material_discovery/`, `apps/backend/src/modules/materials/`, `docs/api/materials-api-contract.md`, `docs/backend/api-catalog.md`

## Purpose

Public browse and detail view of surplus materials available for reuse. Guests and authenticated users can search, filter, paginate, and open material details without logging in.

**Not in current shipped scope:** real public map pins, distance/nearest sort, similar materials, material-to-project suggestions, account-wide saved materials, project likes, and follows.

## Current status

| Layer | Status | Notes |
|-------|--------|-------|
| Backend `materials` (read) | **Implemented** | Server-side filters, pagination, `viewsCount`, `likesCount`, `isLiked`, `sort=newest\|popular` |
| Flutter `material_discovery` | **Implemented** | API-backed filters, Load more pagination, categories from API |
| Client search/filters | **Implemented** | Debounced refetch to `GET /api/materials` |
| Browse/detail error states | **Implemented** | Initial load retry, filtered/no-materials empty states, detail 404 and retry/back actions |
| Nearby map | **Not implemented** | Replaced with honest location/privacy panel |
| Learner reserve from detail | **Partial** | Quantity dialog + `POST /api/reservations`; see [reservations.md](reservations.md) |
| Learner material likes | **Implemented** | Detail-page optimistic like toggle + read-only list/home/related-card counts |
| Report material | **Implemented** | Detail page only; unchanged in this slice |

List/detail DTOs include `quantity`, `availableQuantity`, `unit`, `viewsCount`, `likesCount`, `isLiked`, `pickupAllowed`, `imageUrl` / `primaryImageUrl` (URL or object-key reference only — never binary blobs in PostgreSQL), and approximate `city`/`area` only.

## Images

- Material images are stored in `material_images` with `imageUrl` (HTTP URL or `/uploads/...` object key), `sortOrder`, `isCover`, and `materialId` only.
- Public list/detail DTOs expose the cover image when present, otherwise the first ordered image as `primaryImageUrl` (alias `imageUrl`).
- Flutter resolves relative paths via `ApiConfig.resolveMediaUrl()` and shows a category-based gradient/icon fallback when no image exists or loading fails.
- **Local dev uploads:** `imageUrl` values like `/uploads/materials/<file>` are served by Express static middleware from `apps/backend/uploads/materials/`. If the DB row exists but the file is missing on disk, the UI shows the category fallback (not an error state).

## Category display (discovery)

- Discovery category chips load via shared `discoveryMaterialCategoriesProvider` in `features/materials` → `GET /api/categories?type=MATERIAL&rootOnly=true&discoveryOnly=true`.
- When `discoveryOnly=true`, the **backend** filters out internal/test/admin-looking names (bracketed labels, `test`, `admin`, `approvals`) and dedupes by normalized English label (`category-discovery-filter.ts`). There is **no** client-side category filtering in production discovery UI.
- Supplier/admin listing flows use `materialCategoriesProvider` (same endpoint **without** `discoveryOnly`) and receive the full active category list.
- Discovery UI shows a compact row: **All**, up to 8 visible categories (`discoveryVisibleCategoryCount` in `material_discovery_constants.dart`), and **More** for the rest in a constrained scroll panel.
- Material list filtering still uses `categoryId` server-side via `ApiMaterialDiscoveryRepository`.

## Main user flow

1. User opens `/materials`.
2. Page loads categories (`GET /api/categories?type=MATERIAL&rootOnly=true&discoveryOnly=true`) and materials (`GET /api/materials` with query params).
3. Search/filters debounce or apply immediately → backend refetch from page 1.
4. **Load more** appends the next page when available.
5. Tap card → `/materials/:id` → `GET /api/materials/:id` (writes `material_views` and increments `viewsCount` once per authenticated user/material; guest opens count per request).
6. Authenticated learners can like/unlike the material on detail (`POST`/`DELETE /api/materials/:id/like`); own-material likes are allowed.
7. Popular badge shows only when `viewsCount >= 10`.

Browse states:
- Initial network/server failure shows a centered error state with **Try again**.
- Empty list without active filters shows “No materials available yet.”
- Empty list with active filters/search shows “No materials matched this combination yet.”
- Refetch failure after cached results shows an inline retry banner while keeping the current results.

Detail states:
- Backend 404 / not found maps to a material-not-found state with **Back to materials**.
- Network/server failure maps to an error state with **Try again** and **Back to materials**.

## Frontend files

| Area | Path |
|------|------|
| Domain | `domain/discovery_material.dart`, `material_discovery_query.dart`, `material_discovery_result.dart`, `material_discovery_repository.dart`, `material_discovery_constants.dart` |
| Shared data (categories only) | `features/materials/application/material_listing_providers.dart` — `discoveryMaterialCategoriesProvider`; `features/materials/data/categories_api.dart` and `models/category.dart` |
| Data | `data/api_material_discovery_repository.dart`, `material_discovery_api_mapper.dart`, `mock_material_discovery_repository.dart` |
| Pages | `presentation/pages/materials_discovery_page.dart`, `material_details_page.dart` |
| Views / widgets | `presentation/views/materials_discovery_view.dart`, `widgets/material_search_filters.dart`, `widgets/discovery_category_picker.dart`, `widgets/discovery_location_privacy_panel.dart`, `widgets/materials_hero_section.dart` |

**Also used from:** `features/home/application/home_suggested_materials_provider.dart` (first page subset).

**Routes:** `/materials` and `/materials/:id` belong to this feature only — not to `features/materials`.

**Report material:** detail page calls `materialReportsApiProvider` from `features/materials/data/material_reports_api.dart` (`POST /api/materials/:id/reports`).

## Backend files

| Area | Path |
|------|------|
| Public read / policy / price-check / reports | `modules/materials/materials.routes.ts`, `materials.controller.ts`, `materials.service.ts`, `materials.repository.ts`, `materials.validation.ts` |
| Discovery category filter | `modules/categories/category-discovery-filter.ts` |
| Tests | `modules/materials/materials.discovery.test.ts`, `modules/categories/category-discovery-filter.test.ts` |

## API endpoints

| Method | Path | Auth | Used by discovery UI |
|--------|------|------|----------------------|
| GET | `/api/materials` | Public | Yes — filters + pagination |
| GET | `/api/materials/:id` | Public | Yes — records material views |
| POST | `/api/materials/:id/like` | JWT + LEARNER | Yes — detail like toggle |
| DELETE | `/api/materials/:id/like` | JWT + LEARNER | Yes — detail unlike toggle |
| GET | `/api/categories?discoveryOnly=true` | Public | Yes — discovery category chips only |
| GET | `/api/categories` | Public | Supplier/admin category pickers (unfiltered) |
| GET | `/api/materials/listing-policy` | Public | No (supplier listing) |
| POST | `/api/materials/price-check` | JWT | No (supplier add material) |
| POST | `/api/materials/:id/reports` | JWT | Yes (detail report CTA) |

## Location privacy

- Public discovery exposes **city** and **area** only.
- Exact pickup address/coordinates are **not** returned on public list/detail.
- Accepted learner reservations may expose full pickup location through reservation APIs.
- Map browse and distance sort require safe approximate coordinates and remain future work.

## Known gaps / future work

- Bilingual material titles/descriptions (backend has single `title`/`description` today).
- Real map with privacy-safe approximate pins.
- Distance / nearest-first sort.
- Similar materials, saved materials, follows, project likes, and supplier/category follow signals.
- "Projects you can build with this material" suggestions.
- Database `isPublic` category flag to replace discovery name-pattern filtering.
