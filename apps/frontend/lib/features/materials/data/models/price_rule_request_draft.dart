class PriceRuleRequestDraftResponse {
  const PriceRuleRequestDraftResponse({
    required this.id,
    required this.status,
    this.maxAllowedUnitPriceNis,
    this.unit,
    this.category,
    this.listingDraftJson,
  });

  final String id;
  final String status;
  final double? maxAllowedUnitPriceNis;
  final String? unit;
  final PriceRuleRequestDraftCategory? category;
  final Map<String, dynamic>? listingDraftJson;

  factory PriceRuleRequestDraftResponse.fromJson(Map<String, dynamic> json) {
    final category = json['category'];

    return PriceRuleRequestDraftResponse(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      maxAllowedUnitPriceNis: _parseAmount(json['maxAllowedUnitPriceNis']),
      unit: json['unit'] as String?,
      category: category is Map
          ? PriceRuleRequestDraftCategory.fromJson(
              Map<String, dynamic>.from(category),
            )
          : null,
      listingDraftJson: json['listingDraftJson'] is Map
          ? Map<String, dynamic>.from(json['listingDraftJson'] as Map)
          : null,
    );
  }

  static double? _parseAmount(dynamic value) {
    if (value is num) {
      return value.toDouble();
    }
    if (value is String) {
      return double.tryParse(value);
    }
    return null;
  }
}

class PriceRuleRequestDraftCategory {
  const PriceRuleRequestDraftCategory({
    required this.id,
    required this.nameEn,
    this.nameAr,
  });

  final String id;
  final String nameEn;
  final String? nameAr;

  factory PriceRuleRequestDraftCategory.fromJson(Map<String, dynamic> json) {
    return PriceRuleRequestDraftCategory(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String?,
    );
  }
}
