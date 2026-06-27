class MatchedMaterialReference {
  const MatchedMaterialReference({
    required this.id,
    required this.nameEn,
    this.nameAr,
    required this.unit,
  });

  final String id;
  final String nameEn;
  final String? nameAr;
  final String unit;

  factory MatchedMaterialReference.fromJson(Map<String, dynamic> json) {
    return MatchedMaterialReference(
      id: json['id']?.toString() ?? '',
      nameEn: json['nameEn']?.toString() ?? '',
      nameAr: json['nameAr'] as String?,
      unit: json['unit']?.toString() ?? 'piece',
    );
  }

  String get displayLabel => nameEn;
}

class MaterialPriceCheckResult {
  const MaterialPriceCheckResult({
    required this.allowed,
    this.reason,
    required this.currency,
    required this.currencySymbol,
    this.maxAllowedPrice,
    this.priceRuleId,
    this.materialTypeId,
    this.matchedReference,
    this.approvedUnit,
    this.candidates = const [],
    required this.message,
  });

  final bool allowed;
  final String? reason;
  final String currency;
  final String currencySymbol;
  final double? maxAllowedPrice;
  final String? priceRuleId;
  final String? materialTypeId;
  final MatchedMaterialReference? matchedReference;
  final String? approvedUnit;
  final List<MatchedMaterialReference> candidates;
  final String message;

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

  static List<MatchedMaterialReference> _parseCandidates(dynamic value) {
    if (value is! List) {
      return const [];
    }

    return value
        .whereType<Map>()
        .map(
          (item) => MatchedMaterialReference.fromJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .where((candidate) => candidate.id.isNotEmpty)
        .toList();
  }

  factory MaterialPriceCheckResult.fromJson(Map<String, dynamic> json) {
    final rawMatched = json['matchedReference'];

    return MaterialPriceCheckResult(
      allowed: json['allowed'] == true,
      reason: json['reason'] as String?,
      currency: json['currency'] as String? ?? 'NIS',
      currencySymbol: json['currencySymbol'] as String? ?? '₪',
      maxAllowedPrice: _parseAmount(json['maxAllowedPrice']),
      priceRuleId: json['priceRuleId'] as String?,
      materialTypeId: json['materialTypeId'] as String?,
      matchedReference: rawMatched is Map
          ? MatchedMaterialReference.fromJson(
              Map<String, dynamic>.from(rawMatched),
            )
          : null,
      approvedUnit: json['approvedUnit'] as String?,
      candidates: _parseCandidates(json['candidates']),
      message: json['message'] as String? ?? '',
    );
  }
}
