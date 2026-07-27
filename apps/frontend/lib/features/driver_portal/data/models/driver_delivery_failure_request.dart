class DriverDeliveryFailureRequest {
  const DriverDeliveryFailureRequest({required this.reason, this.note});

  final String reason;
  final String? note;

  Map<String, dynamic> toJson() => {
    'reason': reason,
    if (note != null && note!.trim().isNotEmpty) 'note': note!.trim(),
  };
}
