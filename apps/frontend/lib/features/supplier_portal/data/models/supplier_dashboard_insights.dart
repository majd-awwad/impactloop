class SupplierRecentReservationRequest {
  const SupplierRecentReservationRequest({
    required this.id,
    required this.materialId,
    required this.materialTitle,
    this.requesterName,
    required this.status,
    required this.quantityRequested,
    required this.requestedAt,
  });

  final String id;
  final String materialId;
  final String materialTitle;
  final String? requesterName;
  final String status;
  final double quantityRequested;
  final DateTime requestedAt;

  factory SupplierRecentReservationRequest.fromJson(Map<String, dynamic> json) {
    return SupplierRecentReservationRequest(
      id: json['id'] as String? ?? '',
      materialId: json['materialId'] as String? ?? '',
      materialTitle: json['materialTitle'] as String? ?? '',
      requesterName: json['requesterName'] as String?,
      status: json['status'] as String? ?? '',
      quantityRequested: (json['quantityRequested'] as num?)?.toDouble() ?? 0,
      requestedAt: DateTime.tryParse(json['requestedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class SupplierDashboardMaterialInsight {
  const SupplierDashboardMaterialInsight({
    required this.id,
    required this.title,
    required this.status,
    this.categoryName,
    this.coverImageUrl,
    required this.viewsCount,
    required this.demandCount,
  });

  final String id;
  final String title;
  final String status;
  final String? categoryName;
  final String? coverImageUrl;
  final int viewsCount;
  final int demandCount;

  factory SupplierDashboardMaterialInsight.fromJson(
    Map<String, dynamic> json,
  ) {
    return SupplierDashboardMaterialInsight(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      status: json['status'] as String? ?? '',
      categoryName: json['categoryName'] as String?,
      coverImageUrl: json['coverImageUrl'] as String?,
      viewsCount: json['viewsCount'] as int? ?? 0,
      demandCount: json['demandCount'] as int? ?? 0,
    );
  }
}
