import 'payment_order.dart';

/// Reservation-scoped checkout session DTO (PAY-05D).
/// Amounts stay decimal strings / minor ints — no client money math with double.
class ReservationCheckoutSessionItem {
  const ReservationCheckoutSessionItem({
    required this.paymentOrderId,
    required this.purpose,
    required this.amount,
    required this.amountMinor,
    required this.currency,
    required this.status,
    this.reservationId,
    this.materialTitle,
  });

  final String paymentOrderId;
  final String purpose;
  final String amount;
  final int amountMinor;
  final String currency;
  final String status;
  final String? reservationId;
  final String? materialTitle;

  factory ReservationCheckoutSessionItem.fromJson(Map<String, dynamic> json) {
    return ReservationCheckoutSessionItem(
      paymentOrderId: json['paymentOrderId'] as String? ?? '',
      purpose: json['purpose'] as String? ?? '',
      amount: json['amount']?.toString() ?? '0.00',
      amountMinor: (json['amountMinor'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'NIS',
      status: json['status'] as String? ?? '',
      reservationId: json['reservationId'] as String?,
      materialTitle: json['materialTitle'] as String?,
    );
  }
}

class ReservationCheckoutOrderStatus {
  const ReservationCheckoutOrderStatus({
    required this.paymentOrderId,
    required this.status,
  });

  final String paymentOrderId;
  final String status;

  factory ReservationCheckoutOrderStatus.fromJson(Map<String, dynamic> json) {
    return ReservationCheckoutOrderStatus(
      paymentOrderId: json['paymentOrderId'] as String? ?? '',
      status: json['status'] as String? ?? '',
    );
  }
}

class ReservationCheckoutSession {
  const ReservationCheckoutSession({
    required this.checkoutSessionId,
    required this.reservationId,
    this.deliveryGroupId,
    required this.status,
    required this.currency,
    required this.totalAmount,
    required this.totalAmountMinor,
    this.items = const [],
    this.attemptId,
    this.attemptStatus,
    this.checkoutUrl,
    this.expiresAt,
    this.orderStatuses = const [],
  });

  final String checkoutSessionId;
  final String reservationId;
  final String? deliveryGroupId;
  final String status;
  final String currency;
  final String totalAmount;
  final int totalAmountMinor;
  final List<ReservationCheckoutSessionItem> items;
  final String? attemptId;
  final String? attemptStatus;
  final String? checkoutUrl;
  final DateTime? expiresAt;
  final List<ReservationCheckoutOrderStatus> orderStatuses;

  bool get isSucceeded => status == 'SUCCEEDED';
  bool get isFailed => status == 'FAILED';
  bool get isCancelled => status == 'CANCELLED';
  bool get isExpired => status == 'EXPIRED';
  bool get isCheckoutPending => status == 'CHECKOUT_PENDING';
  bool get isCreated => status == 'CREATED';
  bool get isActive => isCreated || isCheckoutPending;

  bool get hasActiveAttempt {
    final status = attemptStatus;
    return status == 'CREATED' || status == 'PENDING';
  }

  /// Integer minor sum of line items — must equal [totalAmountMinor].
  int get itemsAmountMinorSum =>
      items.fold<int>(0, (sum, item) => sum + item.amountMinor);

  factory ReservationCheckoutSession.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    final rawOrderStatuses = json['orderStatuses'];

    return ReservationCheckoutSession(
      checkoutSessionId: json['checkoutSessionId'] as String? ?? '',
      reservationId: json['reservationId'] as String? ?? '',
      deliveryGroupId: json['deliveryGroupId'] as String?,
      status: json['status'] as String? ?? '',
      currency: json['currency'] as String? ?? 'NIS',
      totalAmount: json['totalAmount']?.toString() ?? '0.00',
      totalAmountMinor: (json['totalAmountMinor'] as num?)?.toInt() ?? 0,
      items: rawItems is List
          ? rawItems
              .whereType<Map>()
              .map(
                (item) => ReservationCheckoutSessionItem.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
          : const [],
      attemptId: json['attemptId'] as String?,
      attemptStatus: json['attemptStatus'] as String?,
      checkoutUrl: json['checkoutUrl'] as String?,
      expiresAt: _parseDate(json['expiresAt']),
      orderStatuses: rawOrderStatuses is List
          ? rawOrderStatuses
              .whereType<Map>()
              .map(
                (item) => ReservationCheckoutOrderStatus.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
          : const [],
    );
  }
}

/// Result of mock checkout act — session-owned attempts return [checkoutSession].
class MockCheckoutActResult {
  const MockCheckoutActResult({
    this.order,
    this.checkoutSession,
  });

  final PaymentOrder? order;
  final ReservationCheckoutSession? checkoutSession;
}

DateTime? _parseDate(Object? value) {
  if (value is! String || value.trim().isEmpty) return null;
  return DateTime.tryParse(value)?.toUtc();
}
