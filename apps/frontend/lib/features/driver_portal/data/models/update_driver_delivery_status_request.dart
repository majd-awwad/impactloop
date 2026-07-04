class UpdateDriverDeliveryStatusRequest {
  const UpdateDriverDeliveryStatusRequest({
    required this.status,
    this.note,
    this.confirmationCode,
  });

  final String status;
  final String? note;
  final String? confirmationCode;

  Map<String, dynamic> toJson() {
    return {
      'status': status,
      if (note != null && note!.trim().isNotEmpty) 'note': note!.trim(),
      if (confirmationCode != null && confirmationCode!.trim().isNotEmpty)
        'confirmationCode': confirmationCode!.trim(),
    };
  }
}
