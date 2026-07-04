# Locations Feature

**Sources inspected:** `apps/backend/src/modules/locations/`, `apps/backend/src/services/reverse-geocoding.service.ts`, `apps/backend/src/modules/supplier/supplier.validation.ts`, `supplier.service.ts`, `supplier.repository.ts`, `materials.service.ts`, `apps/frontend/lib/features/supplier_portal/data/locations_api.dart`, `supplier_profile_page.dart`, `add_material_page.dart`, `apps/backend/prisma/schema.prisma` (`Location` model), `docs/backend/api-catalog.md`, `docs/database/tables-catalog.md`

## Purpose

Store and use **pickup/business locations** for suppliers/materials, plus authenticated user saved locations for discovery distance sorting. The standalone locations API now covers authenticated forward/reverse geocoding and private saved-location CRUD.

Supplier pickup/business locations are **created/updated inline** through supplier profile PATCH and referenced when creating materials. User saved locations are private rows owned by the authenticated user and are not exposed through public discovery DTOs.

## Current status

| Area | Status | Notes |
|------|--------|-------|
| `locations` table + PostGIS column | **Implemented** | Schema + supplier/material relations |
| Reverse geocode API | **Implemented** | `POST /api/locations/reverse-geocode` |
| Forward geocode API | **Implemented** | `POST /api/locations/geocode` resolves typed city/area/address into coordinates for authenticated private location forms |
| Saved locations CRUD API | **Implemented** | `GET/POST/PATCH/DELETE /api/locations/saved`; private to authenticated owner |
| Saved locations management UI | **Implemented** | Authenticated `/profile/locations` screen lists, creates, edits, deletes, sets default saved locations, geocodes typed addresses, and lets users pick exact coordinates on a map |
| Supplier profile location | **Implemented** | `defaultPickupLocation` on `PATCH /api/supplier/profile` |
| Material create location | **Implemented** | Copies profile default or optional per-material override (individual/student only); never reuses profile row |
| Public discovery location fields | **Implemented** | List returns `city`, `area`, privacy-safe `approximateLatitude`/`approximateLongitude`, and `approximateDistanceKm` when available; detail returns `city` + `area` only — no exact lat/lng/address or `pickupNotes` |
| Public nearest-first sorting | **Implemented** | `GET /api/materials?sort=nearest` accepts viewer lat/lng or authenticated `savedLocationId`; distance is computed server-side |
| Reservation/delivery precise reveal | **Out of scope here** | Not changed by this feature slice; public Materials Discovery stays redacted before reservation/delivery |
| Public redaction / visibility enforcement | **Implemented for Materials Discovery** | Public material list/detail omit exact coordinates/address and pickup notes; non-material public APIs still need separate review |

## Main user flow

1. Supplier opens profile → sets pickup location (map pin or manual fields).
2. On coordinate change, Flutter calls reverse geocode → fills city/area/address fields.
3. Supplier saves profile → backend upserts `locations` row, links `supplier_profiles.default_pickup_location_id`.
4. Supplier adds material → pickup UI depends on `supplierType`:
   - **Organization** (WORKSHOP / FACTORY / EDUCATIONAL_INSTITUTION): read-only profile pickup preview; backend copies profile location into a new `locations` row for the material.
   - **Individual / student**: default copies profile pickup; optional per-material override creates a separate `locations` row (`useDefaultPickupLocation: false` + `pickupLocation`).

Profile edits do **not** retroactively change existing material pickup rows because each create copies or creates a dedicated material location.

## Frontend files

| Area | Path |
|------|------|
| API | `supplier_portal/data/locations_api.dart` |
| Model | `supplier_portal/data/models/reverse_geocode_result.dart` |
| Profile usage | `supplier_portal/presentation/pages/supplier_profile_page.dart`, `supplier_profile_form.dart`, `supplier_location_input_mode.dart`, `supplier_pickup_map.dart` |
| Add material pickup | `supplier_portal/presentation/pages/add_material_page.dart`, `add_material_pickup_section.dart`, `supplier_pickup_map_preview.dart` |
| Repository | `supplier_portal/data/supplier_profile_repository.dart` (`reverseGeocode`) |
| State enum | `supplier_portal/presentation/widgets/supplier_reverse_geocode_state.dart` |
| Saved locations UI | `features/locations/presentation/pages/saved_locations_page.dart` |
| Saved locations data/state | `features/locations/data/saved_locations_api.dart`, `features/locations/data/saved_location.dart`, `features/locations/application/saved_locations_providers.dart` |

