import '../../../../core/config/api_config.dart';

import 'reservation_message.dart';
import 'reservation_preferred_window.dart';

class LearnerReservationPickupLocation {
  const LearnerReservationPickupLocation({    this.country,
    required this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
    this.isApproximate = true,
  });

  final String? country;
  final String city;
  final String? area;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
  final bool isApproximate;

  factory LearnerReservationPickupLocation.fromJson(
    Map<String, dynamic> json,
  ) {
    return LearnerReservationPickupLocation(
      country: json['country'] as String?,
      city: json['city'] as String? ?? '',
      area: json['area'] as String?,
      addressLine: json['addressLine'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      isApproximate: json['isApproximate'] == true,
    );
  }

  String get formattedAddress {
    final parts = <String>[
      if (addressLine?.trim().isNotEmpty == true) addressLine!.trim(),
      if (area?.trim().isNotEmpty == true) area!.trim(),
      city.trim(),
      if (country?.trim().isNotEmpty == true) country!.trim(),
    ];

    return parts.where((part) => part.isNotEmpty).join(', ');
  }
}

class LearnerReservationMaterial {
  const LearnerReservationMaterial({
    required this.id,
    required this.title,
    required this.materialType,
    required this.status,
    required this.deliveryAllowed,
    this.unit = 'piece',
    this.imageUrl,
    this.city,
    this.area,
  });

  final String id;
  final String title;
  final String materialType;
  final String status;
  final bool deliveryAllowed;
  final String unit;
  final String? imageUrl;
  final String? city;
  final String? area;

  factory LearnerReservationMaterial.fromJson(Map<String, dynamic> json) {
    return LearnerReservationMaterial(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      materialType: json['materialType'] as String? ?? '',
      status: json['status'] as String? ?? '',
      deliveryAllowed: json['deliveryAllowed'] == true,
      unit: json['unit'] as String? ?? 'piece',
      imageUrl: _parseImageUrl(json['imageUrl']),
      city: json['city'] as String?,
      area: json['area'] as String?,
    );
  }

  static String? _parseImageUrl(Object? value) {
    if (value is! String) {
      return null;
    }

    final trimmed = value.trim();
    if (trimmed.isEmpty) {
      return null;
    }

    return ApiConfig.resolveMediaUrl(trimmed);
  }
  String get locationLabel {
    if (city != null && area != null) {
      return '$city, $area';
    }

    return city ?? area ?? 'Location shared later';
  }
}

class LearnerReservationSupplier {
  const LearnerReservationSupplier({
    required this.id,
    required this.displayName,
  });

  final String id;
  final String displayName;

  factory LearnerReservationSupplier.fromJson(Map<String, dynamic> json) {
    return LearnerReservationSupplier(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? 'Supplier',
    );
  }
}

class LearnerReservation {
  const LearnerReservation({
    required this.id,
    required this.status,
    required this.quantityRequested,
    this.message,
    required this.createdAt,
    required this.updatedAt,
    this.pickupWindowStart,
    this.pickupWindowEnd,
    this.supplierNote,
    this.rejectionReason,
    this.pickupLocationFull,
    this.deliveryRequested = false,
    this.fulfillmentMethod = 'PICKUP',
    this.learnerPreferredPickupWindows = const [],
    this.learnerPreferredDeliveryWindows = const [],
    this.deliveryAddressText,
    this.safeDropoffAllowed,
    this.deliveryNote,
    required this.material,
    required this.supplier,
    this.isOverdue = false,
    this.needsFollowUp = false,
    this.pickupWindowStatus,
    this.canSendMessage = false,
    this.latestMessage,
  });

