class CreateReservationRequest {
  const CreateReservationRequest({
    required this.materialId,
    required this.quantityRequested,
    this.message,
  });

  final String materialId;
  final double quantityRequested;
  final String? message;

  Map<String, dynamic> toJson() {
    return {
      'materialId': materialId,
      'quantityRequested': quantityRequested,
      if (message != null && message!.trim().isNotEmpty)
        'message': message!.trim(),
    };
  }
}
