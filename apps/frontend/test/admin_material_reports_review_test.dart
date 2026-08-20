import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/admin_portal/data/admin_materials_api.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_materials_page.dart';
import 'package:frontend/features/admin_portal/presentation/widgets/admin_material_report_review_dialog.dart';
import 'package:frontend/l10n/app_localizations.dart';

AdminMaterialReportListItem _report({
  String id = 'report-1',
  String status = 'PENDING',
  String materialStatus = 'AVAILABLE',
  String? resolutionAction,
  String? adminNote,
  String? reviewedByName,
  DateTime? reviewedAt,
  bool canHide = true,
  bool canMarkUnavailable = true,
  bool locked = false,
}) {
  return AdminMaterialReportListItem(
    reportId: id,
    reason: 'WRONG_PRICE',
    note: 'Listed price does not match the photo.',
    status: status,
    reporterName: 'Amina Learner',
    reporterEmail: 'amina@example.test',
    materialTitle: 'Oak plywood sheet',
    materialId: 'material-1',
    materialStatus: materialStatus,
    supplierName: 'Nablus Workshop',
    supplierVerificationStatus: 'VERIFIED',
    createdAt: DateTime.utc(2026, 8, 18),
    reviewedAt: reviewedAt,
    adminNote: adminNote,
    resolutionAction: resolutionAction,
    reviewedByName: reviewedByName,
    isFree: false,
    price: 45,
    currency: 'NIS',
    canHideMaterial: canHide,
    canMarkUnavailable: canMarkUnavailable,
    isModerationLocked: locked,
  );
}

Widget _wrap({required Widget child, Locale locale = const Locale('en')}) {
  return ProviderScope(
    child: MaterialApp(
      locale: locale,
      theme: AppTheme.lightFor(locale.languageCode),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: child),
    ),
  );
}

class _FakeAdminMaterialsApi extends AdminMaterialsApi {
  _FakeAdminMaterialsApi(this.reports) : super(Dio());

  List<AdminMaterialReportListItem> reports;
  var resolveCalls = 0;
  var rejectCalls = 0;
  var hideCalls = 0;
  var unavailableCalls = 0;

  @override
  Future<AdminMaterialsSummary> fetchSummary() async {
    return const AdminMaterialsSummary(
      total: 1,
      available: 1,
      paid: 1,
      unavailable: 0,
      reported: 1,
    );
  }

  @override
  Future<List<AdminMaterialListItem>> fetchMaterials({
    String? search,
    String? status,
    String? reportStatus,
    bool? isFree,
    int page = 1,
    int limit = 50,
  }) async {
    return const [];
  }

  @override
  Future<List<AdminMaterialReportListItem>> fetchReports({
    String? status,
    String? search,
    int page = 1,
    int limit = 50,
  }) async {
    if (status == null || status == 'ALL') return List.of(reports);
    return reports.where((report) => report.status == status).toList();
  }

  @override
  Future<Map<String, dynamic>> fetchMaterialDetail(String id) async {
    return {
      'id': id,
      'title': 'Oak plywood sheet',
      'status': 'AVAILABLE',
      'isFree': false,
      'price': 45,
      'currency': 'NIS',
      'description': 'Sheet material',
      'supplier': {'displayName': 'Nablus Workshop'},
      'category': {'nameEn': 'Wood'},
      'location': {'city': 'Nablus'},
      'images': <Map<String, dynamic>>[],
      'latestReports': <Map<String, dynamic>>[],
      'reportSummary': {'pendingCount': 1, 'totalCount': 1},
      'allowedActions': {
        'canHide': true,
        'canMarkUnavailable': true,
        'canRestore': false,
        'isModerationLocked': false,
      },
    };
  }

  AdminMaterialReportListItem _withStatus(
    AdminMaterialReportListItem report,
    String status, {
    String? resolutionAction,
    String? adminNote,
  }) {
    return AdminMaterialReportListItem(
      reportId: report.reportId,
      reason: report.reason,
      note: report.note,
      status: status,
      reporterName: report.reporterName,
      reporterEmail: report.reporterEmail,
      materialTitle: report.materialTitle,
      materialId: report.materialId,
      materialStatus: report.materialStatus,
      supplierName: report.supplierName,
      supplierVerificationStatus: report.supplierVerificationStatus,
      createdAt: report.createdAt,
      reviewedAt: DateTime.utc(2026, 8, 20),
      adminNote: adminNote,
      resolutionAction: resolutionAction,
      reviewedByName: 'Admin Reviewer',
      isFree: report.isFree,
      price: report.price,
      currency: report.currency,
      canHideMaterial: report.canHideMaterial,
      canMarkUnavailable: report.canMarkUnavailable,
      isModerationLocked: report.isModerationLocked,
    );
  }

