# Material Discovery Feature

**Sources inspected:** `apps/frontend/lib/features/material_discovery/`, `apps/backend/src/modules/materials/`, `docs/api/materials-api-contract.md` (supplementary), `docs/backend/api-catalog.md`

## Purpose

Public browse and detail view of surplus materials available for reuse. Guests and authenticated users can search/filter client-side and open material details without logging in.

**Not in scope:** reserving materials, supplier management, map-based geo search (placeholder UI only).

## Current status

| Layer | Status | Notes |
|-------|--------|-------|
| Backend `materials` (read) | **Implemented** | `GET /api/materials`, `GET /api/materials/:id` |
| Flutter `material_discovery` | **Implemented** | Default `ApiMaterialDiscoveryRepository` |
| Client search/filters | **Frontend-only** | Applied in `materials_discovery_view.dart` on loaded list |
| Nearby map | **Frontend-only** | `nearby_map_placeholder.dart` — not API-backed |
| Learner reserve from detail | **Partial** | Quantity dialog + `POST /api/reservations`; see [reservations.md](reservations.md) |

List/detail DTOs include `quantity` (remaining physical stock) and `availableQuantity` (remaining minus active `PENDING`/`ACCEPTED` holds). Cards/detail show available stock when `availableQuantity > 0` even if some quantity is held.

## Main user flow

1. User opens `/materials` (from landing, nav, or supplier shell “browse”).
2. Page loads `GET /api/materials` → maps to `DiscoveryMaterial` list.
3. User searches/filters locally → taps card → `/materials/:id` → `GET /api/materials/:id`.
4. Empty/error states shown in view; optional injectable repository for tests (`MockMaterialDiscoveryRepository`).

## Frontend files

| Area | Path |
|------|------|
| Domain | `domain/discovery_material.dart`, `material_discovery_repository.dart` |
| Data | `data/api_material_discovery_repository.dart`, `material_discovery_api_mapper.dart`, `mock_material_discovery_repository.dart`, `mock_materials.dart` |
| Pages | `presentation/pages/materials_discovery_page.dart`, `material_details_page.dart` |
| Views / widgets | `presentation/views/materials_discovery_view.dart`, `widgets/material_search_filters.dart`, `materials_hero_section.dart`, `nearby_map_placeholder.dart` |
| Copy | `presentation/material_discovery_content.dart` |

**Also used from:** `features/home/application/home_suggested_materials_provider.dart` (API list subset).

## Backend files

| Area | Path |
|------|------|
| Module | `modules/materials/materials.routes.ts`, `materials.controller.ts`, `materials.service.ts`, `materials.repository.ts`, `materials.validation.ts` |
| Policy | `constants/material-listing-policy.ts` |

## API endpoints

| Method | Path | Auth | Used by discovery UI |
|--------|------|------|----------------------|
| GET | `/api/materials` | Public | Yes |
| GET | `/api/materials/:id` | Public | Yes |
| GET | `/api/materials/listing-policy` | Public | No (supplier listing flow) |
| POST | `/api/materials/price-check` | JWT | No (supplier add material) |

Public list filters (from `materials.repository.ts`): active categories with `categoryType` MATERIAL or BOTH; default statuses `AVAILABLE`, `PENDING_RESERVATION`, `RESERVED` (query can narrow).

## Database tables

| Table | Role |
|-------|------|
| `materials` | Core listing |
| `material_images` | Cover/gallery URLs |
| `material_tags` | Optional tags |
| `categories` | Category name/type filter |
| `locations` | Linked to material; public response shape — **Needs verification** for privacy redaction |
| `users`, `supplier_profiles` | Owner display — **Needs verification** of fields exposed |

## Reusable components

From `shared/widgets/materials/`:

- `AppMaterialCard` — primary card (route-independent)
- `MaterialStatusBadge`, `MaterialConditionBadge`, `MaterialPriceBadge`
- `MaterialsUiPalette`

App-level: `EntryNavBar` on discovery pages.

## Known gaps / Needs verification

- Search/category chips are **client-side only**; API query params on discovery page not wired — **Needs verification** if `materialsQuerySchema` supports same filters for future server-side search.
- `nearby_map_placeholder.dart` is not PostGIS-backed.
- Pagination: API returns paginated `items`; discovery page loads one page — **Needs verification** of pagination UI.
- `REUSED` / `UNAVAILABLE` materials excluded from public list per repository filter.
- Supplementary contract doc: `docs/api/materials-api-contract.md` — align with api-catalog when response shapes change.
