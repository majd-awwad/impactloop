import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/driver_portal/data/driver_deliveries_api.dart';
import 'package:frontend/features/driver_portal/data/driver_deliveries_repository.dart';
import 'package:frontend/features/driver_portal/data/driver_profile_api.dart';
import 'package:frontend/features/driver_portal/data/driver_profile_repository.dart';
import 'package:frontend/features/driver_portal/data/models/driver_archive.dart';
import 'package:frontend/features/driver_portal/data/models/driver_deliveries_list_result.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/features/driver_portal/data/models/driver_operational_profile.dart';
import 'package:frontend/features/driver_portal/presentation/pages/driver_dashboard_page.dart';
import 'package:frontend/features/driver_portal/presentation/pages/driver_jobs_page.dart';
import 'package:frontend/features/driver_portal/presentation/pages/driver_profile_page.dart';
import 'package:frontend/features/driver_portal/presentation/shell/driver_portal_shell.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:go_router/go_router.dart';

/// Focused responsive overflow regressions for DR-05 closure.
void main() {
  testWidgets('Arabic RTL 360px Jobs and Profile have no overflow', (
    tester,
  ) async {
    await _pumpDriverRoute(
      tester,
      locale: const Locale('ar'),
      size: const Size(360, 780),
      path: '/driver/jobs',
      child: const DriverJobsPage(),
      includeJob: true,
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(DriverJobsPage), findsOneWidget);
    expect(find.textContaining('overflow material'), findsOneWidget);
    expect(
      find.byIcon(Icons.assignment_turned_in_outlined),
      findsOneWidget,
    );



    await _pumpDriverRoute(
      tester,
      locale: const Locale('ar'),
      size: const Size(360, 780),
      path: '/driver/profile',
      child: const DriverProfilePage(),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(
      find.byKey(const ValueKey('driver-unselected-bottom-nav')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('driver-mobile-nav-0')), findsOneWidget);
    expect(find.byKey(const ValueKey('driver-mobile-nav-1')), findsOneWidget);
    expect(find.byKey(const ValueKey('driver-mobile-nav-2')), findsOneWidget);
    expect(find.byKey(const ValueKey('driver-mobile-nav-3')), findsOneWidget);
    expect(
      find.byKey(const ValueKey('driver-accepting-new-jobs-switch')),
      findsOneWidget,
    );
  });

  testWidgets('Arabic RTL 320px Jobs and Profile have no overflow', (
    tester,
  ) async {
    await _pumpDriverRoute(
      tester,
      locale: const Locale('ar'),
      size: const Size(320, 720),
      path: '/driver/jobs',
      child: const DriverJobsPage(),
      includeJob: true,
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    await _pumpDriverRoute(
      tester,
      locale: const Locale('ar'),
      size: const Size(320, 720),
      path: '/driver/profile',
      child: const DriverProfilePage(),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(
      find.byKey(const ValueKey('driver-unselected-bottom-nav')),
      findsOneWidget,
    );
  });

  testWidgets('English wide desktop 1.3x and 1.6x have no overflow', (
    tester,
  ) async {
    for (final scale in [1.3, 1.6]) {
      await _pumpDriverRoute(
        tester,
        locale: const Locale('en'),
        size: const Size(1280, 900),
        scale: scale,
        path: '/driver',
        child: const DriverDashboardPage(),
        includeJob: true,
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.byType(DriverDashboardPage), findsOneWidget);
      expect(
        find.byKey(const ValueKey('driver-accepting-new-jobs-switch')),
        findsOneWidget,
      );
      expect(find.textContaining('History'), findsWidgets);
    }
  });

  testWidgets('Profile keeps four unselected mobile nav actions', (
    tester,
  ) async {
    await _pumpDriverRoute(
      tester,
      locale: const Locale('en'),
      size: const Size(390, 844),
      path: '/driver/profile',
      child: const DriverProfilePage(),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(
      find.byKey(const ValueKey('driver-unselected-bottom-nav')),
      findsOneWidget,
    );
    for (var i = 0; i < 4; i++) {
      expect(find.byKey(ValueKey('driver-mobile-nav-$i')), findsOneWidget);
    }
  });
}

Future<void> _pumpDriverRoute(
  WidgetTester tester, {
  required Locale locale,
  required Size size,
  required String path,
  required Widget child,
  double scale = 1,
  bool includeJob = false,
}) async {
  final profile = DriverOperationalProfile.fromJson({
    'status': 'ACTIVE',
    'availability': 'AVAILABLE',
    'acceptingNewJobs': true,
    'activeDeliveryCount': 0,
    'maxActiveDeliveries': 3,
    'canAcceptMore': true,
    'city': 'Hebron',
    'area': 'University District',
    'transportationType': 'CAR',
    'vehicleLabel': 'Van',
    'vehiclePlate': 'ABC-1234',
    'capacityNotes': 'Medium load',
    'updatedAt': '2026-08-02T10:00:00.000Z',
  });
  final list = DriverDeliveriesListResult(
    deliveries: includeJob
        ? [
            DriverDelivery.fromJson({
              'id': 'delivery-overflow',
              'reservationId': 'reservation-overflow',
              'status': 'WAITING_FOR_DRIVER',
              'requestedAt': '2026-08-02T08:00:00.000Z',
              'material': {
                'id': 'material-overflow',
                'title': 'Long Arabic-friendly overflow material title fabric',
                'quantityRequested': 2,
                'unit': 'roll',
              },
              'supplier': {'displayName': 'Hebron Supplier Workshop'},
              'pickupLocation': {
                'city': 'Hebron',
                'area': 'University District',
              },
              'dropoffLocation': {'city': 'Ramallah', 'area': 'Al-Tireh'},
              'distanceKm': 12.5,
            }),
          ]
        : const [],
    meta: DriverDeliveriesListMeta(
      activeDeliveryCount: 0,
      maxActiveDeliveries: 3,
      canAcceptMore: true,
      canBrowseAvailableJobs: true,
      status: DriverProfileStatus.active,
      availability: DriverOperationalAvailability.available,
      acceptingNewJobs: true,
      driverHasRecentLocation: true,
      nearbyAvailableCount: includeJob ? 1 : 0,
      totalAvailableCount: includeJob ? 1 : 0,
      driverProfileCity: 'Hebron',
      driverProfileArea: 'University District',
    ),
  );

  final profileRepo = _OverflowProfileRepository(profile);
  final deliveriesRepo = _OverflowDeliveriesRepository(list);
  Widget shellOrEmpty(String routePath) =>
      routePath == path ? DriverPortalShell(child: child) : const SizedBox();
  final router = GoRouter(
    initialLocation: path,
    routes: [
      GoRoute(path: '/driver', builder: (_, _) => shellOrEmpty('/driver')),
      GoRoute(
        path: '/driver/jobs',
        builder: (_, _) => shellOrEmpty('/driver/jobs'),
      ),
      GoRoute(
        path: '/driver/active',
        builder: (_, _) => shellOrEmpty('/driver/active'),
      ),
      GoRoute(
        path: '/driver/profile',
        builder: (_, _) => shellOrEmpty('/driver/profile'),
      ),
      GoRoute(
        path: '/driver/history',
        builder: (_, _) => shellOrEmpty('/driver/history'),
      ),
      GoRoute(
        path: '/driver/notifications',
        builder: (_, _) => shellOrEmpty('/driver/notifications'),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        driverProfileRepositoryProvider.overrideWithValue(profileRepo),
        driverDeliveriesRepositoryProvider.overrideWithValue(deliveriesRepo),
        authControllerProvider.overrideWith(_OverflowAuthController.new),
        myNotificationUnreadCountProvider.overrideWith(
          _ZeroUnreadCountNotifier.new,
        ),
        supplierNotificationsUnreadCountProvider.overrideWith(
          _ZeroSupplierUnreadCountNotifier.new,
        ),
      ],
      child: MaterialApp.router(
        locale: locale,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            size: size,
            textScaler: TextScaler.linear(scale),
          ),
          child: child!,
        ),
        routerConfig: router,
      ),
    ),
  );
}

class _OverflowAuthController extends AuthController {
  @override
  AuthState build() => AuthState(
    user: User(
      id: 'driver-overflow',
      displayName: 'Driver Overflow',
      email: 'driver.overflow@example.com',
      accountStatus: 'ACTIVE',
      roles: const ['DRIVER'],
      activeRole: 'DRIVER',
      createdAt: DateTime(2026),
    ),
    accessToken: 'overflow-token',
    hasBootstrapped: true,
  );
}

class _ZeroUnreadCountNotifier extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

class _ZeroSupplierUnreadCountNotifier
    extends SupplierNotificationsUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

class _OverflowProfileRepository extends DriverProfileRepository {
  _OverflowProfileRepository(this._profile) : super(DriverProfileApi(Dio()));

  final DriverOperationalProfile _profile;

  @override
  Future<DriverOperationalProfile> fetchProfile() async => _profile;

  @override
  Future<DriverOperationalProfile> updateAvailability(
    bool acceptingNewJobs,
  ) async => _profile;
}

class _OverflowDeliveriesRepository extends DriverDeliveriesRepository {
  _OverflowDeliveriesRepository(this._list) : super(DriverDeliveriesApi(Dio()));

  final DriverDeliveriesListResult _list;

  @override
  Future<DriverDeliveriesListResult> fetchAvailableDeliveries({
    DriverAvailableJobsFilter? filter,
    String? cursor,
    int limit = 20,
  }) async => _list;

  @override
  Future<DriverDeliveriesListResult> fetchActiveDeliveries() async =>
      DriverDeliveriesListResult(
        deliveries: const [],
        meta: _list.meta,
      );

  @override
  Future<DriverArchivePage<DriverHistoricalDelivery>> fetchHistory({
    String? cursor,
    int limit = 20,
  }) async => const DriverArchivePage(
    items: [],
    pagination: DriverDeliveriesPagination(limit: 20, hasMore: false),
  );

  @override
  Future<DriverArchivePage<DriverIncident>> fetchIncidents({
    String? cursor,
    int limit = 20,
  }) async => const DriverArchivePage(
    items: [],
    pagination: DriverDeliveriesPagination(limit: 20, hasMore: false),
  );
}
