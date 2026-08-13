import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/driver_portal/presentation/widgets/complete_delivery_dialog.dart';
import 'package:frontend/l10n/app_localizations.dart';

Widget _wrap(Widget child, {Locale locale = const Locale('en')}) {
  return MaterialApp(
    locale: locale,
    theme: AppTheme.light,
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    home: Scaffold(body: child),
  );
}

void main() {
  testWidgets('shows Scan Delivery QR entry and manual code path', (tester) async {
    await tester.pumpWidget(_wrap(const CompleteDeliveryDialog()));
    await tester.pumpAndSettle();

    expect(find.text('Scan Delivery QR'), findsOneWidget);
    expect(find.text('or'), findsOneWidget);
    expect(find.text('Learner delivery code'), findsOneWidget);
    expect(find.text('Mark delivered'), findsOneWidget);
  });

  testWidgets('Scan Delivery QR pops CompleteDeliveryScanQr', (tester) async {
    CompleteDeliveryChoice? choice;
    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (context) {
            return TextButton(
              onPressed: () async {
                choice = await CompleteDeliveryDialog.show(context);
              },
              child: const Text('open'),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Scan Delivery QR'));
    await tester.pumpAndSettle();

    expect(choice, isA<CompleteDeliveryScanQr>());
  });

  testWidgets('manual 6-digit code completes via dialog result', (tester) async {
    CompleteDeliveryChoice? choice;
    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (context) {
            return TextButton(
              onPressed: () async {
                choice = await CompleteDeliveryDialog.show(context);
              },
              child: const Text('open'),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), '123456');
    await tester.tap(find.text('Mark delivered'));
    await tester.pumpAndSettle();

    expect(choice, isA<CompleteDeliveryManualCode>());
    expect((choice! as CompleteDeliveryManualCode).code, '123456');
  });
}
