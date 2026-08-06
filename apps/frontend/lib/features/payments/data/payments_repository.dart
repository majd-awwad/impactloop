import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/payment_order.dart';
import 'models/reservation_payment_requirement.dart';
import 'payments_api.dart';

final paymentsApiProvider = Provider<PaymentsApi>((ref) {
  return PaymentsApi(ref.watch(apiClientProvider));
});

final paymentsRepositoryProvider = Provider<PaymentsRepository>((ref) {
  return PaymentsRepository(ref.watch(paymentsApiProvider));
});

class PaymentsRepository {
  const PaymentsRepository(this._api);

  final PaymentsApi _api;

  Future<PaymentOrder> fetchPaymentOrder(String orderId) {
    return _api.fetchPaymentOrder(orderId);
  }

  Future<ReservationPaymentRequirement> fetchReservationPaymentRequirement(
    String reservationId,
  ) {
    return _api.fetchReservationPaymentRequirement(reservationId);
  }

  Future<PaymentCheckoutSession> startCheckout({
    required String orderId,
    required String idempotencyKey,
  }) {
    return _api.startCheckout(orderId: orderId, idempotencyKey: idempotencyKey);
  }

  Future<PaymentOrder> actOnMockCheckout({
    required String attemptId,
    required String action,
    String? token,
  }) {
    return _api.actOnMockCheckout(
      attemptId: attemptId,
      action: action,
      token: token,
    );
  }

  Future<({String orderId, String attemptId, String attemptStatus, String orderStatus})>
      cancelAttempt({
    required String orderId,
    required String attemptId,
  }) {
    return _api.cancelAttempt(orderId: orderId, attemptId: attemptId);
  }
}
