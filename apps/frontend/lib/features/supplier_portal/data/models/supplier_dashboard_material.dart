class SupplierDashboardMaterial {
  const SupplierDashboardMaterial({
    required this.id,
    required this.title,
    required this.status,
    required this.quantity,
    required this.unit,
    required this.viewsCount,
    this.categoryName,
    this.coverImageUrl,
    required this.createdAt,
  });

  final String id;
  final String title;
  final String status;
  final double quantity;
  final String unit;
  final int viewsCount;
  final String? categoryName;
  final String? coverImageUrl;
  final DateTime createdAt;

  factory SupplierDashboardMaterial.fromJson(Map<String, dynamic> json) {
    return SupplierDashboardMaterial(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      status: json['status'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? '',
      viewsCount: json['viewsCount'] as int? ?? 0,
      categoryName: json['categoryName'] as String?,
      coverImageUrl: json['coverImageUrl'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}
