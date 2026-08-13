/// Compact reservation payment requirement used by checkout summary.
class ReservationPaymentRequirement {
  const ReservationPaymentRequirement({
    required this.reservationId,
    required this.reservationStatus,
    required this.paymentEnforcementEnabled,
    this.paymentMethod = 'CARD',
    this.dueAtHandover = false,
    required this.overallStatus,
    required this.fulfillmentMethod,
    required this.material,
    this.deliveryFee,
    this.orders = const [],
    required this.paymentReady,
    required this.fulfillmentReady,
    required this.pickupCodeAvailable,
    required this.outstandingPaymentOrderIds,
  });

  final String reservationId;
  final String reservationStatus;
  final bool paymentEnforcementEnabled;
  final String paymentMethod;
  final bool dueAtHandover;
  final String overallStatus;
  final String fulfillmentMethod;
  final RequirementObligation material;
  final RequirementObligation? deliveryFee;
  final List<RequirementOrderRow> orders;
  final bool paymentReady;
  final bool fulfillmentReady;
  final bool pickupCodeAvailable;
  final List<String> outstandingPaymentOrderIds;

  factory ReservationPaymentRequirement.fromJson(Map<String, dynamic> json) {
    final rawOrders = json['orders'];
    final rawDelivery = json['deliveryFee'];
    final outstanding = json['outstandingPaymentOrderIds'];

    return ReservationPaymentRequirement(
      reservationId: json['reservationId'] as String? ?? '',
      reservationStatus: json['reservationStatus'] as String? ?? '',
      paymentEnforcementEnabled: json['paymentEnforcementEnabled'] == true,
      paymentMethod: json['paymentMethod'] as String? ?? 'CARD',
      dueAtHandover: json['dueAtHandover'] == true,
      overallStatus: json['overallStatus'] as String? ?? 'NOT_REQUIRED',
      fulfillmentMethod: json['fulfillmentMethod'] as String? ?? 'PICKUP',
      material: RequirementObligation.fromJson(
        Map<String, dynamic>.from(json['material'] as Map? ?? const {}),
        requiredByDefault: true,
      ),
      deliveryFee: rawDelivery is Map
          ? RequirementObligation.fromJson(
              Map<String, dynamic>.from(rawDelivery),
              requiredByDefault: false,
            )
          : null,
      orders: rawOrders is List
          ? rawOrders
                .whereType<Map>()
                .map(
                  (item) => RequirementOrderRow.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
      paymentReady: json['paymentReady'] == true,
      fulfillmentReady: json['fulfillmentReady'] == true,
      pickupCodeAvailable: json['pickupCodeAvailable'] == true,
      outstandingPaymentOrderIds: outstanding is List
          ? outstanding.map((e) => e.toString()).toList(growable: false)
          : const [],
    );
  }
}

class RequirementObligation {
  const RequirementObligation({
    required this.required,
    required this.status,
    this.paymentOrderId,
    this.amount,
    this.currency,
    this.cycleNumber,
    required this.canStartCheckout,
    this.applicable,
    this.deliveryGroupId,
  });

  final bool required;
  final String status;
  final String? paymentOrderId;
  final String? amount;
  final String? currency;
  final int? cycleNumber;
  final bool canStartCheckout;
  final bool? applicable;
  final String? deliveryGroupId;

  bool get isPaid => status == 'PAID';
  bool get isOutstanding =>
      status == 'REQUIRES_PAYMENT' || status == 'CHECKOUT_PENDING';

  factory RequirementObligation.fromJson(
    Map<String, dynamic> json, {
    required bool requiredByDefault,
  }) {
    return RequirementObligation(
      required:
          json['required'] == true ||
          (json['required'] == null && requiredByDefault),
      status: json['status'] as String? ?? 'NOT_REQUIRED',
      paymentOrderId: json['paymentOrderId'] as String?,
      amount: json['amount']?.toString(),
      currency: json['currency'] as String?,
      cycleNumber: (json['cycleNumber'] as num?)?.toInt(),
      canStartCheckout: json['canStartCheckout'] == true,
      applicable: json['applicable'] as bool?,
      deliveryGroupId: json['deliveryGroupId'] as String?,
    );
  }
}

class RequirementOrderRow {
  const RequirementOrderRow({
    required this.id,
    required this.purpose,
    this.paymentMethod = 'CARD',
    required this.amount,
    required this.currency,
    required this.status,
    required this.cycleNumber,
    required this.isCurrent,
    required this.canStartCheckout,
    this.paidAt,
  });

  final String id;
  final String purpose;
  final String paymentMethod;
  final String amount;
  final String currency;
  final String status;
  final int cycleNumber;
  final bool isCurrent;
  final bool canStartCheckout;
  final DateTime? paidAt;

  factory RequirementOrderRow.fromJson(Map<String, dynamic> json) {
    final paidAt = json['paidAt'];
    return RequirementOrderRow(
      id: json['id'] as String? ?? '',
      purpose: json['purpose'] as String? ?? '',
      paymentMethod: json['paymentMethod'] as String? ?? 'CARD',
      amount: json['amount']?.toString() ?? '0.00',
      currency: json['currency'] as String? ?? 'NIS',
      status: json['status'] as String? ?? '',
      cycleNumber: (json['cycleNumber'] as num?)?.toInt() ?? 1,
      isCurrent: json['isCurrent'] == true,
      canStartCheckout: json['canStartCheckout'] == true,
      paidAt: paidAt is String ? DateTime.tryParse(paidAt)?.toUtc() : null,
    );
  }
}
