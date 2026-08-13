import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/reservations/data/models/create_reservation_request.dart';
import 'package:frontend/features/reservations/data/models/reservation_payment_summary.dart';
import 'package:frontend/features/reservations/data/models/reservation_quote.dart';
import 'package:frontend/features/reservations/presentation/learner_reservation_payment_presentation.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

void main() {
  test('reservation create and quote payloads carry cash method', () {
    const create = CreateReservationRequest(
      materialId: 'material-1',
      quantityRequested: 2,
      fulfillmentMethod: 'DELIVERY',
      paymentMethod: 'CASH',
      deliveryAddressText: '12 Learner Street',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
    );
    const quote = ReservationQuoteRequest(
      materialId: 'material-1',
      quantity: 2,
      fulfillmentMethod: 'DELIVERY',
      paymentMethod: 'CASH',
    );

    expect(create.toJson()['paymentMethod'], 'CASH');
    expect(quote.toJson()['paymentMethod'], 'CASH');
  });

  test('cash due-at-handover summary never exposes a checkout action', () {
    final summary = ReservationPaymentSummary.fromJson(const {
      'enforcementEnabled': true,
      'paymentMethod': 'CASH',
      'paymentReady': false,
      'fulfillmentReady': true,
      'dueAtHandover': true,
      'overallStatus': 'REQUIRES_PAYMENT',
      'outstandingOrderCount': 1,
      'outstandingAmount': '24.00',
      'currency': 'NIS',
      'hasMaterialPaymentOutstanding': true,
      'hasDeliveryFeeOutstanding': false,
      'checkoutableOrderId': null,
      'pickupCodeAvailable': true,
      'deliveryDispatchable': false,
    });

    expect(summary.paymentMethod, 'CASH');
    expect(summary.paymentReady, isFalse);
    expect(summary.fulfillmentReady, isTrue);
    expect(summary.dueAtHandover, isTrue);
    expect(summary.canStartCheckout, isFalse);
    expect(summary.isPaymentActionRequired, isFalse);
    expect(
      paymentStatusLabel(summary, l10n: AppLocalizationsEn()),
      'Due at handover',
    );
  });
}
