import 'dart:math';

import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/payment_order.dart';
import 'models/reservation_checkout_session.dart';
import 'models/reservation_payment_requirement.dart';

String generatePaymentCheckoutIdempotencyKey() {
  const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  final random = Random.secure();
  final suffix = List.generate(
    24,
    (_) => chars[random.nextInt(chars.length)],
  ).join();
  return 'pay-chk-${DateTime.now().microsecondsSinceEpoch}-$suffix';
}

class PaymentsApi {
  const PaymentsApi(this._client);

  final Dio _client;

  Future<PaymentOrder> fetchPaymentOrder(String orderId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/payments/orders/$orderId'),
      PaymentOrder.fromJson,
    );
  }

  Future<ReservationPaymentRequirement> fetchReservationPaymentRequirement(
    String reservationId,
  ) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/payments/reservations/$reservationId/requirement',
      ),
      ReservationPaymentRequirement.fromJson,
    );
  }

  Future<ReservationCheckoutSession> startReservationCheckout({
    required String reservationId,
    required String idempotencyKey,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/payments/reservations/$reservationId/checkout',
        data: const <String, dynamic>{},
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      ),
      ReservationCheckoutSession.fromJson,
    );
  }

  Future<ReservationCheckoutSession> fetchCheckoutSession(String sessionId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/payments/checkout-sessions/$sessionId',
      ),
      ReservationCheckoutSession.fromJson,
    );
  }

  /// Resume helper: relevant session for the current payable set (may be null).
  Future<ReservationCheckoutSession?> fetchReservationCheckoutSession(
    String reservationId,
  ) {
    return unwrapNullableApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/payments/reservations/$reservationId/checkout-session',
      ),
      ReservationCheckoutSession.fromJson,
    );
  }

  /// Server-owned TTL expiry — not a list/detail GET mutation.
  Future<void> reconcileExpiredCheckoutSessions({String? reservationId}) {
    return unwrapApiVoidResponse(
      _client.post<Map<String, dynamic>>(
        '/api/payments/checkout-sessions/reconcile-expired',
        queryParameters: {
          if (reservationId != null && reservationId.isNotEmpty)
            'reservationId': reservationId,
        },
      ),
    );
  }

  Future<ReservationCheckoutSession> cancelReservationCheckoutAttempt({
    required String sessionId,
    required String attemptId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/payments/checkout-sessions/$sessionId/cancel-attempt',
        data: {'attemptId': attemptId},
      ),
      ReservationCheckoutSession.fromJson,
    );
  }

  /// Legacy per-order checkout — kept for compat; prefer [startReservationCheckout].
  Future<PaymentCheckoutSession> startCheckout({
    required String orderId,
    required String idempotencyKey,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/payments/orders/$orderId/checkout',
        data: const <String, dynamic>{},
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      ),
      PaymentCheckoutSession.fromJson,
    );
  }

  Future<MockCheckoutActResult> actOnMockCheckout({
    required String attemptId,
    required String action,
    String? token,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/payments/mock/checkout/$attemptId/act',
        data: <String, dynamic>{
          'action': action,
          if (token != null && token.isNotEmpty) 'token': token,
        },
      ),
      (json) {
        final sessionRaw = json['checkoutSession'];
        if (sessionRaw is Map) {
          return MockCheckoutActResult(
            checkoutSession: ReservationCheckoutSession.fromJson(
              Map<String, dynamic>.from(sessionRaw),
            ),
          );
        }
        final orderRaw = json['order'];
        if (orderRaw is Map) {
          return MockCheckoutActResult(
            order: PaymentOrder.fromJson(Map<String, dynamic>.from(orderRaw)),
          );
        }
        throw const ApiException(
          message: 'Mock act response missing checkoutSession or order',
        );
      },
    );
  }

  /// Legacy per-order cancel — kept for compat.
  Future<({String orderId, String attemptId, String attemptStatus, String orderStatus})>
      cancelAttempt({
    required String orderId,
    required String attemptId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/payments/orders/$orderId/cancel-attempt',
        data: {'attemptId': attemptId},
      ),
      (json) => (
        orderId: json['orderId'] as String? ?? orderId,
        attemptId: json['attemptId'] as String? ?? attemptId,
        attemptStatus: json['attemptStatus'] as String? ?? '',
        orderStatus: json['orderStatus'] as String? ?? '',
      ),
    );
  }
}
