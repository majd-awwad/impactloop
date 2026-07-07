import 'reservation_preferred_window.dart';

class CreateReservationRequest {
  const CreateReservationRequest({
    required this.materialId,
    required this.quantityRequested,
    required this.fulfillmentMethod,
    this.message,
    this.buildItemId,
    this.learnerPreferredPickupWindows = const [],
    this.learnerPreferredDeliveryWindows = const [],
    this.deliveryAddressText,
    this.safeDropoffAllowed,
    this.deliveryNote,
  });

  final String materialId;
  final double quantityRequested;
  final String fulfillmentMethod;
  final String? message;
  final String? buildItemId;
  final List<ReservationPreferredWindow> learnerPreferredPickupWindows;
  final List<ReservationPreferredWindow> learnerPreferredDeliveryWindows;
  final String? deliveryAddressText;
  final bool? safeDropoffAllowed;
  final String? deliveryNote;

  Map<String, dynamic> toJson() {
    return {
      'materialId': materialId,
      'quantityRequested': quantityRequested,
      'fulfillmentMethod': fulfillmentMethod,
      if (buildItemId != null && buildItemId!.trim().isNotEmpty)
        'buildItemId': buildItemId!.trim(),
      if (message != null && message!.trim().isNotEmpty)
        'message': message!.trim(),
      if (fulfillmentMethod == 'PICKUP' &&
          learnerPreferredPickupWindows.isNotEmpty)
        'learnerPreferredPickupWindows': learnerPreferredPickupWindows
            .map((window) => window.toJson())
            .toList(),
      if (fulfillmentMethod == 'DELIVERY' &&
          learnerPreferredDeliveryWindows.isNotEmpty)
        'learnerPreferredDeliveryWindows': learnerPreferredDeliveryWindows
            .map((window) => window.toJson())
            .toList(),
      if (fulfillmentMethod == 'DELIVERY' &&
          deliveryAddressText != null &&
          deliveryAddressText!.trim().isNotEmpty)
        'deliveryAddressText': deliveryAddressText!.trim(),
      if (fulfillmentMethod == 'DELIVERY' && safeDropoffAllowed != null)
        'safeDropoffAllowed': safeDropoffAllowed,
      if (fulfillmentMethod == 'DELIVERY' &&
          deliveryNote != null &&
          deliveryNote!.trim().isNotEmpty)
        'deliveryNote': deliveryNote!.trim(),
    };
  }
}
