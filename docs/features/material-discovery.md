# Material Discovery Feature

**Sources inspected:** `apps/frontend/lib/features/material_discovery/`, `apps/backend/src/modules/materials/`, `docs/api/materials-api-contract.md`, `docs/backend/api-catalog.md`

## Purpose

Public browse and detail view of surplus materials available for reuse. Guests and authenticated users can search, filter, paginate, and open material details without logging in.

**Not in scope:** real public map pins, distance/nearest sort, similar materials, account-wide saved materials.

## Current status

| Layer | Status | Notes |
|-------|--------|-------|
| Backend `materials` (read) | **Implemented** | Server-side filters, pagination, `viewsCount`, `sort=newest\|popular` |
| Flutter `material_discovery` | **Implemented** | API-backed filters, Load more pagination, categories from API |
| Client search/filters | **Implemented** | Debounced refetch to `GET /api/materials` |
| Nearby map | **Not implemented** | Replaced with honest location/privacy panel |
| Learner reserve from detail | **Partial** | Quantity dialog + `POST /api/reservations`; see [reservations.md](reservations.md) |
| Report material | **Implemented** | Detail page only; unchanged in this slice |

List/detail DTOs include `quantity`, `availableQuantity`, `unit`, `viewsCount`, `pickupAllowed`, and approximate `city`/`area` only.

## Main user flow

1. User opens `/materials`.
2. Page loads categories (`GET /api/categories?type=MATERIAL`) and materials (`GET /api/materials` with query params).
3. Search/filters debounce or apply immediately → backend refetch from page 1.
4. **Load more** appends the next page when available.
5. Tap card → `/materials/:id` → `GET /api/materials/:id` (increments `viewsCount`).
6. Popular badge shows only when `viewsCount >= 10` (total detail views, not unique visitors).

## Frontend files

| Area | Path |
|------|------|
| Domain | `domain/discovery_material.dart`, `material_discovery_query.dart`, `material_discovery_result.dart`, `material_discovery_repository.dart`, `material_discovery_constants.dart` |
| Data | `data/api_material_discovery_repository.dart`, `material_discovery_api_mapper.dart`, `mock_material_discovery_repository.dart` |
| Pages | `presentation/pages/materials_discovery_page.dart`, `material_details_page.dart` |
| Views / widgets | `presentation/views/materials_discovery_view.dart`, `widgets/material_search_filters.dart`, `widgets/discovery_location_privacy_panel.dart`, `widgets/materials_hero_section.dart` |

**Also used from:** `features/home/application/home_suggested_materials_provider.dart` (first page subset).

## Backend files

| Area | Path |
|------|------|
| Module | `modules/materials/materials.routes.ts`, `materials.controller.ts`, `materials.service.ts`, `materials.repository.ts`, `materials.validation.ts` |
| Tests | `modules/materials/materials.discovery.test.ts` |

## API endpoints

| Method | Path | Auth | Used by discovery UI |
|--------|------|------|----------------------|
| GET | `/api/materials` | Public | Yes — filters + pagination |
| GET | `/api/materials/:id` | Public | Yes — increments `viewsCount` |
| GET | `/api/categories?type=MATERIAL` | Public | Yes — category chips |
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
- Similar materials and saved materials lists.
