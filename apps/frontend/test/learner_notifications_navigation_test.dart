import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/app/widgets/entry_nav_bar.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/notifications/application/notifications_routes.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/notifications/data/notifications_api.dart';
import 'package:frontend/features/notifications/presentation/notification_visuals.dart';
import 'package:frontend/features/notifications/presentation/pages/user_notifications_page.dart';
import 'package:frontend/features/home/presentation/pages/learner_home_page.dart';
import 'package:frontend/features/home/application/learner_home_provider.dart';
import 'package:frontend/features/home/domain/learner_home_models.dart';
import 'package:frontend/features/learning_hub/presentation/pages/learning_hub_page.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/material_discovery/presentation/pages/materials_discovery_page.dart';
import 'package:frontend/features/material_discovery/application/material_discovery_providers.dart';
import 'package:frontend/features/material_discovery/data/mock_material_discovery_repository.dart';
import 'package:frontend/features/materials/application/material_listing_providers.dart';
import 'package:frontend/features/locations/application/saved_locations_providers.dart';
import 'package:frontend/features/profile/presentation/widgets/profile_family_page_widgets.dart';
import 'package:frontend/features/reservations/presentation/pages/learner_reservations_page.dart';
import 'package:frontend/features/reservations/application/my_reservations_provider.dart';
import 'package:frontend/features/deliveries/application/learner_deliveries_provider.dart';
import 'package:frontend/features/driver_portal/presentation/shell/driver_portal_shell.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/widgets/notification_bell_button.dart';

