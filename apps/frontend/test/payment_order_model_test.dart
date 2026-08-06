import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/payments/data/models/payment_order.dart';
import 'package:frontend/features/payments/data/models/reservation_payment_requirement.dart';

void main() {
  group('PaymentOrder model', () {
    test('parses payable order with attempts', () {
      final order = PaymentOrder.fromJson({
        'id': 'ord-1',
        'purpose': 'MATERIAL_SUBTOTAL',
        'cycleNumber': 1,
        'status': 'REQUIRES_PAYMENT',
        'amount': '16.00',
        'amountMinor': 1600,
        'currency': 'NIS',
        'reservationId': 'res-1',
        'deliveryGroupId': null,
        'paidAt': null,
        'cancelledAt': null,
        'refundedAt': null,
        'createdAt': '2026-08-06T10:00:00.000Z',
        'updatedAt': '2026-08-06T10:00:00.000Z',
        'attempts': [
          {
            'id': 'att-1',
            'status': 'FAILED',
            'provider': 'MOCK',
            'providerMode': 'LOCAL',
            'amount': '16.00',
            'amountMinor': 1600,
            'currency': 'NIS',
            'failureCode': 'DECLINED',
            'failureMessage': 'Card declined',
            'expiresAt': null,
            'createdAt': '2026-08-06T10:01:00.000Z',
            'succeededAt': null,
          },
        ],
        'refund': null,
      });

      expect(order.isPayable, isTrue);
      expect(order.isMaterial, isTrue);
      expect(order.latestTerminalAttempt?.isFailed, isTrue);
      expect(order.activeAttempt, isNull);
    });

    test('detects active attempt and paid status', () {
      final order = PaymentOrder.fromJson({
        'id': 'ord-2',
        'purpose': 'DELIVERY_FEE',
        'cycleNumber': 1,
        'status': 'CHECKOUT_PENDING',
        'amount': '4.00',
        'amountMinor': 400,
        'currency': 'NIS',
        'reservationId': 'res-1',
        'createdAt': '2026-08-06T10:00:00.000Z',
        'updatedAt': '2026-08-06T10:00:00.000Z',
        'attempts': [
          {
            'id': 'att-2',
            'status': 'CREATED',
            'provider': 'MOCK',
            'providerMode': 'LOCAL',
            'amount': '4.00',
            'amountMinor': 400,
            'currency': 'NIS',
            'createdAt': '2026-08-06T10:02:00.000Z',
          },
        ],
      });

      expect(order.isDeliveryFee, isTrue);
      expect(order.activeAttempt?.id, 'att-2');
      expect(order.isCheckoutPending, isTrue);
    });
  });

  group('ReservationPaymentRequirement model', () {
    test('parses material and delivery obligations', () {
      final req = ReservationPaymentRequirement.fromJson({
        'reservationId': 'res-1',
        'reservationStatus': 'ACCEPTED',
        'paymentEnforcementEnabled': true,
        'overallStatus': 'REQUIRES_PAYMENT',
        'fulfillmentMethod': 'PICKUP',
        'material': {
          'required': true,
          'status': 'REQUIRES_PAYMENT',
          'paymentOrderId': 'ord-1',
          'amount': '16.00',
          'currency': 'NIS',
          'cycleNumber': 1,
          'canStartCheckout': true,
        },
        'deliveryFee': {
          'applicable': true,
          'required': true,
          'status': 'PAID',
          'paymentOrderId': 'ord-2',
          'amount': '4.00',
          'currency': 'NIS',
          'cycleNumber': 1,
          'canStartCheckout': false,
        },
        'orders': [
          {
            'id': 'ord-1',
            'purpose': 'MATERIAL_SUBTOTAL',
            'amount': '16.00',
            'currency': 'NIS',
            'status': 'REQUIRES_PAYMENT',
            'cycleNumber': 1,
            'isCurrent': true,
            'canStartCheckout': true,
          },
        ],
        'paymentReady': false,
        'fulfillmentReady': false,
        'pickupCodeAvailable': false,
        'outstandingPaymentOrderIds': ['ord-1'],
      });

      expect(req.material.canStartCheckout, isTrue);
      expect(req.deliveryFee?.isPaid, isTrue);
      expect(req.orders.single.id, 'ord-1');
    });
  });
}
