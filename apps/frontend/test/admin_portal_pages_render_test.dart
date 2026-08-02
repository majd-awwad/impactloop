import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/admin_portal/data/admin_dashboard_providers.dart';
import 'package:frontend/features/admin_portal/data/admin_deliveries_api.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/admin_portal/data/models/admin_audit_logs_models.dart';
import 'package:frontend/features/admin_portal/data/models/admin_dashboard_models.dart';
import 'package:frontend/features/admin_portal/data/models/admin_deliveries_models.dart';
import 'package:frontend/features/admin_portal/data/models/admin_reservations_models.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_audit_logs_page.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_deliveries_page.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_impact_page.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_overview_page.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_reservations_page.dart';

Map<String, dynamic> _sampleDeliveryDetailJson({
  String status = 'DRIVER_ASSIGNED',
  bool canReopen = true,
  bool includeDriver = true,
}) {
  return {
    'id': 'delivery-1',
    'status': status,
    'requestedAt': '2026-01-10T10:00:00.000Z',
    'assignedAt': includeDriver ? '2026-01-10T10:05:00.000Z' : null,
    'canReopenDriverAssignment': canReopen,
    'reservation': {
      'id': 'reservation-1',
      'status': 'ACCEPTED',
      'quantityRequested': 1,
      'unit': 'piece',
    },
    'material': {'id': 'material-1', 'title': 'Stepper motor'},
    'learner': {
      'id': 'learner-1',
      'displayName': 'Learner One',
      'email': 'learner@example.test',
    },
    'supplier': {
      'id': 'supplier-1',
      'displayName': 'Supplier One',
      'email': 'supplier@example.test',
    },
    'driver': includeDriver
        ? {
            'id': 'driver-1',
            'displayName': 'Driver One',
            'email': 'driver@example.test',
            'acceptedAt': '2026-01-10T10:05:00.000Z',
          }
        : null,
    'pickup': {
      'supplierName': 'Supplier One',
      'location': {'country': 'Palestine', 'city': 'Ramallah'},
    },
    'dropoff': {
      'learnerName': 'Learner One',
      'location': {'country': 'Palestine', 'city': 'Ramallah'},
    },
    'timeline': <Map<String, dynamic>>[],
    'locationHistory': {'count': 0, 'items': <Map<String, dynamic>>[]},
  };
}

AdminDeliveriesListResponse _sampleDeliveriesList() {
  return AdminDeliveriesListResponse.fromJson({
    'summary': {
      'total': 1,
      'waitingForDriver': 0,
      'activeInProgress': 1,
      'needsAdminReview': 0,
      'delivered': 0,
      'failedCancelled': 0,
    },
    'items': [
      {
        'id': 'delivery-1',
        'status': 'DRIVER_ASSIGNED',
        'requestedAt': '2026-01-10T10:00:00.000Z',
        'assignedAt': '2026-01-10T10:05:00.000Z',
        'reservation': {'id': 'reservation-1'},
        'material': {'id': 'material-1', 'title': 'Stepper motor'},
        'learner': {
          'id': 'learner-1',
          'displayName': 'Learner One',
          'email': 'learner@example.test',
        },
        'supplier': {
          'id': 'supplier-1',
          'displayName': 'Supplier One',
          'email': 'supplier@example.test',
        },
        'driver': {
          'id': 'driver-1',
          'displayName': 'Driver One',
          'email': 'driver@example.test',
        },
        'currentDriver': {
          'id': 'driver-1',
          'displayName': 'Current Driver',
          'email': 'current@example.test',
        },
        'scope': 'SINGLE',
        'lifecyclePhase': 'PRE_PICKUP',
        'adminAttentionState': 'NONE',
        'assignmentState': 'ACTIVE',
        'kpiBucket': 'ACTIVE_IN_PROGRESS',
        'availableMutations': [],
        'availableLinks': [],
        'itemCount': 1,
        'pickupArea': 'Ramallah',
        'dropoffArea': 'Ramallah',
      },
    ],
    'pagination': {'page': 1, 'limit': 20, 'total': 1, 'totalPages': 1},
    'filterOptions': {
      'statuses': ['DRIVER_ASSIGNED'],
    },
  });
}

