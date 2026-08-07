import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/app.dart';
import 'package:frontend/app/application/app_settings_notifier.dart';
import 'package:frontend/app/router/app_router.dart';
import 'package:frontend/core/auth/access_token_holder.dart';
import 'package:frontend/core/auth/token_storage.dart';
import 'package:frontend/features/auth/application/auth_providers.dart';
import 'package:frontend/features/auth/data/auth_api.dart';
import 'package:frontend/features/auth/data/auth_repository.dart';
import 'package:frontend/features/auth/data/models/auth_tokens.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/locations/application/saved_locations_providers.dart';
import 'package:frontend/features/material_discovery/application/material_discovery_providers.dart';
import 'package:frontend/features/material_discovery/data/mock_material_discovery_repository.dart';
import 'package:frontend/features/materials/application/material_listing_providers.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/notifications/data/notifications_api.dart';
import 'package:frontend/features/notifications/presentation/pages/user_notifications_page.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_dashboard.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_avatar_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_dashboard_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_profile_providers.dart';
import 'package:frontend/shared/widgets/notification_bell_button.dart';

import 'support/learning_hub_test_support.dart';

/// Production-router regression: /profile/account → /notifications → back.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
    'account settings notifications entry uses canonical /notifications URL',
    (tester) async {
      tester.view.physicalSize = const Size(1100, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final router = await _pumpProductionRouter(tester, _learner());

      router.go('/profile/account');
      await tester.pumpAndSettle();

      expect(
        router.routeInformationProvider.value.uri.path,
        '/profile/account',
      );
      expect(find.text('Account and Settings'), findsOneWidget);
      expect(find.byType(UserNotificationsPage), findsNothing);

      await tester.ensureVisible(find.text('Notifications'));
      await tester.tap(find.text('Notifications').last);
      await tester.pumpAndSettle();

      expect(router.state.uri.path, '/notifications');
      expect(router.routeInformationProvider.value.uri.path, '/notifications');
      expect(find.byType(UserNotificationsPage), findsOneWidget);
      expect(find.text('Account and Settings'), findsNothing);

      expect(router.canPop(), isTrue);
      router.pop();
      await tester.pumpAndSettle();

      expect(router.state.uri.path, '/profile/account');
      expect(
        router.routeInformationProvider.value.uri.path,
        '/profile/account',
      );
      expect(find.text('Account and Settings'), findsOneWidget);
    },
  );

  testWidgets(
    'account settings notification bell pushes /notifications and pops back',
    (tester) async {
      tester.view.physicalSize = const Size(1100, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final router = await _pumpProductionRouter(tester, _learner());

      router.go('/profile/account');
      await tester.pumpAndSettle();

      expect(find.byType(NotificationBellButton), findsOneWidget);
      await tester.tap(find.byType(NotificationBellButton));
      await tester.pumpAndSettle();

      expect(router.state.uri.path, '/notifications');
      expect(router.routeInformationProvider.value.uri.path, '/notifications');
      expect(find.byType(UserNotificationsPage), findsOneWidget);

      router.pop();
      await tester.pumpAndSettle();
      expect(router.state.uri.path, '/profile/account');
      expect(
        router.routeInformationProvider.value.uri.path,
        '/profile/account',
      );
    },
  );

  testWidgets('direct /notifications load and refresh keep the canonical URL', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1100, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final router = await _pumpProductionRouter(tester, _learner());

    router.go('/notifications');
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path, '/notifications');
    expect(find.byType(UserNotificationsPage), findsOneWidget);

    await tester.tap(find.byKey(const Key('notifications-refresh-button')));
    await tester.pumpAndSettle();
    expect(router.routeInformationProvider.value.uri.path, '/notifications');
    expect(find.byType(UserNotificationsPage), findsOneWidget);
  });
}

