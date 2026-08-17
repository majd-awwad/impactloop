import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/shared/widgets/learner_discovery/learner_discovery.dart';

void main() {
  testWidgets('long Arabic filter chips do not overflow in a narrow wrap', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    FlutterError.onError = (details) {
      final message = details.exceptionAsString();
      if (message.contains('RenderFlex overflowed') ||
          message.contains('overflowed by')) {
        fail('Layout overflow: $message');
      }
      FlutterError.presentError(details);
    };

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightFor('ar'),
        home: const Scaffold(
          body: Padding(
            padding: EdgeInsets.all(16),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _TapChip(label: 'جميع المواد متوفرة'),
                _TapChip(label: 'معظم المواد متوفرة'),
                _TapChip(label: 'الأكثر توفرًا للمواد'),
                _TapChip(label: 'لا توجد مواد متوفرة'),
                _TapChip(label: 'كل المستويات'),
              ],
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    expect(find.text('جميع المواد متوفرة'), findsOneWidget);
  });

  testWidgets('long labeled chips with icons do not overflow a 320px wrap', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    FlutterError.onError = (details) {
      final message = details.exceptionAsString();
      if (message.contains('RenderFlex overflowed') ||
          message.contains('overflowed by')) {
        fail('Layout overflow: $message');
      }
      FlutterError.presentError(details);
    };

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightFor('ar'),
        home: const Scaffold(
          body: SizedBox(
            width: 320,
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _TapChip(
                    label: 'جميع المواد متوفرة',
                    icon: Icons.sort_rounded,
                  ),
                  _TapChip(
                    label: 'الأكثر توفرًا للمواد',
                    icon: Icons.equalizer_rounded,
                  ),
                  _TapChip(label: 'لا توجد مواد متوفرة'),
                ],
              ),
            ),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });

  testWidgets('tapping a filter chip selects it immediately', (tester) async {
    var selected = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightFor('ar'),
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, setState) {
              return LearnerFilterChip(
                label: 'سهل',
                selected: selected,
                dense: true,
                onSelected: () => setState(() => selected = !selected),
              );
            },
          ),
        ),
      ),
    );

    await tester.tap(find.text('سهل'));
    await tester.pump();

    expect(selected, isTrue);
    expect(tester.takeException(), isNull);
  });
}

class _TapChip extends StatelessWidget {
  const _TapChip({required this.label, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return LearnerFilterChip(
      label: label,
      selected: false,
      dense: true,
      icon: icon,
      onSelected: () {},
    );
  }
}
