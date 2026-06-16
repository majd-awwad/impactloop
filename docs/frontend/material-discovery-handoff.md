# Material Discovery Handoff

## What Was Built

Material Discovery currently includes:

- public route: `/materials`
- public route: `/materials/:id`
- reusable shared `AppMaterialCard`
- local mock search and filter interactions
- repository boundary for loading discovery data
- API contract documentation for future backend integration

The current implementation is frontend-only and uses local mock data.

## Important Files

Primary feature areas:

- `apps/frontend/lib/features/material_discovery/presentation/pages`
- `apps/frontend/lib/features/material_discovery/presentation/views`
- `apps/frontend/lib/features/material_discovery/domain`
- `apps/frontend/lib/features/material_discovery/data`
- `apps/frontend/lib/shared/widgets/materials`
- `docs/api/materials-api-contract.md`

Key files:

- `apps/frontend/lib/features/material_discovery/presentation/pages/materials_discovery_page.dart`
- `apps/frontend/lib/features/material_discovery/presentation/pages/material_details_page.dart`
- `apps/frontend/lib/features/material_discovery/presentation/views/materials_discovery_view.dart`
- `apps/frontend/lib/features/material_discovery/domain/discovery_material.dart`
- `apps/frontend/lib/features/material_discovery/domain/material_discovery_repository.dart`
- `apps/frontend/lib/features/material_discovery/data/mock_material_discovery_repository.dart`
- `apps/frontend/lib/features/material_discovery/data/mock_materials.dart`
- `apps/frontend/lib/shared/widgets/materials/app_material_card.dart`

## Reusable Components

The following shared widgets are designed for reuse beyond the public discovery page:

- `AppMaterialCard`
- `MaterialStatusBadge`
- `MaterialConditionBadge`
- `MaterialPriceBadge`

These should be reused later by Supplier My Materials, reservation previews, and other material list/detail surfaces instead of being recreated per feature.

## Architecture Rules

- `AppMaterialCard` must stay route-independent.
- `AppMaterialCard` must not import `GoRouter`.
- `AppMaterialCard` must not call backend or API code.
- The UI should receive domain or display-ready data through parameters and callbacks.
- Backend DTOs must be mapped before reaching `AppMaterialCard`.

`AppMaterialCard` is a shared presentation widget, not a feature-specific page widget.

## Repository Boundary

Current boundary:

- `MaterialDiscoveryRepository` is the abstraction.
- `MockMaterialDiscoveryRepository` is the current mock implementation.

Current contract:

- `Future<List<DiscoveryMaterial>> getMaterials()`
- `Future<DiscoveryMaterial?> getMaterialById(String id)`

Future backend integration should add:

- `ApiMaterialDiscoveryRepository`

That future repository should implement the same contract and map backend responses into `DiscoveryMaterial`.

## Reusing The Card In Supplier My Materials

Supplier pages should reuse `AppMaterialCard` directly and pass supplier-specific actions through the optional trailing area.

```dart
AppMaterialCard(
  title: material.title,
  description: material.description,
  category: material.category,
  conditionLabel: material.conditionLabel,
  conditionTone: material.conditionTone,
  statusLabel: material.statusLabel,
  statusTone: material.statusTone,
  quantityLabel: material.quantityLabel,
  priceLabel: material.priceLabel,
  locationLabel: material.locationLabel,
  availabilityLabel: material.availabilityLabel,
  deliveryAvailable: material.deliveryAvailable,
  isFree: material.isFree,
  gradientColors: material.gradientColors,
  imageUrl: material.imageUrl,
  ratingLabel: material.ratingLabel,
  trailing: Wrap(
    spacing: 8,
    children: [
      OutlinedButton(onPressed: onEdit, child: const Text('Edit')),
      OutlinedButton(onPressed: onHide, child: const Text('Hide')),
      FilledButton(onPressed: onChangeStatus, child: const Text('Change status')),
    ],
  ),
  onTap: onOpenDetails,
)
```

The supplier feature should own supplier-specific callbacks and actions, not the shared card.

## What Not To Duplicate

- Do not recreate material card UI inside the supplier feature.
- Do not copy badge styles into supplier widgets.
- Do not hardcode new material colors outside the shared material widget palette.

If supplier pages need small behavior differences, extend the shared card API carefully instead of forking the component.

## Next Integration Step

When the backend is ready:

1. Implement `ApiMaterialDiscoveryRepository`.
2. Map `GET /api/materials` and `GET /api/materials/:id` responses into `DiscoveryMaterial`.
3. Keep filters local if API filtering is not ready, or move filtering to backend later if the API supports it.
4. Keep `AppMaterialCard` unchanged.

The safest path is to swap repositories at the page or provider layer while preserving the existing shared widget API.
