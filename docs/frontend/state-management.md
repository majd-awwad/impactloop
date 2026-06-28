# Flutter State Management

Current Riverpod and data-flow inventory. This documents existing code organization only.

**Inspected source files:**
- `apps/frontend/lib/app/app.dart`
- `apps/frontend/lib/app/application/app_settings_notifier.dart`
- `apps/frontend/lib/app/application/app_settings_storage.dart`
- `apps/frontend/lib/core/network/api_client.dart`
- `apps/frontend/lib/features/auth/application/auth_controller.dart`
- `apps/frontend/lib/features/auth/application/auth_navigation.dart`
- `apps/frontend/lib/features/auth/application/auth_providers.dart`
- `apps/frontend/lib/features/auth/application/registration_draft_notifier.dart`
- `apps/frontend/lib/features/auth/data/auth_api.dart`
- `apps/frontend/lib/features/auth/data/auth_repository.dart`
- `apps/frontend/lib/features/health/application/health_controller.dart`
- `apps/frontend/lib/features/health/data/health_remote_data_source.dart`
- `apps/frontend/lib/features/home/application/home_suggested_materials_provider.dart`
- `apps/frontend/lib/features/reservations/application/reservation_create_controller.dart`
- `apps/frontend/lib/features/reservations/application/my_reservations_provider.dart`
- `apps/frontend/lib/features/materials/application/material_listing_providers.dart`
- `apps/frontend/lib/features/materials/data/material_listing_repository.dart`
- `apps/frontend/lib/features/supplier_portal/application/supplier_my_materials_providers.dart`
- `apps/frontend/lib/features/supplier_portal/data/supplier_dashboard_repository.dart`
- `apps/frontend/lib/features/supplier_portal/data/supplier_my_materials_repository.dart`
- `apps/frontend/lib/features/supplier_portal/data/supplier_profile_repository.dart`
- `apps/frontend/lib/features/supplier_portal/presentation/controllers/supplier_dashboard_providers.dart`
- `apps/frontend/lib/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart`
- `apps/frontend/lib/features/supplier_portal/presentation/controllers/supplier_pickup_schedule_providers.dart`
- `apps/frontend/lib/features/supplier_portal/presentation/controllers/supplier_profile_providers.dart`
- `apps/frontend/lib/features/supplier_portal/presentation/controllers/supplier_requests_providers.dart`
- `apps/frontend/lib/features/*/presentation/widgets/**` for provider usage in widgets

## Current Pattern

The frontend uses Riverpod with three common layers:

| Layer | Current files | Pattern |
|-------|---------------|---------|
| Core infrastructure providers | `core/network/api_client.dart` | `Provider<Dio>` and `Provider<AccessTokenHolder>` create shared infrastructure. |
| Data providers/repositories | feature `data/*_repository.dart` | API clients are wrapped by repository providers. |
| Application state/query providers | feature `application/*.dart` and supplier `presentation/controllers/*.dart` | `NotifierProvider`, `FutureProvider`, and helper functions expose state and async operations to pages/widgets. |

The intended feature-first direction is visible, but not perfectly consistent: supplier portal still has several providers under `presentation/controllers`.

## Provider Types In Use

| Type | Current examples | Use |
|------|------------------|-----|
| `Provider<T>` | `apiClientProvider`, `authRepositoryProvider`, `materialListingRepositoryProvider`, supplier repository/API providers | Dependency construction and synchronous derived values. |
| `NotifierProvider<Notifier, State>` | `authControllerProvider`, `registrationDraftProvider`, `appSettingsProvider`, supplier filters/query providers | Mutable app/session/form/query state. |
| `FutureProvider<T>` | `materialCategoriesProvider`, `discoveryMaterialCategoriesProvider`, `materialListingPolicyProvider`, `supplierDashboardProvider`, `supplierProfileProvider` | Async loads with `AsyncValue`. |
| `FutureProvider.autoDispose<T>` | `healthStatusProvider`, `homeSuggestedMaterialsProvider`, `supplierMyMaterialsProvider`, incoming requests, pickup schedule, notifications | Screen-bound async loads that may be disposed. |
| `FutureProvider.family<T, Arg>` | `materialTypesSearchProvider`, `supplierMyMaterialByIdProvider` | Parameterized async reads. |

No `StateProvider`, `ChangeNotifierProvider`, or generated Riverpod annotations were found in inspected files.

## App State

`appSettingsProvider` stores:

- `ThemeMode`
- language code

It defaults to `ThemeMode.system` and English, then loads saved values asynchronously from `AppSettingsStorage`. It persists changes best-effort using `FlutterSecureStorage`, with memory storage in widget tests.

`ImpactLoopApp` watches `appSettingsProvider` and passes the settings into `MaterialApp.router`.

## Auth State

Auth state is centralized in `authControllerProvider`.

`AuthController` owns:

- current `User`
- access token
- loading state
- bootstrap status
- normalized API error

`authNetworkBootstrapProvider` initializes the shared Dio client and schedules `bootstrapSession()`.

Auth dependencies are provider-built:

- `tokenStorageProvider`
- `authApiProvider`
- `authRepositoryProvider`
- `accessTokenHolderProvider`
- `apiClientProvider`
- `authSessionRefresherProvider`
- `authSessionExpiryProvider`

Registration draft state is separate in `registrationDraftProvider`. It stores basic registration data, selected intent, learner profile draft, and supplier profile draft before producing a `RegisterRequest`.

Shared network auth behavior:

- `AuthInterceptor` attaches the current bearer token and client platform header.
- On eligible 401s, `AuthInterceptor` uses `AuthSessionRefresher` to refresh once through a bare Dio client, then retries the original request once.
- Concurrent 401s share one refresh operation.
- Refresh failure clears token storage and emits `authSessionExpiryProvider`, which drives `AuthController` to an unauthenticated/session-expired state.
- Multipart material-image uploads are marked `skipAuthRefresh` because replaying a consumed multipart request body is unsafe.

