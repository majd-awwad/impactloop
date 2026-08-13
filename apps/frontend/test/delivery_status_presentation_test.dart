import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/deliveries/presentation/delivery_status_presentation.dart';
import 'package:frontend/features/deliveries/domain/delivery_status_contract.dart';
import 'package:frontend/features/deliveries/data/models/learner_delivery.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/l10n/app_localizations_en.dart';
import 'package:frontend/shared/l10n/learner_ui_labels.dart';

void main() {
  test('formatDeliveryPickupWindow renders readable same-day window', () {
    final text = formatDeliveryPickupWindow(
      pickupWindowStart: DateTime.parse('2026-06-27T07:00:00.000Z'),
      pickupWindowEnd: DateTime.parse('2026-06-27T13:00:00.000Z'),
      l10n: AppLocalizationsEn(),
    );

    expect(text, isNotNull);
    expect(text, contains('Jun 27'));
    expect(text, contains('–'));
  });

  test('deliveryStatusLabel maps delivered status', () {
    expect(deliveryStatusLabel('DELIVERED'), 'Delivered');
  });

  test('every backend delivery status has meaningful Arabic copy and tone', () {
    final ar = AppLocalizationsAr();
    final labels = LearnerUiLabels(ar);

    expect(learnerDeliveryStatuses, hasLength(15));
    for (final status in learnerDeliveryStatuses) {
      expect(labels.deliveryStatus(status), isNot(ar.unknownStatus));
      expect(deliveryStatusAppTone(status).name, isNot('neutral'));
    }

    expect(labels.deliveryStatus('DELIVERED'), ar.statusDelivered);
    expect(isSuccessfulLearnerDeliveryStatus('DELIVERED'), isTrue);
    expect(isTerminalLearnerDeliveryStatus('DELIVERED'), isTrue);
    expect(isSuccessfulLearnerDeliveryStatus('COMPLETED'), isFalse);
  });

  test('retry statuses are active and localized in English and Arabic', () {
    final en = LearnerUiLabels(AppLocalizationsEn());
    final ar = LearnerUiLabels(AppLocalizationsAr());

    for (final status in const ['REDELIVERY_PENDING', 'REDELIVERY_SCHEDULED']) {
      expect(isActiveLearnerDeliveryStatus(status), isTrue);
      expect(isTerminalLearnerDeliveryStatus(status), isFalse);
      expect(
        en.deliveryStatus(status),
        isNot(AppLocalizationsEn().unknownStatus),
      );
      expect(
        ar.deliveryStatus(status),
        isNot(AppLocalizationsAr().unknownStatus),
      );
      expect(deliveryStatusAppTone(status).name, 'info');
    }
  });

  test(
    'learner retry projection keeps the replacement window and hides pending handover',
    () {
      final delivery = LearnerDelivery.fromJson({
        'id': 'delivery-1',
        'reservationId': 'reservation-1',
        'status': 'REDELIVERY_PENDING',
        'learnerDeliveryCode': '123456',
        'reservation': {
          'id': 'reservation-1',
          'status': 'ACCEPTED',
          'confirmedDeliveryWindowStart': '2026-08-14T10:00:00.000Z',
          'confirmedDeliveryWindowEnd': '2026-08-14T11:00:00.000Z',
        },
      });

      expect(delivery.isActive, isTrue);
      expect(delivery.shouldShowLearnerDeliveryCode, isFalse);
      expect(delivery.reservation.confirmedDeliveryWindowStart, isNotNull);
      expect(delivery.reservation.confirmedDeliveryWindowEnd, isNotNull);
    },
  );

  test('unknown future delivery status stays neutral and never leaks code', () {
    final ar = AppLocalizationsAr();

    expect(
      deliveryStatusLabel('FUTURE_DELIVERY_STATE', l10n: ar),
      ar.unknownStatus,
    );
    expect(deliveryStatusAppTone('FUTURE_DELIVERY_STATE').name, 'neutral');
    expect(isTerminalLearnerDeliveryStatus('FUTURE_DELIVERY_STATE'), isFalse);
  });

  test('Arabic pickup windows use localized dates with Western digits', () {
    final ar = AppLocalizationsAr();
    final text = formatDeliveryPickupWindow(
      pickupWindowStart: DateTime.utc(2026, 7, 31, 7),
      pickupWindowEnd: DateTime.utc(2026, 7, 31, 9),
      l10n: ar,
    );

    expect(text, isNotNull);
    expect(text, contains('2026'));
    expect(text, isNot(contains('Jul')));
    expect(text, isNot(matches('[٠-٩]')));
  });
}
