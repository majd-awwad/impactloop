import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_text_styles.dart';
import 'package:frontend/app/theme/app_theme.dart';

void main() {
  Widget harness({
    required Size size,
    required WidgetBuilder builder,
    String languageCode = 'en',
  }) {
    return MediaQuery(
      data: MediaQueryData(size: size),
      child: MaterialApp(
        theme: AppTheme.lightFor(languageCode),
        home: Builder(builder: builder),
      ),
    );
  }

  testWidgets('learner compact styles stay smaller on a phone', (tester) async {
    late TextStyle display;
    late TextStyle title;
    late TextStyle subtitle;
    late TextStyle body;

    await tester.pumpWidget(
      harness(
        size: const Size(390, 844),
        builder: (context) {
          display = AppTextStyles.display(context);
          title = AppTextStyles.title(context);
          subtitle = AppTextStyles.subtitle(context);
          body = AppTextStyles.body(context);
          return const SizedBox.shrink();
        },
      ),
    );

    expect(display.fontSize, 24);
    expect(title.fontSize, 20);
    expect(subtitle.fontSize, 15);
    expect(body.fontSize, 14);
    expect(title.height, 1.2);
    expect(subtitle.height, 1.3);
  });

  testWidgets('desktop styles keep a bit more room', (tester) async {
    late TextStyle display;
    late TextStyle title;

    await tester.pumpWidget(
      harness(
        size: const Size(1024, 800),
        builder: (context) {
          display = AppTextStyles.display(context);
          title = AppTextStyles.title(context);
          return const SizedBox.shrink();
        },
      ),
    );

    expect(display.fontSize, 28);
    expect(title.fontSize, 22);
  });

  test('Arabic text scaler is slightly tighter and capped', () {
    final arabic = AppTheme.textScalerFor(
      incoming: TextScaler.linear(1.5),
      languageCode: 'ar',
    );
    final english = AppTheme.textScalerFor(
      incoming: TextScaler.linear(1.5),
      languageCode: 'en',
    );

    expect(english.scale(10), 12);
    expect(arabic.scale(10), closeTo(11.28, 0.05));
  });
}