class _FakeAdminDeliveriesApi implements AdminDeliveriesApi {
  _FakeAdminDeliveriesApi({
    required this.detail,
    required this.reopenResult,
    this.reopenError,
  });

  final AdminDeliveryDetail detail;
  final AdminDeliveryDetail reopenResult;
  final ApiException? reopenError;
  var reopenCalled = false;

  @override
  Future<AdminDeliveriesListResponse> fetchDeliveries({
    required int page,
    required int limit,
    String? search,
    String? status,
    String? assignment,
    String? scope,
    String? incidentState,
    String? dateFrom,
    String? dateTo,
  }) async {
    return _sampleDeliveriesList();
  }

  @override
  Future<AdminDeliveryDetail> fetchDeliveryDetail(String id) async => detail;

  @override
  Future<AdminDeliveryDetail> reopenDriverAssignment(String id) async {
    reopenCalled = true;
    final error = reopenError;
    if (error != null) {
      throw error;
    }
    return reopenResult;
  }
}

AdminDashboardResponse _sampleDashboard() {
  return AdminDashboardResponse.fromJson({
    'summary': {
      'totalUsers': 10,
      'totalSuppliers': 3,
      'totalMaterials': 25,
      'availableMaterials': 12,
      'pendingApprovals': 4,
      'activeInvitations': 2,
      'completedReuse': 5,
      'activeDrivers': 1,
    },
    'pendingActions': {
      'supplierVerifications': 0,
      'categoryRequests': 0,
      'priceRequests': 0,
      'reports': 0,
    },
    'impact': {
      'reusedMaterials': 5,
      'completedReservations': 4,
      'learnersBenefited': 3,
      'suppliersContributed': 2,
      'reuseByMonth': [
        {'month': '2026-01', 'count': 1},
      ],
      'estimatedCo2Kg': 5.6,
      'estimatedCo2Label': '5.6 kg CO₂e',
      'estimatedCo2Method': 'Conservative MVP estimates',
      'reuseCompletionRate': 0.42,
      'co2ReuseProgress': 0.2,
    },
    'materialsByCategory': [
      {
        'id': 'cat-1',
        'nameEn': 'Electronics',
        'nameAr': 'إلكترونيات',
        'count': 10,
      },
    ],
    'reservationStatusBreakdown': [
      {'status': 'COMPLETED', 'count': 4},
    ],
    'recentInvitations': [],
    'supplierVerificationPendingCount': 0,
    'supplierVerificationPreview': [],
    'recentActivity': [],
  });
}

