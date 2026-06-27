class UpdateDriverDeliveryStatusRequest {
  const UpdateDriverDeliveryStatusRequest({required this.status, this.note});

  final String status;
  final String? note;

  Map<String, dynamic> toJson() {
    return {
      'status': status,
      if (note != null && note!.trim().isNotEmpty) 'note': note!.trim(),
    };
  }
}
