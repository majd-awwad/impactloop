class MaterialTypeCategorySummary {
  const MaterialTypeCategorySummary({
    required this.id,
    required this.nameEn,
    required this.nameAr,
  });

  final String id;
  final String nameEn;
  final String nameAr;

  factory MaterialTypeCategorySummary.fromJson(Map<String, dynamic> json) {
    return MaterialTypeCategorySummary(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
    );
  }
}

class MaterialType {
  const MaterialType({
    required this.id,
    required this.nameEn,
    this.nameAr,
    required this.normalizedName,
    required this.defaultUnit,
    required this.category,
    required this.hasActivePriceRule,
    required this.aliases,
  });

  final String id;
  final String nameEn;
  final String? nameAr;
  final String normalizedName;
  final String defaultUnit;
  final MaterialTypeCategorySummary category;
  final bool hasActivePriceRule;
  final List<String> aliases;

  factory MaterialType.fromJson(Map<String, dynamic> json) {
    final rawAliases = json['aliases'];

    return MaterialType(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String?,
      normalizedName: json['normalizedName'] as String? ?? '',
      defaultUnit: json['defaultUnit'] as String? ?? 'piece',
      category: MaterialTypeCategorySummary.fromJson(
        json['category'] as Map<String, dynamic>? ?? const {},
      ),
      hasActivePriceRule: json['hasActivePriceRule'] as bool? ?? false,
      aliases: rawAliases is List
          ? rawAliases.whereType<String>().toList()
          : const [],
    );
  }
}

class MaterialTypeSearchResult {
  const MaterialTypeSearchResult({required this.items});

  final List<MaterialType> items;

  factory MaterialTypeSearchResult.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];

    return MaterialTypeSearchResult(
      items: rawItems is List
          ? rawItems
                .whereType<Map>()
                .map(
                  (item) =>
                      MaterialType.fromJson(Map<String, dynamic>.from(item)),
                )
                .toList()
          : const [],
    );
  }
}
