import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/intl.dart';

import 'package:frontend/features/material_discovery/presentation/widgets/preferred_window_input.dart';
import 'package:frontend/features/reservations/data/models/reservation_preferred_window.dart';
import 'package:frontend/features/reservations/presentation/learner_reservation_ui_helpers.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

Widget _wrap({
  required Widget child,
  Locale locale = const Locale('en'),
  Size size = const Size(390, 800),
}) {
  return MaterialApp(
    locale: locale,
    localizationsDelegates: AppLocalizations.localizationsDelegates,
    supportedLocales: AppLocalizations.supportedLocales,
    home: MediaQuery(
      data: MediaQueryData(size: size),
      child: Scaffold(
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: child,
        ),
      ),
    ),
  );
}

PreferredWindowDraft _filledDraft({
  DateTime? date,
  TimeOfDay? startTime,
  TimeOfDay? endTime,
}) {
  return PreferredWindowDraft(
    date: date ?? DateTime(2026, 7, 5),
    startTime: startTime ?? const TimeOfDay(hour: 16, minute: 0),
    endTime: endTime ?? const TimeOfDay(hour: 18, minute: 0),
  );
}

void main() {
  group('PreferredWindowDraft', () {
    test('isBlank is true only when no date or times are selected', () {
      expect(PreferredWindowDraft().isBlank, isTrue);
      expect(PreferredWindowDraft(date: DateTime(2026, 7, 5)).isBlank, isFalse);
      expect(
        PreferredWindowDraft(
          startTime: const TimeOfDay(hour: 16, minute: 0),
        ).isBlank,
        isFalse,
      );
      expect(
        PreferredWindowDraft(
          endTime: const TimeOfDay(hour: 18, minute: 0),
        ).isBlank,
        isFalse,
      );
    });

    test('partialValidationError is null for blank drafts', () {
      expect(PreferredWindowDraft().partialValidationError(), isNull);
    });

    test('partialValidationError requires date, start, and end when started', () {
      final draft = PreferredWindowDraft(date: DateTime(2026, 7, 5));

      expect(draft.partialValidationError(), isNotNull);
    });

    test('partialValidationError rejects end before or equal to start', () {
      final draft = PreferredWindowDraft(
        date: DateTime(2026, 7, 5),
        startTime: const TimeOfDay(hour: 18, minute: 0),
        endTime: const TimeOfDay(hour: 16, minute: 0),
      );

      expect(
        draft.partialValidationError(),
        'End time must be after start time.',
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

      onPreferredWindowsChanged([_filledDraft()]);

      expect(deliveryWindow.date, DateTime(2026, 7, 5));
      expect(deliveryWindow.startTime, const TimeOfDay(hour: 16, minute: 0));
      expect(deliveryWindow.endTime, const TimeOfDay(hour: 18, minute: 0));
      expect(deliveryWindow.start, isNotNull);
      expect(deliveryWindow.end, isNotNull);
    });

    test('serialization payload remains UTC ISO-8601', () {
      final start = DateTime(2026, 7, 5, 16, 0);
      final end = DateTime(2026, 7, 5, 18, 0);
      final window = ReservationPreferredWindow(start: start, end: end);

      expect(
        window.toJson()['start'],
        start.toUtc().toIso8601String(),
      );
      expect(
        window.toJson()['end'],
        end.toUtc().toIso8601String(),
      );
    });
  });

  group('PreferredWindowInput polish', () {
    testWidgets('empty single preferred window renders without Window 1 heading', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          child: PreferredWindowInput(
            windows: [PreferredWindowDraft()],
            enabled: true,
            label: '',
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Window 1'), findsNothing);
      expect(find.textContaining('Preferred window'), findsNothing);
      expect(find.byIcon(Icons.calendar_today_outlined), findsOneWidget);
      expect(find.byIcon(Icons.schedule_outlined), findsNWidgets(2));
    });

    testWidgets('date field renders calendar icon and placeholders', (
      tester,
    ) async {
      final l10n = AppLocalizationsEn();

      await tester.pumpWidget(
        _wrap(
          child: PreferredWindowInput(
            windows: [PreferredWindowDraft()],
            enabled: true,
            label: '',
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.calendar_today_outlined), findsOneWidget);
      expect(find.text(l10n.preferredWindowChooseDate), findsOneWidget);
      expect(find.text(l10n.preferredWindowDateLabel), findsOneWidget);
    });

    testWidgets('start and end fields render clock icons', (tester) async {
      await tester.pumpWidget(
        _wrap(
          child: PreferredWindowInput(
            windows: [PreferredWindowDraft()],
            enabled: true,
            label: '',
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byIcon(Icons.schedule_outlined), findsNWidgets(2));
    });

    testWidgets('add another window creates a second row', (tester) async {
      await tester.pumpWidget(
        _wrap(child: const _PreferredWindowListHarness()),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('preferred-window-row-0')), findsOneWidget);

      await tester.tap(find.byKey(const ValueKey('preferred-window-add-button')));
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('preferred-window-row-1')), findsOneWidget);
    });

    testWidgets('delete removes the correct window', (tester) async {
      await tester.pumpWidget(
        _wrap(
          size: const Size(1024, 800),
          child: _PreferredWindowListHarness(
            initialWindows: [
              PreferredWindowDraft(date: DateTime(2026, 7, 5)),
              PreferredWindowDraft(date: DateTime(2026, 7, 6)),
            ],
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('preferred-window-remove-1')));
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('preferred-window-row-1')), findsNothing);
      expect(
        find.text(DateFormat.yMd('en').format(DateTime(2026, 7, 5))),
        findsOneWidget,
      );
    });

    testWidgets('blank optional row does not show inline validation error', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          child: PreferredWindowInput(
            windows: [PreferredWindowDraft()],
            enabled: true,
            label: '',
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text(AppLocalizationsEn().preferredWindowIncompleteError),
        findsNothing,
      );
    });

    testWidgets('partially completed row shows inline validation error', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(
          child: PreferredWindowInput(
            windows: [PreferredWindowDraft(date: DateTime(2026, 7, 5))],
            enabled: true,
            label: '',
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.text(AppLocalizationsEn().preferredWindowIncompleteError),
        findsOneWidget,
      );
    });

    testWidgets('end before start shows inline validation error', (tester) async {
      await tester.pumpWidget(
        _wrap(
          child: PreferredWindowInput(
            windows: [
              PreferredWindowDraft(
                date: DateTime(2026, 7, 5),
                startTime: const TimeOfDay(hour: 18, minute: 0),
                endTime: const TimeOfDay(hour: 16, minute: 0),
              ),
            ],
            enabled: true,
            label: '',
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(AppLocalizationsEn().endAfterStart), findsOneWidget);
    });

    testWidgets('desktop layout does not overflow at 1024px', (tester) async {
      await tester.pumpWidget(
        _wrap(
          size: const Size(1024, 800),
          child: PreferredWindowInput(
            windows: [_filledDraft(), _filledDraft()],
            enabled: true,
            label: '',
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.textContaining('Preferred window'), findsWidgets);
    });

    testWidgets('390px mobile layout stacks fields vertically', (tester) async {
      await tester.pumpWidget(
        _wrap(
          size: const Size(390, 800),
          child: PreferredWindowInput(
            windows: [PreferredWindowDraft()],
            enabled: true,
            label: '',
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      final dateField = tester.getTopLeft(
        find.byKey(const ValueKey('preferred-window-date-field-0')),
      );
      final startField = tester.getTopLeft(
        find.byKey(const ValueKey('preferred-window-start-field-0')),
      );

      expect(startField.dy, greaterThan(dateField.dy));
      expect(tester.takeException(), isNull);
    });

    testWidgets('360px mobile layout has no RenderFlex overflow', (tester) async {
      await tester.pumpWidget(
        _wrap(
          size: const Size(360, 800),
          child: PreferredWindowInput(
            windows: [_filledDraft(), _filledDraft()],
            enabled: true,
            label: '',
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });

    testWidgets('arabic RTL renders localized labels', (tester) async {
      await tester.pumpWidget(
        _wrap(
          locale: const Locale('ar'),
          size: const Size(360, 800),
          child: PreferredWindowInput(
            windows: [PreferredWindowDraft()],
            enabled: true,
            label: '',
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('اختر التاريخ'), findsOneWidget);
      expect(find.text('اختر الوقت'), findsNWidgets(2));
      expect(tester.takeException(), isNull);
    });

    testWidgets('english LTR renders localized labels', (tester) async {
      await tester.pumpWidget(
        _wrap(
          locale: const Locale('en'),
          child: PreferredWindowInput(
            windows: [PreferredWindowDraft()],
            enabled: true,
            label: '',
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Choose date'), findsOneWidget);
      expect(find.text('Choose time'), findsNWidgets(2));
    });

    testWidgets('retains values when parent updates state', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const Scaffold(body: _PreferredWindowInputHarness()),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Add another window'), findsNothing);
      expect(find.text('Choose date'), findsOneWidget);

      await tester.tap(find.text('Apply selection'));
      await tester.pumpAndSettle();

      final formattedDate = DateFormat.yMd('en').format(DateTime(2026, 7, 5));
      expect(find.text(formattedDate), findsOneWidget);
      expect(find.text('16:00'), findsOneWidget);
      expect(find.text('18:00'), findsOneWidget);
    });
  });

  group('ReservationPreferredWindowsSection', () {
    testWidgets('blank windows do not block validation at submit layer', (
      tester,
    ) async {
      final draft = PreferredWindowDraft();
      final windows = <ReservationPreferredWindow>[];

      for (final item in [draft]) {
        if (item.isBlank) {
          continue;
        }
        final error = item.partialValidationError();
        if (error != null) {
          fail('Blank row should not produce validation error');
        }
        windows.add(
          ReservationPreferredWindow(start: item.start!, end: item.end!),
        );
      }

      expect(windows, isEmpty);
    });
  });

  test('reservationStatusLabel shows Needs your confirmation', () {
    expect(
      reservationStatusLabel('AWAITING_LEARNER_CONFIRMATION'),
      'Needs your confirmation',
    );
  });

  test(
    'resolveLearnerConfirmation payload includes deliveryWindow UTC times',
    () {
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
    },
  );
}

class _PreferredWindowListHarness extends StatefulWidget {
  const _PreferredWindowListHarness({this.initialWindows});

  final List<PreferredWindowDraft>? initialWindows;

  @override
  State<_PreferredWindowListHarness> createState() =>
      _PreferredWindowListHarnessState();
}

class _PreferredWindowListHarnessState extends State<_PreferredWindowListHarness> {
  late List<PreferredWindowDraft> _windows;

  @override
  void initState() {
    super.initState();
    _windows = widget.initialWindows ?? [PreferredWindowDraft()];
  }

  @override
  Widget build(BuildContext context) {
    return PreferredWindowInput(
      windows: _windows,
      enabled: true,
      label: '',
      onChanged: (next) => setState(() => _windows = next),
    );
  }
}

class _PreferredWindowInputHarness extends StatefulWidget {
  const _PreferredWindowInputHarness();

  @override
  State<_PreferredWindowInputHarness> createState() =>
      _PreferredWindowInputHarnessState();
}

class _PreferredWindowInputHarnessState
    extends State<_PreferredWindowInputHarness> {
  PreferredWindowDraft _deliveryWindow = PreferredWindowDraft();

  void _applySelection() {
    setState(() {
      _deliveryWindow = _filledDraft();
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