Future<GoRouter> _pumpProductionRouter(WidgetTester tester, User user) async {
  final repository = AuthRepository(
    api: _FakeAuthApi(meResult: user),
    tokenStorage: _FakeTokenStorage(initialRefreshToken: 'stored-refresh'),
    accessTokenHolder: AccessTokenHolder(),
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        learningHubRepositoryProvider.overrideWithValue(
          emptyLearningHubRepository,
        ),
        initialAppSettingsProvider.overrideWithValue(
          const AppSettings(themeMode: ThemeMode.system, languageCode: 'en'),
        ),
        materialDiscoveryRepositoryProvider.overrideWithValue(
          const MockMaterialDiscoveryRepository(),
        ),
        discoveryMaterialCategoriesProvider.overrideWith(
          (ref) => Future.value([]),
        ),
        savedLocationsProvider.overrideWith((ref) => Future.value([])),
        authRepositoryProvider.overrideWithValue(repository),
        supplierDashboardProvider.overrideWith(
          (ref) async => SupplierDashboard.fromJson({
            'hasSupplierProfile': false,
            'message':
                'Complete your supplier profile to start listing materials.',
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
          }),
        ),
        supplierActionNeededCountProvider.overrideWith((ref) => 0),
        supplierDisplayAvatarUrlProvider.overrideWith((ref) => null),
        supplierProfileManagementProvider.overrideWith(
          (ref) => Future.error(StateError('unused')),
        ),
        supplierNotificationsUnreadCountProvider.overrideWith(
          _ZeroSupplierUnread.new,
        ),
        myNotificationUnreadCountProvider.overrideWith(_ZeroUnread.new),
        notificationsListProvider.overrideWith(_TestListNotifier.new),
        notificationsApiProvider.overrideWithValue(_FakeNotificationsApi()),
        notificationReadFilterProvider.overrideWith(
          NotificationReadFilterNotifier.new,
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

User _learner() {
  return User(
    id: 'learner-1',
    displayName: 'Learner User',
    email: 'learner@example.com',
    accountStatus: 'ACTIVE',
    roles: const ['LEARNER'],
    activeRole: 'LEARNER',
    createdAt: DateTime.utc(2026),
  );
}

class _FakeAuthApi extends AuthApi {
  _FakeAuthApi({required this.meResult}) : super(Dio());

  final User meResult;

  @override
  Future<AuthTokens> refresh({String? refreshToken}) async {
    return const AuthTokens(
      accessToken: 'restored-access',
      refreshToken: 'rotated-refresh',
    );
  }

  @override
  Future<User> me() async => meResult;

  @override
  Future<void> logout({String? refreshToken}) async {}

  @override
  Future<void> forgotPassword({required String email}) async {}

  @override
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {}
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

class _ZeroUnread extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

class _ZeroSupplierUnread extends SupplierNotificationsUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

class _TestListNotifier extends NotificationsListNotifier {
  @override
  Future<NotificationsListState> build() async {
    return const NotificationsListState(
      items: [],
      page: 1,
      totalPages: 1,
      total: 0,
      unreadCount: 0,
      isLoadingMore: false,
      filter: NotificationReadFilter.all,
    );
  }
}

class _FakeNotificationsApi extends NotificationsApi {
  _FakeNotificationsApi() : super(Dio());

  @override
  Future<AppNotificationsPage> fetchNotifications({
    int page = 1,
    int limit = 20,
    bool? isRead,
    String? category,
  }) async {
    return const AppNotificationsPage(
      items: [],
      page: 1,
      limit: 20,
      totalPages: 1,
      total: 0,
      unreadCount: 0,
    );
  }

  @override
  Future<int> fetchUnreadCount() async => 0;

  @override
  Future<AppNotification> markRead(String notificationId) async {
    return AppNotification(
      id: notificationId,
      notificationType: 'TEST',
      title: 'Title',
      body: 'Body',
      isRead: true,
      createdAt: DateTime.utc(2026),
    );
  }

  @override
  Future<void> markAllRead() async {}
}