## Async Data Loading

Async reads generally follow this shape:

```dart
final resultProvider = FutureProvider.autoDispose<Result>((ref) async {
  final repository = ref.watch(repositoryProvider);
  return repository.fetch();
});
```

Pages and widgets watch the provider and render loading, error, and data branches with `AsyncValue`.

Examples:

- `healthStatusProvider` fetches backend health.
- `homeSuggestedMaterialsProvider` loads material discovery results and takes the first four.
- `learningProjectsProvider`, `learningProjectProvider`, and `projectCategoriesProvider` load Learning Hub list/detail/category data from `/api/learning-projects` and `/api/categories?type=PROJECT`.
- `materialCategoriesProvider`, `discoveryMaterialCategoriesProvider`, `materialListingPolicyProvider`, and `categoryRequestsProvider` load shared materials data. Supplier add-material uses the full category list; discovery browse uses `discoveryMaterialCategoriesProvider` (`discoveryOnly=true`); admin approvals uses `materialCategoriesProvider`.
- `reservationCreateControllerProvider` submits learner reservation requests from material detail and exposes loading/error state for the Reserve button.
- `myReservationsProvider` loads `GET /api/reservations/my` for the learner reservation page and material-detail reservation state.
- `learnerDeliveriesProvider` and `learnerDeliveryProvider` load learner delivery status from `/api/deliveries`; `deliveryRequestControllerProvider` submits accepted-reservation delivery requests.
- `supplierMyMaterialsProvider` checks auth, watches query state, then fetches supplier materials.
- Supplier dashboard/profile/request/schedule/notification providers load supplier portal data.

## Query And Filter State

Filters and query state are kept in `NotifierProvider`s:

- `supplierMyMaterialsQueryProvider`
- `incomingRequestTabProvider`
- `pickupScheduleFilterProvider`
- `supplierNotificationFilterProvider`
- `completingReservationIdProvider`

These providers keep UI selection state separate from the async data providers that depend on them.

## Repository Organization

Current repository providers live mostly in feature `data/` files:

- Auth: `authRepositoryProvider`
- Materials listing: `materialListingRepositoryProvider` (API client providers are co-located in `material_listing_repository.dart` today)
- Supplier dashboard: `supplierDashboardRepositoryProvider`
- Supplier profile: `supplierProfileRepositoryProvider`
- Supplier requests: `supplierRequestsRepositoryProvider`
- Supplier pickup schedule: `supplierPickupScheduleRepositoryProvider`
- Supplier my materials: `supplierMyMaterialsRepositoryProvider`
- Learning Hub: `learningHubRepositoryProvider` (overridden in `main.dart`; widget tests use `emptyLearningHubRepository` from `test/support/learning_hub_test_support.dart`)
- Home suggested materials preview: `homeMaterialDiscoveryRepositoryProvider`

Repository providers should construct API clients and expose feature operations. Widgets should not instantiate API clients directly.

Current exception: `material_discovery` pages directly instantiate `ApiMaterialDiscoveryRepository(ref.read(apiClientProvider))` instead of using an application/provider wrapper. Treat that as current code reality, not the preferred pattern for new work.

## Where New State Belongs

Use this placement for new code:

- Cross-app settings/session state: `apps/frontend/lib/app/application/`
- Feature business/application state: `apps/frontend/lib/features/<feature>/application/`
- API clients, DTO parsing, and repositories: `apps/frontend/lib/features/<feature>/data/`
- Widget-local ephemeral UI state: inside the widget with `StatefulWidget`/controllers

Avoid adding new providers under `presentation/controllers` unless maintaining existing supplier portal structure. For new supplier work, prefer `application/` unless the team first chooses to migrate the existing supplier providers.

## Widget Rules

- Widgets may `watch` providers for display state.
- Widgets may `read` notifier/repository providers for submit actions.
- Widgets should not call Dio/API clients directly.
- Shared widgets should not watch feature providers.
- Reusable widgets should accept values and callbacks instead of owning feature state.

## Invalidation And Refresh

Current code uses `ref.invalidate(...)` and `ref.refresh(...future)` after mutations.

Examples:

- Accepting/declining requests invalidates `incomingRequestsProvider`.
- Completing requests invalidates incoming requests and pickup schedule providers.
- Supplier material changes invalidate supplier material/dashboard/notification providers.
- Creating a learner reservation refreshes the material detail future and invalidates `homeSuggestedMaterialsProvider` plus `myReservationsProvider`; discovery list refresh remains page-local because material discovery currently owns its own `Future`.
- Supplier accept/decline/complete invalidates incoming requests, supplier notifications, supplier dashboard, pickup schedule, and pickup schedule summary providers.
- Retry buttons invalidate the failed async provider.

Keep invalidation close to the mutation that changes server state.

## Remaining Inconsistencies

- Supplier portal providers are split between `application/` and `presentation/controllers/`.
- `material_discovery` has repository classes but no central provider for list/detail fetch; it **does** use `discoveryMaterialCategoriesProvider` from `features/materials` for category chips only.
- `features/materials` is data-only (no routes). Public browse routes `/materials` and `/materials/:id` are registered on `material_discovery` pages; supplier routes `/supplier/materials/*` are on `supplier_portal`.
- Some form submit flows call repository/helper functions directly from widgets after validation; this is current practice but should remain thin.
- Learning hub remains mock-data oriented and was not found using application providers in the inspected paths.
- Optional follow-up: extract Riverpod API providers from `material_listing_repository.dart` into a dedicated providers file without changing behavior.
