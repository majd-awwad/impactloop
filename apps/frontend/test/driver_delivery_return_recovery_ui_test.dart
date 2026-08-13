import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/driver_portal/application/driver_deliveries_provider.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/features/driver_portal/presentation/pages/driver_delivery_detail_page.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

void main() {
  testWidgets(
    'driver sees return recovery without learner completion or cash controls',
    (tester) async {
      final delivery = DriverDelivery.fromJson({
        'id': 'delivery-return-1',
        'reservationId': 'reservation-1',
        'status': 'RETURN_TO_SUPPLIER_REQUIRED',
        'requestedAt': '2026-08-14T08:00:00.000Z',
        'returnRequiredAt': '2026-08-14T10:00:00.000Z',
        'returnReason': 'FINAL_ATTEMPT_FAILED',
        'material': {
          'title': 'Wood',
          'quantity': 2,
          'unit': 'kg',
        },
        'supplier': {
          'displayName': 'Safe Supplier',
          'phone': '+970599100100',
        },
        'learner': {
          'displayName': 'Learner',
          'phone': '+970599200200',
        },
        'pickupLocation': {
          'safeSummary': 'Supplier location',
          'addressLine': 'Industrial Road',
        },
        'dropoffLocation': {'safeSummary': 'Learner area'},
        'handoverPayment': {
          'paymentMethod': 'CASH',
          'status': 'REQUIRES_PAYMENT',
          'amount': 12,
          'currency': 'NIS',
        },
        'canDriverReportDeliveryFailed': false,
        'canDriverReportDriverIssue': false,
      });
      final en = AppLocalizationsEn();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            driverDeliveryDetailProvider.overrideWith(
              (ref, id) async => DriverDeliveryDetailActive(delivery),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light,
            locale: const Locale('en'),
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            home: const Scaffold(
              body: DriverDeliveryDetailPage(deliveryId: 'delivery-return-1'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text(en.driverReturnToSupplierTitle), findsWidgets);
      expect(find.text(en.driverWaitingSupplierConfirmation), findsOneWidget);
      expect(find.textContaining('Safe Supplier'), findsWidgets);
      expect(find.textContaining('Wood'), findsWidgets);
      expect(find.text(en.driverMarkDelivered), findsNothing);
      expect(find.text(en.driverCouldntDeliver), findsNothing);
      expect(find.byIcon(Icons.qr_code_2_outlined), findsNothing);
    },
  );
}
