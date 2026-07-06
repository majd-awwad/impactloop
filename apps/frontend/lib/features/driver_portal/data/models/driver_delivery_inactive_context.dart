class DriverDeliveryInactiveContext {
  const DriverDeliveryInactiveContext({
    required this.deliveryId,
    required this.isActive,
    required this.status,
    this.closureReason,
    this.message,
  });

  final String deliveryId;
  final bool isActive;
  final String status;
  final String? closureReason;
  final String? message;

  bool get movedToAdminReview => closureReason == 'MOVED_TO_ADMIN_REVIEW';

  factory DriverDeliveryInactiveContext.fromJson(Map<String, dynamic> json) {
    return DriverDeliveryInactiveContext(
      deliveryId: json['deliveryId'] as String? ?? '',
      isActive: json['isActive'] == true,
      status: json['status'] as String? ?? '',
      closureReason: json['closureReason'] as String?,
      message: json['message'] as String?,
    );
  }
}
