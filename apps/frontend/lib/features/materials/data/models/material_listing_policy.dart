class MaterialListingPolicy {
  const MaterialListingPolicy({
    required this.currency,
    required this.currencySymbol,
    required this.freeAllowed,
    required this.paidAllowed,
    required this.otherAllowedForFree,
    required this.otherAllowedForPaid,
    required this.paidRequiresApprovedMaterialType,
    required this.paidRequiresActivePriceRule,
    required this.message,
  });

  final String currency;
  final String currencySymbol;
  final bool freeAllowed;
  final bool paidAllowed;
  final bool otherAllowedForFree;
  final bool otherAllowedForPaid;
  final bool paidRequiresApprovedMaterialType;
  final bool paidRequiresActivePriceRule;
  final String message;

  factory MaterialListingPolicy.fromJson(Map<String, dynamic> json) {
    return MaterialListingPolicy(
      currency: json['currency'] as String? ?? 'NIS',
      currencySymbol: json['currencySymbol'] as String? ?? '₪',
      freeAllowed: json['freeAllowed'] as bool? ?? true,
      paidAllowed: json['paidAllowed'] as bool? ?? true,
      otherAllowedForFree: json['otherAllowedForFree'] as bool? ?? true,
      otherAllowedForPaid: json['otherAllowedForPaid'] as bool? ?? false,
      paidRequiresApprovedMaterialType:
          json['paidRequiresApprovedMaterialType'] as bool? ?? true,
      paidRequiresActivePriceRule:
          json['paidRequiresActivePriceRule'] as bool? ?? true,
      message: json['message'] as String? ?? '',
    );
  }
}
