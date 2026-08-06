/// Compact server-derived payment summary on learner reservation list items.
/// Amounts remain decimal strings. No provider metadata or attempt tokens.
class ReservationPaymentSummary {
  const ReservationPaymentSummary({
    required this.enforcementEnabled,
    required this.overallStatus,
    required this.outstandingOrderCount,
    this.outstandingAmount,
    this.currency,
    required this.hasMaterialPaymentOutstanding,
    required this.hasDeliveryFeeOutstanding,
    this.checkoutableOrderId,
    required this.fulfillmentReady,
    required this.pickupCodeAvailable,
    required this.deliveryDispatchable,
  });

  final bool enforcementEnabled;
  final String overallStatus;
  final int outstandingOrderCount;

  /// Decimal string from the server (e.g. `"16.00"`). Never parsed as double
  /// for money math in the UI layer.
  final String? outstandingAmount;
  final String? currency;
  final bool hasMaterialPaymentOutstanding;
  final bool hasDeliveryFeeOutstanding;
  final String? checkoutableOrderId;
  final bool fulfillmentReady;
  final bool pickupCodeAvailable;
  final bool deliveryDispatchable;

  bool get isPaymentActionRequired =>
      enforcementEnabled &&
      (hasMaterialPaymentOutstanding || hasDeliveryFeeOutstanding);

  /// True when one obligation is settled and another remains (e.g. material
  /// paid, shared delivery fee still due).
  bool get isPartialPayment =>
      enforcementEnabled &&
      !hasMaterialPaymentOutstanding &&
      hasDeliveryFeeOutstanding;

  bool get canStartCheckout =>
      checkoutableOrderId != null && checkoutableOrderId!.trim().isNotEmpty;

  bool get isPaid =>
      enforcementEnabled &&
      overallStatus == 'PAID' &&
      !hasMaterialPaymentOutstanding &&
      !hasDeliveryFeeOutstanding;

  bool get isRefundPending => overallStatus == 'REFUND_PENDING';
  bool get isRefunded => overallStatus == 'REFUNDED';
  bool get isProcessing => overallStatus == 'PROCESSING';
  bool get isResolutionRequired => overallStatus == 'RESOLUTION_REQUIRED';
  bool get isPaymentsDisabled =>
      !enforcementEnabled || overallStatus == 'PAYMENT_DISABLED';

  factory ReservationPaymentSummary.fromJson(Map<String, dynamic> json) {
    final outstandingAmount = json['outstandingAmount']?.toString();

    return ReservationPaymentSummary(
      enforcementEnabled: json['enforcementEnabled'] == true,
      overallStatus: json['overallStatus'] as String? ?? 'NOT_REQUIRED',
      outstandingOrderCount:
          (json['outstandingOrderCount'] as num?)?.toInt() ?? 0,
      outstandingAmount: outstandingAmount,
      currency: json['currency'] as String?,
      hasMaterialPaymentOutstanding:
          json['hasMaterialPaymentOutstanding'] == true,
      hasDeliveryFeeOutstanding: json['hasDeliveryFeeOutstanding'] == true,
      checkoutableOrderId: json['checkoutableOrderId'] as String?,
      fulfillmentReady: json['fulfillmentReady'] == true,
      pickupCodeAvailable: json['pickupCodeAvailable'] == true,
      deliveryDispatchable: json['deliveryDispatchable'] == true,
    );
  }
}