  @override
  Future<void> resolveReport({
    required String id,
    required String adminNote,
  }) async {
    resolveCalls += 1;
    reports = [
      for (final report in reports)
        if (report.reportId == id)
          _withStatus(
            report,
            'RESOLVED',
            resolutionAction: 'NO_MATERIAL_ACTION',
            adminNote: adminNote,
          )
        else
          report,
    ];
  }

  @override
  Future<void> rejectReport({
    required String id,
    required String adminNote,
  }) async {
    rejectCalls += 1;
    reports = [
      for (final report in reports)
        if (report.reportId == id)
          _withStatus(report, 'REJECTED', adminNote: adminNote)
        else
          report,
    ];
  }

  @override
  Future<void> hideMaterialFromReport({
    required String id,
    required String adminNote,
  }) async {
    hideCalls += 1;
  }

  @override
  Future<void> markUnavailableFromReport({
    required String id,
    required String adminNote,
  }) async {
    unavailableCalls += 1;
  }
}

Future<void> _openDialog(
  WidgetTester tester, {
  required AdminMaterialReportListItem report,
  required Future<void> Function(AdminMaterialReportDecision, String) onSubmit,
  Locale locale = const Locale('en'),
}) async {
  await tester.binding.setSurfaceSize(const Size(1280, 900));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    _wrap(
      locale: locale,
      child: Builder(
        builder: (context) => TextButton(
          onPressed: () {
            showDialog<void>(
              context: context,
              builder: (_) => AdminMaterialReportReviewDialog(
                report: report,
                onViewMaterial: () {},
                onSubmit: onSubmit,
              ),
            );
          },
          child: const Text('Open review'),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open review'));
  await tester.pumpAndSettle();
}

Future<void> _scrollTo(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    180,
    scrollable: find.byType(Scrollable).last,
  );
}

void main() {
  test('report list item parses resolution outcome and lock flags', () {
    final item = AdminMaterialReportListItem.fromJson({
      'reportId': 'r1',
      'reason': 'WRONG_PRICE',
      'status': 'RESOLVED',
      'reporterName': 'Amina',
      'reporterEmail': 'a@test',
      'materialTitle': 'Plywood',
      'materialId': 'm1',
      'materialStatus': 'AVAILABLE',
      'supplierName': 'Workshop',
      'supplierVerificationStatus': 'VERIFIED',
      'createdAt': '2026-08-18T00:00:00.000Z',
      'reviewedAt': '2026-08-20T00:00:00.000Z',
      'adminNote': 'Supplier corrected the price before review.',
      'resolutionAction': 'NO_MATERIAL_ACTION',
      'reviewedByName': 'Admin Reviewer',
      'isFree': false,
      'price': 45,
      'canHideMaterial': true,
      'canMarkUnavailable': true,
      'isModerationLocked': false,
    });

    expect(item.resolutionAction, 'NO_MATERIAL_ACTION');
    expect(item.reviewedByName, 'Admin Reviewer');
    expect(item.isPending, isFalse);
    expect(item.canHideMaterial, isTrue);
  });

  testWidgets('Review report opens dialog without mutating the report', (
    tester,
  ) async {
    var submitted = false;
    await _openDialog(
      tester,
      report: _report(),
      onSubmit: (_, _) async {
        submitted = true;
      },
    );

    expect(find.text('Review report'), findsWidgets);
    expect(find.text('Misleading information'), findsNothing);
    expect(find.text('Wrong price'), findsOneWidget);
    expect(find.text('Listed price does not match the photo.'), findsOneWidget);
    expect(find.text('Oak plywood sheet'), findsOneWidget);
    expect(find.text('Nablus Workshop'), findsOneWidget);
    expect(submitted, isFalse);
    expect(find.text('The report was closed.'), findsNothing);
  });

  testWidgets('decision and note are required before submit', (tester) async {
    var submitted = false;
    await _openDialog(
      tester,
      report: _report(),
      onSubmit: (_, _) async {
        submitted = true;
      },
    );

    await tester.tap(find.text('Submit decision'));
    await tester.pump();
    expect(find.text('Select a decision before submitting.'), findsOneWidget);
    expect(submitted, isFalse);

    await _scrollTo(
      tester,
      find.text('Close report without changing the material'),
    );
    await tester.tap(find.text('Close report without changing the material'));
    await tester.pump();
    await tester.tap(find.text('Submit decision'));
    await tester.pump();
    expect(
      find.text('Enter a short administrative note (at least 3 characters).'),
      findsOneWidget,
    );
    expect(submitted, isFalse);

    await _scrollTo(tester, find.byType(TextField).last);
    await tester.enterText(
      find.byType(TextField).last,
      'Supplier corrected the price before review.',
    );
    await tester.tap(find.text('Submit decision'));
    await tester.pumpAndSettle();
    expect(submitted, isTrue);
  });

  testWidgets('locked materials disable hide and mark unavailable', (
    tester,
  ) async {
    await _openDialog(
      tester,
      report: _report(
        materialStatus: 'RESERVED',
        canHide: false,
        canMarkUnavailable: false,
        locked: true,
      ),
      onSubmit: (_, _) async {},
    );

    await _scrollTo(
      tester,
      find.text('Unavailable while an active reservation exists').first,
    );
    expect(
      find.text('Unavailable while an active reservation exists'),
      findsWidgets,
    );

    await _scrollTo(tester, find.text('Hide material'));
    await tester.tap(find.text('Hide material'), warnIfMissed: false);
    await tester.pump();
    expect(
      find.text(
        'The report will be closed and the material will be hidden from public discovery.',
      ),
      findsNothing,
    );

    await _scrollTo(tester, find.text('Reject report'));
    await tester.tap(find.text('Reject report'));
    await tester.pump();
    await _scrollTo(
      tester,
      find.text(
        'The report will be rejected and the material will not change.',
      ),
    );
    expect(
      find.text(
        'The report will be rejected and the material will not change.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('Arabic review dialog renders without overflow', (tester) async {
    await _openDialog(
      tester,
      locale: const Locale('ar'),
      report: _report(),
      onSubmit: (_, _) async {},
    );

    expect(find.text('مراجعة البلاغ'), findsWidgets);
    await _scrollTo(tester, find.text('رفض البلاغ'));
    expect(find.text('رفض البلاغ'), findsOneWidget);
    await _scrollTo(tester, find.text('إخفاء المادة'));
    expect(find.text('إخفاء المادة'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('English review dialog renders without overflow', (tester) async {
    await _openDialog(tester, report: _report(), onSubmit: (_, _) async {});

    expect(find.text('Review report'), findsWidgets);
    await _scrollTo(tester, find.text('Hide material'));
    expect(find.text('Hide material'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'pending report is reviewed then appears under Resolved with success copy',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(1600, 1000));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final api = _FakeAdminMaterialsApi([_report()]);
      final router = GoRouter(
        initialLocation: '/admin/materials',
        routes: [
          GoRoute(
            path: '/admin/materials',
            builder: (_, _) => const Scaffold(body: AdminMaterialsPage()),
          ),
        ],
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [adminMaterialsApiProvider.overrideWithValue(api)],
          child: MaterialApp.router(
            theme: AppTheme.light,
            locale: const Locale('en'),
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Reported').last);
      await tester.pumpAndSettle();

      expect(find.text('Review report'), findsOneWidget);
      expect(find.text('Resolve'), findsNothing);
      expect(api.resolveCalls, 0);

      await tester.ensureVisible(find.text('Review report'));
      await tester.tap(find.text('Review report'));
      await tester.pumpAndSettle();
      expect(api.resolveCalls, 0);
      expect(
        find.text('Close report without changing the material'),
        findsOneWidget,
      );

      await _scrollTo(
        tester,
        find.text('Close report without changing the material'),
      );
      await tester.tap(find.text('Close report without changing the material'));
      await _scrollTo(tester, find.byType(TextField).last);
      await tester.enterText(
        find.byType(TextField).last,
        'Supplier corrected the price before review.',
      );
      await tester.tap(find.text('Submit decision'));
      await tester.pumpAndSettle();

      expect(api.resolveCalls, 1);
      expect(find.text('The report was closed.'), findsOneWidget);
      expect(find.text('No reports awaiting review'), findsOneWidget);
      expect(find.text('Oak plywood sheet'), findsNothing);

      await tester.tap(find.text('Resolved'));
      await tester.pumpAndSettle();
      expect(find.text('Oak plywood sheet'), findsOneWidget);
      expect(find.textContaining('No material action'), findsOneWidget);
      expect(
        find.textContaining('Supplier corrected the price before review.'),
        findsWidgets,
      );
    },
  );
}
