import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/app/app.dart';
import 'package:frontend/app/application/app_settings_notifier.dart';
import 'package:frontend/app/router/app_router.dart';
import 'package:frontend/core/auth/access_token_holder.dart';
import 'package:frontend/core/auth/auth_session_refresh.dart';
import 'package:frontend/core/auth/token_storage.dart';
import 'package:frontend/features/auth/application/auth_providers.dart';
import 'package:frontend/features/auth/data/auth_api.dart';
import 'package:frontend/features/auth/data/auth_repository.dart';
import 'package:frontend/features/auth/data/models/auth_tokens.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/driver_portal/data/driver_deliveries_repository.dart';
import 'package:frontend/features/driver_portal/data/models/delivery_handover_verify_preview.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/locations/application/saved_locations_providers.dart';
import 'package:frontend/features/material_discovery/application/material_discovery_providers.dart';
import 'package:frontend/features/material_discovery/data/mock_material_discovery_repository.dart';
import 'package:frontend/features/materials/application/material_listing_providers.dart';
import 'package:frontend/features/supplier_portal/data/models/handover_verify_preview.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_dashboard.dart';
import 'package:frontend/features/supplier_portal/data/supplier_requests_api_repository.dart';
import 'package:frontend/features/supplier_portal/data/supplier_requests_repository.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_avatar_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_dashboard_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_profile_providers.dart';
import 'package:frontend/shared/handover/handover_deep_link.dart';
import 'package:go_router/go_router.dart';

import 'support/learning_hub_test_support.dart';

const _testToken = 'TEST_TOKEN';
const _plausibleToken = 'opaque-token-aaaaaaaaaaaaaaaaaaaaaaaa';

final _sharedOverrides = [
  learningHubRepositoryProvider.overrideWithValue(emptyLearningHubRepository),
  initialAppSettingsProvider.overrideWithValue(
    const AppSettings(themeMode: ThemeMode.system, languageCode: 'en'),
  ),
  materialDiscoveryRepositoryProvider.overrideWithValue(
    const MockMaterialDiscoveryRepository(),
  ),
  discoveryMaterialCategoriesProvider.overrideWith((ref) => Future.value([])),
  savedLocationsProvider.overrideWith((ref) => Future.value([])),
];

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('handover deep-link router', () {
    testWidgets('custom-scheme URIs never hit Page Not Found', (tester) async {
      final router = await _pumpSignedOut(tester);

      for (final location in [
        'impactloop://handover/$_testToken',
        'impactloop://delivery-handover/$_testToken',
        'impactloop://supplier-pickup-handover/$_testToken',
      ]) {
        router.go(location);
        await tester.pumpAndSettle();
        _expectNoBrokenRouteLeak(_testToken);
        expect(find.text('Sign in'), findsWidgets);
        expect(
          router.routeInformationProvider.value.uri.path,
          '/login',
        );
        expect(
          router.routeInformationProvider.value.uri.queryParameters['from'],
          contains(handoverEntryRoute),
        );
      }
    });

    testWidgets('unauthenticated deep link resumes after login', (tester) async {
      final router = await _pumpSignedOut(
        tester,
        loginUser: _user(roles: const ['SUPPLIER'], activeRole: 'SUPPLIER'),
      );

      router.go('impactloop://handover/$_testToken');
      await tester.pumpAndSettle();
      expect(router.routeInformationProvider.value.uri.path, '/login');

      await tester.enterText(
        find.byType(TextFormField).first,
        'supplier@test.com',
      );
      await tester.enterText(find.byType(TextFormField).at(1), 'Password123!');
      await tester.ensureVisible(find.text('Sign in').last);
      await tester.tap(find.text('Sign in').last);
      await tester.pumpAndSettle();

      _expectNoBrokenRouteLeak(_testToken);
      expect(
        router.routeInformationProvider.value.uri.path,
        handoverEntryRoute,
      );
      expect(find.text('Invalid QR code.'), findsOneWidget);
    });

    testWidgets('supplier reservation QR opens the existing verify flow', (
      tester,
    ) async {
      final repo = _FakeSupplierRequestsRepository()
        ..onVerify = (_) async => _supplierPreview();
      final router = await _pumpAuthenticated(
        tester,
        _user(roles: const ['SUPPLIER'], activeRole: 'SUPPLIER'),
        extraOverrides: [
          supplierRequestsRepositoryProvider.overrideWithValue(repo),
        ],
      );

      router.go('impactloop://handover/$_plausibleToken');
      await tester.pumpAndSettle();

      _expectNoBrokenRouteLeak(_plausibleToken);
      expect(repo.verifyCalls, 1);
      expect(repo.verifiedPayloads, ['impactloop://handover/$_plausibleToken']);
      expect(repo.confirmCalls, 0);
      expect(find.text('QR verified'), findsOneWidget);
      expect(find.text('Confirm handover'), findsOneWidget);
    });

    testWidgets('driver delivery QR opens the existing verify flow', (
      tester,
    ) async {
      final repo = _FakeDriverDeliveriesRepository()
        ..onVerifyDelivery = (_) async => _deliveryPreview();
      final router = await _pumpAuthenticated(
        tester,
        _user(roles: const ['DRIVER'], activeRole: 'DRIVER'),
        extraOverrides: [
          driverDeliveriesRepositoryProvider.overrideWithValue(repo),
        ],
      );

      router.go('impactloop://delivery-handover/$_plausibleToken');
      await tester.pumpAndSettle();

      _expectNoBrokenRouteLeak(_plausibleToken);
      expect(repo.verifyDeliveryCalls, 1);
      expect(repo.confirmDeliveryCalls, 0);
      expect(find.text('Confirm handover'), findsOneWidget);
    });

    testWidgets('wrong-role QR stays on a controlled error page', (
      tester,
    ) async {
      final router = await _pumpAuthenticated(
        tester,
        _user(roles: const ['LEARNER'], activeRole: 'LEARNER'),
      );

      router.go('impactloop://delivery-handover/$_plausibleToken');
      await tester.pumpAndSettle();

      _expectNoBrokenRouteLeak(_plausibleToken);
      expect(
        find.text('This QR cannot be processed with your current account.'),
        findsOneWidget,
      );
    });

    testWidgets('warm start replaces the previous handover URI', (tester) async {
      final repo = _FakeSupplierRequestsRepository()
        ..onVerify = (_) async => _supplierPreview();
      final router = await _pumpAuthenticated(
        tester,
        _user(roles: const ['SUPPLIER'], activeRole: 'SUPPLIER'),
        extraOverrides: [
          supplierRequestsRepositoryProvider.overrideWithValue(repo),
        ],
      );

      router.go('impactloop://handover/$_plausibleToken');
      await tester.pumpAndSettle();
      expect(repo.verifyCalls, 1);

      const nextToken = '${_plausibleToken}zz';
      router.go('impactloop://handover/$nextToken');
      await tester.pumpAndSettle();

      expect(
        router.routeInformationProvider.value.uri.queryParameters['token'],
        nextToken,
      );
      expect(repo.verifyCalls, greaterThanOrEqualTo(2));
      expect(
        repo.verifiedPayloads.last,
        'impactloop://handover/$nextToken',
      );
      expect(repo.confirmCalls, 0);
      expect(find.text('QR verified'), findsOneWidget);
    });
  });
}

