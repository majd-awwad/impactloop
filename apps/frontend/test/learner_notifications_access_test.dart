import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/application/app_settings_notifier.dart';
import 'package:frontend/app/widgets/entry_nav_bar.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/notifications/application/notifications_routes.dart';
import 'package:frontend/features/notifications/presentation/pages/user_notifications_page.dart';
import 'package:frontend/shared/widgets/notification_bell_button.dart';
import 'package:frontend/shared/widgets/user_avatar.dart';

void main() {
  testWidgets('learner desktop navigation renders exactly one notification bell', (
    tester,
  ) async {
    await _pumpLearnerNav(tester, const Size(1100, 900));

    expect(find.byType(NotificationBellButton), findsOneWidget);
  });

  testWidgets('learner tablet layout renders exactly one notification bell', (
    tester,
  ) async {
    await _pumpLearnerNav(tester, const Size(800, 900));

    expect(find.byType(NotificationBellButton), findsOneWidget);
  });

  testWidgets('learner mobile layout renders exactly one notification bell', (
    tester,
  ) async {
    await _pumpLearnerNav(tester, const Size(390, 844));

    expect(find.byType(NotificationBellButton), findsOneWidget);
  });

  testWidgets(
    'duplicate trailing NotificationBellButton is ignored so only one remains',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(1100, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(
              () => _TestAuthController(_learnerUser()),
            ),
            myNotificationUnreadCountProvider.overrideWith(
              () => _ZeroUnreadCountNotifier(),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(
              body: EntryNavBar(
                showSignIn: false,
                showCreateAccount: false,
                homeRoute: '/home',
                trailingActions: [NotificationBellButton(compact: true)],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(NotificationBellButton), findsOneWidget);
    },
  );

  testWidgets('learner EntryNavBar bell opens /notifications', (tester) async {
    final router = GoRouter(
      initialLocation: '/home',
      routes: [
        GoRoute(
          path: '/home',
          builder: (context, state) => const Scaffold(
            body: EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
            ),
          ),
        ),
        GoRoute(
          path: sharedNotificationsRoute,
          builder: (context, state) =>
              const Scaffold(body: Text('Notifications page')),
        ),
      ],
    );

    await tester.binding.setSurfaceSize(const Size(1100, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(_learnerUser()),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _ZeroUnreadCountNotifier(),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(NotificationBellButton), findsOneWidget);

    await tester.tap(find.byType(NotificationBellButton));
    await tester.pumpAndSettle();

    expect(find.text('Notifications page'), findsOneWidget);
    expect(router.state.uri.path, sharedNotificationsRoute);
  });

  testWidgets(
    'notifications page itself still shows exactly one bell in the nav',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(1100, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(
              () => _TestAuthController(_learnerUser()),
            ),
            myNotificationUnreadCountProvider.overrideWith(
              () => _ZeroUnreadCountNotifier(),
            ),
            notificationsListProvider.overrideWith(
              () => _EmptyNotificationsListNotifier(),
            ),
          ],
          child: const MaterialApp(home: UserNotificationsPage()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(NotificationBellButton), findsOneWidget);
    },
  );

  testWidgets('learner account menu includes Arabic Notifications label', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1100, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(_learnerUser()),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _ZeroUnreadCountNotifier(),
          ),
          appSettingsProvider.overrideWith(() => _ArabicSettingsNotifier()),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byType(UserAvatar).first);
    await tester.pumpAndSettle();

    expect(find.text('الإشعارات'), findsOneWidget);
    expect(find.text('Notifications'), findsNothing);
  });

  testWidgets('supplier mode still uses supplier notification route for bell', (
    tester,
  ) async {
    expect(
      notificationRouteForBell(
        User(
          id: 'user-1',
          displayName: 'Supplier',
          email: 'supplier@test.com',
          accountStatus: 'ACTIVE',
          roles: const ['SUPPLIER'],
          activeRole: 'SUPPLIER',
          createdAt: DateTime(2026),
        ),
      ),
      '/supplier/notifications',
    );
    expect(notificationRouteForBell(_learnerUser()), sharedNotificationsRoute);
  });

  testWidgets('RTL layout keeps a single learner notification bell', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1100, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(_learnerUser()),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _ZeroUnreadCountNotifier(),
          ),
          appSettingsProvider.overrideWith(() => _ArabicSettingsNotifier()),
        ],
        child: const Directionality(
          textDirection: TextDirection.rtl,
          child: MaterialApp(
            home: Scaffold(
              body: EntryNavBar(
                showSignIn: false,
                showCreateAccount: false,
                homeRoute: '/home',
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(NotificationBellButton), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pumpLearnerNav(WidgetTester tester, Size size) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(
          () => _TestAuthController(_learnerUser()),
        ),
        myNotificationUnreadCountProvider.overrideWith(
          () => _ZeroUnreadCountNotifier(),
        ),
      ],
      child: const MaterialApp(
        home: Scaffold(
          body: EntryNavBar(
            showSignIn: false,
            showCreateAccount: false,
            homeRoute: '/home',
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

User _learnerUser() {
  return User(
    id: 'learner-1',
    displayName: 'Learner User',
    email: 'learner@example.com',
    accountStatus: 'ACTIVE',
    roles: const ['LEARNER'],
    activeRole: 'LEARNER',
    createdAt: DateTime(2026),
  );
}

class _TestAuthController extends AuthController {
  _TestAuthController(this.user);

  final User user;

  @override
  AuthState build() {
    return AuthState(
      user: user,
      accessToken: 'test-access',
      hasBootstrapped: true,
    );
  }
}

class _ZeroUnreadCountNotifier extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

class _ArabicSettingsNotifier extends AppSettingsNotifier {
  @override
  AppSettings build() {
    return const AppSettings(themeMode: ThemeMode.system, languageCode: 'ar');
  }
}

class _EmptyNotificationsListNotifier extends NotificationsListNotifier {
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
