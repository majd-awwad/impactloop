import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/supplier_portal/presentation/l10n/supplier_l10n.dart';
import 'package:frontend/features/supplier_portal/presentation/shell/supplier_nav_config.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/dashboard/supplier_dashboard_quick_actions_panel.dart';
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

  testWidgets('adds a learner requests shortcut that uses the existing route', (
    tester,
  ) async {
    final en = SupplierL10n.forLanguage('en');
    final learnerRequestsRoute = supplierNavItems
        .firstWhere(
          (item) =>
              item.labelKey == SupplierNavLabelKey.learnerMaterialRequests,
        )
        .route;
    final router = GoRouter(
      initialLocation: '/supplier',
      routes: [
        GoRoute(
          path: '/supplier',
          builder: (context, state) => const SupplierLocaleScope(
            languageCode: 'en',
            child: Scaffold(body: SupplierDashboardQuickActionsPanel()),
          ),
        ),
        GoRoute(
          path: learnerRequestsRoute,
          builder: (context, state) => const Text('material-requests-page'),
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp.router(theme: AppTheme.light, routerConfig: router),
    );
    await tester.pumpAndSettle();

    expect(find.text(en.quickActionLearnerRequests), findsOneWidget);
    expect(find.text(en.quickActionLearnerRequestsCaption), findsOneWidget);

    await tester.tap(find.text(en.quickActionLearnerRequests));
    await tester.pumpAndSettle();

    expect(find.text('material-requests-page'), findsOneWidget);
  });
}
