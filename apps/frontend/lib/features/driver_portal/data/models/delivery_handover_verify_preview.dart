class DeliveryHandoverVerifyPreviewItem {
  const DeliveryHandoverVerifyPreviewItem({
    required this.reservationId,
    required this.materialId,
    required this.materialTitle,
    required this.quantity,
    required this.unit,
  });

  final String reservationId;
  final String materialId;
  final String materialTitle;
  final double quantity;
  final String unit;

  factory DeliveryHandoverVerifyPreviewItem.fromJson(
    Map<String, dynamic> json,
  ) {
    final material = Map<String, dynamic>.from(
      json['material'] as Map? ?? const <String, dynamic>{},
    );
    final quantityRaw = json['quantity'];

    return DeliveryHandoverVerifyPreviewItem(
      reservationId: json['reservationId']?.toString() ?? '',
      materialId: material['id']?.toString() ?? '',
      materialTitle: material['title']?.toString() ?? '',
      quantity: quantityRaw is num
          ? quantityRaw.toDouble()
          : double.tryParse(quantityRaw?.toString() ?? '') ?? 0,
      unit: json['unit']?.toString() ?? '',
    );
  }
}

class DeliveryHandoverVerifyPreview {
  const DeliveryHandoverVerifyPreview({
    required this.deliveryId,
    this.deliveryGroupId,
    required this.learnerDisplayName,
    required this.destinationCity,
    this.destinationArea,
    required this.items,
    this.expiresAt,
  });

  final String deliveryId;
  final String? deliveryGroupId;
  final String learnerDisplayName;
  final String destinationCity;
  final String? destinationArea;
  final List<DeliveryHandoverVerifyPreviewItem> items;
  final DateTime? expiresAt;

  factory DeliveryHandoverVerifyPreview.fromJson(Map<String, dynamic> json) {
    final learner = Map<String, dynamic>.from(
      json['learner'] as Map? ?? const <String, dynamic>{},
    );
    final destination = Map<String, dynamic>.from(
      json['destination'] as Map? ?? const <String, dynamic>{},
    );
    final expiresRaw = json['expiresAt']?.toString();
    final itemsRaw = json['items'];

    return DeliveryHandoverVerifyPreview(
      deliveryId: json['deliveryId']?.toString() ?? '',
      deliveryGroupId: json['deliveryGroupId']?.toString(),
      learnerDisplayName: learner['displayName']?.toString() ?? '',
      destinationCity: destination['city']?.toString() ?? '',
      destinationArea: destination['area']?.toString(),
      items: itemsRaw is List
          ? itemsRaw
                .whereType<Map>()
                .map(
                  (item) => DeliveryHandoverVerifyPreviewItem.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
      expiresAt: expiresRaw == null || expiresRaw.isEmpty
          ? null
          : DateTime.tryParse(expiresRaw)?.toLocal(),
    );
  }
}
