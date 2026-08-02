import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/admin_portal/data/admin_no_show_reports_api.dart';
import 'package:frontend/features/admin_portal/data/admin_reservations_api.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_no_show_reports_page.dart';

void main() {
  test('AdminNoShowReportsExportPreflight parses spreadsheet formats only', () {
    final preflight = AdminNoShowReportsExportPreflight.fromJson({
      'count': 12,
      'filters': {
        'search': 'wood',
        'status': 'PENDING_REVIEW',
        'workflow': 'ACCOUNTABILITY',
        'targetRole': 'LEARNER',
        'operationalState': 'NOT_REQUIRED',
        'dateFrom': '2026-07-01',
        'dateTo': '2026-07-31',
      },
      'formats': {
        'xlsx': {'maxAllowed': 10000, 'exceedsLimit': false, 'allowed': true},
        'csv': {'maxAllowed': 10000, 'exceedsLimit': false, 'allowed': true},
      },
    });

    expect(preflight.count, 12);
    expect(preflight.eligibilityFor('xlsx')?.allowed, isTrue);
    expect(preflight.eligibilityFor('csv')?.allowed, isTrue);
    expect(preflight.eligibilityFor('pdf'), isNull);
    expect(preflight.formats.containsKey('pdf'), isFalse);
    expect(preflight.filters.containsKey('page'), isFalse);
    expect(preflight.filters.containsKey('limit'), isFalse);
  });

  testWidgets(
    'incident reports export dialog shows Excel and CSV only with all-pages copy',
    (tester) async {
      String? downloadedFormat;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AdminIncidentReportsExportDialog(
              count: 12,
              filterSummary:
                  'Search: wood · Status: PENDING_REVIEW · Workflow: ACCOUNTABILITY',
              formats: const {
                'xlsx': AdminExportFormatEligibility(
                  maxAllowed: 10000,
                  exceedsLimit: false,
                  allowed: true,
                ),
                'csv': AdminExportFormatEligibility(
                  maxAllowed: 10000,
                  exceedsLimit: false,
                  allowed: true,
                ),
              },
              onDownload: (format) async {
                downloadedFormat = format;
              },
            ),
          ),
        ),
      );

      expect(find.text('Export incident reports'), findsOneWidget);
      expect(
        find.textContaining(
          'Export all 12 matching incident reports, including results from all pages.',
        ),
        findsOneWidget,
      );
      expect(find.text('Excel'), findsOneWidget);
      expect(find.text('CSV'), findsOneWidget);
      expect(find.text('PDF'), findsNothing);
      expect(find.text('Detailed editable data'), findsOneWidget);

      await tester.tap(find.text('Export'));
      await tester.pumpAndSettle();
      expect(downloadedFormat, 'xlsx');
    },
  );

  testWidgets('CSV selection downloads format=csv', (tester) async {
    String? downloadedFormat;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdminIncidentReportsExportDialog(
            count: 3,
            filterSummary: 'Target role: SUPPLIER',
            formats: const {
              'xlsx': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
              'csv': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
            },
            onDownload: (format) async {
              downloadedFormat = format;
            },
          ),
        ),
      ),
    );

    await tester.tap(find.text('CSV'));
    await tester.pumpAndSettle();
    expect(find.text('Raw data'), findsOneWidget);

    await tester.tap(find.text('Export'));
    await tester.pumpAndSettle();
    expect(downloadedFormat, 'csv');
  });

  testWidgets('over-limit disables export and shows limit message', (
    tester,
  ) async {
    var downloadCalls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdminIncidentReportsExportDialog(
            count: 20000,
            filterSummary: 'No filters (all incident reports)',
            formats: const {
              'xlsx': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: true,
                allowed: false,
              ),
              'csv': AdminExportFormatEligibility(
                maxAllowed: 50000,
                exceedsLimit: false,
                allowed: true,
              ),
            },
            onDownload: (_) async {
              downloadCalls += 1;
            },
          ),
        ),
      ),
    );

    expect(find.textContaining('exceeds the limit of 10000'), findsOneWidget);
    final exportButton = find.widgetWithText(FilledButton, 'Export');
    expect(tester.widget<FilledButton>(exportButton).onPressed, isNull);

    await tester.tap(find.text('CSV'));
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(exportButton).onPressed, isNotNull);

    await tester.tap(exportButton);
    await tester.pumpAndSettle();
    expect(downloadCalls, 1);
  });

  testWidgets('zero-result message path is not confused with dialog title', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: Text('No incident reports match the current filters.'),
        ),
      ),
    );
    expect(
      find.text('No incident reports match the current filters.'),
      findsOneWidget,
    );
  });

  testWidgets('API failure recovery keeps dialog open with error', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdminIncidentReportsExportDialog(
            count: 4,
            filterSummary: 'Status: VERIFIED',
            formats: const {
              'xlsx': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
              'csv': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
            },
            onDownload: (_) async {
              throw const ApiException(
                message: 'Backend offline',
                code: 'NETWORK',
              );
            },
          ),
        ),
      ),
    );

    await tester.tap(find.text('Export'));
    await tester.pumpAndSettle();
    expect(find.text('Export incident reports'), findsOneWidget);
    expect(find.textContaining('Backend offline'), findsOneWidget);
    expect(find.text('Cancel'), findsOneWidget);
  });

  testWidgets('duplicate download click is ignored while downloading', (
    tester,
  ) async {
    var downloadCalls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdminIncidentReportsExportDialog(
            count: 2,
            filterSummary: 'Search: wood',
            formats: const {
              'xlsx': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
              'csv': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
            },
            onDownload: (_) async {
              downloadCalls += 1;
              await Future<void>.delayed(const Duration(milliseconds: 80));
            },
          ),
        ),
      ),
    );

    final exportButton = find.widgetWithText(FilledButton, 'Export');
    await tester.tap(exportButton);
    await tester.pump();
    // While downloading, the primary button shows a spinner (no Export label).
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.widgetWithText(FilledButton, 'Export'), findsNothing);
    await tester.pumpAndSettle();
    expect(downloadCalls, 1);
  });
}
