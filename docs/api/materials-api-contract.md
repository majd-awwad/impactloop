# Materials API Contract

## Purpose

This document defines the future backend response shape for Material Discovery.

Current frontend status:

- Material Discovery uses an API-backed repository by default.
- The UI loads data through a repository boundary, not directly from API DTOs.
- `AppMaterialCard` must remain independent from backend response models.
- `MockMaterialDiscoveryRepository` still exists for fallback and testing.

Future backend integration should:

- fetch DTOs from the real API
- map DTOs into the frontend UI/domain model
- keep presentation widgets unaware of transport-layer field names

## Current frontend boundary

Frontend repository contract:

- `getMaterials()`
- `getMaterialById(String id)`

Current implementations:

- `ApiMaterialDiscoveryRepository` for the default page flow
- `MockMaterialDiscoveryRepository` for fallback and testing

API integration notes:

- the frontend uses the shared Dio client from `apiClientProvider`
- API responses are unwrapped with `unwrapApiResponse(...)`
- `GET /api/materials` maps `data.items` into `DiscoveryMaterial`
- `GET /api/materials/:id` maps `data` into `DiscoveryMaterial`
- backend DTOs are mapped before data reaches `AppMaterialCard`

## GET /api/materials

Returns a paginated list of materials for discovery.

Public visibility behavior:

- only returns materials where:
  - category is active
  - category type is `MATERIAL` or `BOTH`
  - status is `AVAILABLE`, `PENDING_RESERVATION`, or `RESERVED`
- `status` defaults to `AVAILABLE`
- `REUSED` and `UNAVAILABLE` are not exposed by public discovery endpoints

Example response:

```json
{
  "success": true,
  "message": "Materials fetched successfully",
  "data": {
    "items": [
      {
        "id": "plywood-panels",
        "title": "Reclaimed Birch Plywood Panels",
        "description": "Clean workshop offcuts suitable for shelving, prototypes, and student build bases.",
        "category": {
          "id": "cat_wood",
          "nameEn": "Wood",
          "nameAr": "خشب"
        },
        "condition": "GOOD",
        "status": "AVAILABLE",
        "quantity": 18,
        "unit": "sheets",
        "isFree": true,
        "price": null,
        "city": "Nablus",
        "area": "Industrial Area",
        "deliveryAvailable": true,
        "imageUrl": "https://example.com/materials/plywood-panels.jpg",
        "supplierName": "Green Workshop Co.",
        "ratingSummary": null,
        "createdAt": "2026-06-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

## GET /api/materials/:id

Returns one material record by id.

Public visibility behavior:

- returns `404` for missing ids
- returns `404` for non-public materials
- public details are limited to materials where:
  - `status` is `AVAILABLE`, `PENDING_RESERVATION`, or `RESERVED`
  - category is active
  - category type is `MATERIAL` or `BOTH`

Example response:

```json
{
  "success": true,
  "message": "Material fetched successfully",
  "data": {
    "id": "plywood-panels",
    "title": "Reclaimed Birch Plywood Panels",
    "description": "Clean workshop offcuts suitable for shelving, prototypes, and student build bases.",
    "category": {
      "id": "cat_wood",
      "nameEn": "Wood",
      "nameAr": "خشب"
    },
    "condition": "GOOD",
    "status": "AVAILABLE",
    "quantity": 18,
    "unit": "sheets",
    "isFree": true,
    "price": null,
    "city": "Nablus",
    "area": "Industrial Area",
    "deliveryAvailable": true,
    "imageUrl": "https://example.com/materials/plywood-panels.jpg",
    "supplierName": "Green Workshop Co.",
    "ratingSummary": null,
    "createdAt": "2026-06-01T10:00:00.000Z"
  }
}
```

## Field notes

- `id`: stable route-safe identifier
- `title`: display title
- `description`: long description for discovery and details
- `category`: object with `id`, `nameEn`, and `nameAr`
- `condition`: backend enum/string mapped into condition badge tone and label
- `status`: backend enum/string mapped into status badge tone and label
- `quantity`: numeric quantity value
- `unit`: quantity unit such as `sheets`, `pieces`, `kg`
- `isFree`: whether the material is free
- `price`: nullable price value when `isFree` is true
- `city`: public city label
- `area`: public approximate area label
- `deliveryAvailable`: public fulfillment flag
- `imageUrl`: nullable public preview image
- `supplierName`: public supplier display name
- `ratingSummary`: currently `null`; ratings and reviews are future work
- `createdAt`: creation timestamp for future sorting/filtering

## Frontend mapping guidance

### Raw backend fields vs UI-derived labels

The backend should return raw values such as:

- `category.id`
- `category.nameEn`
- `category.nameAr`
- `quantity`
- `unit`
- `isFree`
- `price`
- `city`
- `area`
- `deliveryAvailable`

The frontend may derive display-oriented fields from those raw values, for example:

- `categoryLabel`
- `quantityLabel`
- `priceLabel`
- `locationLabel`
- `deliveryLabel`

`AppMaterialCard` should receive display-ready values or mapped domain values from the frontend layer, but it must not depend directly on backend DTOs.

The real repository should map backend DTOs into the frontend domain model before data reaches:

- `MaterialsDiscoveryPage`
- `MaterialDetailsPage`
- `MaterialsDiscoveryView`
- `AppMaterialCard`

`AppMaterialCard` must not depend directly on API DTOs.
