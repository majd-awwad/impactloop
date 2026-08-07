import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/data/models/reservation_payment_summary.dart';
import 'package:frontend/features/reservations/presentation/learner_reservation_payment_presentation.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

LearnerReservation _reservation({
  required String id,
  required String fulfillmentMethod,
  required ReservationPaymentSummary summary,
  String status = 'ACCEPTED',
  Map<String, dynamic>? activeDelivery,
}) {
  return LearnerReservation.fromJson({
    'id': id,
    'status': status,
    'fulfillmentMethod': fulfillmentMethod,
    'quantityRequested': 1,
    'createdAt': '2026-01-01T00:00:00.000Z',
    'updatedAt': '2026-01-01T00:00:00.000Z',
    'material': {
      'id': 'mat-1',
      'title': 'Motors',
      'materialType': 'Motors',
      'status': 'RESERVED',
      'unit': 'piece',
    },
    'supplier': {'id': 'sup-1', 'displayName': 'Workshop'},
    'paymentSummary': {
      'enforcementEnabled': summary.enforcementEnabled,
      'overallStatus': summary.overallStatus,
      'outstandingOrderCount': summary.outstandingOrderCount,
      'outstandingAmount': summary.outstandingAmount,
      'currency': summary.currency,
      'hasMaterialPaymentOutstanding': summary.hasMaterialPaymentOutstanding,
      'hasDeliveryFeeOutstanding': summary.hasDeliveryFeeOutstanding,
      'checkoutableOrderId': summary.checkoutableOrderId,
      'fulfillmentReady': summary.fulfillmentReady,
      'pickupCodeAvailable': summary.pickupCodeAvailable,
      'deliveryDispatchable': summary.deliveryDispatchable,
    },
    if (activeDelivery != null) 'activeDelivery': activeDelivery,
  });
}

ReservationPaymentSummary _summary({
  required String overallStatus,
  bool hasMaterial = false,
  bool hasFee = false,
  String? amount,
  String? checkoutableOrderId,
  bool pickupCodeAvailable = false,
  bool fulfillmentReady = false,
}) {
  return ReservationPaymentSummary(
    enforcementEnabled: true,
    overallStatus: overallStatus,
    outstandingOrderCount: (hasMaterial ? 1 : 0) + (hasFee ? 1 : 0),
    outstandingAmount: amount,
    currency: 'NIS',
    hasMaterialPaymentOutstanding: hasMaterial,
    hasDeliveryFeeOutstanding: hasFee,
    checkoutableOrderId: checkoutableOrderId,
    fulfillmentReady: fulfillmentReady,
    pickupCodeAvailable: pickupCodeAvailable,
    deliveryDispatchable: false,
  );
}

void main() {
  final en = AppLocalizationsEn();

  group('PAY-05F presentation / action truth', () {
    test('NOT_REQUIRED shows payment not required, not unavailable', () {
      final label = paymentStatusLabel(
        _summary(overallStatus: 'NOT_REQUIRED'),
        l10n: en,
      );
      expect(label, en.paymentStatusNotRequired);
      expect(label, isNot(contains('unavailable')));
    });

    test('DELIVERY pay copy never mentions pickup code', () {
      final reservation = _reservation(
        id: 'res-d',
        fulfillmentMethod: 'DELIVERY',
        summary: _summary(
          overallStatus: 'REQUIRES_PAYMENT',
          hasMaterial: true,
          amount: '200.00',
          checkoutableOrderId: 'ord-1',
        ),
      );

      expect(
        reservationNextStepMessage(reservation, l10n: en),
        en.reservationNextStepPayToConfirmDelivery,
      );
      expect(
        reservationNextStepSupporting(reservation, l10n: en),
        en.reservationNextStepPaySupportingDelivery,
      );
      expect(
        reservationNextStepSupporting(reservation, l10n: en),
        isNot(contains('pickup')),
      );
    });

    test('PICKUP pay copy keeps pickup-window supporting text', () {
      final reservation = _reservation(
        id: 'res-p',
        fulfillmentMethod: 'PICKUP',
        summary: _summary(
          overallStatus: 'REQUIRES_PAYMENT',
          hasMaterial: true,
          amount: '40.00',
          checkoutableOrderId: 'ord-1',
        ),
      );

      expect(
        reservationNextStepSupporting(reservation, l10n: en),
        en.reservationNextStepPaySupporting,
      );
    });

    test('action truth table for pay / pickup / track / refund', () {
      final paidPickup = _reservation(
        id: 'res-paid-pickup',
        fulfillmentMethod: 'PICKUP',
        summary: _summary(
          overallStatus: 'PAID',
          pickupCodeAvailable: true,
          fulfillmentReady: true,
        ),
      );
      expect(
        resolvePrimaryAction(paidPickup),
        LearnerReservationPrimaryAction.viewPickupCode,
      );

      final unpaidFee = _reservation(
        id: 'res-fee',
        fulfillmentMethod: 'DELIVERY',
        summary: _summary(
          overallStatus: 'REQUIRES_PAYMENT',
          hasFee: true,
          amount: '20.00',
          checkoutableOrderId: 'ord-fee',
        ),
      );
      expect(
        resolvePrimaryAction(unpaidFee),
        LearnerReservationPrimaryAction.completePayment,
      );

      final waiting = _reservation(
        id: 'res-wait',
        fulfillmentMethod: 'DELIVERY',
        summary: _summary(
          overallStatus: 'PAID',
          fulfillmentReady: true,
        ),
        activeDelivery: {
          'id': 'del-1',
          'status': 'WAITING_FOR_DRIVER',
        },
      );
      expect(
        resolvePrimaryAction(waiting),
        LearnerReservationPrimaryAction.trackDelivery,
      );

      final refundPending = _reservation(
        id: 'res-refund',
        fulfillmentMethod: 'PICKUP',
        summary: _summary(overallStatus: 'REFUND_PENDING'),
      );
      expect(
        resolvePrimaryAction(refundPending),
        LearnerReservationPrimaryAction.viewDetails,
      );
    });
  });
}
