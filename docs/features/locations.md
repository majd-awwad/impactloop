# Locations Feature

**Sources inspected:** `apps/backend/src/modules/locations/`, `apps/backend/src/services/reverse-geocoding.service.ts`, `apps/backend/src/modules/supplier/supplier.validation.ts`, `supplier.service.ts`, `supplier.repository.ts`, `materials.service.ts`, `apps/frontend/lib/features/supplier_portal/data/locations_api.dart`, `supplier_profile_page.dart`, `add_material_page.dart`, `apps/backend/prisma/schema.prisma` (`Location` model), `docs/backend/api-catalog.md`, `docs/database/tables-catalog.md`

## Purpose

Store and use **pickup/business locations** for suppliers and materials. The only **standalone locations API** today is authenticated **reverse geocoding** (coordinates → city/area/address text via Nominatim).

Locations are **created/updated inline** through supplier profile PATCH and referenced when creating materials — there is **no** public locations CRUD router.

## Current status

| Area | Status | Notes |
|------|--------|-------|
| `locations` table + PostGIS column | **Implemented** | Schema + supplier/material relations |
| Reverse geocode API | **Implemented** | `POST /api/locations/reverse-geocode` |
| Locations CRUD API | **Not implemented** | No `GET/POST/PATCH /api/locations` |
| Supplier profile location | **Implemented** | `defaultPickupLocation` on `PATCH /api/supplier/profile` |
| Material create location | **Implemented** | Copies profile default or optional per-material override (individual/student only); never reuses profile row |
| Public discovery location fields | **Partial** | API returns `city` + `area` only — no lat/lng/address |
| Public redaction / visibility enforcement | **Needs verification** | `visibility`, `isApproximate` stored; public `mapMaterial` does not expose coordinates but redaction rules not centrally documented in code |

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

**No** dedicated `features/locations` Flutter folder.

## Backend files

| Area | Path |
|------|------|
| Locations module | `modules/locations/locations.routes.ts`, `.controller.ts`, `.service.ts`, `.validation.ts` |
| Geocoding | `services/reverse-geocoding.service.ts` (Nominatim, cache, rate limit) |
| Profile upsert | `modules/supplier/supplier.repository.ts` (`upsertLocation`, profile PATCH) |
| Material create pickup | `modules/supplier/supplier.service.ts` (`resolveMaterialPickupLocationId`), `supplier.repository.ts` (`copyLocationRow`, `createMaterialPickupLocation`) |
| Public material mapper | `modules/materials/materials.service.ts` (`mapMaterial` — city/area only) |
| Supplier-owned material mapper | `modules/supplier/supplier.service.ts` (`mapLocation` — full fields for owner) |

## API endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/locations/reverse-geocode` | Bearer JWT | Body: `{ latitude, longitude }` |

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
| GET | `/api/materials`, `GET /api/materials/:id` | `city`, `area` only |

## Database tables

| Table / field | Role |
|---------------|------|
| `locations` | `country`, `city`, `area`, `address_line`, `latitude`, `longitude`, PostGIS `location`, `visibility`, `is_approximate`, `location_type` |
| `supplier_profiles.default_pickup_location_id` | Default pickup for listings |
| `organization_profiles` | Optional `business_location` relation |
| `materials.location_id` | Pickup location per listing (copied or override row; not the profile row) |

`visibility` enum in validation: `PUBLIC`, `ORDER_ONLY`, `PRIVATE` (`supplier.validation.ts`).

## Reusable components

- `supplier_pickup_map.dart`, `supplier_pickup_map_preview.dart` — supplier portal only
- `HeroWorkshopVisual` / landing — unrelated to locations API

## Known gaps / Needs verification

- **Public redaction:** Public materials API omits coordinates/address on list/detail (`mapMaterial`). `visibility` / `ORDER_ONLY` is stored but not enforced on public reads — **Needs verification** beyond create-time copy behavior.
- No learner-facing precise location reveal after reservation (reservation create **not implemented**).
- No dedicated locations list/manage API for learners or drivers.
- Reverse geocode requires external Nominatim — env/network dependent (`reverse-geocoding.service.ts`).
- Delivery pickup/dropoff location fields on `reservations` — schema only; **not implemented** in API/UI.

## Related docs

- [Supplier portal](supplier-portal.md)
- [Materials listing](materials-listing.md)
