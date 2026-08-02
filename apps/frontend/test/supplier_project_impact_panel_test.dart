import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_project_support.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/dashboard/supplier_project_impact_panel.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

void main() {
  final en = AppLocalizationsEn();

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

      expect(find.text(en.supplierProjectImpact), findsOneWidget);
      expect(
        find.text(en.supplierYourCompletedProjectImpactWillAppear),
        findsOneWidget,
      );
      expect(find.text('0'), findsNWidgets(3));
    });

    testWidgets('shows metric values when project support is populated', (
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
      expect(find.text(en.supplierProjectImpact), findsOneWidget);
      expect(
        find.text(en.supplierYourMaterialsHelpedLearnersCompleteReal),
        findsOneWidget,
      );
      expect(find.text(en.supplierProjectsSupported), findsOneWidget);
      expect(find.text(en.supplierComponentsCompleted), findsOneWidget);
      expect(find.text(en.supplierLearnerBuildsHelped), findsOneWidget);
    });
  });
}

Widget _wrap(Widget child) {
  return MaterialApp(
    locale: const Locale('en'),
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
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
