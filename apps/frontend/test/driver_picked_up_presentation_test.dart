import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery_failure_request.dart';
import 'package:frontend/features/driver_portal/presentation/driver_delivery_timing_presentation.dart';
import 'package:frontend/features/driver_portal/presentation/widgets/driver_active_delivery_card.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/l10n/app_localizations_en.dart';
import 'package:frontend/shared/l10n/driver_status_labels.dart';

Map<String, dynamic> _deliveryJson({
  required String status,
  DateTime? confirmedStart,
  DateTime? confirmedEnd,
  String? phone = '+970568860223',
}) {
  return {
    'id': 'delivery-1',
    'reservationId': 'reservation-1',
    'status': status,
    'requestedAt': '2026-08-18T08:00:00.000Z',
    'material': {
      'id': 'material-1',
      'title': 'Arduino',
      'quantityRequested': 2,
      'unit': 'pcs',
    },
    'supplier': {'displayName': 'Supplier'},
    'learner': {'displayName': 'ماجد', 'phone': phone},
    'pickupLocation': {'city': 'Hebron'},
    'dropoffLocation': {'city': 'Nablus'},
    if (confirmedStart != null)
      'confirmedDeliveryWindowStart': confirmedStart.toUtc().toIso8601String(),
    if (confirmedEnd != null)
      'confirmedDeliveryWindowEnd': confirmedEnd.toUtc().toIso8601String(),
  };
}

void main() {
  final ar = AppLocalizationsAr();
  final en = AppLocalizationsEn();

  test('PICKED_UP without a window asks the driver to schedule delivery', () {
    final delivery = DriverDelivery.fromJson(_deliveryJson(status: 'PICKED_UP'));
    expect(delivery.nextStatus, isNull);
    expect(delivery.needsDriverDeliveryWindow, isTrue);

    final guidanceAr = buildDriverNextActionGuidance(delivery, l10n: ar);
    expect(guidanceAr.actionLabel, ar.driverSetDeliveryWindow);
    expect(guidanceAr.actionLabel, isNot(ar.driverNoNextAction));
    expect(guidanceAr.hasFurtherSteps, isTrue);
    expect(guidanceAr.requiresScheduleWindow, isTrue);

    final guidanceEn = buildDriverNextActionGuidance(delivery, l10n: en);
    expect(guidanceEn.actionLabel, en.driverSetDeliveryWindow);
    expect(guidanceEn.actionLabel, isNot(en.driverNoNextAction));
  });

  test('PICKED_UP with a driver window advances toward the learner', () {
    final start = DateTime.now().add(const Duration(hours: 1));
    final end = start.add(const Duration(hours: 1));
    final delivery = DriverDelivery.fromJson(
      _deliveryJson(
        status: 'PICKED_UP',
        confirmedStart: start,
        confirmedEnd: end,
      ),
    );

    expect(delivery.needsDriverDeliveryWindow, isFalse);
    expect(delivery.nextStatus, 'ON_THE_WAY');
    expect(delivery.confirmedDeliveryWindowStart, isNotNull);
    expect(delivery.confirmedDeliveryWindowEnd, isNotNull);

    final guidance = buildDriverNextActionGuidance(delivery, l10n: ar);
    expect(guidance.actionLabel, ar.driverStartDeliveryOnTheWay);
    expect(guidance.requiresScheduleWindow, isFalse);
    expect(guidance.hasFurtherSteps, isTrue);
  });

  test('REDELIVERY_PENDING does not present the old window as the next step', () {
    final delivery = DriverDelivery.fromJson(
      _deliveryJson(
        status: 'REDELIVERY_PENDING',
        confirmedStart: DateTime.utc(2026, 8, 14, 8),
        confirmedEnd: DateTime.utc(2026, 8, 14, 9),
      ),
    );

    expect(delivery.nextStatus, isNull);
    expect(delivery.needsDriverDeliveryWindow, isTrue);
    final guidance = buildDriverNextActionGuidance(delivery, l10n: ar);
    expect(guidance.actionLabel, ar.driverScheduleRedelivery);
    expect(guidance.hasFurtherSteps, isTrue);
    expect(guidance.actionLabel, isNot(ar.driverNoNextAction));
  });

  test('Arabic and English picked-up labels stay distinct from terminal copy', () {
    expect(ar.driverSetDeliveryWindow, 'تحديد موعد التوصيل');
    expect(en.driverSetDeliveryWindow, 'Set delivery window');
    expect(ar.driverNoFurtherSteps, isNot(ar.driverSetDeliveryWindow));
    expect(en.driverNoFurtherSteps, isNot(en.driverSetDeliveryWindow));
    expect(driverDeliveryStatusLabel('PICKED_UP', ar), isNot(contains('_')));
    expect(driverDeliveryStatusLabel('ON_THE_WAY', ar), isNotEmpty);
    expect(driverDeliveryStatusLabel('ARRIVED_DROPOFF', ar), isNotEmpty);
    expect(driverDeliveryStatusLabel('DELIVERED', ar), isNotEmpty);
  });

  test('window request sends UTC ISO datetimes', () {
    final start = DateTime.utc(2026, 8, 18, 14);
    final end = DateTime.utc(2026, 8, 18, 15);
    final payload = DriverDeliveryWindowRequest(
      start: start,
      end: end,
    ).toJson();

    expect(payload['start'], '2026-08-18T14:00:00.000Z');
    expect(payload['end'], '2026-08-18T15:00:00.000Z');
  });

  testWidgets(
    'PICKED_UP card shows schedule delivery instead of no further steps',
    (tester) async {
      final delivery = DriverDelivery.fromJson(
        _deliveryJson(status: 'PICKED_UP'),
      );
      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => Scaffold(
              body: DriverActiveDeliveryCard(delivery: delivery),
            ),
          ),
        ],
      );

      await tester.pumpWidget(
        MaterialApp.router(
          theme: AppTheme.light,
          locale: const Locale('ar'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: router,
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('تحديد موعد التوصيل'), findsWidgets);
      expect(find.text('لا يوجد إجراء تالٍ'), findsNothing);
      expect(find.text('لا مزيد من الخطوات لهذا التوصيل.'), findsNothing);
    },
  );
}
