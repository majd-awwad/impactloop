import 'reservation_preferred_window.dart';

class CreateReservationRequest {
  const CreateReservationRequest({
    required this.materialId,
    required this.quantityRequested,
    required this.fulfillmentMethod,
    this.message,
    this.buildItemId,
    this.materialRequestMatchId,
    this.learnerPreferredPickupWindows = const [],
    this.learnerPreferredDeliveryWindows = const [],
    this.deliveryAddressText,
    this.dropoffCity,
    this.dropoffArea,
    this.safeDropoffAllowed,
    this.deliveryNote,
    this.combineWithDeliveryGroupId,
  });

  final String materialId;
  final double quantityRequested;
  final String fulfillmentMethod;
  final String? message;
  final String? buildItemId;
  final String? materialRequestMatchId;
  final List<ReservationPreferredWindow> learnerPreferredPickupWindows;
  final List<ReservationPreferredWindow> learnerPreferredDeliveryWindows;
  final String? deliveryAddressText;
  final String? dropoffCity;
  final String? dropoffArea;
  final bool? safeDropoffAllowed;
  final String? deliveryNote;
  final String? combineWithDeliveryGroupId;

  Map<String, dynamic> toJson() {
    return {
      'materialId': materialId,
      'quantityRequested': quantityRequested,
      'fulfillmentMethod': fulfillmentMethod,
      if (buildItemId != null && buildItemId!.trim().isNotEmpty)
        'buildItemId': buildItemId!.trim(),
      if (materialRequestMatchId != null &&
          materialRequestMatchId!.trim().isNotEmpty)
        'materialRequestMatchId': materialRequestMatchId!.trim(),
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
      if (fulfillmentMethod == 'DELIVERY' &&
          dropoffCity != null &&
          dropoffCity!.trim().isNotEmpty)
        'dropoffCity': dropoffCity!.trim(),
      if (fulfillmentMethod == 'DELIVERY' &&
          dropoffArea != null &&
          dropoffArea!.trim().isNotEmpty)
        'dropoffArea': dropoffArea!.trim(),
      if (fulfillmentMethod == 'DELIVERY' && safeDropoffAllowed != null)
        'safeDropoffAllowed': safeDropoffAllowed,
      if (fulfillmentMethod == 'DELIVERY' &&
          deliveryNote != null &&
          deliveryNote!.trim().isNotEmpty)
        'deliveryNote': deliveryNote!.trim(),
      if (fulfillmentMethod == 'DELIVERY' &&
          combineWithDeliveryGroupId != null &&
          combineWithDeliveryGroupId!.trim().isNotEmpty)
        'combineWithDeliveryGroupId': combineWithDeliveryGroupId!.trim(),
    };
  }
}
