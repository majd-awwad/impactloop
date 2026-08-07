/// Server PaymentOrder DTO. Amounts stay decimal strings — no client money math.
class PaymentAttemptSummary {
  const PaymentAttemptSummary({
    required this.id,
    required this.status,
    required this.provider,
    required this.providerMode,
    required this.amount,
    required this.amountMinor,
    required this.currency,
    this.failureCode,
    this.failureMessage,
    this.expiresAt,
    required this.createdAt,
    this.succeededAt,
  });

  final String id;
  final String status;
  final String provider;
  final String providerMode;
  final String amount;
  final int amountMinor;
  final String currency;
  final String? failureCode;
  final String? failureMessage;
  final DateTime? expiresAt;
  final DateTime createdAt;
  final DateTime? succeededAt;

  bool get isActive => status == 'CREATED' || status == 'PENDING';
  bool get isFailed => status == 'FAILED';
  bool get isCancelled => status == 'CANCELLED';
  bool get isExpired => status == 'EXPIRED';
  bool get isSucceeded => status == 'SUCCEEDED';

  factory PaymentAttemptSummary.fromJson(Map<String, dynamic> json) {
    return PaymentAttemptSummary(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      provider: json['provider'] as String? ?? 'MOCK',
      providerMode: json['providerMode'] as String? ?? 'LOCAL',
      amount: json['amount']?.toString() ?? '0.00',
      amountMinor: (json['amountMinor'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'NIS',
      failureCode: json['failureCode'] as String?,
      failureMessage: json['failureMessage'] as String?,
      expiresAt: _parseDate(json['expiresAt']),
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now().toUtc(),
      succeededAt: _parseDate(json['succeededAt']),
    );
  }
}

class PaymentRefundSummary {
  const PaymentRefundSummary({
    required this.id,
    required this.status,
    required this.amount,
    required this.currency,
    this.reason,
    this.failureCode,
    this.failureMessage,
    required this.requestedAt,
    this.succeededAt,
  });

  final String id;
  final String status;
  final String amount;
  final String currency;
  final String? reason;
  final String? failureCode;
  final String? failureMessage;
  final DateTime requestedAt;
  final DateTime? succeededAt;

  bool get isPending => status == 'REQUESTED' || status == 'PENDING';

  factory PaymentRefundSummary.fromJson(Map<String, dynamic> json) {
    return PaymentRefundSummary(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      amount: json['amount']?.toString() ?? '0.00',
      currency: json['currency'] as String? ?? 'NIS',
      reason: json['reason'] as String?,
      failureCode: json['failureCode'] as String?,
      failureMessage: json['failureMessage'] as String?,
      requestedAt: _parseDate(json['requestedAt']) ?? DateTime.now().toUtc(),
      succeededAt: _parseDate(json['succeededAt']),
    );
  }
}

class PaymentOrder {
  const PaymentOrder({
    required this.id,
    required this.purpose,
    required this.cycleNumber,
    required this.status,
    required this.amount,
    required this.amountMinor,
    required this.currency,
    this.reservationId,
    this.deliveryGroupId,
    this.paidAt,
    this.cancelledAt,
    this.refundedAt,
    required this.createdAt,
    required this.updatedAt,
    this.attempts = const [],
    this.refund,
  });

  final String id;
  final String purpose;
  final int cycleNumber;
  final String status;
  final String amount;
  final int amountMinor;
  final String currency;
  final String? reservationId;
  final String? deliveryGroupId;
  final DateTime? paidAt;
  final DateTime? cancelledAt;
  final DateTime? refundedAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<PaymentAttemptSummary> attempts;
  final PaymentRefundSummary? refund;

  bool get isMaterial => purpose == 'MATERIAL_SUBTOTAL';
  bool get isDeliveryFee => purpose == 'DELIVERY_FEE';
  bool get isPayable =>
      status == 'REQUIRES_PAYMENT' || status == 'CHECKOUT_PENDING';
  bool get isPaid => status == 'PAID';
  bool get isCancelled => status == 'CANCELLED';
  bool get isRefundPending => status == 'REFUND_PENDING';
  bool get isRefunded => status == 'REFUNDED';
  bool get isCheckoutPending => status == 'CHECKOUT_PENDING';

  PaymentAttemptSummary? get latestAttempt {
    if (attempts.isEmpty) return null;
    return attempts.reduce(
      (a, b) => a.createdAt.isAfter(b.createdAt) ? a : b,
    );
  }

  PaymentAttemptSummary? get activeAttempt {
    for (final attempt in attempts) {
      if (attempt.isActive) return attempt;
    }
    return null;
  }

  PaymentAttemptSummary? get latestTerminalAttempt {
    PaymentAttemptSummary? latest;
    for (final attempt in attempts) {
      if (attempt.isSucceeded ||
          attempt.isFailed ||
          attempt.isCancelled ||
          attempt.isExpired) {
        if (latest == null || attempt.createdAt.isAfter(latest.createdAt)) {
          latest = attempt;
        }
      }
    }
    return latest;
  }

  factory PaymentOrder.fromJson(Map<String, dynamic> json) {
    final rawAttempts = json['attempts'];
    final attempts = rawAttempts is List
        ? rawAttempts
              .whereType<Map>()
              .map(
                (item) => PaymentAttemptSummary.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
        : const <PaymentAttemptSummary>[];

    final rawRefund = json['refund'];
    return PaymentOrder(
      id: json['id'] as String? ?? '',
      purpose: json['purpose'] as String? ?? 'MATERIAL_SUBTOTAL',
      cycleNumber: (json['cycleNumber'] as num?)?.toInt() ?? 1,
      status: json['status'] as String? ?? 'REQUIRES_PAYMENT',
      amount: json['amount']?.toString() ?? '0.00',
      amountMinor: (json['amountMinor'] as num?)?.toInt() ?? 0,
      currency: json['currency'] as String? ?? 'NIS',
      reservationId: json['reservationId'] as String?,
      deliveryGroupId: json['deliveryGroupId'] as String?,
      paidAt: _parseDate(json['paidAt']),
      cancelledAt: _parseDate(json['cancelledAt']),
      refundedAt: _parseDate(json['refundedAt']),
      createdAt: _parseDate(json['createdAt']) ?? DateTime.now().toUtc(),
      updatedAt: _parseDate(json['updatedAt']) ?? DateTime.now().toUtc(),
      attempts: attempts,
      refund: rawRefund is Map
          ? PaymentRefundSummary.fromJson(Map<String, dynamic>.from(rawRefund))
          : null,
    );
  }
}

class PaymentCheckoutSession {
  const PaymentCheckoutSession({
    required this.orderId,
    required this.orderStatus,
    required this.attemptId,
    required this.attemptStatus,
    required this.checkoutUrl,
    this.expiresAt,
  });

  final String orderId;
  final String orderStatus;
  final String attemptId;
  final String attemptStatus;
  final String checkoutUrl;
  final DateTime? expiresAt;

  factory PaymentCheckoutSession.fromJson(Map<String, dynamic> json) {
    return PaymentCheckoutSession(
      orderId: json['orderId'] as String? ?? '',
      orderStatus: json['orderStatus'] as String? ?? '',
      attemptId: json['attemptId'] as String? ?? '',
      attemptStatus: json['attemptStatus'] as String? ?? '',
      checkoutUrl: json['checkoutUrl'] as String? ?? '',
      expiresAt: _parseDate(json['expiresAt']),
    );
  }
}

DateTime? _parseDate(Object? value) {
  if (value is! String || value.trim().isEmpty) return null;
  return DateTime.tryParse(value)?.toUtc();
}
