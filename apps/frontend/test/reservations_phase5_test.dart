import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/reservation_follow_up_actions.dart';
import 'package:flutter/material.dart';

void main() {
  group('Pickup follow-up stabilization UI', () {
    testWidgets('before allowed start shows only request reschedule', (
      tester,
    ) async {
      await _pump(tester, phase: 'BEFORE_ALLOWED', canRequestReschedule: true);

      expect(find.text('Request reschedule'), findsOneWidget);
      expect(find.text('Mark completed'), findsNothing);
      expect(find.text('Close reservation'), findsNothing);
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
      expect(find.text('Request reschedule'), findsNothing);
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

      expect(find.text('Close reservation'), findsOneWidget);
      expect(find.text('Report to admin'), findsOneWidget);
      expect(find.text('Request reschedule'), findsOneWidget);
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
