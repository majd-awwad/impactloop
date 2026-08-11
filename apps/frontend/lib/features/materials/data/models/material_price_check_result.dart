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

  String displayLabel({bool preferArabic = false}) {
    if (preferArabic) {
      final ar = nameAr?.trim();
      if (ar != null && ar.isNotEmpty) {
        return ar;
      }
    }
    return nameEn;
  }
}

class MaterialPriceCheckResult {
  const MaterialPriceCheckResult({
    required this.allowed,
    this.reason,
    required this.currency,
    required this.currencySymbol,
    this.maxAllowedPrice,
    this.baseMaxPrice,
    this.baseSuggestedPrice,
    this.selectedCondition,
    this.conditionMultiplier,
    this.adjustedSuggestedPrice,
    this.adjustedMaxPrice,
    this.submittedPrice,
    this.isWithinAdjustedRange,
    this.source,
    this.priceRuleId,
    this.materialTypeId,
    this.matchedReference,
    this.approvedUnit,
    this.candidates = const [],
    this.categorySuggestion,
    required this.message,
  });

  final bool allowed;
  final String? reason;
  final String currency;
  final String currencySymbol;
  final double? maxAllowedPrice;
  final double? baseMaxPrice;
  final double? baseSuggestedPrice;
  final String? selectedCondition;
  final double? conditionMultiplier;
  final double? adjustedSuggestedPrice;
  final double? adjustedMaxPrice;
  final double? submittedPrice;
  final bool? isWithinAdjustedRange;
  final String? source;
  final String? priceRuleId;
  final String? materialTypeId;
  final MatchedMaterialReference? matchedReference;
  final String? approvedUnit;
  final List<MatchedMaterialReference> candidates;
  final CategorySuggestion? categorySuggestion;
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

  static CategorySuggestion? _parseCategorySuggestion(dynamic value) {
    if (value is! Map) {
      return null;
    }
    return CategorySuggestion.fromJson(Map<String, dynamic>.from(value));
  }

  factory MaterialPriceCheckResult.fromJson(Map<String, dynamic> json) {
    final rawMatched = json['matchedReference'];

    return MaterialPriceCheckResult(
      allowed: json['allowed'] == true,
      reason: json['reason'] as String?,
      currency: json['currency'] as String? ?? 'NIS',
      currencySymbol: json['currencySymbol'] as String? ?? '₪',
      maxAllowedPrice: _parseAmount(json['maxAllowedPrice']),
      baseMaxPrice: _parseAmount(json['baseMaxPrice']),
      baseSuggestedPrice: _parseAmount(json['baseSuggestedPrice']),
      selectedCondition: json['selectedCondition'] as String?,
      conditionMultiplier: _parseAmount(json['conditionMultiplier']),
      adjustedSuggestedPrice: _parseAmount(json['adjustedSuggestedPrice']),
      adjustedMaxPrice: _parseAmount(json['adjustedMaxPrice']),
      submittedPrice: _parseAmount(json['submittedPrice']),
      isWithinAdjustedRange: json['isWithinAdjustedRange'] as bool?,
      source: json['source'] as String?,
      priceRuleId: json['priceRuleId'] as String?,
      materialTypeId: json['materialTypeId'] as String?,
      matchedReference: rawMatched is Map
          ? MatchedMaterialReference.fromJson(
              Map<String, dynamic>.from(rawMatched),
            )
          : null,
      approvedUnit: json['approvedUnit'] as String?,
      candidates: _parseCandidates(json['candidates']),
      categorySuggestion: _parseCategorySuggestion(json['categorySuggestion']),
      message: json['message'] as String? ?? '',
    );
  }
}

class CategorySuggestion {
  const CategorySuggestion({
    required this.materialType,
    required this.confidence,
    required this.categoryId,
    required this.categoryNameEn,
    this.categoryNameAr,
  });

  final MatchedMaterialReference materialType;
  final String confidence;
  final String categoryId;
  final String categoryNameEn;
  final String? categoryNameAr;

  factory CategorySuggestion.fromJson(Map<String, dynamic> json) {
    final materialTypeRaw = json['materialType'];
    final categoryRaw = json['category'];
    final category = categoryRaw is Map
        ? Map<String, dynamic>.from(categoryRaw)
        : const <String, dynamic>{};
    return CategorySuggestion(
      materialType: materialTypeRaw is Map
          ? MatchedMaterialReference.fromJson(
              Map<String, dynamic>.from(materialTypeRaw),
            )
          : const MatchedMaterialReference(
              id: '',
              nameEn: '',
              unit: 'piece',
            ),
      confidence: json['confidence']?.toString() ?? '',
      categoryId: category['id']?.toString() ?? '',
      categoryNameEn: category['nameEn']?.toString() ?? '',
      categoryNameAr: category['nameAr'] as String?,
    );
  }
}
