class MaterialPriceRule {
  const MaterialPriceRule({
    required this.id,
    required this.materialTypeId,
    required this.currency,
    required this.unit,
    this.maxAllowedUnitPriceNis,
    this.maxAllowedTotalPriceNis,
    required this.status,
    required this.sourceType,
    required this.isActive,
  });

  final String id;
  final String materialTypeId;
  final String currency;
  final String unit;
  final double? maxAllowedUnitPriceNis;
  final double? maxAllowedTotalPriceNis;
  final String status;
  final String sourceType;
  final bool isActive;

  static double? _parseAmount(dynamic value) {
    if (value == null) {
      return null;
    }

    if (value is num) {
      return value.toDouble();
    }

    if (value is String) {
      return double.tryParse(value);
    }

    return null;
  }

  factory MaterialPriceRule.fromJson(Map<String, dynamic> json) {
    return MaterialPriceRule(
      id: json['id'] as String? ?? '',
      materialTypeId: json['materialTypeId'] as String? ?? '',
      currency: json['currency'] as String? ?? 'NIS',
      unit: json['unit'] as String? ?? 'piece',
      maxAllowedUnitPriceNis: _parseAmount(json['maxAllowedUnitPriceNis']),
      maxAllowedTotalPriceNis: _parseAmount(json['maxAllowedTotalPriceNis']),
      status: json['status'] as String? ?? 'PENDING_REVIEW',
      sourceType: json['sourceType'] as String? ?? 'MANUAL',
      isActive: json['isActive'] as bool? ?? false,
    );
  }
}
