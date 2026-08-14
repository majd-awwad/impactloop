import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/reservations/data/models/reservation_preferred_window.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_locale_scope.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/accept_incoming_request_dialog.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

SupplierIncomingRequest request({
  required String fulfillmentMethod,
  List<ReservationPreferredWindow> deliveryWindows = const [],
  List<ReservationPreferredWindow> pickupWindows = const [],
}) => SupplierIncomingRequest(
  id: 'reservation-1',
  materialTitle: 'Reusable timber',
  learnerName: 'Learner',
  quantityRequested: 2,
  unit: 'pieces',
  status: SupplierIncomingRequestStatus.pending,
  requestedAt: DateTime(2026, 8, 13),
  fulfillmentMethod: fulfillmentMethod,
  fulfillmentLabel: fulfillmentMethod,
  learnerPreferredDeliveryWindows: deliveryWindows,
  learnerPreferredPickupWindows: pickupWindows,
);

Future<void> pumpDialog(
  WidgetTester tester,
  SupplierIncomingRequest value,
) async {
  await tester.pumpWidget(
    MaterialApp(
      locale: const Locale('en'),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: SupplierLocaleScope(
        languageCode: 'en',
        child: Scaffold(body: AcceptIncomingRequestDialog(request: value)),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'delivery preference is read-only and no appointment is requested',
    (tester) async {
      final window = ReservationPreferredWindow(
        start: DateTime(2026, 8, 14, 10),
        end: DateTime(2026, 8, 14, 12),
      );
      await pumpDialog(
        tester,
        request(fulfillmentMethod: 'DELIVERY', deliveryWindows: [window]),
      );

      expect(find.text('Learner preferred delivery windows'), findsOneWidget);
      expect(find.byType(Chip), findsOneWidget);
      expect(find.byType(ChoiceChip), findsNothing);
      expect(find.text('Driver pickup window from supplier'), findsOneWidget);
      expect(find.textContaining('custom delivery window'), findsNothing);
      expect(
        find.textContaining('Earliest delivery after pickup'),
        findsNothing,
      );
    },
  );

  testWidgets(
    'delivery without preference explains that timing is unspecified',
    (tester) async {
      await pumpDialog(tester, request(fulfillmentMethod: 'DELIVERY'));
      expect(
        find.text(AppLocalizationsEn().supplierNoPreferredDeliveryTime),
        findsOneWidget,
      );
    },
  );

  testWidgets('pickup keeps preferred-window selection behavior', (
    tester,
  ) async {
    final window = ReservationPreferredWindow(
      start: DateTime(2026, 8, 14, 10),
      end: DateTime(2026, 8, 14, 12),
    );
    await pumpDialog(
      tester,
      request(fulfillmentMethod: 'PICKUP', pickupWindows: [window]),
    );
    expect(find.byType(ChoiceChip), findsOneWidget);
  });
}
