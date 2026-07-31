import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/admin_portal/data/admin_deliveries_api.dart';
import 'package:frontend/features/admin_portal/data/admin_reservations_api.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_deliveries_page.dart';

void main() {
  test(
    'AdminDeliveriesExportPreflight parses spreadsheet formats only',
    () {
      final preflight = AdminDeliveriesExportPreflight.fromJson({
        'count': 42,
        'filters': {'status': 'WAITING_FOR_DRIVER', 'search': 'wood'},
        'formats': {
          'xlsx': {'maxAllowed': 10000, 'exceedsLimit': false, 'allowed': true},
          'csv': {'maxAllowed': 10000, 'exceedsLimit': false, 'allowed': true},
        },
      });

      expect(preflight.count, 42);
      expect(preflight.eligibilityFor('xlsx')?.allowed, isTrue);
      expect(preflight.eligibilityFor('csv')?.allowed, isTrue);
      expect(preflight.eligibilityFor('pdf'), isNull);
      expect(preflight.formats.containsKey('pdf'), isFalse);
    },
  );

  testWidgets(
    'deliveries export dialog shows Excel and CSV only with all-pages copy',
    (tester) async {
      String? downloadedFormat;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AdminDeliveriesExportDialog(
              count: 42,
              filterSummary: 'Status: WAITING_FOR_DRIVER · Search: wood',
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

      expect(find.text('Export deliveries'), findsOneWidget);
      expect(
        find.textContaining(
          'Export all 42 matching deliveries, including results from all pages.',
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
          body: AdminDeliveriesExportDialog(
            count: 3,
            filterSummary: 'Status: DELIVERED',
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
          body: AdminDeliveriesExportDialog(
            count: 20000,
            filterSummary: 'No filters (all deliveries)',
            formats: const {
              'xlsx': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: true,
                allowed: false,
              ),
              'csv': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: true,
                allowed: false,
              ),
            },
            onDownload: (_) async {
              downloadCalls += 1;
            },
          ),
        ),
      ),
    );

    expect(find.textContaining('exceeds the limit'), findsOneWidget);
    final exportButton = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Export'),
    );
    expect(exportButton.onPressed, isNull);

    await tester.tap(find.text('Export'));
    await tester.pumpAndSettle();
    expect(downloadCalls, 0);
  });

  testWidgets('download failure recovers and allows retry', (tester) async {
    var attempts = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdminDeliveriesExportDialog(
            count: 2,
            filterSummary: 'Scope: SINGLE',
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
              attempts += 1;
              if (attempts == 1) {
                throw const ApiException(
                  message: 'Network unavailable',
                  code: 'NETWORK',
                );
              }
            },
          ),
        ),
      ),
    );

    await tester.tap(find.text('Export'));
    await tester.pumpAndSettle();
    expect(find.text('Network unavailable'), findsOneWidget);
    expect(attempts, 1);

    await tester.tap(find.text('Export'));
    await tester.pumpAndSettle();
    expect(attempts, 2);
    expect(find.text('Export deliveries'), findsNothing);
  });

  testWidgets('duplicate export click is ignored while downloading', (
    tester,
  ) async {
    var downloadCalls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdminDeliveriesExportDialog(
            count: 4,
            filterSummary: 'Assignment: UNASSIGNED',
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
              await Future<void>.delayed(const Duration(milliseconds: 200));
            },
          ),
        ),
      ),
    );

    final exportFinder = find.byWidgetPredicate(
      (widget) => widget is FilledButton,
    );
    await tester.tap(exportFinder);
    await tester.pump();
    expect(downloadCalls, 1);

    await tester.tap(exportFinder);
    await tester.pump();
    expect(downloadCalls, 1);

    await tester.pumpAndSettle();
  });
}
