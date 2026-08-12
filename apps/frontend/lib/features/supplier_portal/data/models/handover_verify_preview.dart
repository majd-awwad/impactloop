class HandoverVerifyPreview {
  const HandoverVerifyPreview({
    required this.reservationId,
    required this.materialId,
    required this.materialTitle,
    required this.quantity,
    required this.unit,
    required this.learnerDisplayName,
    this.expiresAt,
  });

  final String reservationId;
  final String materialId;
  final String materialTitle;
  final double quantity;
  final String unit;
  final String learnerDisplayName;
  final DateTime? expiresAt;

  factory HandoverVerifyPreview.fromJson(Map<String, dynamic> json) {
    final material = Map<String, dynamic>.from(
      json['material'] as Map? ?? const <String, dynamic>{},
    );
    final learner = Map<String, dynamic>.from(
      json['learner'] as Map? ?? const <String, dynamic>{},
    );
    final expiresRaw = json['expiresAt']?.toString();
    final quantityRaw = json['quantity'];

    return HandoverVerifyPreview(
      reservationId: json['reservationId']?.toString() ?? '',
      materialId: material['id']?.toString() ?? '',
      materialTitle: material['title']?.toString() ?? '',
      quantity: quantityRaw is num
          ? quantityRaw.toDouble()
          : double.tryParse(quantityRaw?.toString() ?? '') ?? 0,
      unit: json['unit']?.toString() ?? '',
      learnerDisplayName: learner['displayName']?.toString() ?? '',
      expiresAt: expiresRaw == null || expiresRaw.isEmpty
          ? null
          : DateTime.tryParse(expiresRaw)?.toLocal(),
    );
  }
}
