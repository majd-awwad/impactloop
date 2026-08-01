class MaterialCategory {
  const MaterialCategory({
    required this.id,
    required this.nameEn,
    required this.nameAr,
    required this.categoryType,
    this.iconUrl,
  });

  final String id;
  final String nameEn;
  final String nameAr;
  final String categoryType;
  final String? iconUrl;

  factory MaterialCategory.fromJson(Map<String, dynamic> json) {
    return MaterialCategory(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      categoryType: json['categoryType'] as String? ?? 'MATERIAL',
      iconUrl: json['iconUrl'] as String?,
    );
  }
}
