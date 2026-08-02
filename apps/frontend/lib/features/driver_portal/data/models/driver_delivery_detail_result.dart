import 'driver_delivery.dart';

class DriverDeliveryDetailResult {
  const DriverDeliveryDetailResult({
    required this.isActive,
    required this.delivery,
    this.closureReason,
  });

  final bool isActive;
  final DriverDelivery delivery;
  final String? closureReason;

  factory DriverDeliveryDetailResult.fromJson(Map<String, dynamic> json) {
    final inactiveContext = json['inactiveContext'];
    return DriverDeliveryDetailResult(
      isActive: json['isActive'] == true,
      delivery: DriverDelivery.fromJson(
        Map<String, dynamic>.from(json['delivery'] as Map? ?? const {}),
      ),
      closureReason: inactiveContext is Map
          ? inactiveContext['closureReason'] as String?
          : null,
    );
  }
}
