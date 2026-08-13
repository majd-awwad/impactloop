class DeliveryHandoverCredential {
  const DeliveryHandoverCredential({
    required this.deliveryId,
    required this.handoverToken,
    required this.qrPayload,
    required this.expiresAt,
  });

  final String deliveryId;
  final String handoverToken;
  final String qrPayload;
  final DateTime expiresAt;

  bool isExpiredAt([DateTime? now]) {
    final reference = now ?? DateTime.now();
    return !expiresAt.isAfter(reference);
  }

  factory DeliveryHandoverCredential.fromJson(Map<String, dynamic> json) {
    final expiresRaw = json['expiresAt']?.toString();
    final expiresAt = expiresRaw == null || expiresRaw.isEmpty
        ? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true)
        : DateTime.parse(expiresRaw);

    return DeliveryHandoverCredential(
      deliveryId: json['deliveryId']?.toString() ?? '',
      handoverToken: json['handoverToken']?.toString() ?? '',
      qrPayload: json['qrPayload']?.toString() ?? '',
      expiresAt: expiresAt.toLocal(),
    );
  }
}
