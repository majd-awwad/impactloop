import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:go_router/go_router.dart';

import 'package:frontend/app/application/app_settings_notifier.dart';
import 'package:frontend/app/application/app_settings_storage.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/auth/presentation/pages/login_page.dart';
import 'package:frontend/features/auth/presentation/pages/register_page.dart';
import 'package:frontend/features/deliveries/application/learner_deliveries_provider.dart';
import 'package:frontend/features/driver_portal/presentation/shell/driver_portal_shell.dart';
import 'package:frontend/features/home/application/learner_home_provider.dart';
import 'package:frontend/features/home/domain/learner_home_models.dart';
import 'package:frontend/features/home/presentation/pages/learner_home_page.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/presentation/pages/learning_hub_page.dart';
import 'package:frontend/features/locations/application/saved_locations_providers.dart';
import 'package:frontend/features/material_discovery/application/material_discovery_providers.dart';
import 'package:frontend/features/materials/application/material_listing_providers.dart';
import 'package:frontend/features/material_discovery/data/mock_material_discovery_repository.dart';
import 'package:frontend/features/material_discovery/presentation/pages/materials_discovery_page.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/notifications/presentation/pages/user_notifications_page.dart';
import 'package:frontend/features/profile/application/profile_providers.dart';
import 'package:frontend/features/profile/data/models/learner_profile_summary.dart';
import 'package:frontend/features/profile/data/profile_api.dart';
import 'package:frontend/features/profile/data/profile_repository.dart';
import 'package:frontend/features/profile/presentation/pages/account_settings_page.dart';
import 'package:frontend/features/profile/presentation/pages/profile_page.dart';
import 'package:frontend/features/reservations/application/my_reservations_provider.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/presentation/pages/learner_reservations_page.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';

