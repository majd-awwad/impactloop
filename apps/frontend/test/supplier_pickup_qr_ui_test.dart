import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/complete_pickup_dialog.dart';
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
  testWidgets('shows Scan Pickup QR entry and manual code path', (tester) async {
    await tester.pumpWidget(_wrap(const CompletePickupDialog()));
    await tester.pumpAndSettle();

    expect(find.text('Scan Pickup QR'), findsOneWidget);
    expect(find.text('or'), findsOneWidget);
    expect(find.text('Pickup confirmation code'), findsOneWidget);
    expect(find.text('Mark completed'), findsOneWidget);
  });

  testWidgets('Scan Pickup QR pops CompletePickupScanQr', (tester) async {
    CompletePickupChoice? choice;
    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (context) {
            return TextButton(
              onPressed: () async {
                choice = await CompletePickupDialog.show(context);
              },
              child: const Text('open'),
            );
          },
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Scan Pickup QR'));
    await tester.pumpAndSettle();

    expect(choice, isA<CompletePickupScanQr>());
  });

  testWidgets('manual 6-digit code still completes via dialog result', (
    tester,
  ) async {
    CompletePickupChoice? choice;
    await tester.pumpWidget(
      _wrap(
        Builder(
          builder: (context) {
            return TextButton(
              onPressed: () async {
                choice = await CompletePickupDialog.show(context);
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
    await tester.tap(find.text('Mark completed'));
    await tester.pumpAndSettle();

    expect(choice, isA<CompletePickupManualCode>());
    expect((choice! as CompletePickupManualCode).code, '123456');
  });

  testWidgets('allowScan false hides QR entry but keeps manual code', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(const CompletePickupDialog(allowScan: false)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Scan Pickup QR'), findsNothing);
    expect(find.text('Pickup confirmation code'), findsOneWidget);
  });

  testWidgets('Arabic scan label is localized', (tester) async {
    await tester.pumpWidget(
      _wrap(const CompletePickupDialog(), locale: const Locale('ar')),
    );
    await tester.pumpAndSettle();

    expect(find.text('مسح رمز QR للاستلام'), findsOneWidget);
  });
}
