class HandoverPaymentSummary {
  const HandoverPaymentSummary({
    required this.paymentMethod,
    required this.cashDueAtHandover,
    this.totalAmount,
    this.currency,
  });

  final String paymentMethod;
  final bool cashDueAtHandover;
  final String? totalAmount;
  final String? currency;

  bool get requiresCashConfirmation =>
      paymentMethod == 'CASH' &&
      cashDueAtHandover &&
      totalAmount != null &&
      currency != null;

  factory HandoverPaymentSummary.fromJson(Map<String, dynamic> json) =>
      HandoverPaymentSummary(
        paymentMethod: json['paymentMethod']?.toString() ?? 'CARD',
        cashDueAtHandover: json['cashDueAtHandover'] == true,
        totalAmount: json['totalAmount']?.toString(),
        currency: json['currency']?.toString(),
      );
}
