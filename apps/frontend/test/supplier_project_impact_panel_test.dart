import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_project_support.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/dashboard/supplier_project_impact_panel.dart';

void main() {
  group('SupplierProjectImpactPanel', () {
    testWidgets('shows empty-state copy when project support is zero', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          const SupplierProjectImpactPanel(
            projectSupport: SupplierProjectSupport(
              projectsSupported: 0,
              projectComponentsSupported: 0,
              learnerBuildsHelped: 0,
              completedLinkedReservations: 0,
              latestSupportedProjects: [],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Project impact'), findsOneWidget);
      expect(
        find.text(
          'Your completed project impact will appear here when learners finish components using your materials.',
        ),
        findsOneWidget,
      );
      expect(find.text('0'), findsNWidgets(3));
    });

    testWidgets('shows metric values and recent projects when populated', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          SupplierProjectImpactPanel(
            projectSupport: SupplierProjectSupport(
              projectsSupported: 2,
              projectComponentsSupported: 3,
              learnerBuildsHelped: 2,
              completedLinkedReservations: 3,
              latestSupportedProjects: [
                SupplierLatestSupportedProject(
                  projectId: 'proj-1',
                  title: 'Solar charger',
                  categoryName: 'Electronics',
                  completedAt: DateTime.utc(2026, 7, 1),
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('2'), findsNWidgets(2));
      expect(find.text('3'), findsOneWidget);
      expect(find.text('Solar charger'), findsOneWidget);
      expect(find.text('Electronics'), findsOneWidget);
      expect(find.text('Recent supported projects'), findsOneWidget);
    });
  });
}

Widget _wrap(Widget child) {
  return MaterialApp(
    home: SupplierLocaleScope(
      languageCode: 'en',
      child: Scaffold(
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: child,
        ),
      ),
    ),
  );
}