  final String id;
  final String status;
  final double quantityRequested;
  final String? message;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? pickupWindowStart;
  final DateTime? pickupWindowEnd;
  final String? supplierNote;
  final String? rejectionReason;
  final LearnerReservationPickupLocation? pickupLocationFull;
  final bool deliveryRequested;
  final String fulfillmentMethod;
  final List<ReservationPreferredWindow> learnerPreferredPickupWindows;
  final List<ReservationPreferredWindow> learnerPreferredDeliveryWindows;
  final String? deliveryAddressText;
  final bool? safeDropoffAllowed;
  final String? deliveryNote;
  final LearnerReservationMaterial material;
  final LearnerReservationSupplier supplier;
  final bool isOverdue;
  final bool needsFollowUp;
  final String? pickupWindowStatus;
  final bool canSendMessage;
  final ReservationMessage? latestMessage;

  factory LearnerReservation.fromJson(Map<String, dynamic> json) {
    final materialJson = json['material'];
    final supplierJson = json['supplier'];
    final pickupLocationJson = json['pickupLocationFull'];

    return LearnerReservation(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      quantityRequested: (json['quantityRequested'] as num?)?.toDouble() ?? 0,
      message: json['message'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      updatedAt:
          DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      pickupWindowStart: DateTime.tryParse(
        json['pickupWindowStart'] as String? ?? '',
      ),
      pickupWindowEnd: DateTime.tryParse(
        json['pickupWindowEnd'] as String? ?? '',
      ),
      supplierNote: json['supplierNote'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      pickupLocationFull: pickupLocationJson is Map<String, dynamic>
          ? LearnerReservationPickupLocation.fromJson(pickupLocationJson)
          : null,
      deliveryRequested: json['deliveryRequested'] == true,
      fulfillmentMethod: json['fulfillmentMethod'] as String? ?? 'PICKUP',
      learnerPreferredPickupWindows: _parsePreferredWindows(
        json['learnerPreferredPickupWindows'],
      ),
      learnerPreferredDeliveryWindows: _parsePreferredWindows(
        json['learnerPreferredDeliveryWindows'],
      ),
      deliveryAddressText: json['deliveryAddressText'] as String?,
      safeDropoffAllowed: json['safeDropoffAllowed'] as bool?,
      deliveryNote: json['deliveryNote'] as String?,
      material: LearnerReservationMaterial.fromJson(
        materialJson is Map<String, dynamic>
            ? materialJson
            : const <String, dynamic>{},
      ),
      supplier: LearnerReservationSupplier.fromJson(
        supplierJson is Map<String, dynamic>
            ? supplierJson
            : const <String, dynamic>{},
      ),
      isOverdue: json['isOverdue'] == true,
      needsFollowUp: json['needsFollowUp'] == true,
      pickupWindowStatus: json['pickupWindowStatus'] as String?,
      canSendMessage: json['canSendMessage'] == true,
      latestMessage: json['latestMessage'] is Map
          ? ReservationMessage.fromJson(
              Map<String, dynamic>.from(json['latestMessage'] as Map),
            )
          : null,
    );
  }

  bool get isPending => status == 'PENDING';
  bool get isAccepted => status == 'ACCEPTED';
  bool get isAwaitingConfirmation =>
      status == 'AWAITING_LEARNER_CONFIRMATION';
  bool get isRejected => status == 'REJECTED';
  bool get isCompleted => status == 'COMPLETED';
  bool get isCancelled => status == 'CANCELLED';
  bool get isExpired => status == 'EXPIRED';

  bool get isPickupFulfillment => fulfillmentMethod == 'PICKUP';
  bool get isDeliveryFulfillment => fulfillmentMethod == 'DELIVERY';

  static List<ReservationPreferredWindow> _parsePreferredWindows(Object? value) {
    if (value is! List) {
      return const [];
    }

    return value
        .whereType<Map>()
        .map((entry) => ReservationPreferredWindow.fromJson(
              Map<String, dynamic>.from(entry),
            ))
        .toList();
  }

  bool get hasRevealedPickupLocation =>
      pickupLocationFull != null &&
      pickupLocationFull!.formattedAddress.isNotEmpty &&
      (isAccepted || isCompleted);

  bool shouldShowSelfPickupAddress({required bool hasDeliveryRecord}) =>
      hasRevealedPickupLocation &&
      isPickupFulfillment &&
      !hasDeliveryRecord;
}