void _expectNoBrokenRouteLeak(String token) {
  expect(find.textContaining('no routes for location'), findsNothing);
  expect(find.textContaining('page not found'), findsNothing);
  expect(find.textContaining('Page Not Found'), findsNothing);
  expect(find.textContaining('impactloop://'), findsNothing);
  expect(find.textContaining(token), findsNothing);
}

Future<GoRouter> _pumpSignedOut(WidgetTester tester, {User? loginUser}) async {
  final tokenStorage = _FakeTokenStorage(initialRefreshToken: 'stale-refresh');
  final accessTokenHolder = AccessTokenHolder();
  final repository = AuthRepository(
    api: _FakeAuthApi(loginUser: loginUser),
    tokenStorage: tokenStorage,
    accessTokenHolder: accessTokenHolder,
    sessionRefresher: _ConfigurableAuthSessionRefresher(
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
      refreshError: DioException(
        requestOptions: RequestOptions(path: '/api/auth/refresh'),
      ),
    ),
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ..._sharedOverrides,
        authRepositoryProvider.overrideWithValue(repository),
      ],
      child: const ImpactLoopApp(),
    ),
  );
  await tester.pumpAndSettle();
  return ProviderScope.containerOf(
    tester.element(find.byType(ImpactLoopApp)),
  ).read(appRouterProvider);
}

Future<GoRouter> _pumpAuthenticated(
  WidgetTester tester,
  User user, {
  List extraOverrides = const [],
}) async {
  final tokenStorage = _FakeTokenStorage(initialRefreshToken: 'stored-refresh');
  final accessTokenHolder = AccessTokenHolder();
  final repository = AuthRepository(
    api: _FakeAuthApi(meResult: user),
    tokenStorage: tokenStorage,
    accessTokenHolder: accessTokenHolder,
    sessionRefresher: _ConfigurableAuthSessionRefresher(
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
      refreshResult: const AuthTokens(
        accessToken: 'restored-access',
        refreshToken: 'rotated-refresh',
      ),
    ),
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ..._sharedOverrides,
        authRepositoryProvider.overrideWithValue(repository),
        supplierDashboardProvider.overrideWith(
          (ref) async => _testSupplierDashboard(),
        ),
        supplierActionNeededCountProvider.overrideWith((ref) => 0),
        supplierDisplayAvatarUrlProvider.overrideWith((ref) => null),
        supplierProfileManagementProvider.overrideWith(
          (ref) => Future.error(StateError('Profile rendering stub')),
        ),
        ...extraOverrides,
      ],
      child: const ImpactLoopApp(),
    ),
  );
  await tester.pumpAndSettle();
  return ProviderScope.containerOf(
    tester.element(find.byType(ImpactLoopApp)),
  ).read(appRouterProvider);
}

