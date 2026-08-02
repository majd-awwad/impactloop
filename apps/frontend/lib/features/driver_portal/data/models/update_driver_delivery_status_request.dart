class UpdateDriverDeliveryUnpickedItem {
  const UpdateDriverDeliveryUnpickedItem({
    required this.reservationId,
    required this.reason,
    this.note,
  });

  final String reservationId;
  final String reason;
  final String? note;

  Map<String, dynamic> toJson() {
    return {
      'reservationId': reservationId,
      'reason': reason,
      if (note != null && note!.trim().isNotEmpty) 'note': note!.trim(),
    };
  }
}

class UpdateDriverDeliveryStatusRequest {
  const UpdateDriverDeliveryStatusRequest({
    required this.status,
    this.note,
    this.confirmationCode,
    this.pickedReservationIds,
    this.unpicked,
  });

  final String status;
  final String? note;
  final String? confirmationCode;
  final List<String>? pickedReservationIds;
  final List<UpdateDriverDeliveryUnpickedItem>? unpicked;

  Map<String, dynamic> toJson() {
    return {
      'status': status,
      if (note != null && note!.trim().isNotEmpty) 'note': note!.trim(),
      if (confirmationCode != null && confirmationCode!.trim().isNotEmpty)
        'confirmationCode': confirmationCode!.trim(),
      if (pickedReservationIds != null)
        'pickedReservationIds': pickedReservationIds,
      if (unpicked != null)
        'unpicked': unpicked!.map((item) => item.toJson()).toList(),
    };
  }
}
