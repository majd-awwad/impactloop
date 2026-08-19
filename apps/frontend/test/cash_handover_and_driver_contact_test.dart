import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/features/driver_portal/presentation/widgets/complete_delivery_dialog.dart';
import 'package:frontend/features/driver_portal/presentation/widgets/driver_learner_contact_card.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/complete_pickup_dialog.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/models/handover_payment_summary.dart';

const cash = HandoverPaymentSummary(
  paymentMethod: 'CASH',
  cashDueAtHandover: true,
  totalAmount: '35.00',
  currency: 'NIS',
);

Widget wrap(Widget child, {Locale locale = const Locale('en')}) => MaterialApp(
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

void main() {
  testWidgets('cash pickup displays authoritative amount and requires confirmation', (
    tester,
  ) async {
    CompletePickupChoice? choice;
    await tester.pumpWidget(wrap(Builder(builder: (context) {
      return TextButton(
        onPressed: () async {
          choice = await CompletePickupDialog.show(context, payment: cash);
        },
        child: const Text('open'),
      );
    })));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Cash to collect'), findsOneWidget);
    expect(find.text('35.00 NIS'), findsOneWidget);
    await tester.enterText(find.byType(TextField), '123456');
    await tester.ensureVisible(find.text('Mark completed'));
    await tester.tap(find.text('Mark completed'));
    await tester.pump();
    expect(choice, isNull);
    expect(find.text('Confirm cash receipt before completing handover.'), findsOneWidget);
    expect(find.byType(Checkbox), findsOneWidget);
  });

  testWidgets('cash delivery shows amount while card does not show cash controls', (
    tester,
  ) async {
    await tester.pumpWidget(wrap(const CompleteDeliveryDialog(payment: cash)));
    await tester.pumpAndSettle();
    expect(find.text('Cash to collect'), findsOneWidget);
    expect(find.text('35.00 NIS'), findsOneWidget);

    await tester.pumpWidget(wrap(const CompleteDeliveryDialog()));
    await tester.pumpAndSettle();
    expect(find.text('Cash to collect'), findsNothing);
  });

  testWidgets('Arabic cash labels are localized', (tester) async {
    await tester.pumpWidget(wrap(
      const CompleteDeliveryDialog(payment: cash),
      locale: const Locale('ar'),
    ));
    await tester.pumpAndSettle();
    expect(find.text('المبلغ المطلوب تحصيله نقدًا'), findsOneWidget);
    expect(find.text('أؤكد استلام المبلغ نقدًا'), findsOneWidget);
  });

  testWidgets('Arabic RTL keeps +970 learner phone LTR', (tester) async {
    await tester.pumpWidget(wrap(
      const DriverLearnerContactCard(
        learner: DriverDeliveryParty(
          displayName: 'ماجد',
          phone: '+970568860223',
        ),
      ),
      locale: const Locale('ar'),
    ));
    await tester.pumpAndSettle();

    expect(find.text('+970568860223'), findsOneWidget);
    expect(find.textContaining('970568860223+'), findsNothing);

    final phoneText = tester.widget<SelectableText>(find.byType(SelectableText));
    expect(phoneText.data, '+970568860223');
    expect(
      tester.widget<Directionality>(
        find
            .ancestor(
              of: find.text('+970568860223'),
              matching: find.byType(Directionality),
            )
            .first,
      ).textDirection,
      TextDirection.ltr,
    );
  });

  testWidgets('active learner contact shows phone and call action', (tester) async {
    await tester.pumpWidget(wrap(const DriverLearnerContactCard(
      learner: DriverDeliveryParty(
        displayName: 'Maya',
        phone: '+970599000000',
      ),
    )));
    await tester.pumpAndSettle();
    expect(find.text('Learner contact'), findsOneWidget);
    expect(find.text('+970599000000'), findsOneWidget);
    expect(find.text('Call'), findsOneWidget);
  });

  testWidgets('null learner phone shows localized fallback without call', (
    tester,
  ) async {
    await tester.pumpWidget(wrap(const DriverLearnerContactCard(
      learner: DriverDeliveryParty(displayName: 'Maya'),
    )));
    await tester.pumpAndSettle();
    expect(find.text('No phone number available'), findsOneWidget);
    expect(find.text('Call'), findsNothing);
  });
}