void main() {
  testWidgets('AdminOverviewPage renders dashboard content', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminDashboardProvider.overrideWith(
            (ref) async => _sampleDashboard(),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: AdminOverviewPage())),
      ),
    );

    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('10'), findsWidgets);
  });

  testWidgets('AdminImpactPage renders impact analytics', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminDashboardProvider.overrideWith(
            (ref) async => _sampleDashboard(),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: AdminImpactPage())),
      ),
    );

    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.textContaining('Impact Analytics'), findsOneWidget);
  });

  testWidgets('AdminAuditLogsPage renders empty state', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminAuditLogsListProvider.overrideWith(
            (ref) async => const AdminAuditLogsListResponse(
              items: [],
              pagination: AdminAuditLogsPagination(
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
              ),
              filterOptions: AdminAuditLogFilterOptions(
                actions: [],
                targetTypes: [],
                actors: [],
              ),
              summary: AdminAuditLogSummary(
                total: 0,
                today: 0,
                thisWeek: 0,
                mostRecentAt: null,
              ),
            ),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: AdminAuditLogsPage())),
      ),
    );

    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('No audit logs recorded yet.'), findsOneWidget);
  });

  testWidgets('AdminReservationsPage renders empty state', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminReservationsListProvider.overrideWith(
            (ref) async => const AdminReservationsListResponse(
              summary: AdminReservationsSummary(
                total: 0,
                pending: 0,
                acceptedActive: 0,
                completed: 0,
                withDelivery: 0,
              ),
              items: [],
              pagination: AdminReservationsPagination(
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
              ),
              statuses: [],
            ),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: AdminReservationsPage())),
      ),
    );

    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('No reservations found'), findsOneWidget);
  });

  testWidgets('AdminDeliveriesPage renders empty state', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminDeliveriesListProvider.overrideWith(
            (ref) async => const AdminDeliveriesListResponse(
              summary: AdminDeliveriesSummary(
                total: 0,
                waitingForDriver: 0,
                activeInProgress: 0,
                needsAdminReview: 0,
                delivered: 0,
                failedCancelled: 0,
              ),
              items: [],
              pagination: AdminDeliveriesPagination(
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
              ),
              statuses: [],
            ),
          ),
        ],
        child: const MaterialApp(home: Scaffold(body: AdminDeliveriesPage())),
      ),
    );

    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('No deliveries found'), findsOneWidget);
  });

  testWidgets('AdminDeliveriesPage renders its six-column desktop monitor', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1600, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final api = _FakeAdminDeliveriesApi(
      detail: AdminDeliveryDetail.fromJson(_sampleDeliveryDetailJson()),
      reopenResult: AdminDeliveryDetail.fromJson(_sampleDeliveryDetailJson()),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [adminDeliveriesApiProvider.overrideWithValue(api)],
        child: const MaterialApp(home: Scaffold(body: AdminDeliveriesPage())),
      ),
    );

    await tester.pumpAndSettle();
    for (final label in const [
      'Delivery',
      'Journey',
      'Progress',
      'Attention',
      'Updated',
      'Action',
    ]) {
      expect(find.text(label), findsOneWidget);
    }
    expect(find.text('Current Driver'), findsOneWidget);
    expect(find.byTooltip('View delivery'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('AdminDeliveriesPage confirms and reopens a driver assignment', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final api = _FakeAdminDeliveriesApi(
      detail: AdminDeliveryDetail.fromJson(_sampleDeliveryDetailJson()),
      reopenResult: AdminDeliveryDetail.fromJson(
        _sampleDeliveryDetailJson(
          status: 'WAITING_FOR_DRIVER',
          canReopen: false,
          includeDriver: false,
        ),
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [adminDeliveriesApiProvider.overrideWithValue(api)],
        child: const MaterialApp(home: Scaffold(body: AdminDeliveriesPage())),
      ),
    );

    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('View delivery'));
    await tester.pumpAndSettle();
    expect(find.text('Reopen to drivers'), findsOneWidget);

    await tester.tap(find.text('Reopen to drivers'));
    await tester.pumpAndSettle();
    expect(find.text('Reopen to drivers?'), findsOneWidget);

    await tester.tap(find.text('Reopen'));
    await tester.pumpAndSettle();

    expect(api.reopenCalled, isTrue);
    expect(find.text('Delivery reopened to drivers.'), findsOneWidget);
    expect(find.text('Reopen to drivers'), findsNothing);
  });

  testWidgets('AdminDeliveriesPage surfaces reopen conflict errors', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    final api = _FakeAdminDeliveriesApi(
      detail: AdminDeliveryDetail.fromJson(_sampleDeliveryDetailJson()),
      reopenResult: AdminDeliveryDetail.fromJson(_sampleDeliveryDetailJson()),
      reopenError: const ApiException(
        message:
            'Pickup has already started; this delivery cannot be reopened.',
        code: 'CONFLICT',
        statusCode: 409,
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [adminDeliveriesApiProvider.overrideWithValue(api)],
        child: const MaterialApp(home: Scaffold(body: AdminDeliveriesPage())),
      ),
    );

    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('View delivery'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reopen to drivers'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Reopen'));
    await tester.pumpAndSettle();

    expect(api.reopenCalled, isTrue);
    expect(
      find.text(
        'Pickup has already started; this delivery cannot be reopened.',
      ),
      findsOneWidget,
    );
    expect(find.text('Reopen to drivers'), findsOneWidget);
  });
}
