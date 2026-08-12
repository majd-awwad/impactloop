class HandoverCredential {
  const HandoverCredential({
    required this.reservationId,
    required this.handoverToken,
    required this.qrPayload,
    required this.expiresAt,
  });

  final String reservationId;
  final String handoverToken;
  final String qrPayload;
  final DateTime expiresAt;

  bool isExpiredAt([DateTime? now]) {
    final reference = now ?? DateTime.now();
    return !expiresAt.isAfter(reference);
  }

  factory HandoverCredential.fromJson(Map<String, dynamic> json) {
    final expiresRaw = json['expiresAt']?.toString();
    final expiresAt = expiresRaw == null || expiresRaw.isEmpty
        ? DateTime.fromMillisecondsSinceEpoch(0, isUtc: true)
        : DateTime.parse(expiresRaw);

    return HandoverCredential(
      reservationId: json['reservationId']?.toString() ?? '',
      handoverToken: json['handoverToken']?.toString() ?? '',
      qrPayload: json['qrPayload']?.toString() ?? '',
      expiresAt: expiresAt.toLocal(),
    );
  }
}
