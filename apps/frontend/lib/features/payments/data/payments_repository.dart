import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/payment_order.dart';
import 'models/reservation_checkout_session.dart';
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

  Future<ReservationCheckoutSession> startReservationCheckout({
    required String reservationId,
    required String idempotencyKey,
  }) {
    return _api.startReservationCheckout(
      reservationId: reservationId,
      idempotencyKey: idempotencyKey,
    );
  }

  Future<ReservationCheckoutSession> fetchCheckoutSession(String sessionId) {
    return _api.fetchCheckoutSession(sessionId);
  }

  Future<ReservationCheckoutSession?> fetchReservationCheckoutSession(
    String reservationId,
  ) {
    return _api.fetchReservationCheckoutSession(reservationId);
  }

  Future<void> reconcileExpiredCheckoutSessions({String? reservationId}) {
    return _api.reconcileExpiredCheckoutSessions(
      reservationId: reservationId,
    );
  }

  Future<ReservationCheckoutSession> cancelReservationCheckoutAttempt({
    required String sessionId,
    required String attemptId,
  }) {
    return _api.cancelReservationCheckoutAttempt(
      sessionId: sessionId,
      attemptId: attemptId,
    );
  }

  /// Legacy per-order checkout — kept for compat.
  Future<PaymentCheckoutSession> startCheckout({
    required String orderId,
    required String idempotencyKey,
  }) {
    return _api.startCheckout(orderId: orderId, idempotencyKey: idempotencyKey);
  }

  Future<MockCheckoutActResult> actOnMockCheckout({
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

  /// Legacy per-order cancel — kept for compat.
  Future<({String orderId, String attemptId, String attemptStatus, String orderStatus})>
      cancelAttempt({
    required String orderId,
    required String attemptId,
  }) {
    return _api.cancelAttempt(orderId: orderId, attemptId: attemptId);
  }
}
