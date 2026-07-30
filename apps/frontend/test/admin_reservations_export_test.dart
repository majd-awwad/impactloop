import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/admin_portal/data/admin_reservations_api.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_reservations_page.dart';

void main() {
  test('parseContentDispositionFilename handles quoted and UTF-8 forms', () {
    expect(
      parseContentDispositionFilename(
        'attachment; filename="impactloop-reservations-2026-07-30.csv"',
      ),
      'impactloop-reservations-2026-07-30.csv',
    );
    expect(
      parseContentDispositionFilename(
        "attachment; filename*=UTF-8''impactloop-reservations-2026-07-01-to-2026-07-30.pdf",
      ),
      'impactloop-reservations-2026-07-01-to-2026-07-30.pdf',
    );
    expect(
      parseContentDispositionFilename(
        'attachment; filename=impactloop-reservations.csv',
      ),
      'impactloop-reservations.csv',
    );
  });

  test('sanitizeAdminExportFilename strips path traversal characters', () {
    expect(sanitizeAdminExportFilename('../evil.pdf'), '.._evil.pdf');
    expect(sanitizeAdminExportFilename(''), isNull);
  });

  test('AdminReservationsExportPreflight parses per-format eligibility', () {
    final preflight = AdminReservationsExportPreflight.fromJson({
      'count': 12,
      'filters': {'status': 'ACCEPTED'},
      'formats': {
        'xlsx': {'maxAllowed': 10000, 'exceedsLimit': false, 'allowed': true},
        'pdf': {'maxAllowed': 500, 'exceedsLimit': false, 'allowed': true},
        'csv': {'maxAllowed': 10000, 'exceedsLimit': false, 'allowed': true},
      },
    });
    expect(preflight.count, 12);
    expect(preflight.eligibilityFor('xlsx')?.allowed, isTrue);
    expect(preflight.eligibilityFor('pdf')?.allowed, isTrue);
    expect(preflight.eligibilityFor('pdf')?.maxAllowed, 500);
  });

  testWidgets('export dialog shows Excel PDF CSV with Excel default', (
    tester,
  ) async {
    String? downloadedFormat;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdminReservationsExportDialog(
            count: 12,
            filterSummary: 'Status: ACCEPTED',
            formats: const {
              'xlsx': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
              'pdf': AdminExportFormatEligibility(
                maxAllowed: 500,
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

    expect(find.text('Excel'), findsOneWidget);
    expect(find.text('PDF'), findsOneWidget);
    expect(find.text('CSV'), findsOneWidget);
    expect(find.text('Detailed editable data'), findsOneWidget);

    await tester.tap(find.text('PDF'));
    await tester.pumpAndSettle();
    expect(find.text('Formatted administrative report'), findsOneWidget);

    await tester.tap(find.text('Export'));
    await tester.pumpAndSettle();
    expect(downloadedFormat, 'pdf');
  });

  testWidgets('PDF is selectable when allowed=true', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdminReservationsExportDialog(
            count: 12,
            filterSummary: 'All',
            formats: const {
              'xlsx': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
              'pdf': AdminExportFormatEligibility(
                maxAllowed: 500,
                exceedsLimit: false,
                allowed: true,
              ),
              'csv': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
            },
            onDownload: (_) async {},
          ),
        ),
      ),
    );

    final button = tester.widget<SegmentedButton<String>>(
      find.byType(SegmentedButton<String>),
    );
    final pdfSegment = button.segments.singleWhere((s) => s.value == 'pdf');
    expect(pdfSegment.enabled, isTrue);

    await tester.tap(find.text('PDF'));
    await tester.pumpAndSettle();
    expect(find.text('Formatted administrative report'), findsOneWidget);
  });

  testWidgets('PDF is disabled when exceedsLimit=true', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AdminReservationsExportDialog(
            count: 600,
            filterSummary: 'All',
            formats: const {
              'xlsx': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
              'pdf': AdminExportFormatEligibility(
                maxAllowed: 500,
                exceedsLimit: true,
                allowed: false,
              ),
              'csv': AdminExportFormatEligibility(
                maxAllowed: 10000,
                exceedsLimit: false,
                allowed: true,
              ),
            },
            onDownload: (_) async {},
          ),
        ),
      ),
    );

    expect(find.text('PDF'), findsOneWidget);
    final button = tester.widget<SegmentedButton<String>>(
      find.byType(SegmentedButton<String>),
    );
    final pdfSegment = button.segments.singleWhere((s) => s.value == 'pdf');
    expect(pdfSegment.enabled, isFalse);

    await tester.tap(find.text('PDF'));
    await tester.pumpAndSettle();
    // Selection stays on Excel default.
    expect(find.text('Detailed editable data'), findsOneWidget);
    expect(find.text('Formatted administrative report'), findsNothing);
  });
}