import '../support/a11y_test_harness.dart';
import '../support/learning_hub_test_support.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('critical auth routes', () {
    testWidgets('/login renders welcome copy on narrow mobile', (tester) async {
      await pumpA11yPage(
        tester,
        page: const LoginPage(),
        viewport: a11yNarrowViewport,
        textScale: 1.0,
      );

      expect(find.text('Welcome back'), findsOneWidget);
    });

    testWidgets('/register renders account heading on narrow mobile', (
      tester,
    ) async {
      await pumpA11yPage(
        tester,
        page: const RegisterPage(),
        viewport: a11yNarrowViewport,
        textScale: 1.0,
      );

      expect(find.text('Create your account'), findsOneWidget);
    });
  });

  group('learner shell tabs', () {
    testWidgets('shell routes survive mobile text scale 1.4', (tester) async {
      final routes = <String, Widget>{
        '/home': const LearnerHomePage(),
        '/materials': const MaterialsDiscoveryPage(),
        '/learning': const LearningHubPage(),
        '/learner/reservations': const LearnerReservationsPage(),
        '/profile': const ProfilePage(),
      };

      for (final entry in routes.entries) {
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
        await pumpA11yPage(
          tester,
          page: entry.value,
          overrides: _learnerShellOverrides(entry.key),
        );

        expectNoLayoutExceptions(tester);
      }
    });

    testWidgets('/learner/reservations AR refresh tooltip is present', (
      tester,
    ) async {
      final reservation = LearnerReservation.fromJson({
        'id': 'res-a11y',
        'status': 'ACCEPTED',
        'quantityRequested': 1,
        'fulfillmentMethod': 'PICKUP',
        'createdAt': '2026-08-06T10:00:00.000Z',
        'updatedAt': '2026-08-06T10:00:00.000Z',
        'materialSubtotal': 16,
        'material': {
          'id': 'mat-1',
          'title': 'Arduino',
          'materialType': 'Electronics',
          'status': 'RESERVED',
          'unit': 'piece',
          'deliveryAllowed': true,
        },
        'supplier': {'id': 'sup-1', 'displayName': 'Reuse Workshop'},
        'paymentSummary': {
          'enforcementEnabled': true,
          'overallStatus': 'REQUIRES_PAYMENT',
          'outstandingOrderCount': 1,
          'outstandingAmount': '16.00',
          'currency': 'NIS',
          'hasMaterialPaymentOutstanding': true,
          'hasDeliveryFeeOutstanding': false,
          'checkoutableOrderId': 'ord-1',
          'fulfillmentReady': false,
          'pickupCodeAvailable': false,
          'deliveryDispatchable': false,
        },
      });

      await pumpA11yPage(
        tester,
        page: const LearnerReservationsPage(),
        locale: const Locale('ar'),
        overrides: [
          authControllerProvider.overrideWith(_LearnerAuth.new),
          myReservationsProvider.overrideWith((ref) async => [reservation]),
          learnerDeliveriesProvider.overrideWith((ref) async => const []),
        ],
      );

      expect(find.byTooltip('تحديث'), findsOneWidget);
      expectNoLayoutExceptions(tester);
    });
  });

  group('authenticated flows', () {
    testWidgets('/notifications AR payment rows avoid overflow', (tester) async {
      final ar = AppLocalizationsAr();
      configureA11yViewport(tester);
      await tester.pumpWidget(
        MediaQuery(
          data: MediaQueryData(
            size: a11yMobileViewport,
            textScaler: const TextScaler.linear(a11ySmokeTextScale),
          ),
          child: ProviderScope(
            overrides: [
              authControllerProvider.overrideWith(_LearnerAuth.new),
              myReservationsProvider.overrideWith((ref) async => const []),
              learnerDeliveriesProvider.overrideWith((ref) async => const []),
              notificationsListProvider.overrideWith(
                () => _StaticNotificationsList([
                  AppNotification(
                    id: 'pay-required',
                    notificationType: 'PAYMENT_REQUIRED',
                    title: 'Server',
                    body: 'Server',
                    relatedEntityType: 'RESERVATION',
                    relatedEntityId: 'res-1',
                    actionType: 'OPEN_RESERVATION',
                    isRead: false,
                    createdAt: DateTime.utc(2026, 8, 7),
                    metadata: const {
                      'paymentOrderId': 'ord-1',
                      'paymentPurpose': 'MATERIAL_SUBTOTAL',
                      'paymentStatus': 'REQUIRES_PAYMENT',
                      'amount': '42.00',
                      'currency': 'NIS',
                      'reservationId': 'res-1',
                      'materialTitle': 'أسمنت',
                    },
                  ),
                ]),
              ),
              myNotificationUnreadCountProvider.overrideWith(
                () => _UnreadCount(1),
              ),
            ],
            child: MaterialApp(
              locale: const Locale('ar'),
              supportedLocales: AppLocalizations.supportedLocales,
              localizationsDelegates: const [
                AppLocalizations.delegate,
                GlobalMaterialLocalizations.delegate,
                GlobalWidgetsLocalizations.delegate,
                GlobalCupertinoLocalizations.delegate,
              ],
              home: const UserNotificationsPage(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(ar.notificationPaymentRequiredTitle), findsOneWidget);
      expect(find.textContaining('PAYMENT_REQUIRED'), findsNothing);
      expectNoLayoutExceptions(tester);
    });

    testWidgets('/profile/account merges destination and logout semantics', (
      tester,
    ) async {
      configureA11yViewport(tester);
      final router = GoRouter(
        initialLocation: '/profile/account',
        routes: [
          GoRoute(
            path: '/profile/account',
            builder: (_, _) => const AccountSettingsPage(),
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(
              () => _LearnerAuth(user: _learnerUser()),
            ),
            appSettingsStorageProvider.overrideWithValue(
              MemoryAppSettingsStorage(),
            ),
            initialAppSettingsProvider.overrideWithValue(
              const AppSettings(themeMode: ThemeMode.system, languageCode: 'en'),
            ),
            myNotificationUnreadCountProvider.overrideWith(
              _ZeroUnreadCount.new,
            ),
            supplierNotificationsUnreadCountProvider.overrideWith(
              _ZeroSupplierUnread.new,
            ),
          ],
          child: wrapWithA11yMediaQuery(
            child: MaterialApp.router(
              supportedLocales: AppLocalizations.supportedLocales,
              localizationsDelegates: const [
                AppLocalizations.delegate,
                GlobalMaterialLocalizations.delegate,
                GlobalWidgetsLocalizations.delegate,
                GlobalCupertinoLocalizations.delegate,
              ],
              routerConfig: router,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      withSemanticsCheck(tester, () {
        expect(
          find.bySemanticsLabel(
            'Personal information. Name, phone, and profile photo. Open destination.',
          ),
          findsOneWidget,
        );
        expect(
          find.bySemanticsLabel('Logout. Destructive action.'),
          findsOneWidget,
        );
      });
      expectNoLayoutExceptions(tester);
    });
  });

  group('role portals', () {
    testWidgets('/driver shell survives narrow Arabic text scale 1.4', (
      tester,
    ) async {
      configureA11yViewport(tester, viewport: a11yNarrowViewport);
      final router = GoRouter(
        initialLocation: '/driver',
        routes: [
          GoRoute(
            path: '/driver',
            builder: (_, _) => const DriverPortalShell(
              child: Center(child: Text('Driver dashboard')),
            ),
          ),
          GoRoute(path: '/driver/jobs', builder: (_, _) => const SizedBox()),
          GoRoute(path: '/driver/active', builder: (_, _) => const SizedBox()),
          GoRoute(path: '/driver/history', builder: (_, _) => const SizedBox()),
          GoRoute(
            path: '/driver/notifications',
            builder: (_, _) => const SizedBox(),
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_DriverAuth.new),
            myNotificationUnreadCountProvider.overrideWith(_ZeroUnreadCount.new),
            supplierNotificationsUnreadCountProvider.overrideWith(
              _ZeroSupplierUnread.new,
            ),
          ],
          child: wrapWithA11yMediaQuery(
            viewport: a11yNarrowViewport,
            child: MaterialApp.router(
              locale: const Locale('ar'),
              supportedLocales: AppLocalizations.supportedLocales,
              localizationsDelegates: const [
                AppLocalizations.delegate,
                GlobalMaterialLocalizations.delegate,
                GlobalWidgetsLocalizations.delegate,
                GlobalCupertinoLocalizations.delegate,
              ],
              routerConfig: router,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      for (var i = 0; i < 5; i++) {
        expect(find.byKey(ValueKey('driver-mobile-nav-$i')), findsOneWidget);
      }
      expectNoLayoutExceptions(tester);
    });
  });
}

List<Override> _learnerShellOverrides(String route) {
  final overrides = <Override>[
    authControllerProvider.overrideWith(_LearnerAuth.new),
    myNotificationUnreadCountProvider.overrideWith(_ZeroUnreadCount.new),
    profileRepositoryProvider.overrideWithValue(_SmokeProfileRepository()),
  ];

  switch (route) {
    case '/home':
      overrides.add(
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
      );
    case '/materials':
      overrides.addAll([
        materialDiscoveryRepositoryProvider.overrideWithValue(
          const MockMaterialDiscoveryRepository(),
        ),
        discoveryMaterialCategoriesProvider.overrideWith(
          (ref) => Future.value([]),
        ),
        savedLocationsProvider.overrideWith((ref) => Future.value([])),
      ]);
    case '/learning':
      overrides.add(
        learningHubRepositoryProvider.overrideWithValue(
          emptyLearningHubRepository,
        ),
      );
    case '/learner/reservations':
      overrides.addAll([
        myReservationsProvider.overrideWith((ref) async => const []),
        learnerDeliveriesProvider.overrideWith((ref) async => const []),
      ]);
    case '/profile':
      break;
  }

  return overrides;
}

User _learnerUser() {
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

class _LearnerAuth extends AuthController {
  _LearnerAuth({User? user}) : _user = user;

  final User? _user;

  @override
  AuthState build() {
    return AuthState(
      user: _user ?? _learnerUser(),
      accessToken: 'test-token',
      hasBootstrapped: true,
    );
  }
}

class _DriverAuth extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'driver-1',
        displayName: 'Driver',
        email: 'driver@example.com',
        accountStatus: 'ACTIVE',
        roles: const ['DRIVER'],
        activeRole: 'DRIVER',
        createdAt: DateTime.utc(2026),
      ),
      accessToken: 'test-token',
      hasBootstrapped: true,
    );
  }
}

class _ZeroUnreadCount extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

class _UnreadCount extends NotificationUnreadCountNotifier {
  _UnreadCount(this.count);
  final int count;

  @override
  Future<int> build() async => count;
}

class _ZeroSupplierUnread extends SupplierNotificationsUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

class _StaticNotificationsList extends NotificationsListNotifier {
  _StaticNotificationsList(this.items);
  final List<AppNotification> items;

  @override
  Future<NotificationsListState> build() async {
    return NotificationsListState(
      items: items,
      page: 1,
      totalPages: 1,
      total: items.length,
      unreadCount: items.where((n) => !n.isRead).length,
      isLoadingMore: false,
      filter: NotificationReadFilter.all,
    );
  }
}

class _SmokeProfileRepository extends ProfileRepository {
  _SmokeProfileRepository() : super(api: ProfileApi(Dio()));

  @override
  Future<LearnerProfileSummary> fetchLearnerProfileSummary() async {
    return LearnerProfileSummary(
      profileCompletion: const LearnerProfileCompletionSummary(
        completedSteps: 4,
        totalSteps: 6,
        percentage: 67,
        missingSteps: ['phone', 'saved_location'],
      ),
      journey: const LearnerJourneySummary(
        activeReservationsCount: 0,
        completedReservationsCount: 0,
        likedMaterialsCount: 0,
        savedProjectsCount: 0,
        followedProjectsCount: 0,
        activeBuildsCount: 0,
        completedBuildsCount: 0,
      ),
      continueProject: null,
    );
  }
}
