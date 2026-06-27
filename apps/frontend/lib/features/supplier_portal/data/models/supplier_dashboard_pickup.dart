class SupplierDashboardPickup {
  const SupplierDashboardPickup({
    required this.id,
    required this.materialTitle,
    required this.requesterName,
    required this.quantityRequested,
    this.pickupWindowStart,
    this.pickupWindowEnd,
  });

  final String id;
  final String materialTitle;
  final String requesterName;
  final double quantityRequested;
  final DateTime? pickupWindowStart;
  final DateTime? pickupWindowEnd;

  factory SupplierDashboardPickup.fromJson(Map<String, dynamic> json) {
    return SupplierDashboardPickup(
      id: json['id'] as String? ?? '',
      materialTitle: json['materialTitle'] as String? ?? '',
      requesterName: json['requesterName'] as String? ?? '',
      quantityRequested: (json['quantityRequested'] as num?)?.toDouble() ?? 0,
      pickupWindowStart: DateTime.tryParse(
        json['pickupWindowStart'] as String? ?? '',
      ),
      pickupWindowEnd: DateTime.tryParse(
        json['pickupWindowEnd'] as String? ?? '',
      ),
    );
  }
}
