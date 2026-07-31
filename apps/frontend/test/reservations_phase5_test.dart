import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/reservation_follow_up_actions.dart';
import 'package:frontend/l10n/app_localizations.dart';

void main() {
  group('Pickup follow-up stabilization UI', () {
    testWidgets('before allowed start shows only request reschedule', (
      tester,
    ) async {
      await _pump(tester, phase: 'BEFORE_ALLOWED', canRequestReschedule: true);

      expect(find.text('Reschedule pickup'), findsOneWidget);
      expect(find.text('Mark completed'), findsNothing);
      expect(find.text('Cancel reservation'), findsNothing);
    });

    testWidgets('during allowed range shows only mark completed', (
      tester,
    ) async {
      await _pump(
        tester,
        phase: 'DURING_ALLOWED',
        canMarkCompleted: true,
        canRequestReschedule: true,
      );

      expect(find.text('Mark completed'), findsOneWidget);
      expect(find.text('Reschedule pickup'), findsNothing);
    });

    testWidgets('after allowed end shows close report and reschedule', (
      tester,
    ) async {
      await _pump(
        tester,
        phase: 'AFTER_ALLOWED',
        canCloseReservation: true,
        canReportToAdmin: true,
        canRequestReschedule: true,
      );

      expect(find.text('Cancel reservation'), findsOneWidget);
      expect(find.text('Report to admin'), findsOneWidget);
      expect(find.text('Reschedule pickup'), findsOneWidget);
      expect(find.text('Mark completed'), findsNothing);
    });
  });
}

Future<void> _pump(
  WidgetTester tester, {
  required String phase,
  bool canMarkCompleted = false,
  bool canRequestReschedule = false,
  bool canCloseReservation = false,
  bool canReportToAdmin = false,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(
        body: ReservationFollowUpActions(
          pickupHandoverPhase: phase,
          canMarkCompleted: canMarkCompleted,
          canRequestReschedule: canRequestReschedule,
          canCloseReservation: canCloseReservation,
          canReportToAdmin: canReportToAdmin,
          hasAdminReport: false,
          onMarkCompleted: () {},
          onRequestReschedule: () {},
          onCloseReservation: () {},
          onReportToAdmin: () {},
        ),
      ),
    ),
  );
}