import 'support/learning_hub_test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('notification type icons', () {
    test('maps supported categories and uses a non-bell fallback', () {
      expect(
        iconForNotification(_notification('RESERVATION_ACCEPTED')),
        Icons.event_available_outlined,
      );
      expect(
        iconForNotification(
          _notification(
            'DRIVER_DELIVERY_ACCEPTED',
            relatedEntityType: 'DELIVERY',
          ),
        ),
        Icons.local_shipping_outlined,
      );
      expect(
        iconForNotification(_notification('MATERIAL_MODERATION_UPDATE')),
        Icons.inventory_2_outlined,
      );
      expect(
        iconForNotification(
          _notification(
            'LEARNING_PROJECT_MODERATION',
            relatedEntityType: 'LEARNING_PROJECT',
          ),
        ),
        Icons.school_outlined,
      );
      expect(
        iconForNotification(_notification('CATEGORY_REQUEST_UPDATE')),
        Icons.handshake_outlined,
      );
      expect(
        iconForNotification(_notification('SUPPLIER_VERIFICATION_UPDATE')),
        Icons.manage_accounts_outlined,
      );
      expect(
        iconForNotification(_notification('LEGACY_UNKNOWN_EVENT')),
        Icons.info_outline_rounded,
      );
      expect(
        iconForNotification(_notification('LEGACY_UNKNOWN_EVENT')),
        isNot(Icons.notifications_none_outlined),
      );
      expect(
        categoryForNotification(_notification('RESERVATION_ACCEPTED')),
        NotificationVisualCategory.reservation,
      );
    });
  });

  group('learner notifications navigation and layout', () {
    testWidgets('notification bell navigates to /notifications', (
      tester,
    ) async {
      final harness = await _pumpShell(
        tester,
        initialLocation: '/home',
        surfaceSize: const Size(1100, 900),
      );

      expect(find.byType(NotificationBellButton), findsWidgets);
      await tester.tap(find.byType(NotificationBellButton).first);
      await tester.pumpAndSettle();

      expect(harness.router.state.uri.path, '/notifications');
      expect(find.byType(UserNotificationsPage), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('bell is present on home and profile/account shells', (
      tester,
    ) async {
      final harness = await _pumpShell(
        tester,
        initialLocation: '/home',
        surfaceSize: const Size(1100, 900),
      );

      expect(find.byType(NotificationBellButton), findsWidgets);

      harness.router.go('/profile');
      await tester.pumpAndSettle();
      expect(find.byType(NotificationBellButton), findsWidgets);

      harness.router.go('/profile/account');
      await tester.pumpAndSettle();
      expect(find.byType(NotificationBellButton), findsWidgets);
      expect(tester.takeException(), isNull);
    });

    testWidgets('direct /notifications navigation renders the page', (
      tester,
    ) async {
      await _pumpShell(
        tester,
        initialLocation: '/notifications',
        surfaceSize: const Size(1100, 900),
      );

      expect(find.byType(UserNotificationsPage), findsOneWidget);
      expect(find.text('Notifications'), findsWidgets);
      expect(find.text('Reservation accepted'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('mobile layout does not overflow and shows back control', (
      tester,
    ) async {
      final harness = await _pumpShell(
        tester,
        initialLocation: '/notifications',
        surfaceSize: const Size(360, 800),
      );

      expect(tester.takeException(), isNull);
      expect(
        find.byKey(const Key('notifications-back-button')),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const Key('notifications-back-button')));
      await tester.pumpAndSettle();
      expect(harness.router.state.uri.path, '/home');
    });

    testWidgets('mobile back falls back to /home on direct entry', (
      tester,
    ) async {
      final harness = await _pumpShell(
        tester,
        initialLocation: '/notifications',
        surfaceSize: const Size(390, 844),
      );

      expect(harness.router.canPop(), isFalse);
      await tester.tap(find.byKey(const Key('notifications-back-button')));
      await tester.pumpAndSettle();
      expect(harness.router.state.uri.path, '/home');
    });

    testWidgets('desktop cards stay content-sized without fixed large height', (
      tester,
    ) async {
      await _pumpShell(
        tester,
        initialLocation: '/notifications',
        surfaceSize: const Size(1280, 900),
      );

      final icon = find.byKey(const Key('notification-type-icon-unread-1'));
      expect(icon, findsOneWidget);
      final tile = find
          .ancestor(of: icon, matching: find.byType(InkWell))
          .first;
      final size = tester.getSize(tile);
      // Short reservation copy lands ~156px; keep bound well under old 220.
      expect(size.height, lessThan(180));
      expect(size.width, lessThanOrEqualTo(notificationsContentMaxWidth + 1));
      expect(tester.takeException(), isNull);
    });

    testWidgets('responsive viewports keep one bell and visible summary', (
      tester,
    ) async {
      for (final size in const [
        Size(320, 720),
        Size(390, 844),
        Size(430, 900),
        Size(768, 1024),
        Size(1100, 900),
        Size(1440, 900),
      ]) {
        await _pumpShell(
          tester,
          initialLocation: '/notifications',
          surfaceSize: size,
        );

        expect(tester.takeException(), isNull, reason: '$size');
        expect(
          find.byType(NotificationBellButton),
          findsOneWidget,
          reason: '$size',
        );
        final summary = find.textContaining('Showing');
        if (summary.evaluate().isEmpty) {
          await tester.drag(find.byType(ListView), const Offset(0, -500));
          await tester.pumpAndSettle();
        }
        expect(find.textContaining('Showing'), findsOneWidget, reason: '$size');
        expect(find.byType(UserNotificationsPage), findsOneWidget);
      }
    });

    testWidgets(
      'supplier material moderation deep link marks read and opens material',
      (tester) async {
        final harness = await _pumpShell(
          tester,
          initialLocation: '/notifications',
          surfaceSize: const Size(1100, 900),
          listNotifierBuilder: _MaterialModerationListNotifier.new,
          user: _user(roles: const ['SUPPLIER'], activeRole: 'SUPPLIER'),
        );

        expect(find.text('Material review update'), findsOneWidget);
        expect(
          find.byKey(const Key('notification-unread-dot-mod-1')),
          findsOneWidget,
        );
        await tester.tap(find.text('Material review update'));
        await tester.pumpAndSettle();

        expect(
          harness.router.state.uri.path,
          '/supplier/materials/material-42',
        );
        expect(harness.router.canPop(), isTrue);

        harness.router.pop();
        await tester.pumpAndSettle();
        expect(harness.router.state.uri.path, '/notifications');
        expect(
          find.byKey(const Key('notification-unread-dot-mod-1')),
          findsNothing,
        );
      },
    );

    testWidgets(
      'role-gated bell appears once for learner supplier and driver',
      (tester) async {
        await _pumpRoleNav(tester, _user(roles: const ['LEARNER']));
        expect(find.byType(NotificationBellButton), findsOneWidget);

        await _pumpRoleNav(
          tester,
          _user(roles: const ['SUPPLIER'], activeRole: 'SUPPLIER'),
        );
        expect(find.byType(NotificationBellButton), findsOneWidget);

        _setTestSurface(tester, const Size(900, 760));
        final driverRouter = GoRouter(
          initialLocation: '/driver/jobs',
          routes: [
            ShellRoute(
              builder: (context, state, child) =>
                  DriverPortalShell(child: child),
              routes: [
                GoRoute(
                  path: '/driver/jobs',
                  builder: (context, state) =>
                      const Center(child: Text('Jobs')),
                ),
              ],
            ),
          ],
        );
        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              authControllerProvider.overrideWith(
                () =>
                    _Auth(_user(roles: const ['DRIVER'], activeRole: 'DRIVER')),
              ),
              myNotificationUnreadCountProvider.overrideWith(
                () => _TestUnreadCountNotifier(0),
              ),
              supplierNotificationsUnreadCountProvider.overrideWith(
                _ZeroSupplierUnread.new,
              ),
            ],
            child: MaterialApp.router(
              localizationsDelegates: const [
                AppLocalizations.delegate,
                GlobalMaterialLocalizations.delegate,
                GlobalWidgetsLocalizations.delegate,
                GlobalCupertinoLocalizations.delegate,
              ],
              supportedLocales: AppLocalizations.supportedLocales,
              routerConfig: driverRouter,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.byType(NotificationBellButton), findsOneWidget);
      },
    );

    testWidgets('admin and moderator do not receive a notification bell', (
      tester,
    ) async {
      await _pumpRoleNav(
        tester,
        _user(roles: const ['ADMIN'], activeRole: 'ADMIN'),
      );
      expect(find.byType(NotificationBellButton), findsNothing);

      await _pumpRoleNav(
        tester,
        _user(roles: const ['MODERATOR'], activeRole: 'MODERATOR'),
      );
      expect(find.byType(NotificationBellButton), findsNothing);
    });

    testWidgets('showNotificationBell false suppresses auto injection', (
      tester,
    ) async {
      _setTestSurface(tester, const Size(1100, 900));
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(
              () => _Auth(_user(roles: const ['LEARNER'])),
            ),
            myNotificationUnreadCountProvider.overrideWith(
              () => _TestUnreadCountNotifier(0),
            ),
          ],
          child: MaterialApp(
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: const Scaffold(
              body: EntryNavBar(
                showSignIn: false,
                showCreateAccount: false,
                homeRoute: '/home',
                showNotificationBell: false,
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.byType(NotificationBellButton), findsNothing);
    });

    testWidgets('real learner pages use shared chrome with exactly one bell', (
      tester,
    ) async {
      await _pumpRealLearnerPage(
        tester,
        const LearnerHomePage(),
        overrides: [
          learnerHomeFeedProvider.overrideWith(
            (ref) async => const LearnerHomeFeed(
              profileCompletion: LearnerHomeProfileCompletion(
                hasInterests: false,
                hasSavedLocation: false,
                hasSavedProjects: false,
                hasActivity: false,
              ),
              sections: [],
            ),
          ),
        ],
      );
      expect(find.byType(EntryNavBar), findsOneWidget);
      expect(find.byType(NotificationBellButton), findsOneWidget);

      await _pumpRealLearnerPage(
        tester,
        ProfileFamilyPageScaffold(
          title: 'Account',
          backTooltip: 'Back',
          backFallbackRoute: '/profile',
          child: const Text('Account body'),
        ),
        overrides: const [],
      );
      expect(find.byType(NotificationBellButton), findsOneWidget);

      await _pumpRealLearnerPage(
        tester,
        const MaterialsDiscoveryPage(),
        overrides: [
          materialDiscoveryRepositoryProvider.overrideWithValue(
            const MockMaterialDiscoveryRepository(),
          ),
          discoveryMaterialCategoriesProvider.overrideWith(
            (ref) => Future.value([]),
          ),
          savedLocationsProvider.overrideWith((ref) => Future.value([])),
        ],
      );
      expect(find.byType(EntryNavBar), findsOneWidget);
      expect(find.byType(NotificationBellButton), findsOneWidget);

      await _pumpRealLearnerPage(
        tester,
        const LearningHubPage(),
        overrides: [
          learningHubRepositoryProvider.overrideWithValue(
            emptyLearningHubRepository,
          ),
        ],
      );
      expect(find.byType(EntryNavBar), findsOneWidget);
      expect(find.byType(NotificationBellButton), findsOneWidget);

      await _pumpRealLearnerPage(
        tester,
        const LearnerReservationsPage(),
        overrides: [
          myReservationsProvider.overrideWith((ref) async => []),
          learnerDeliveriesProvider.overrideWith((ref) async => []),
        ],
      );
      expect(find.byType(EntryNavBar), findsOneWidget);
      expect(find.byType(NotificationBellButton), findsOneWidget);
    });

    test('material review open routes follow exact backend contracts', () {
      final moderation = AppNotification(
        id: 'mod-1',
        notificationType: 'MATERIAL_MODERATION_UPDATE',
        title: 'Listing updated',
        body: 'Your material was updated by moderation.',
        relatedEntityType: 'MATERIAL',
        relatedEntityId: 'material-9',
        actionType: 'OPEN_MATERIAL',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
      expect(
        notificationOpenRoute(
          moderation,
          isSupplierMode: true,
          isDriverMode: false,
        ),
        '/supplier/materials/material-9',
      );
      expect(
        notificationOpenRoute(
          moderation,
          isSupplierMode: false,
          isDriverMode: false,
        ),
        isNull,
      );
      expect(
        notificationActionLabel(moderation, isSupplierMode: true),
        'View material',
      );
      expect(
        notificationActionLabel(moderation, isSupplierMode: true, l10n: null),
        'View material',
      );

      final categoryApproved = AppNotification(
        id: 'cat-1',
        notificationType: 'CATEGORY_REQUEST_UPDATE',
        title: 'Category request approved',
        body: 'Continue listing.',
        relatedEntityType: 'CATEGORY_REQUEST',
        relatedEntityId: 'category-request-1',
        actionType: 'CONTINUE_LISTING',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
      expect(
        notificationOpenRoute(
          categoryApproved,
          isSupplierMode: true,
          isDriverMode: false,
        ),
        '/supplier/materials/new?categoryRequestId=category-request-1',
      );
      expect(
        notificationOpenRoute(
          categoryApproved,
          isSupplierMode: false,
          isDriverMode: false,
        ),
        isNull,
      );

      final priceRejected = AppNotification(
        id: 'price-1',
        notificationType: 'PRICE_REQUEST_UPDATE',
        title: 'Price request rejected',
        body: 'Edit listing.',
        relatedEntityType: 'PRICE_RULE_REQUEST',
        relatedEntityId: 'price-request-1',
        actionType: 'EDIT_LISTING',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
      expect(
        notificationOpenRoute(
          priceRejected,
          isSupplierMode: true,
          isDriverMode: false,
        ),
        '/supplier/materials/new?priceRuleRequestId=price-request-1',
      );

      final published = AppNotification(
        id: 'pub-1',
        notificationType: 'CATEGORY_REQUEST_UPDATE',
        title: 'Listing published',
        body: 'Published.',
        relatedEntityType: 'CATEGORY_REQUEST',
        relatedEntityId: 'category-request-1',
        actionType: 'NONE',
        metadata: const {'publishedMaterialId': 'material-99'},
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
      expect(
        notificationOpenRoute(
          published,
          isSupplierMode: true,
          isDriverMode: false,
        ),
        isNull,
      );

      final inventedMatch = AppNotification(
        id: 'invented',
        notificationType: 'MATERIAL_REQUEST_MATCH',
        title: 'Match',
        body: 'Body',
        relatedEntityType: 'MATERIAL',
        relatedEntityId: 'material-9',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
      expect(
        notificationOpenRoute(
          inventedMatch,
          isSupplierMode: false,
          isDriverMode: false,
        ),
        isNull,
      );
      expect(notificationHasNavigationTarget(inventedMatch), isFalse);

      final categoryIdAsMaterial = AppNotification(
        id: 'bad',
        notificationType: 'CATEGORY_REQUEST_UPDATE',
        title: 'Category',
        body: 'Body',
        relatedEntityType: 'CATEGORY_REQUEST',
        relatedEntityId: 'category-request-1',
        actionType: 'CONTINUE_LISTING',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
      final categoryRoute = notificationOpenRoute(
        categoryIdAsMaterial,
        isSupplierMode: true,
        isDriverMode: false,
      );
      expect(categoryRoute, isNot(contains('/materials/category-request-1')));
      expect(categoryRoute, isNot(contains('/learner/material-requests/')));

      final missingMaterialId = AppNotification(
        id: 'missing',
        notificationType: 'MATERIAL_MODERATION_UPDATE',
        title: 'Listing updated',
        body: 'Body',
        relatedEntityType: 'MATERIAL',
        actionType: 'OPEN_MATERIAL',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
      expect(
        notificationOpenRoute(
          missingMaterialId,
          isSupplierMode: true,
          isDriverMode: false,
        ),
        isNull,
      );

      expect(
        userSupportsNotificationInbox(_user(roles: const ['LEARNER'])),
        isTrue,
      );
      expect(
        userSupportsNotificationInbox(
          _user(roles: const ['ADMIN'], activeRole: 'ADMIN'),
        ),
        isFalse,
      );
    });

    testWidgets('read unread and all filters still work', (tester) async {
      await _pumpShell(
        tester,
        initialLocation: '/notifications',
        surfaceSize: const Size(1100, 900),
      );

      expect(find.text('Reservation accepted'), findsOneWidget);

      await tester.tap(find.byKey(const Key('notifications-read-filter-unread')));
      await tester.pumpAndSettle();
      expect(find.text('Reservation accepted'), findsOneWidget);

      await tester.tap(find.byKey(const Key('notifications-read-filter-read')));
      await tester.pumpAndSettle();
      expect(find.text('Learning project approved'), findsOneWidget);

      await tester.tap(find.byKey(const Key('notifications-read-filter-all')));
      await tester.pumpAndSettle();
      expect(find.text('Reservation accepted'), findsOneWidget);
      expect(find.text('Learning project approved'), findsOneWidget);
    });

    testWidgets('mark all as read clears unread state and badge', (
      tester,
    ) async {
      final harness = await _pumpShell(
        tester,
        initialLocation: '/notifications',
        surfaceSize: const Size(1100, 900),
      );

      expect(
        find.byKey(const Key('notifications-mark-all-read')),
        findsOneWidget,
      );
      await tester.tap(find.byKey(const Key('notifications-mark-all-read')));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('notifications-mark-all-read')),
        findsNothing,
      );
      expect(
        harness.container.read(myNotificationUnreadCountProvider).value,
        0,
      );
      expect(
        find.byKey(const Key('notification-unread-dot-unread-1')),
        findsNothing,
      );
    });

    testWidgets('refresh exposes a loading or disabled state', (tester) async {
      final gate = Completer<void>();
      var delayNextBuild = false;
      await _pumpShell(
        tester,
        initialLocation: '/notifications',
        surfaceSize: const Size(1100, 900),
        listNotifierBuilder: () => _DelayedNotificationsListNotifier(
          shouldDelay: () => delayNextBuild,
          gate: gate,
        ),
      );

      final refresh = find.byKey(const Key('notifications-refresh-button'));
      expect(refresh, findsOneWidget);

      delayNextBuild = true;
      await tester.tap(refresh);
      await tester.pump();
      expect(
        find.descendant(
          of: refresh,
          matching: find.byType(CircularProgressIndicator),
        ),
        findsOneWidget,
      );

      gate.complete();
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('Arabic RTL and English LTR render without overflow', (
      tester,
    ) async {
      await _pumpShell(
        tester,
        initialLocation: '/notifications',
        surfaceSize: const Size(360, 800),
        locale: const Locale('ar'),
      );
      expect(tester.takeException(), isNull);
      expect(find.text('الإشعارات'), findsWidgets);

      await _pumpShell(
        tester,
        initialLocation: '/notifications',
        surfaceSize: const Size(360, 800),
        locale: const Locale('en'),
      );
      expect(tester.takeException(), isNull);
      expect(find.text('Notifications'), findsWidgets);
    });

    testWidgets('reservation deep-link action remains functional', (
      tester,
    ) async {
      final harness = await _pumpShell(
        tester,
        initialLocation: '/notifications',
        surfaceSize: const Size(1100, 900),
      );

      await tester.tap(find.text('Reservation accepted'));
      await tester.pumpAndSettle();
      expect(
        harness.router.state.uri.path,
        '/learner/reservations/reservation-1',
      );
      expect(
        find.byKey(const Key('notification-unread-dot-unread-1')),
        findsNothing,
      );
      expect(
        harness.container.read(myNotificationUnreadCountProvider).value,
        0,
      );
    });

    testWidgets(
      'non-navigable unread notification marks read and stays on page',
      (tester) async {
        final harness = await _pumpShell(
          tester,
          initialLocation: '/notifications',
          surfaceSize: const Size(1100, 900),
          listNotifierBuilder: _GenericUnreadListNotifier.new,
        );

        expect(
          find.byKey(const Key('notification-unread-dot-generic-1')),
          findsOneWidget,
        );
        expect(
          harness.container.read(myNotificationUnreadCountProvider).value,
          1,
        );

        await tester.tap(find.text('Something happened'));
        await tester.pumpAndSettle();

        expect(harness.router.state.uri.path, '/notifications');
        expect(
          find.byKey(const Key('notification-unread-dot-generic-1')),
          findsNothing,
        );
        expect(
          harness.container.read(myNotificationUnreadCountProvider).value,
          0,
        );
        expect(tester.takeException(), isNull);
      },
    );

    testWidgets(
      'already-read navigable notification skips mark-read and still navigates',
      (tester) async {
        final harness = await _pumpShell(
          tester,
          initialLocation: '/notifications',
          surfaceSize: const Size(1100, 900),
          listNotifierBuilder: _AlreadyReadReservationListNotifier.new,
        );

        await tester.tap(find.text('Reservation accepted'));
        await tester.pumpAndSettle();

        expect(
          harness.router.state.uri.path,
          '/learner/reservations/reservation-1',
        );
        final notifier = harness.container
                .read(notificationsListProvider.notifier)
            as _AlreadyReadReservationListNotifier;
        expect(notifier.markReadCalls, isEmpty);
      },
    );
  });
}

AppNotification _notification(
  String type, {
  String? relatedEntityType,
  String? relatedEntityId,
  bool isRead = false,
}) {
  return AppNotification(
    id: 'n-$type',
    notificationType: type,
    title: 'Title',
    body: 'Body',
    relatedEntityType: relatedEntityType,
    relatedEntityId: relatedEntityId,
    isRead: isRead,
    createdAt: DateTime.utc(2026),
  );
}

class _Harness {
  const _Harness({required this.router, required this.container});

  final GoRouter router;
  final ProviderContainer container;
}

Future<_Harness> _pumpShell(
  WidgetTester tester, {
  required String initialLocation,
  required Size surfaceSize,
  Locale locale = const Locale('en'),
  NotificationsListNotifier Function()? listNotifierBuilder,
  User? user,
}) async {
  _setTestSurface(tester, surfaceSize);

  final authUser =
      user ??
      User(
        id: 'learner-1',
        displayName: 'Learner',
        email: 'learner@example.com',
        accountStatus: 'ACTIVE',
        roles: const ['LEARNER'],
        createdAt: DateTime.utc(2026),
      );
  final unread = _TestUnreadCountNotifier(1);
  final listBuilder = listNotifierBuilder ?? _TestNotificationsListNotifier.new;

  final router = GoRouter(
    initialLocation: initialLocation,
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
        path: '/profile',
        builder: (context, state) => const Scaffold(
          body: EntryNavBar(
            showSignIn: false,
            showCreateAccount: false,
            homeRoute: '/home',
            phoneTitle: 'Profile',
            showPhoneAccountMenu: false,
          ),
        ),
      ),
      GoRoute(
        path: '/profile/account',
        builder: (context, state) => ProfileFamilyPageScaffold(
          title: 'Account',
          backTooltip: 'Back',
          backFallbackRoute: '/profile',
          child: const Text('Account body'),
        ),
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const UserNotificationsPage(),
      ),
      GoRoute(
        path: '/learner/reservations/:id',
        builder: (context, state) =>
            Text('Reservation ${state.pathParameters['id']}'),
      ),
      GoRoute(
        path: '/materials/:id',
        builder: (context, state) =>
            Text('Material ${state.pathParameters['id']}'),
      ),
      GoRoute(
        path: '/supplier/materials/new',
        builder: (context, state) =>
            Text('Supplier new material ${state.uri.query}'),
      ),
      GoRoute(
        path: '/supplier/materials/:id',
        builder: (context, state) =>
            Text('Supplier material ${state.pathParameters['id']}'),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(() => _Auth(authUser)),
        notificationsListProvider.overrideWith(listBuilder),
        myNotificationUnreadCountProvider.overrideWith(() => unread),
        notificationReadFilterProvider.overrideWith(
          NotificationReadFilterNotifier.new,
        ),
        notificationsApiProvider.overrideWithValue(_FakeNotificationsApi()),
        supplierNotificationsUnreadCountProvider.overrideWith(
          _ZeroSupplierUnread.new,
        ),
      ],
      child: MaterialApp.router(
        locale: locale,
        theme: AppTheme.light,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();

  final container = ProviderScope.containerOf(
    tester.element(find.byType(MaterialApp).first),
  );
  return _Harness(router: router, container: container);
}

void _setTestSurface(WidgetTester tester, Size size) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}

class _LearnerAuthController extends AuthController {
  @override
  AuthState build() => AuthState(
    hasBootstrapped: true,
    accessToken: 'token',
    user: User(
      id: 'learner-1',
      displayName: 'Learner',
      email: 'learner@example.com',
      accountStatus: 'ACTIVE',
      roles: const ['LEARNER'],
      createdAt: DateTime.utc(2026),
    ),
  );
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

class _TestUnreadCountNotifier extends NotificationUnreadCountNotifier {
  _TestUnreadCountNotifier(this.initial);

  final int initial;

  @override
  Future<int> build() async => initial;
}

class _TestNotificationsListNotifier extends NotificationsListNotifier {
  NotificationReadFilter _filter = NotificationReadFilter.all;

  List<AppNotification> get _allItems => [
    AppNotification(
      id: 'unread-1',
      notificationType: 'RESERVATION_ACCEPTED',
      title: 'Reservation accepted',
      body: 'Wood boards was accepted.',
      relatedEntityType: 'RESERVATION',
      relatedEntityId: 'reservation-1',
      isRead: false,
      createdAt: DateTime.utc(2026, 1, 2),
      metadata: const {'materialTitle': 'Wood boards'},
    ),
    AppNotification(
      id: 'read-1',
      notificationType: 'LEARNING_PROJECT_MODERATION',
      title: 'Project approved',
      body: 'Your project was approved.',
      relatedEntityType: 'LEARNING_PROJECT',
      relatedEntityId: 'project-1',
      isRead: true,
      createdAt: DateTime.utc(2026, 1, 1),
      metadata: const {
        'projectTitle': 'Desk lamp',
        'moderationEvent': 'APPROVED',
      },
    ),
  ];

  @override
  Future<NotificationsListState> build() async {
    _filter = ref.watch(notificationReadFilterProvider);
    final items = switch (_filter) {
      NotificationReadFilter.all => _allItems,
      NotificationReadFilter.unread =>
        _allItems.where((item) => !item.isRead).toList(growable: false),
      NotificationReadFilter.read =>
        _allItems.where((item) => item.isRead).toList(growable: false),
    };

    return NotificationsListState(
      items: items,
      page: 1,
      totalPages: 1,
      total: items.length,
      unreadCount: _allItems.where((item) => !item.isRead).length,
      isLoadingMore: false,
      filter: _filter,
    );
  }

  @override
  Future<void> markReadLocal(String notificationId) async {
    applyReadLocal(notificationId);
    ref.read(myNotificationUnreadCountProvider.notifier).adjustBy(-1);
  }
}

class _DelayedNotificationsListNotifier extends _TestNotificationsListNotifier {
  _DelayedNotificationsListNotifier({
    required this.shouldDelay,
    required this.gate,
  });

  final bool Function() shouldDelay;
  final Completer<void> gate;

  @override
  Future<NotificationsListState> build() async {
    if (shouldDelay()) {
      await gate.future;
    }
    return super.build();
  }

  @override
  Future<void> refreshInBackground() async {
    final current = state.value;
    if (current == null) {
      return super.refreshInBackground();
    }
    state = AsyncData(current.copyWith(isBackgroundRefreshing: true));
    if (shouldDelay()) {
      await gate.future;
    }
    if (!ref.mounted) {
      return;
    }
    final next = await super.build();
    if (!ref.mounted) {
      return;
    }
    state = AsyncData(next.copyWith(isBackgroundRefreshing: false));
  }
}

class _GenericUnreadListNotifier extends NotificationsListNotifier {
  @override
  Future<NotificationsListState> build() async {
    return NotificationsListState(
      items: [
        AppNotification(
          id: 'generic-1',
          notificationType: 'LEGACY_UNKNOWN_EVENT',
          title: 'Something happened',
          body: 'Please check your account.',
          isRead: false,
          createdAt: DateTime.utc(2026),
        ),
      ],
      page: 1,
      totalPages: 1,
      total: 1,
      unreadCount: 1,
      isLoadingMore: false,
      filter: NotificationReadFilter.all,
    );
  }

  @override
  Future<void> markReadLocal(String notificationId) async {
    applyReadLocal(notificationId);
    ref.read(myNotificationUnreadCountProvider.notifier).adjustBy(-1);
  }
}

class _AlreadyReadReservationListNotifier extends NotificationsListNotifier {
  final List<String> markReadCalls = [];

  @override
  Future<NotificationsListState> build() async {
    return NotificationsListState(
      items: [
        AppNotification(
          id: 'read-res-1',
          notificationType: 'RESERVATION_ACCEPTED',
          title: 'Reservation accepted',
          body: 'Wood boards was accepted.',
          relatedEntityType: 'RESERVATION',
          relatedEntityId: 'reservation-1',
          isRead: true,
          createdAt: DateTime.utc(2026, 1, 2),
          metadata: const {'materialTitle': 'Wood boards'},
        ),
      ],
      page: 1,
      totalPages: 1,
      total: 1,
      unreadCount: 0,
      isLoadingMore: false,
      filter: NotificationReadFilter.all,
    );
  }

  @override
  Future<void> markReadLocal(String notificationId) async {
    markReadCalls.add(notificationId);
    await super.markReadLocal(notificationId);
  }
}

class _MaterialModerationListNotifier extends NotificationsListNotifier {
  @override
  Future<NotificationsListState> build() async {
    return NotificationsListState(
      items: [
        AppNotification(
          id: 'mod-1',
          notificationType: 'MATERIAL_MODERATION_UPDATE',
          title: 'Material listing updated',
          body: 'Your material was updated by moderation.',
          relatedEntityType: 'MATERIAL',
          relatedEntityId: 'material-42',
          actionType: 'OPEN_MATERIAL',
          isRead: false,
          createdAt: DateTime.utc(2026),
        ),
      ],
      page: 1,
      totalPages: 1,
      total: 1,
      unreadCount: 1,
      isLoadingMore: false,
      filter: NotificationReadFilter.all,
    );
  }

  @override
  Future<void> markReadLocal(String notificationId) async {
    applyReadLocal(notificationId);
    ref.read(myNotificationUnreadCountProvider.notifier).adjustBy(-1);
  }
}

class _Auth extends AuthController {
  _Auth(this.user);

  final User user;

  @override
  AuthState build() =>
      AuthState(hasBootstrapped: true, accessToken: 'token', user: user);
}

User _user({required List<String> roles, String? activeRole}) {
  return User(
    id: 'user-1',
    displayName: 'User',
    email: 'user@example.com',
    accountStatus: 'ACTIVE',
    roles: roles,
    activeRole: activeRole ?? roles.first,
    createdAt: DateTime.utc(2026),
    supplierProfile: roles.contains('SUPPLIER')
        ? const SupplierProfile(
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: 'Supplier',
          )
        : null,
  );
}

class _ZeroSupplierUnread extends SupplierNotificationsUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

Future<void> _pumpRoleNav(WidgetTester tester, User user) async {
  _setTestSurface(tester, const Size(1100, 900));
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(() => _Auth(user)),
        myNotificationUnreadCountProvider.overrideWith(
          () => _TestUnreadCountNotifier(0),
        ),
        supplierNotificationsUnreadCountProvider.overrideWith(
          _ZeroSupplierUnread.new,
        ),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: const Scaffold(
          body: EntryNavBar(
            showSignIn: false,
            showCreateAccount: false,
            homeRoute: '/home',
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

Future<void> _pumpRealLearnerPage(
  WidgetTester tester,
  Widget page, {
  required List<dynamic> overrides,
}) async {
  _setTestSurface(tester, const Size(1100, 900));
  // Clear prior ProviderScope so override lists can change between pages.
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(_LearnerAuthController.new),
        myNotificationUnreadCountProvider.overrideWith(
          () => _TestUnreadCountNotifier(0),
        ),
        ...overrides,
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: page,
      ),
    ),
  );
  await tester.pumpAndSettle();
}
