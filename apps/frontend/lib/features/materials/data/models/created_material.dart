class CreatedMaterialCategory {
  const CreatedMaterialCategory({
    required this.id,
    required this.nameEn,
    required this.nameAr,
  });

  final String id;
  final String nameEn;
  final String nameAr;

  factory CreatedMaterialCategory.fromJson(Map<String, dynamic> json) {
    return CreatedMaterialCategory(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
    );
  }
}

class CreatedMaterialImage {
  const CreatedMaterialImage({
    required this.id,
    required this.imageUrl,
    required this.sortOrder,
    required this.isCover,
  });

  final String id;
  final String imageUrl;
  final int sortOrder;
  final bool isCover;

  factory CreatedMaterialImage.fromJson(Map<String, dynamic> json) {
    return CreatedMaterialImage(
      id: json['id'] as String? ?? '',
      imageUrl: json['imageUrl'] as String? ?? '',
      sortOrder: json['sortOrder'] as int? ?? 0,
      isCover: json['isCover'] as bool? ?? false,
    );
  }
}

class CreatedMaterial {
  const CreatedMaterial({
    required this.id,
    required this.title,
    required this.status,
    required this.isFree,
    this.price,
    required this.currency,
    required this.materialType,
    this.materialTypeId,
    this.customMaterialType,
    this.priceRuleId,
    this.priceCheckedAt,
    this.maxAllowedPriceAtCheck,
    required this.category,
    required this.images,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String status;
  final bool isFree;
  final double? price;
  final String currency;
  final String materialType;
  final String? materialTypeId;
  final String? customMaterialType;
  final String? priceRuleId;
  final String? priceCheckedAt;
  final double? maxAllowedPriceAtCheck;
  final CreatedMaterialCategory category;
  final List<CreatedMaterialImage> images;
  final String createdAt;

  static double? _parseAmount(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value);
    return null;
  }

  factory CreatedMaterial.fromJson(Map<String, dynamic> json) {
    final rawImages = json['images'];
    return CreatedMaterial(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      status: json['status'] as String? ?? 'AVAILABLE',
      isFree: json['isFree'] as bool? ?? true,
      price: _parseAmount(json['price']),
      currency: json['currency'] as String? ?? 'NIS',
      materialType: json['materialType'] as String? ?? '',
      materialTypeId: json['materialTypeId'] as String?,
      customMaterialType: json['customMaterialType'] as String?,
      priceRuleId: json['priceRuleId'] as String?,
      priceCheckedAt: json['priceCheckedAt'] as String?,
      maxAllowedPriceAtCheck: _parseAmount(json['maxAllowedPriceAtCheck']),
      category: CreatedMaterialCategory.fromJson(
        json['category'] as Map<String, dynamic>? ?? const {},
      ),
      images: rawImages is List
          ? rawImages
                .whereType<Map>()
                .map(
                  (item) => CreatedMaterialImage.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList()
          : const [],
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}
