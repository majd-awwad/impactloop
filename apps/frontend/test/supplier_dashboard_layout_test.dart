import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/presentation/widgets/dashboard/supplier_dashboard_stat_card.dart';
import 'package:frontend/shared/widgets/app_section_card.dart';

void main() {
  testWidgets('uses four compact KPIs and one shared secondary metrics card', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 1200,
            child: Column(
              children: [
                SupplierDashboardMainStatGrid(
                  activeMaterials: 50,
                  pendingRequests: 1,
                  scheduledPickups: 0,
                  reusedMaterials: 1,
                ),
                SizedBox(height: 8),
                SupplierDashboardSecondaryMetricsRow(
                  totalMaterials: 53,
                  availableMaterials: 50,
                  reservedMaterials: 1,
                  totalViews: 6,
                  totalLikes: 6,
                  followersCount: 0,
                ),
              ],
            ),
          ),
        ),
      ),
    );

    expect(find.byType(SupplierDashboardStatCard), findsNWidgets(4));
    expect(find.byType(AppSectionCard), findsNWidgets(5));
    expect(find.text('Total materials'), findsOneWidget);
    expect(find.text('Available materials'), findsOneWidget);
    expect(find.text('Reserved materials'), findsOneWidget);
    expect(find.text('Total material views'), findsOneWidget);
    expect(find.text('Total material likes'), findsOneWidget);
    expect(find.text('Followers'), findsOneWidget);
  });
}
