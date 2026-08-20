import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/admin_portal/data/admin_impact_providers.dart';
import 'package:frontend/features/admin_portal/data/models/admin_impact_models.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_impact_page.dart';
import 'package:frontend/l10n/app_localizations.dart';

AdminImpactAnalytics _sampleImpact({
  int componentsFulfilled = 3,
  int buildsSupported = 2,
  int projectsSupported = 2,
  double? estimatedCo2eKg,
  int included = 0,
  int total = 5,
}) {
  return AdminImpactAnalytics.fromJson({
    'verifiedImpact': {
      'completedReuseEvents': 5,
      'distinctMaterialsReused': 4,
      'learnersBenefited': 2,
      'suppliersContributed': 2,
    },
    'learningImpact': {
      'componentsFulfilled': componentsFulfilled,
      'buildsSupported': buildsSupported,
      'projectsSupported': projectsSupported,
    },
    'reuseByCategory': [
      {
        'nameEn': 'Electronics',
        'nameAr': 'إلكترونيات',
        'completedReuseEvents': 3,
      },
      {
        'nameEn': 'Wood & Panels',
        'nameAr': 'خشب وألواح',
        'completedReuseEvents': 2,
      },
    ],
    'monthlyReuse': [
      {'month': '2026-03', 'completedReuseEvents': 0},
      {'month': '2026-08', 'completedReuseEvents': 5},
    ],
    'environmentalEstimate': {
      'estimatedCo2eKg': estimatedCo2eKg,
      'estimatedCo2eLabel': estimatedCo2eKg == null
          ? null
          : '$estimatedCo2eKg kg CO₂e',
      'isEstimate': true,
      'includedReuseEvents': included,
      'totalCompletedReuseEvents': total,
      'coveragePercent': total == 0 ? 0 : ((included / total) * 100).round(),
      'methodologyVersion': 'admin-impact-co2e-v2-mass-only',
      'unavailableReason': estimatedCo2eKg == null
          ? 'NO_ELIGIBLE_EVENTS'
          : null,
    },
  });
}

Widget _harness({
  required AdminImpactAnalytics impact,
  Locale locale = const Locale('en'),
}) {
  return ProviderScope(
    overrides: [
      adminImpactAnalyticsProvider.overrideWith((ref) async => impact),
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: const Scaffold(body: AdminImpactPage()),
    ),
  );
}

Future<void> _scrollTo(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    480,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('maps verified KPIs and hides the old 1% progress ring', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1280, 1100));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_harness(impact: _sampleImpact()));
    await tester.pumpAndSettle();

    expect(find.text('Impact Analytics'), findsOneWidget);
    expect(find.text('Completed reuse events'), findsOneWidget);
    expect(find.text('Learners benefited'), findsOneWidget);
    expect(find.text('Suppliers contributed'), findsOneWidget);
    expect(find.text('Project components fulfilled'), findsWidgets);
    expect(find.text('5'), findsWidgets);
    expect(find.text('2'), findsWidgets);
    expect(find.text('3'), findsWidgets);
    expect(find.text('Completed reuse by category'), findsOneWidget);
    expect(find.text('Electronics'), findsOneWidget);
    expect(find.text('Wood & Panels'), findsOneWidget);
    expect(find.text('Learning impact'), findsOneWidget);
    expect(find.text('Completed reuse activity over time'), findsOneWidget);
    await _scrollTo(tester, find.text('Estimated potential CO₂e avoided'));
    expect(find.text('Estimated potential CO₂e avoided'), findsOneWidget);
    expect(find.text('Estimated'), findsWidgets);
    expect(
      find.text('Coverage: 0 of 5 completed reuse events included'),
      findsOneWidget,
    );
    expect(find.text('0% estimation coverage'), findsOneWidget);
    expect(find.text('Calculation methodology'), findsOneWidget);
    expect(find.text('1%'), findsNothing);
    expect(find.textContaining('Reuse completion rate'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'shows unavailable environmental copy without a fake CO₂ number',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 1100));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(_harness(impact: _sampleImpact()));
      await tester.pumpAndSettle();
      await _scrollTo(
        tester,
        find.text('Environmental estimate unavailable for current data'),
      );

      expect(
        find.text('Environmental estimate unavailable for current data'),
        findsOneWidget,
      );
      expect(find.textContaining('5.6 kg'), findsNothing);
    },
  );

  testWidgets('uses distinct materials KPI when learning components are zero', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1280, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _harness(
        impact: _sampleImpact(
          componentsFulfilled: 0,
          buildsSupported: 0,
          projectsSupported: 0,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Distinct materials reused'), findsOneWidget);
    expect(find.text('Learning impact'), findsNothing);
  });

  testWidgets('renders Arabic RTL labels without mixing English KPI copy', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1280, 1100));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _harness(impact: _sampleImpact(), locale: const Locale('ar')),
    );
    await tester.pumpAndSettle();

    expect(find.text('تحليلات الأثر'), findsOneWidget);
    expect(find.text('عمليات إعادة الاستخدام المكتملة'), findsOneWidget);
    expect(find.text('المتعلمون المستفيدون'), findsOneWidget);
    expect(find.text('الموردون المساهمون'), findsOneWidget);
    expect(find.text('إعادة الاستخدام المكتملة حسب الفئة'), findsOneWidget);
    expect(find.text('إلكترونيات'), findsOneWidget);
    await _scrollTo(tester, find.text('تقديري'));
    expect(find.text('تقديري'), findsOneWidget);
    expect(find.text('منهجية الحساب'), findsOneWidget);
    expect(find.text('Completed reuse events'), findsNothing);
    expect(find.text('1%'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('narrow layout still renders KPI cards', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 1400));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_harness(impact: _sampleImpact()));
    await tester.pumpAndSettle();

    expect(find.text('Completed reuse events'), findsOneWidget);
    await _scrollTo(tester, find.text('Environmental estimate'));
    expect(find.text('Environmental estimate'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('empty charts use empty states', (tester) async {
    await tester.binding.setSurfaceSize(const Size(1100, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _harness(
        impact: AdminImpactAnalytics.fromJson({
          'verifiedImpact': {
            'completedReuseEvents': 0,
            'distinctMaterialsReused': 0,
            'learnersBenefited': 0,
            'suppliersContributed': 0,
          },
          'learningImpact': {
            'componentsFulfilled': 0,
            'buildsSupported': 0,
            'projectsSupported': 0,
          },
          'reuseByCategory': [],
          'monthlyReuse': [
            {'month': '2026-08', 'completedReuseEvents': 0},
          ],
          'environmentalEstimate': {
            'isEstimate': true,
            'includedReuseEvents': 0,
            'totalCompletedReuseEvents': 0,
            'coveragePercent': 0,
            'unavailableReason': 'NO_COMPLETED_EVENTS',
          },
        }),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No completed reuse by category yet'), findsOneWidget);
    expect(find.text('No completed reuse activity yet'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