`features/locations` contains the saved-location API client, forward/reverse geocode calls, mutation controller, management page, and the read provider used by Materials Discovery. The management UI is under authenticated Profile navigation because exact address and coordinates are private account data.

## Backend files

| Area | Path |
|------|------|
| Locations module | `modules/locations/locations.routes.ts`, `.controller.ts`, `.service.ts`, `.validation.ts` |
| Saved locations repository | `modules/locations/locations.repository.ts` |
| Geocoding | `services/reverse-geocoding.service.ts` (Nominatim, cache, rate limit) |
| Profile upsert | `modules/supplier/supplier.repository.ts` (`upsertLocation`, profile PATCH) |
| Material create pickup | `modules/supplier/supplier.service.ts` (`resolveMaterialPickupLocationId`), `supplier.repository.ts` (`copyLocationRow`, `createMaterialPickupLocation`) |
| Public material mapper | `modules/materials/materials.service.ts` (`mapMaterial` + detail fields — city/area only; free-form pickup notes are redacted) |
| Supplier-owned material mapper | `modules/supplier/supplier.service.ts` (`mapLocation` — full fields for owner) |

## API endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/locations/reverse-geocode` | Bearer JWT | Body: `{ latitude, longitude }` |
| POST | `/api/locations/geocode` | Bearer JWT | Body: `{ country?, city, area?, addressLine? }`; returns private coordinates + readable fields |
| GET | `/api/locations/saved` | Bearer JWT | List private saved locations for current user |
| POST | `/api/locations/saved` | Bearer JWT | Create private saved location |
| PATCH | `/api/locations/saved/:id` | Bearer JWT | Update own saved location |
| DELETE | `/api/locations/saved/:id` | Bearer JWT | Delete own saved location |

Location persistence is via:

| Method | Path | Auth |
|--------|------|------|
| PATCH | `/api/supplier/profile` | Bearer JWT + **SUPPLIER** | Includes `defaultPickupLocation` object |

Material create (`POST /api/supplier/materials`) pickup fields:

| Field | Type | Notes |
|-------|------|-------|
| `useDefaultPickupLocation` | boolean | Default `true` |
| `pickupLocation` | location object | Required when `useDefaultPickupLocation` is `false`; rejected for organization supplier types |

Public material discovery:

| Method | Path | Location in response |
|--------|------|----------------------|
| GET | `/api/materials` | `city`, `area`, optional approximate coordinates/distance; no `addressLine`, exact latitude/longitude, location object, supplier private location object, or `pickupNotes` |
| GET | `/api/materials/:id` | `city`, `area` only; no coordinates, `addressLine`, location object, supplier private location object, or `pickupNotes` |

`GET /api/materials` list items may additionally include privacy-safe `approximateLatitude`, `approximateLongitude`, and `approximateDistanceKm`. These are rounded approximate values for map pins and nearest sorting, not exact stored coordinates. `GET /api/materials/:id` continues to omit coordinates.

## Database tables

| Table / field | Role |
|---------------|------|
| `locations` | `country`, `city`, `area`, `address_line`, `latitude`, `longitude`, PostGIS `location`, `visibility`, `is_approximate`, `location_type` |
| `supplier_profiles.default_pickup_location_id` | Default pickup for listings |
| `organization_profiles` | Optional `business_location` relation |
| `materials.location_id` | Pickup location per listing (copied or override row; not the profile row) |
| `user_saved_locations` | Private saved-location ownership rows linking `users` to `locations` with `label` and `is_default` |

`visibility` enum in validation: `PUBLIC`, `ORDER_ONLY`, `PRIVATE` (`supplier.validation.ts`).

## Reusable components

- `supplier_pickup_map.dart`, `supplier_pickup_map_preview.dart` — supplier portal only
- `HeroWorkshopVisual` / landing — unrelated to locations API

## Known gaps / future work

- No GPS/current-location permission flow for creating saved locations; users enter city/area and optional exact address/coordinates manually, geocode typed address text, or pick a point on the map.
- Typed city-only geocoding resolves to the provider's best match, which may be a city center rather than an exact doorway. Users should add area/street details or refine with the map for exact saved coordinates.
- No current-location delivery request from device GPS.
- Forward/reverse geocode requires external Nominatim — env/network dependent (`reverse-geocoding.service.ts`).
- Reservation/delivery precise-location reveal behavior is not part of this Materials Discovery + saved locations slice.

## Related docs

- [Supplier portal](supplier-portal.md)
- [Materials listing](materials-listing.md)
