class ReservationMessage {
  const ReservationMessage({
    required this.id,
    required this.reservationId,
    required this.body,
    required this.createdAt,
    required this.sender,
  });

  final String id;
  final String reservationId;
  final String body;
  final DateTime createdAt;
  final ReservationMessageSender sender;

  factory ReservationMessage.fromJson(Map<String, dynamic> json) {
    final senderJson = json['sender'];
    return ReservationMessage(
      id: json['id'] as String? ?? '',
      reservationId: json['reservationId'] as String? ?? '',
      body: json['body'] as String? ?? '',
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      sender: senderJson is Map<String, dynamic>
          ? ReservationMessageSender.fromJson(senderJson)
          : const ReservationMessageSender(id: '', displayName: ''),
    );
  }
}

class ReservationMessageSender {
  const ReservationMessageSender({
    required this.id,
    required this.displayName,
    this.profileImageUrl,
  });

  final String id;
  final String displayName;
  final String? profileImageUrl;

  factory ReservationMessageSender.fromJson(Map<String, dynamic> json) {
    return ReservationMessageSender(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      profileImageUrl: json['profileImageUrl'] as String?,
    );
  }
}
