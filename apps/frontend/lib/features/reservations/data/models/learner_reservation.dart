import '../../../../core/config/api_config.dart';

import 'reservation_message.dart';
import 'reservation_payment_summary.dart';
import 'reservation_preferred_window.dart';

class LearnerReservationPickupLocation {
  const LearnerReservationPickupLocation({
    this.country,
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

  factory LearnerReservationPickupLocation.fromJson(Map<String, dynamic> json) {
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

  bool get hasCoordinates => latitude != null && longitude != null;
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

class LearnerReservationActiveDelivery {
  const LearnerReservationActiveDelivery({
    required this.id,
    required this.status,
    this.learnerDeliveryCode,
  });

  final String id;
  final String status;
  final String? learnerDeliveryCode;

  factory LearnerReservationActiveDelivery.fromJson(Map<String, dynamic> json) {
    return LearnerReservationActiveDelivery(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      learnerDeliveryCode: json['learnerDeliveryCode'] as String?,
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
    this.supplierProposedPickupWindowStart,
    this.supplierProposedPickupWindowEnd,
    this.supplierPickupWindowStart,
    this.supplierPickupWindowEnd,
    this.confirmedDeliveryWindowStart,
    this.confirmedDeliveryWindowEnd,
    this.earliestDeliveryStart,
    this.schedulingConflictReason,
    this.activeDelivery,
    this.supplierNote,
    this.rejectionReason,
    this.pickupLocationFull,
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
    this.selfPickupCode,
    this.pickupHandoverPhase,
    this.canLearnerReschedule = false,
    this.pendingRescheduleReason,
    this.canLearnerReportSupplier = false,
    this.canReportNoDriverAvailable = false,
    this.assignedDriverPickupOverdue = false,
    this.canLearnerRequestDelivery = false,
    this.incidentReviewStatus,
    this.pendingIncidentReasonCode,
    this.unitPriceAtReservation,
    this.materialSubtotal,
    this.deliveryFee,
    this.totalAmount,
    this.currency,
    this.deliveryZone,
    this.deliveryGroupId,
    this.groupedDelivery = false,
    this.groupItemCount,
    this.groupDeliveryFee,
    this.groupTotal,
    this.paymentSummary,
  });

  final String id;
  final String status;
  final double quantityRequested;
  final String? message;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? pickupWindowStart;
  final DateTime? pickupWindowEnd;
  final DateTime? supplierProposedPickupWindowStart;
  final DateTime? supplierProposedPickupWindowEnd;
  final DateTime? supplierPickupWindowStart;
  final DateTime? supplierPickupWindowEnd;
  final DateTime? confirmedDeliveryWindowStart;
  final DateTime? confirmedDeliveryWindowEnd;
  final DateTime? earliestDeliveryStart;
  final String? schedulingConflictReason;
  final LearnerReservationActiveDelivery? activeDelivery;
  final String? supplierNote;
  final String? rejectionReason;
  final LearnerReservationPickupLocation? pickupLocationFull;
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
  final String? selfPickupCode;
  final String? pickupHandoverPhase;
  final bool canLearnerReschedule;
  final String? pendingRescheduleReason;
  final bool canLearnerReportSupplier;
  final bool canReportNoDriverAvailable;
  final bool assignedDriverPickupOverdue;
  final bool canLearnerRequestDelivery;
  final String? incidentReviewStatus;
  final String? pendingIncidentReasonCode;
  final double? unitPriceAtReservation;
  final double? materialSubtotal;
  final double? deliveryFee;
  final double? totalAmount;
  final String? currency;
  final String? deliveryZone;
  final String? deliveryGroupId;
  final bool groupedDelivery;
  final int? groupItemCount;
  final double? groupDeliveryFee;
  final double? groupTotal;
  final ReservationPaymentSummary? paymentSummary;

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
      supplierProposedPickupWindowStart: DateTime.tryParse(
        json['supplierProposedPickupWindowStart'] as String? ?? '',
      ),
      supplierProposedPickupWindowEnd: DateTime.tryParse(
        json['supplierProposedPickupWindowEnd'] as String? ?? '',
      ),
      supplierPickupWindowStart: DateTime.tryParse(
        json['supplierPickupWindowStart'] as String? ?? '',
      ),
      supplierPickupWindowEnd: DateTime.tryParse(
        json['supplierPickupWindowEnd'] as String? ?? '',
      ),
      confirmedDeliveryWindowStart: DateTime.tryParse(
        json['confirmedDeliveryWindowStart'] as String? ?? '',
      ),
      confirmedDeliveryWindowEnd: DateTime.tryParse(
        json['confirmedDeliveryWindowEnd'] as String? ?? '',
      ),
      earliestDeliveryStart: DateTime.tryParse(
        json['earliestDeliveryStart'] as String? ?? '',
      ),
      schedulingConflictReason: json['schedulingConflictReason'] as String?,
      activeDelivery: json['activeDelivery'] is Map
          ? LearnerReservationActiveDelivery.fromJson(
              Map<String, dynamic>.from(json['activeDelivery'] as Map),
            )
          : null,
      supplierNote: json['supplierNote'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      pickupLocationFull: pickupLocationJson is Map<String, dynamic>
          ? LearnerReservationPickupLocation.fromJson(pickupLocationJson)
          : null,
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
      selfPickupCode: json['selfPickupCode'] as String?,
      pickupHandoverPhase: json['pickupHandoverPhase'] as String?,
      canLearnerReschedule: json['canLearnerReschedule'] == true,
      pendingRescheduleReason: () {
        final pending = json['pendingReschedule'];
        if (pending is Map) {
          return pending['reason'] as String?;
        }
        return null;
      }(),
      canLearnerReportSupplier: json['canLearnerReportSupplier'] == true,
      canReportNoDriverAvailable: json['canReportNoDriverAvailable'] == true,
      assignedDriverPickupOverdue: json['assignedDriverPickupOverdue'] == true,
      canLearnerRequestDelivery: json['canLearnerRequestDelivery'] == true,
      incidentReviewStatus: json['incidentReviewStatus'] as String?,
      pendingIncidentReasonCode: json['pendingIncidentReasonCode'] as String?,
      unitPriceAtReservation: (json['unitPriceAtReservation'] as num?)
          ?.toDouble(),
      materialSubtotal: (json['materialSubtotal'] as num?)?.toDouble(),
      deliveryFee: (json['deliveryFee'] as num?)?.toDouble(),
      totalAmount: (json['totalAmount'] as num?)?.toDouble(),
      currency: json['currency'] as String?,
      deliveryZone: json['deliveryZone'] as String?,
      deliveryGroupId: json['deliveryGroupId'] as String?,
      groupedDelivery: json['groupedDelivery'] == true,
      groupItemCount: (json['groupItemCount'] as num?)?.toInt(),
      groupDeliveryFee: (json['groupDeliveryFee'] as num?)?.toDouble(),
      groupTotal: (json['groupTotal'] as num?)?.toDouble(),
      paymentSummary: () {
        final summary = json['paymentSummary'];
        if (summary is Map) {
          return ReservationPaymentSummary.fromJson(
            Map<String, dynamic>.from(summary),
          );
        }
        return null;
      }(),
    );
  }

  bool get isPending => status == 'PENDING';
  bool get isAccepted => status == 'ACCEPTED';
  bool get isAwaitingConfirmation => status == 'AWAITING_LEARNER_CONFIRMATION';
  bool get isAwaitingSupplierConfirmation =>
      status == 'AWAITING_SUPPLIER_CONFIRMATION';
  bool get isAwaitingResolution => status == 'AWAITING_RESOLUTION';
  bool get isReadOnlyFinalState =>
      isCompleted ||
      isCancelled ||
      isRejected ||
      isExpired ||
      isAwaitingResolution ||
      status == 'NO_SHOW' ||
      status == 'FULFILLMENT_FAILED';
  bool get isRejected => status == 'REJECTED';
  bool get isCompleted => status == 'COMPLETED';
  bool get isCancelled => status == 'CANCELLED';
  bool get isExpired => status == 'EXPIRED';
  bool get isTerminalForNewMaterialReservation =>
      isRejected || isCancelled || isExpired || isCompleted;
  bool get blocksNewMaterialReservation => !isTerminalForNewMaterialReservation;

  bool get isPickupFulfillment => fulfillmentMethod == 'PICKUP';
  bool get isDeliveryFulfillment => fulfillmentMethod == 'DELIVERY';

  bool get hasDeliveryJob => isDeliveryFulfillment || activeDelivery != null;

  static List<ReservationPreferredWindow> _parsePreferredWindows(
    Object? value,
  ) {
    if (value is! List) {
      return const [];
    }

    return value
        .whereType<Map>()
        .map(
          (entry) => ReservationPreferredWindow.fromJson(
            Map<String, dynamic>.from(entry),
          ),
        )
        .toList();
  }

  bool get hasRevealedPickupLocation =>
      pickupLocationFull != null &&
      pickupLocationFull!.formattedAddress.isNotEmpty &&
      (isAccepted || isCompleted);

  bool shouldShowSelfPickupAddress({required bool hasDeliveryRecord}) =>
      hasRevealedPickupLocation && isPickupFulfillment && !hasDeliveryRecord;

  bool get shouldShowSelfPickupCode =>
      isAccepted &&
      isPickupFulfillment &&
      selfPickupCode != null &&
      selfPickupCode!.trim().isNotEmpty;

  bool get shouldShowLearnerDeliveryCode =>
      isAccepted &&
      isDeliveryFulfillment &&
      activeDelivery?.learnerDeliveryCode != null &&
      activeDelivery!.learnerDeliveryCode!.trim().isNotEmpty;
}
