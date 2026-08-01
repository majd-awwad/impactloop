import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/shared/widgets/handover_confirmation_code_panel.dart';

void main() {
  testWidgets('HandoverConfirmationCodePanel shows formatted code not hash', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: HandoverConfirmationCodePanel(
            code: '123456',
            instructions: 'Give this code to the supplier.',
          ),
        ),
      ),
    );

    expect(find.text('123 456'), findsOneWidget);
    expect(find.textContaining(r'$2'), findsNothing);
  });
}
