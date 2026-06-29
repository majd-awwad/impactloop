import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/admin_portal/data/admin_dashboard_providers.dart';
import 'package:frontend/features/admin_portal/data/models/admin_audit_logs_models.dart';
import 'package:frontend/features/admin_portal/data/models/admin_dashboard_models.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_audit_logs_page.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_impact_page.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_overview_page.dart';

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
          adminDashboardProvider.overrideWith((ref) async => _sampleDashboard()),
        ],
        child: const MaterialApp(
          home: Scaffold(body: AdminOverviewPage()),
        ),
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
          adminDashboardProvider.overrideWith((ref) async => _sampleDashboard()),
        ],
        child: const MaterialApp(
          home: Scaffold(body: AdminImpactPage()),
        ),
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
              pagination: const AdminAuditLogsPagination(
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 1,
              ),
              filterOptions: const AdminAuditLogFilterOptions(
                actions: [],
                targetTypes: [],
                actors: [],
              ),
              summary: const AdminAuditLogSummary(
                total: 0,
                today: 0,
                thisWeek: 0,
                mostRecentAt: null,
              ),
            ),
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(body: AdminAuditLogsPage()),
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('No audit logs recorded yet.'), findsOneWidget);
  });
}
