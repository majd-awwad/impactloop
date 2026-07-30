import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:frontend/app/app.dart';
import 'package:frontend/app/router/app_router.dart';
import 'package:frontend/core/auth/access_token_holder.dart';
import 'package:frontend/core/auth/token_storage.dart';
import 'package:frontend/features/auth/data/models/register_request.dart';
import 'package:frontend/features/auth/data/models/registration_draft.dart';
import 'package:frontend/features/auth/presentation/pages/login_page.dart';
import 'package:frontend/features/health/application/health_controller.dart';
import 'package:frontend/features/health/data/health_remote_data_source.dart';
import 'package:frontend/features/auth/presentation/models/registration_intent.dart';
import 'package:frontend/features/auth/presentation/pages/register_page.dart';
import 'package:frontend/features/landing/presentation/pages/landing_page.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/application/auth_providers.dart';
import 'package:frontend/features/auth/data/auth_api.dart';
import 'package:frontend/features/auth/data/auth_repository.dart';
import 'package:frontend/features/auth/data/models/auth_tokens.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/auth/application/auth_navigation.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_dashboard.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_dashboard_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_avatar_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_profile_providers.dart';
import 'package:frontend/features/material_discovery/application/material_discovery_providers.dart';
import 'package:frontend/features/material_discovery/data/mock_material_discovery_repository.dart';
import 'package:frontend/features/locations/application/saved_locations_providers.dart';
import 'package:frontend/features/materials/application/material_listing_providers.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:go_router/go_router.dart';

import 'support/learning_hub_test_support.dart';

final _learningHubTestOverride = learningHubRepositoryProvider
    .overrideWithValue(emptyLearningHubRepository);

final _materialDiscoveryTestOverrides = [
  materialDiscoveryRepositoryProvider.overrideWithValue(
    const MockMaterialDiscoveryRepository(),
  ),
  discoveryMaterialCategoriesProvider.overrideWith((ref) => Future.value([])),
  savedLocationsProvider.overrideWith((ref) => Future.value([])),
];

