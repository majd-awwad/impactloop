import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/data/models/reservation_payment_summary.dart';

void main() {
  group('ReservationPaymentSummary parsing', () {
    test('parses all payment-summary statuses and keeps amount as string', () {
      const statuses = [
        'REQUIRES_PAYMENT',
        'PROCESSING',
        'PAID',
        'REFUND_PENDING',
        'REFUNDED',
        'RESOLUTION_REQUIRED',
        'PAYMENT_DISABLED',
        'NOT_REQUIRED',
        'AWAITING_ACCEPTANCE',
        'BLOCKED',
      ];

      for (final status in statuses) {
        final summary = ReservationPaymentSummary.fromJson({
          'enforcementEnabled': true,
          'overallStatus': status,
          'outstandingOrderCount': 1,
          'outstandingAmount': '16.00',
          'currency': 'NIS',
          'hasMaterialPaymentOutstanding': status == 'REQUIRES_PAYMENT',
          'hasDeliveryFeeOutstanding': false,
          'checkoutableOrderId': 'ord-1',
          'fulfillmentReady': false,
          'pickupCodeAvailable': false,
          'deliveryDispatchable': false,
        });

        expect(summary.overallStatus, status);
        expect(summary.outstandingAmount, '16.00');
        expect(summary.outstandingAmount, isA<String>());
        expect(summary.currency, 'NIS');
      }
    });

    test(
      'missing optional payment summary is handled safely on reservation',
      () {
        final reservation = LearnerReservation.fromJson({
          'id': 'res-1',
          'status': 'ACCEPTED',
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
        });

        expect(reservation.paymentSummary, isNull);
      },
    );

    test('does not require provider or private fields', () {
      final summary = ReservationPaymentSummary.fromJson({
        'enforcementEnabled': true,
        'overallStatus': 'REQUIRES_PAYMENT',
        'outstandingOrderCount': 1,
        'outstandingAmount': '8.50',
        'currency': 'NIS',
        'hasMaterialPaymentOutstanding': true,
        'hasDeliveryFeeOutstanding': false,
        'checkoutableOrderId': 'ord-9',
        'fulfillmentReady': false,
        'pickupCodeAvailable': false,
        'deliveryDispatchable': false,
        'provider': 'should-be-ignored',
        'attempts': [
          {'token': 'secret'},
        ],
      });

      expect(summary.checkoutableOrderId, 'ord-9');
      expect(summary.canStartCheckout, isTrue);
      expect(summary.isPaymentActionRequired, isTrue);
    });

    test('partial payment flags drive complete-payment semantics', () {
      final summary = ReservationPaymentSummary.fromJson({
        'enforcementEnabled': true,
        'overallStatus': 'REQUIRES_PAYMENT',
        'outstandingOrderCount': 1,
        'outstandingAmount': '12.00',
        'currency': 'NIS',
        'hasMaterialPaymentOutstanding': false,
        'hasDeliveryFeeOutstanding': true,
        'checkoutableOrderId': 'fee-1',
        'fulfillmentReady': false,
        'pickupCodeAvailable': false,
        'deliveryDispatchable': false,
      });

      expect(summary.isPartialPayment, isTrue);
      expect(summary.canStartCheckout, isTrue);

      final materialOnly = ReservationPaymentSummary.fromJson({
        'enforcementEnabled': true,
        'overallStatus': 'REQUIRES_PAYMENT',
        'outstandingOrderCount': 1,
        'outstandingAmount': '16.00',
        'currency': 'NIS',
        'hasMaterialPaymentOutstanding': true,
        'hasDeliveryFeeOutstanding': false,
        'checkoutableOrderId': 'ord-1',
        'fulfillmentReady': false,
        'pickupCodeAvailable': false,
        'deliveryDispatchable': false,
      });
      expect(materialOnly.isPartialPayment, isFalse);
    });

    test('payments disabled summary hides payment action', () {
      final summary = ReservationPaymentSummary.fromJson({
        'enforcementEnabled': false,
        'overallStatus': 'PAYMENT_DISABLED',
        'outstandingOrderCount': 0,
        'outstandingAmount': null,
        'currency': 'NIS',
        'hasMaterialPaymentOutstanding': false,
        'hasDeliveryFeeOutstanding': false,
        'checkoutableOrderId': null,
        'fulfillmentReady': true,
        'pickupCodeAvailable': true,
        'deliveryDispatchable': false,
      });

      expect(summary.isPaymentsDisabled, isTrue);
      expect(summary.canStartCheckout, isFalse);
      expect(summary.isPaymentActionRequired, isFalse);
    });
  });
}
