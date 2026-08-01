import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/admin_portal/data/models/admin_dashboard_models.dart';
import 'package:frontend/features/admin_portal/presentation/widgets/admin_kpi_card.dart';

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
      'reuseByMonth': [],
      'estimatedCo2Kg': 5.6,
      'estimatedCo2Label': '5.6 kg CO₂e',
      'estimatedCo2Method': 'Conservative MVP estimates',
      'reuseCompletionRate': 0.42,
      'co2ReuseProgress': 0.2,
    },
    'materialsByCategory': [],
    'reservationStatusBreakdown': [],
    'recentInvitations': [],
    'supplierVerificationPendingCount': 0,
    'supplierVerificationPreview': [],
    'recentActivity': [],
  });
}

void main() {
  testWidgets('AdminKpiCard renders value, label, and helper text', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdminKpiCard(
            label: 'Users',
            value: '42',
            helper: 'All registered accounts',
            icon: Icons.people_outline,
            accent: const Color(0xFF2563EB),
          ),
        ),
      ),
    );

    expect(find.text('42'), findsOneWidget);
    expect(find.text('Users'), findsOneWidget);
    expect(find.text('All registered accounts'), findsOneWidget);
    expect(find.byIcon(Icons.people_outline), findsOneWidget);
  });

  testWidgets(
    'AdminKpiGrid renders inside ListView without layout exceptions',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(1200, 800));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListView(
              children: [AdminKpiGrid(dashboard: _sampleDashboard())],
            ),
          ),
        ),
      );

      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('10'), findsWidgets);
    },
  );
}
