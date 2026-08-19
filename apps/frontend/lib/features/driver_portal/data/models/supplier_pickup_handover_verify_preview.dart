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
    final pickup = Map<String, dynamic>.from(
      json['pickupLocation'] as Map? ?? const <String, dynamic>{},
    );
    final reservationId = json['reservationId']?.toString() ?? '';
    final item = _reservedItem(json, reservationId);
    final material = Map<String, dynamic>.from(
      item['material'] as Map? ??
          json['material'] as Map? ??
          const <String, dynamic>{},
    );
    final expiresRaw = json['expiresAt']?.toString();
    final quantityRaw = item['quantity'] ?? json['quantity'];
    final unitRaw = item['unit'] ?? json['unit'] ?? material['unit'];

    return SupplierPickupHandoverVerifyPreview(
      deliveryId: json['deliveryId']?.toString() ?? '',
      reservationId: reservationId,
      supplierDisplayName: supplier['displayName']?.toString() ?? '',
      materialTitle: material['title']?.toString() ?? '',
      quantity: _parseQuantity(quantityRaw),
      unit: unitRaw?.toString() ?? '',
      pickupCity: pickup['city']?.toString() ?? '',
      pickupArea: pickup['area']?.toString(),
      expiresAt: expiresRaw == null || expiresRaw.isEmpty
          ? null
          : DateTime.tryParse(expiresRaw)?.toLocal(),
    );
  }

  static Map<String, dynamic> _reservedItem(
    Map<String, dynamic> json,
    String reservationId,
  ) {
    final itemsRaw = json['items'];
    if (itemsRaw is! List) return const <String, dynamic>{};

    final items = itemsRaw
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
    if (items.isEmpty) return const <String, dynamic>{};

    if (reservationId.isEmpty) return items.first;
    for (final item in items) {
      if (item['reservationId']?.toString() == reservationId) {
        return item;
      }
    }
    return items.first;
  }

  static double _parseQuantity(Object? value) {
    if (value is num) return value.toDouble();
    return double.tryParse(value?.toString() ?? '') ?? 0;
  }
}
