import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_message_bubble.dart';
import 'package:frontend/l10n/app_localizations.dart';

AiMessageItem _userMessage(String text) {
  return AiMessageItem(
    id: 'user-1',
    role: 'USER',
    status: 'COMPLETED',
    contentText: text,
    contentBlocks: const [],
    createdAt: DateTime.utc(2026, 1, 1, 12),
  );
}

AiMessageItem _assistantMessage(String text) {
  return AiMessageItem(
    id: 'assistant-1',
    role: 'ASSISTANT',
    status: 'COMPLETED',
    contentText: text,
    contentBlocks: [
      AiContentBlock(
        type: 'text',
        text: text,
        purpose: 'answer',
      ),
    ],
    createdAt: DateTime.utc(2026, 1, 1, 12, 1),
  );
}

Future<void> _pumpBubble({
  required WidgetTester tester,
  required Locale locale,
  required double width,
  required AiMessageItem message,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        locale: locale,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: Directionality(
          textDirection:
              locale.languageCode == 'ar' ? TextDirection.rtl : TextDirection.ltr,
          child: Scaffold(
            body: Center(
              child: SizedBox(
                width: width,
                child: AiMessageBubble(
                  message: message,
                  locale: locale.languageCode,
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('AiMessageBubble alignment and constraints', () {
    final widths = <double>[320, 360, 960];
    final samples = <String>[
      'Hi',
      'اشرحلي عن Arduino Uno 3 وكيف بشتغل مع breadboard في مشروع طويل جداً يحتاج التفاف نص نظيف بدون overflow على الشاشات الضيقة والعريضة معاً',
      'Arduino Uno 3 مع حساس مسافة HC-SR04',
    ];

    for (final width in widths) {
      for (final locale in const [Locale('en'), Locale('ar')]) {
        for (final role in const ['USER', 'ASSISTANT']) {
          for (final sample in samples) {
            testWidgets(
              '$locale $role @${width.toInt()}px: ${sample.substring(0, sample.length.clamp(0, 24))}',
              (tester) async {
                final message = role == 'USER'
                    ? _userMessage(sample)
                    : _assistantMessage(sample);

                await _pumpBubble(
                  tester: tester,
                  locale: locale,
                  width: width,
                  message: message,
                );

                expect(tester.takeException(), isNull);

                final align = tester.widget<Align>(
                  find
                      .descendant(
                        of: find.byType(AiMessageBubble),
                        matching: find.byType(Align),
                      )
                      .first,
                );
                final expected = role == 'USER'
                    ? AlignmentDirectional.centerEnd
                    : AlignmentDirectional.centerStart;
                expect(align.alignment, expected);

                final row = tester.widget<Row>(
                  find
                      .descendant(
                        of: find.byType(AiMessageBubble),
                        matching: find.byType(Row),
                      )
                      .first,
                );
                expect(row.mainAxisSize, MainAxisSize.min);

                final bubbleSize = tester.getSize(find.byType(AiMessageBubble));
                expect(bubbleSize.width, lessThanOrEqualTo(width + 0.5));
              },
            );
          }
        }
      }
    }
  });
}
