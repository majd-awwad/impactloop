import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/material_discovery/presentation/widgets/preferred_window_input.dart';
import 'package:frontend/features/reservations/presentation/learner_reservation_ui_helpers.dart';

void main() {
  group('PreferredWindowDraft', () {
    test('validationError requires date, start, and end', () {
      final draft = PreferredWindowDraft();

      expect(
        draft.validationError(now: DateTime(2026, 1, 1)),
        'Choose a date, start time, and end time.',
      );
    });

    test('validationError rejects end before or equal to start', () {
      final draft = PreferredWindowDraft(
        date: DateTime(2026, 7, 5),
        startTime: const TimeOfDay(hour: 18, minute: 0),
        endTime: const TimeOfDay(hour: 16, minute: 0),
      );

      expect(
        draft.validationError(now: DateTime(2026, 1, 1)),
        'End time must be after start time.',
      );
    });

    test('stores picked values when parent replaces draft from onChanged', () {
      var deliveryWindow = PreferredWindowDraft();

      void onPreferredWindowsChanged(List<PreferredWindowDraft> windows) {
        if (windows.isNotEmpty) {
          deliveryWindow = windows.first;
        }
      }

      onPreferredWindowsChanged([
        PreferredWindowDraft(
          date: DateTime(2026, 7, 5),
          startTime: const TimeOfDay(hour: 16, minute: 0),
          endTime: const TimeOfDay(hour: 18, minute: 0),
        ),
      ]);

      expect(deliveryWindow.date, DateTime(2026, 7, 5));
      expect(deliveryWindow.startTime, const TimeOfDay(hour: 16, minute: 0));
      expect(deliveryWindow.endTime, const TimeOfDay(hour: 18, minute: 0));
      expect(deliveryWindow.start, isNotNull);
      expect(deliveryWindow.end, isNotNull);
    });
  });

  testWidgets('PreferredWindowInput retains values when parent updates state',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: _PreferredWindowInputHarness(),
        ),
      ),
    );

    expect(find.text('Add another window'), findsNothing);
    expect(find.text('Select'), findsNWidgets(3));

    await tester.tap(find.text('Apply selection'));
    await tester.pumpAndSettle();

    expect(find.text('2026-07-05'), findsOneWidget);
    expect(find.text('16:00'), findsOneWidget);
    expect(find.text('18:00'), findsOneWidget);
  });

  test('reservationStatusLabel shows Needs your confirmation', () {
    expect(
      reservationStatusLabel('AWAITING_LEARNER_CONFIRMATION'),
      'Needs your confirmation',
    );
  });

  test('resolveLearnerConfirmation payload includes deliveryWindow UTC times', () {
    final start = DateTime(2026, 7, 5, 16, 0);
    final end = DateTime(2026, 7, 5, 18, 0);

    final payload = <String, dynamic>{
      'action': 'SUBMIT_DELIVERY_WINDOW',
      'deliveryWindow': {
        'start': start.toUtc().toIso8601String(),
        'end': end.toUtc().toIso8601String(),
      },
    };

    expect(payload['action'], 'SUBMIT_DELIVERY_WINDOW');
    expect(payload['deliveryWindow'], isA<Map<String, dynamic>>());
    expect(
      (payload['deliveryWindow'] as Map<String, dynamic>)['start'],
      start.toUtc().toIso8601String(),
    );
    expect(
      (payload['deliveryWindow'] as Map<String, dynamic>)['end'],
      end.toUtc().toIso8601String(),
    );
  });
}

class _PreferredWindowInputHarness extends StatefulWidget {
  @override
  State<_PreferredWindowInputHarness> createState() =>
      _PreferredWindowInputHarnessState();
}

class _PreferredWindowInputHarnessState
    extends State<_PreferredWindowInputHarness> {
  PreferredWindowDraft _deliveryWindow = PreferredWindowDraft();

  void _applySelection() {
    setState(() {
      _deliveryWindow = PreferredWindowDraft(
        date: DateTime(2026, 7, 5),
        startTime: const TimeOfDay(hour: 16, minute: 0),
        endTime: const TimeOfDay(hour: 18, minute: 0),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        PreferredWindowInput(
          windows: [_deliveryWindow],
          enabled: true,
          label: 'New delivery window',
          allowMultipleWindows: false,
          onChanged: (windows) {
            setState(() {
              if (windows.isNotEmpty) {
                _deliveryWindow = windows.first;
              }
            });
          },
        ),
        TextButton(
          onPressed: _applySelection,
          child: const Text('Apply selection'),
        ),
      ],
    );
  }
}
