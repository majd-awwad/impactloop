class SupplierPickupHandoverVerifyPreview {
  const SupplierPickupHandoverVerifyPreview({
    required this.deliveryId,
    required this.reservationId,
    required this.supplierDisplayName,
    required this.materialTitle,
    required this.quantity,
    required this.unit,
    required this.pickupCity,
    this.pickupArea,
    this.expiresAt,
  });

  final String deliveryId;
  final String reservationId;
  final String supplierDisplayName;
  final String materialTitle;
  final double quantity;
  final String unit;
  final String pickupCity;
  final String? pickupArea;
  final DateTime? expiresAt;

  factory SupplierPickupHandoverVerifyPreview.fromJson(
    Map<String, dynamic> json,
  ) {
    final supplier = Map<String, dynamic>.from(
      json['supplier'] as Map? ?? const <String, dynamic>{},
    );
    final material = Map<String, dynamic>.from(
      json['material'] as Map? ?? const <String, dynamic>{},
    );
    final pickup = Map<String, dynamic>.from(
      json['pickupLocation'] as Map? ?? const <String, dynamic>{},
    );
    final expiresRaw = json['expiresAt']?.toString();
    final quantityRaw = json['quantity'];

    return SupplierPickupHandoverVerifyPreview(
      deliveryId: json['deliveryId']?.toString() ?? '',
      reservationId: json['reservationId']?.toString() ?? '',
      supplierDisplayName: supplier['displayName']?.toString() ?? '',
      materialTitle: material['title']?.toString() ?? '',
      quantity: quantityRaw is num
          ? quantityRaw.toDouble()
          : double.tryParse(quantityRaw?.toString() ?? '') ?? 0,
      unit: json['unit']?.toString() ?? '',
      pickupCity: pickup['city']?.toString() ?? '',
      pickupArea: pickup['area']?.toString(),
      expiresAt: expiresRaw == null || expiresRaw.isEmpty
          ? null
          : DateTime.tryParse(expiresRaw)?.toLocal(),
    );
  }
}