User _user({required List<String> roles, required String activeRole}) {
  return User(
    id: 'user-1',
    displayName: 'Restored User',
    email: 'restored@example.com',
    accountStatus: 'ACTIVE',
    roles: roles,
    activeRole: activeRole,
    createdAt: DateTime(2026),
  );
}

HandoverVerifyPreview _supplierPreview() {
  return HandoverVerifyPreview(
    reservationId: 'res-1',
    materialId: 'mat-1',
    materialTitle: 'Arduino Uno',
    quantity: 1,
    unit: 'piece',
    learnerDisplayName: 'Majd Awwad',
    expiresAt: DateTime.now().add(const Duration(hours: 1)),
  );
}

DeliveryHandoverVerifyPreview _deliveryPreview() {
  return DeliveryHandoverVerifyPreview(
    deliveryId: 'del-1',
    learnerDisplayName: 'Majd Awwad',
    destinationCity: 'Ramallah',
    items: const [
      DeliveryHandoverVerifyPreviewItem(
        reservationId: 'res-1',
        materialId: 'mat-1',
        materialTitle: 'Arduino Uno',
        quantity: 1,
        unit: 'piece',
      ),
    ],
    expiresAt: DateTime.now().add(const Duration(hours: 1)),
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

class _FakeSupplierRequestsRepository implements SupplierRequestsRepository {
  Future<HandoverVerifyPreview> Function(String token)? onVerify;
  int verifyCalls = 0;
  int confirmCalls = 0;
  final verifiedPayloads = <String>[];

  @override
  Future<HandoverVerifyPreview> verifyHandoverCredential(
    String handoverToken,
  ) async {
    verifyCalls += 1;
    verifiedPayloads.add(handoverToken);
    final handler = onVerify;
    if (handler == null) {
      throw StateError('onVerify not configured');
    }
    return handler(handoverToken);
  }

  @override
  Future<SupplierIncomingRequest> confirmHandoverCredential(
    String handoverToken, {
    bool cashReceivedConfirmed = false,
  }) async {
    confirmCalls += 1;
    throw StateError('confirm must not run from deep-link open');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _FakeDriverDeliveriesRepository implements DriverDeliveriesRepository {
  Future<DeliveryHandoverVerifyPreview> Function(String token)?
  onVerifyDelivery;
  int verifyDeliveryCalls = 0;
  int confirmDeliveryCalls = 0;

  @override
  Future<DeliveryHandoverVerifyPreview> verifyDeliveryHandoverCredential(
    String handoverToken,
  ) async {
    verifyDeliveryCalls += 1;
    final handler = onVerifyDelivery;
    if (handler == null) {
      throw StateError('onVerifyDelivery not configured');
    }
    return handler(handoverToken);
  }

  @override
  Future<DriverDelivery> confirmDeliveryHandoverCredential(
    String handoverToken, {
    bool cashReceivedConfirmed = false,
  }) async {
    confirmDeliveryCalls += 1;
    throw StateError('confirm must not run from deep-link open');
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
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

class _ConfigurableAuthSessionRefresher extends AuthSessionRefresher {
  _ConfigurableAuthSessionRefresher({
    required TokenStorage tokenStorage,
    required AccessTokenHolder accessTokenHolder,
    this.refreshResult,
    this.refreshError,
  }) : _tokenStorage = tokenStorage,
       _accessTokenHolder = accessTokenHolder,
       super(
         refreshClient: Dio(),
         tokenStorage: tokenStorage,
         accessTokenHolder: accessTokenHolder,
       );

  final TokenStorage _tokenStorage;
  final AccessTokenHolder _accessTokenHolder;
  final AuthTokens? refreshResult;
  final Object? refreshError;

  @override
  Future<String> refreshAccessToken() async {
    if (refreshError != null) {
      throw refreshError!;
    }

    final tokens =
        refreshResult ?? const AuthTokens(accessToken: 'access-token');
    _accessTokenHolder.accessToken = tokens.accessToken;

    final rotated = tokens.refreshToken;
    if (rotated != null && rotated.isNotEmpty) {
      await _tokenStorage.saveRefreshToken(rotated);
    }

    return tokens.accessToken;
  }
}

class _FakeAuthApi extends AuthApi {
  _FakeAuthApi({this.meResult, this.loginUser}) : super(Dio());

  final User? meResult;
  final User? loginUser;

  @override
  Future<User> me() async {
    return meResult ??
        _user(roles: const ['LEARNER'], activeRole: 'LEARNER');
  }

  @override
  Future<({AuthTokens tokens, User user})> login({
    required String email,
    required String password,
  }) async {
    return (
      tokens: const AuthTokens(
        accessToken: 'login-access',
        refreshToken: 'login-refresh',
      ),
      user:
          loginUser ??
          meResult ??
          _user(roles: const ['LEARNER'], activeRole: 'LEARNER'),
    );
  }

  @override
  Future<void> logout({String? refreshToken}) async {}
}