void main() {
  Future<void> pumpApp(WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          ..._materialDiscoveryTestOverrides,
        ],
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<GoRouter> pumpAuthenticatedRouter(
    WidgetTester tester,
    User user,
  ) async {
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshResult: const AuthTokens(
          accessToken: 'restored-access',
          refreshToken: 'rotated-refresh',
        ),
        meResult: user,
      ),
      tokenStorage: _FakeTokenStorage(initialRefreshToken: 'stored-refresh'),
      accessTokenHolder: AccessTokenHolder(),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          ..._materialDiscoveryTestOverrides,
          authRepositoryProvider.overrideWithValue(repository),
          supplierDashboardProvider.overrideWith(
            (ref) async => _testSupplierDashboard(),
          ),
          supplierActionNeededCountProvider.overrideWith((ref) => 0),
          supplierDisplayAvatarUrlProvider.overrideWith((ref) => null),
          supplierProfileManagementProvider.overrideWith(
            (ref) => Future.error(StateError('Profile rendering stub')),
          ),
        ],
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    );
    return container.read(appRouterProvider);
  }

  Future<void> pumpResponsivePage(
    WidgetTester tester,
    Widget page, {
    required Size surfaceSize,
  }) async {
    tester.view.physicalSize = surfaceSize;
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [_learningHubTestOverride],
        child: MaterialApp(home: page),
      ),
    );
    await tester.pumpAndSettle();
  }

  group('RegisterRequest.fromFormValues', () {
    test('maps learner registrations to learner-only payloads', () {
      final request = RegisterRequest.fromFormValues(
        intent: RegistrationIntent.learner,
        displayName: 'Learner User',
        email: 'learner@example.com',
        password: 'password123',
        learnerProfile: const LearnerProfileDraft(
          learnerType: 'University student',
          skillLevel: 'Beginner',
        ),
      );

      expect(request.roles, const ['LEARNER']);
      expect(request.learnerProfile, isNotNull);
      expect(request.supplierProfile, isNull);
    });

    test('maps supplier registrations to supplier-only payloads', () {
      final request = RegisterRequest.fromFormValues(
        intent: RegistrationIntent.supplier,
        displayName: 'Supplier User',
        email: 'supplier@example.com',
        password: 'password123',
        supplierProfile: const SupplierProfileDraft(
          supplierType: 'Workshop',
          publicName: 'Workshop Hub',
          pickupArea: 'Nablus, Rafidia',
        ),
      );

      expect(request.roles, const ['SUPPLIER']);
      expect(request.learnerProfile, isNull);
      expect(request.supplierProfile, isNotNull);
    });

    test('maps dual-intent registrations to combined payloads', () {
      final request = RegisterRequest.fromFormValues(
        intent: RegistrationIntent.both,
        displayName: 'Dual User',
        email: 'dual@example.com',
        password: 'password123',
        learnerProfile: const LearnerProfileDraft(
          learnerType: 'Self learner',
          skillLevel: 'Advanced',
        ),
        supplierProfile: const SupplierProfileDraft(
          supplierType: 'Educational institution',
          publicName: 'Campus Lab',
          pickupArea: 'Nablus, New Campus',
        ),
      );

      expect(request.roles, const ['LEARNER', 'SUPPLIER']);
      expect(request.learnerProfile, isNotNull);
      expect(request.supplierProfile, isNotNull);
    });
  });

  test('bootstrapSession restores user from refresh and me', () async {
    final tokenStorage = _FakeTokenStorage(
      initialRefreshToken: 'stored-refresh',
    );
    final accessTokenHolder = AccessTokenHolder();
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshResult: const AuthTokens(
          accessToken: 'restored-access',
          refreshToken: 'rotated-refresh',
        ),
        meResult: _testUser(),
      ),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).bootstrapSession();

    final state = container.read(authControllerProvider);
    expect(state.isAuthenticated, isTrue);
    expect(state.accessToken, 'restored-access');
    expect(state.user?.email, 'restored@example.com');
    expect(await tokenStorage.readRefreshToken(), 'rotated-refresh');
  });

  test('bootstrapSession clears local session when refresh fails', () async {
    final tokenStorage = _FakeTokenStorage(
      initialRefreshToken: 'stale-refresh',
    );
    final accessTokenHolder = AccessTokenHolder()..accessToken = 'stale-access';
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshError: DioException(
          requestOptions: RequestOptions(path: '/api/auth/refresh'),
        ),
      ),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).bootstrapSession();

    final state = container.read(authControllerProvider);
    expect(state.isAuthenticated, isFalse);
    expect(state.user, isNull);
    expect(state.accessToken, isNull);
    expect(accessTokenHolder.accessToken, isNull);
    expect(await tokenStorage.readRefreshToken(), isNull);
  });

  test('logout clears local session when API succeeds', () async {
    final tokenStorage = _FakeTokenStorage(
      initialRefreshToken: 'refresh-token',
    );
    final accessTokenHolder = AccessTokenHolder()..accessToken = 'access-token';
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshResult: const AuthTokens(
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        ),
        meResult: _testUser(),
      ),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).bootstrapSession();

    final error = await container
        .read(authControllerProvider.notifier)
        .logout();

    final state = container.read(authControllerProvider);
    expect(error, isNull);
    expect(state.user, isNull);
    expect(state.accessToken, isNull);
    expect(accessTokenHolder.accessToken, isNull);
    expect(await tokenStorage.readRefreshToken(), isNull);
  });

  test('logout clears local session when API fails', () async {
    final tokenStorage = _FakeTokenStorage(
      initialRefreshToken: 'refresh-token',
    );
    final accessTokenHolder = AccessTokenHolder()..accessToken = 'access-token';
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshResult: const AuthTokens(
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        ),
        meResult: _testUser(),
        logoutError: DioException(
          requestOptions: RequestOptions(path: '/api/auth/logout'),
          type: DioExceptionType.connectionError,
        ),
      ),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).bootstrapSession();

    final error = await container
        .read(authControllerProvider.notifier)
        .logout();

    final state = container.read(authControllerProvider);
    expect(error, isNotNull);
    expect(state.user, isNull);
    expect(state.accessToken, isNull);
    expect(accessTokenHolder.accessToken, isNull);
    expect(await tokenStorage.readRefreshToken(), isNull);
  });

  testWidgets('shows backend health status on /health', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          healthStatusProvider.overrideWith(
            (ref) async => HealthStatus(
              status: 'ok',
              uptime: 1.2,
              timestamp: DateTime(2026),
            ),
          ),
        ],
        child: const ImpactLoopApp(),
      ),
    );

    await tester.pumpAndSettle();

    GoRouter.of(
      tester.element(find.text('Build a better future')),
    ).go('/health');
    await tester.pumpAndSettle();

    expect(find.text('ImpactLoop'), findsWidgets);
    expect(find.text('Backend health'), findsOneWidget);
    expect(find.text('ok'), findsOneWidget);
  });

  testWidgets('shows landing page on /', (tester) async {
    await pumpApp(tester);

    expect(find.text('Build a better future'), findsOneWidget);
    expect(find.text('Create account'), findsWidgets);
  });

  testWidgets('logged out users are redirected from /home to /login', (
    tester,
  ) async {
    final tokenStorage = _FakeTokenStorage(
      initialRefreshToken: 'stale-refresh',
    );
    final accessTokenHolder = AccessTokenHolder();
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshError: DioException(
          requestOptions: RequestOptions(path: '/api/auth/refresh'),
        ),
      ),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          ..._materialDiscoveryTestOverrides,
          authRepositoryProvider.overrideWithValue(repository),
        ],
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    );
    final router = container.read(appRouterProvider);

    GoRouter.of(tester.element(find.text('Build a better future'))).go('/home');
    await tester.pumpAndSettle();

    expect(router.routeInformationProvider.value.uri.path, '/login');
  });

  testWidgets('authenticated users are redirected from /login to /home', (
    tester,
  ) async {
    final tokenStorage = _FakeTokenStorage(
      initialRefreshToken: 'stored-refresh',
    );
    final accessTokenHolder = AccessTokenHolder();
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshResult: const AuthTokens(
          accessToken: 'restored-access',
          refreshToken: 'rotated-refresh',
        ),
        meResult: _testUser(),
      ),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          ..._materialDiscoveryTestOverrides,
          authRepositoryProvider.overrideWithValue(repository),
        ],
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    );
    final router = container.read(appRouterProvider);

    GoRouter.of(
      tester.element(find.text('Build a better future')),
    ).go('/login');
    await tester.pumpAndSettle();

    expect(router.routeInformationProvider.value.uri.path, '/home');
  });

  testWidgets('authenticated users are redirected from /register to /home', (
    tester,
  ) async {
    final tokenStorage = _FakeTokenStorage(
      initialRefreshToken: 'stored-refresh',
    );
    final accessTokenHolder = AccessTokenHolder();
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshResult: const AuthTokens(
          accessToken: 'restored-access',
          refreshToken: 'rotated-refresh',
        ),
        meResult: _testUser(),
      ),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          ..._materialDiscoveryTestOverrides,
          authRepositoryProvider.overrideWithValue(repository),
        ],
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    );
    final router = container.read(appRouterProvider);

    GoRouter.of(
      tester.element(find.text('Build a better future')),
    ).go('/register');
    await tester.pumpAndSettle();

    expect(router.routeInformationProvider.value.uri.path, '/home');
  });

  testWidgets('learner-active users can open both learning profile routes', (
    tester,
  ) async {
    final router = await pumpAuthenticatedRouter(tester, _testUser());

    router.go('/profile/learning');
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path, '/profile/learning');
    expect(find.text('No learning details yet'), findsOneWidget);

    router.go('/profile/learner/edit');
    await tester.pumpAndSettle();
    expect(
      router.routeInformationProvider.value.uri.path,
      '/profile/learner/edit',
    );
  });

  for (final role in const ['LEARNER', 'SUPPLIER', 'ADMIN', 'DRIVER']) {
    testWidgets('$role-active users can open the account settings route', (
      tester,
    ) async {
      final router = await pumpAuthenticatedRouter(
        tester,
        _testUser(roles: [role], activeRole: role),
      );

      router.go('/profile/account');
      await tester.pumpAndSettle();

      expect(
        router.routeInformationProvider.value.uri.path,
        '/profile/account',
      );
      expect(find.text('Account and Settings'), findsOneWidget);
    });
  }

  testWidgets('signed-out account settings deep link preserves its target', (
    tester,
  ) async {
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshError: DioException(
          requestOptions: RequestOptions(path: '/api/auth/refresh'),
        ),
      ),
      tokenStorage: _FakeTokenStorage(initialRefreshToken: 'stale-refresh'),
      accessTokenHolder: AccessTokenHolder(),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          ..._materialDiscoveryTestOverrides,
          authRepositoryProvider.overrideWithValue(repository),
        ],
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    );
    final router = container.read(appRouterProvider);

    router.go('/profile/account');
    await tester.pumpAndSettle();

    final uri = router.routeInformationProvider.value.uri;
    expect(uri.path, '/login');
    expect(uri.queryParameters['from'], '/profile/account');
  });

  testWidgets('signed-out learning profile deep link preserves its target', (
    tester,
  ) async {
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshError: DioException(
          requestOptions: RequestOptions(path: '/api/auth/refresh'),
        ),
      ),
      tokenStorage: _FakeTokenStorage(initialRefreshToken: 'stale-refresh'),
      accessTokenHolder: AccessTokenHolder(),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          ..._materialDiscoveryTestOverrides,
          authRepositoryProvider.overrideWithValue(repository),
        ],
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    );
    final router = container.read(appRouterProvider);

    router.go('/profile/learning');
    await tester.pumpAndSettle();

    final uri = router.routeInformationProvider.value.uri;
    expect(uri.path, '/login');
    expect(uri.queryParameters['from'], '/profile/learning');
  });

  testWidgets(
    'supplier-active users are redirected from both learning profile routes',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(1400, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = await pumpAuthenticatedRouter(
        tester,
        _testUser(roles: const ['LEARNER', 'SUPPLIER'], activeRole: 'SUPPLIER'),
      );

      router.go('/profile/learning');
      await tester.pumpAndSettle();
      expect(
        router.routeInformationProvider.value.uri.path,
        '/supplier/profile',
      );

      router.go('/profile/learner/edit');
      await tester.pumpAndSettle();
      expect(
        router.routeInformationProvider.value.uri.path,
        '/supplier/profile',
      );
    },
  );

  testWidgets('supplier-only users cannot open liked materials', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final router = await pumpAuthenticatedRouter(
      tester,
      _testUser(roles: const ['SUPPLIER'], activeRole: 'SUPPLIER'),
    );

    router.go('/materials/liked');
    await tester.pumpAndSettle();

    expect(
      router.routeInformationProvider.value.uri.path,
      '/home',
    );
  });

  testWidgets('supplier users are redirected from /login to /supplier', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final tokenStorage = _FakeTokenStorage(
      initialRefreshToken: 'stored-refresh',
    );
    final accessTokenHolder = AccessTokenHolder();
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshResult: const AuthTokens(
          accessToken: 'restored-access',
          refreshToken: 'rotated-refresh',
        ),
        meResult: _testUser(roles: const ['SUPPLIER']),
      ),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          ..._materialDiscoveryTestOverrides,
          authRepositoryProvider.overrideWithValue(repository),
          supplierDashboardProvider.overrideWith(
            (ref) async => _testSupplierDashboard(),
          ),
        ],
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    );
    final router = container.read(appRouterProvider);

    GoRouter.of(
      tester.element(find.text('Build a better future')),
    ).go('/login');
    await tester.pumpAndSettle();

    expect(
      router.routeInformationProvider.value.uri.path,
      '/supplier/overview',
    );
  });

  testWidgets('supplier users are redirected from /register to /supplier', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final tokenStorage = _FakeTokenStorage(
      initialRefreshToken: 'stored-refresh',
    );
    final accessTokenHolder = AccessTokenHolder();
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshResult: const AuthTokens(
          accessToken: 'restored-access',
          refreshToken: 'rotated-refresh',
        ),
        meResult: _testUser(
          roles: const ['LEARNER', 'SUPPLIER'],
          activeRole: 'SUPPLIER',
        ),
      ),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          ..._materialDiscoveryTestOverrides,
          authRepositoryProvider.overrideWithValue(repository),
          supplierDashboardProvider.overrideWith(
            (ref) async => _testSupplierDashboard(),
          ),
        ],
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    );
    final router = container.read(appRouterProvider);

    GoRouter.of(
      tester.element(find.text('Build a better future')),
    ).go('/register');
    await tester.pumpAndSettle();

    expect(
      router.routeInformationProvider.value.uri.path,
      '/supplier/overview',
    );
  });

  testWidgets('logged out users are redirected from /supplier to /login', (
    tester,
  ) async {
    final tokenStorage = _FakeTokenStorage(
      initialRefreshToken: 'stale-refresh',
    );
    final accessTokenHolder = AccessTokenHolder();
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshError: DioException(
          requestOptions: RequestOptions(path: '/api/auth/refresh'),
        ),
      ),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          ..._materialDiscoveryTestOverrides,
          authRepositoryProvider.overrideWithValue(repository),
        ],
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    );
    final router = container.read(appRouterProvider);

    GoRouter.of(
      tester.element(find.text('Build a better future')),
    ).go('/supplier');
    await tester.pumpAndSettle();

    expect(router.routeInformationProvider.value.uri.path, '/login');
  });

  testWidgets('non-supplier users see supplier access denied', (tester) async {
    final tokenStorage = _FakeTokenStorage(
      initialRefreshToken: 'stored-refresh',
    );
    final accessTokenHolder = AccessTokenHolder();
    final repository = AuthRepository(
      api: _FakeAuthApi(
        refreshResult: const AuthTokens(
          accessToken: 'restored-access',
          refreshToken: 'rotated-refresh',
        ),
        meResult: _testUser(),
      ),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          _learningHubTestOverride,
          ..._materialDiscoveryTestOverrides,
          authRepositoryProvider.overrideWithValue(repository),
        ],
        child: const ImpactLoopApp(),
      ),
    );
    await tester.pumpAndSettle();

    final container = ProviderScope.containerOf(
      tester.element(find.byType(ImpactLoopApp)),
    );
    final router = container.read(appRouterProvider);

    GoRouter.of(
      tester.element(find.text('Build a better future')),
    ).go('/supplier');
    await tester.pumpAndSettle();

    expect(
      router.routeInformationProvider.value.uri.path,
      '/supplier/access-denied',
    );
    expect(
      find.text('You need a Supplier role to access the Supplier Portal.'),
      findsOneWidget,
    );
  });

  testWidgets('materials route renders material discovery page', (
    tester,
  ) async {
    await pumpApp(tester);

    GoRouter.of(
      tester.element(find.text('Build a better future')),
    ).go('/materials');
    await tester.pumpAndSettle();

    expect(find.text('Material Discovery'), findsOneWidget);
    expect(find.text('Reusable Materials'), findsOneWidget);
  });

  testWidgets('learning route q parameter pre-fills project search', (
    tester,
  ) async {
    await pumpApp(tester);

    GoRouter.of(
      tester.element(find.text('Build a better future')),
    ).go('/learning?q=Cardboard%20sheets');
    await tester.pumpAndSettle();

    expect(find.text('Learning Hub'), findsOneWidget);
    expect(find.text('Cardboard sheets'), findsOneWidget);
    expect(find.text('No projects match your filters'), findsOneWidget);
  });

  test('User.fromJson parses string, object, and primaryRole role shapes', () {
    final user = User.fromJson({
      'id': 'user-1',
      'displayName': 'Supplier User',
      'email': 'supplier@example.com',
      'accountStatus': 'ACTIVE',
      'roles': [
        'LEARNER',
        {'role': 'SUPPLIER'},
      ],
      'primaryRole': 'ADMIN',
      'activeRole': 'ADMIN',
      'createdAt': '2026-01-01T00:00:00.000Z',
    });

    expect(user.roles, containsAll(['LEARNER', 'SUPPLIER', 'ADMIN']));
    expect(user.hasRole('supplier'), isTrue);
    expect(postAuthRouteForUser(user), '/admin');
  });

  test('postAuthRouteForUser uses role priority', () {
    expect(
      postAuthRouteForUser(
        User.fromJson({
          'id': 'admin-1',
          'displayName': 'Admin',
          'email': 'admin@example.com',
          'accountStatus': 'ACTIVE',
          'roles': ['ADMIN'],
          'createdAt': '2026-01-01T00:00:00.000Z',
        }),
      ),
      '/admin',
    );

    expect(
      postAuthRouteForUser(
        User.fromJson({
          'id': 'supplier-1',
          'displayName': 'Supplier',
          'email': 'supplier@example.com',
          'accountStatus': 'ACTIVE',
          'roles': ['SUPPLIER'],
          'activeRole': 'SUPPLIER',
          'createdAt': '2026-01-01T00:00:00.000Z',
        }),
      ),
      '/supplier/overview',
    );

    expect(
      postAuthRouteForUser(
        User.fromJson({
          'id': 'learner-1',
          'displayName': 'Learner',
          'email': 'learner@example.com',
          'accountStatus': 'ACTIVE',
          'roles': ['LEARNER'],
          'createdAt': '2026-01-01T00:00:00.000Z',
        }),
      ),
      '/home',
    );
  });

  testWidgets('landing page stays stable on mobile width', (tester) async {
    await pumpResponsivePage(
      tester,
      const LandingPage(),
      surfaceSize: const Size(390, 844),
    );

    expect(find.text('Build a better future'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('dark login stays stable on short laptop height', (tester) async {
    await pumpResponsivePage(
      tester,
      const LoginPage(),
      surfaceSize: const Size(1280, 720),
    );

    expect(find.text('Welcome back'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('unified register stays stable for dual intent on mobile', (
    tester,
  ) async {
    await pumpResponsivePage(
      tester,
      const RegisterPage(),
      surfaceSize: const Size(390, 844),
    );

    final doBothFinder = find.text('Do both');
    await tester.ensureVisible(doBothFinder);
    await tester.tap(doBothFinder);
    await tester.pumpAndSettle();

    expect(find.text('Learner profile'), findsOneWidget);
    expect(find.text('Supplier profile'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _FakeTokenStorage implements TokenStorage {
  _FakeTokenStorage({this.initialRefreshToken});

  String? initialRefreshToken;

  @override
  Future<void> clearRefreshToken() async {
    initialRefreshToken = null;
  }

  @override
  Future<String?> readRefreshToken() async => initialRefreshToken;

  @override
  Future<void> saveRefreshToken(String refreshToken) async {
    initialRefreshToken = refreshToken;
  }
}

class _FakeAuthApi extends AuthApi {
  _FakeAuthApi({
    this.refreshResult,
    this.meResult,
    this.refreshError,
    this.logoutError,
  }) : super(Dio());

  final AuthTokens? refreshResult;
  final User? meResult;
  final Object? refreshError;
  final Object? logoutError;

  @override
  Future<AuthTokens> refresh({String? refreshToken}) async {
    if (refreshError != null) {
      throw refreshError!;
    }

    return refreshResult ?? const AuthTokens(accessToken: 'access-token');
  }

  @override
  Future<User> me() async {
    return meResult ?? _testUser();
  }

  @override
  Future<void> logout({String? refreshToken}) async {
    if (logoutError != null) {
      throw logoutError!;
    }
  }

  @override
  Future<void> forgotPassword({required String email}) async {}

  @override
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {}
}

User _testUser({List<String> roles = const ['LEARNER'], String? activeRole}) {
  final resolvedActiveRole =
      activeRole ??
      (roles.length == 1 && roles.first == 'SUPPLIER' ? 'SUPPLIER' : 'LEARNER');

  return User(
    id: 'user-1',
    displayName: 'Restored User',
    email: 'restored@example.com',
    accountStatus: 'ACTIVE',
    roles: roles,
    activeRole: resolvedActiveRole,
    createdAt: DateTime(2026),
  );
}

SupplierDashboard _testSupplierDashboard() {
  return SupplierDashboard.fromJson({
    'hasSupplierProfile': false,
    'message': 'Complete your supplier profile to start listing materials.',
    'stats': {
      'materials': {
        'total': 0,
        'available': 0,
        'pendingReservation': 0,
        'reserved': 0,
        'reused': 0,
        'unavailable': 0,
      },
      'reservations': {
        'pending': 0,
        'accepted': 0,
        'completed': 0,
        'rejected': 0,
        'cancelled': 0,
        'expired': 0,
      },
      'impact': {'reusedMaterials': 0, 'reusedQuantity': 0},
      'reviews': {'averageRating': 0, 'totalReviews': 0},
      'notifications': {'unread': 0},
    },
    'recentMaterials': [],
    'upcomingPickups': [],
    'recentActivity': [],
  });
}
