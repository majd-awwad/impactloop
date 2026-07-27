class LearnerDeliveryLocation {
  const LearnerDeliveryLocation({
    required this.id,
    required this.country,
    required this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
    this.isApproximate = false,
  });

  final String id;
  final String country;
  final String city;
  final String? area;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
  final bool isApproximate;

  factory LearnerDeliveryLocation.fromJson(Map<String, dynamic> json) {
    return LearnerDeliveryLocation(
      id: json['id'] as String? ?? '',
      country: json['country'] as String? ?? '',
      city: json['city'] as String? ?? '',
      area: json['area'] as String?,
      addressLine: json['addressLine'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      isApproximate: json['isApproximate'] == true,
    );
  }

  String get summary {
    final parts = [city, area, addressLine]
        .where((part) => part != null && part.trim().isNotEmpty)
        .map((part) => part!)
        .toList(growable: false);

    if (parts.isEmpty) {
      return country.isEmpty ? 'Location shared with delivery' : country;
    }

    return parts.join(', ');
  }
}

class LearnerDeliveryMaterial {
  const LearnerDeliveryMaterial({
    required this.id,
    required this.title,
    required this.status,
    this.unit,
  });

  final String id;
  final String title;
  final String status;
  final String? unit;

  factory LearnerDeliveryMaterial.fromJson(Map<String, dynamic> json) {
    return LearnerDeliveryMaterial(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Material',
      status: json['status'] as String? ?? '',
      unit: json['unit'] as String?,
    );
  }
}

class LearnerDeliverySupplier {
  const LearnerDeliverySupplier({required this.id, required this.displayName});

  final String id;
  final String displayName;

  factory LearnerDeliverySupplier.fromJson(Map<String, dynamic> json) {
    return LearnerDeliverySupplier(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? 'Supplier',
    );
  }
}

class LearnerDeliveryDriver {
  const LearnerDeliveryDriver({
    required this.id,
    required this.displayName,
    this.phone,
    this.vehicleType,
    this.vehicleLabel,
    this.vehiclePlate,
  });

  final String id;
  final String displayName;
  final String? phone;
  final String? vehicleType;
  final String? vehicleLabel;
  final String? vehiclePlate;

  factory LearnerDeliveryDriver.fromJson(Map<String, dynamic> json) {
    return LearnerDeliveryDriver(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? 'Driver',
      phone: json['phone'] as String?,
      vehicleType: json['vehicleType'] as String?,
      vehicleLabel: json['vehicleLabel'] as String?,
      vehiclePlate: json['vehiclePlate'] as String?,
    );
  }
}

class LearnerDeliveryReservation {
  const LearnerDeliveryReservation({
    required this.id,
    required this.status,
    required this.material,
    required this.supplier,
    this.pickupWindowStart,
    this.pickupWindowEnd,
    this.supplierPickupWindowStart,
    this.supplierPickupWindowEnd,
    this.completedAt,
  });

  final String id;
  final String status;
  final LearnerDeliveryMaterial material;
  final LearnerDeliverySupplier supplier;
  final DateTime? pickupWindowStart;
  final DateTime? pickupWindowEnd;
  final DateTime? supplierPickupWindowStart;
  final DateTime? supplierPickupWindowEnd;
  final DateTime? completedAt;

  factory LearnerDeliveryReservation.fromJson(Map<String, dynamic> json) {
    final materialJson = json['material'];
    final supplierJson = json['supplier'];

    return LearnerDeliveryReservation(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      pickupWindowStart: DateTime.tryParse(
        json['pickupWindowStart'] as String? ?? '',
      ),
      pickupWindowEnd: DateTime.tryParse(
        json['pickupWindowEnd'] as String? ?? '',
      ),
      supplierPickupWindowStart: DateTime.tryParse(
        json['supplierPickupWindowStart'] as String? ?? '',
      ),
      supplierPickupWindowEnd: DateTime.tryParse(
        json['supplierPickupWindowEnd'] as String? ?? '',
      ),
      completedAt: DateTime.tryParse(json['completedAt'] as String? ?? ''),
      material: LearnerDeliveryMaterial.fromJson(
        materialJson is Map<String, dynamic>
            ? materialJson
            : const <String, dynamic>{},
      ),
      supplier: LearnerDeliverySupplier.fromJson(
        supplierJson is Map<String, dynamic>
            ? supplierJson
            : const <String, dynamic>{},
      ),
    );
  }
}

class LearnerDeliveryHistoryItem {
  const LearnerDeliveryHistoryItem({
    required this.id,
    this.oldStatus,
    required this.newStatus,
    this.note,
    required this.createdAt,
  });

  final String id;
  final String? oldStatus;
  final String newStatus;
  final String? note;
  final DateTime createdAt;

  factory LearnerDeliveryHistoryItem.fromJson(Map<String, dynamic> json) {
    return LearnerDeliveryHistoryItem(
      id: json['id'] as String? ?? '',
      oldStatus: json['oldStatus'] as String?,
      newStatus: json['newStatus'] as String? ?? '',
      note: json['note'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class LearnerDeliveryDriverPing {
  const LearnerDeliveryDriverPing({
    required this.capturedAt,
    this.latitude,
    this.longitude,
    this.accuracyMeters,
    this.coordinatesVisible = false,
    this.trackingLockedReason,
  });

  final DateTime capturedAt;
  final double? latitude;
  final double? longitude;
  final double? accuracyMeters;
  final bool coordinatesVisible;
  final String? trackingLockedReason;

  factory LearnerDeliveryDriverPing.fromJson(Map<String, dynamic> json) {
    return LearnerDeliveryDriverPing(
      capturedAt:
          DateTime.tryParse(json['capturedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      accuracyMeters: (json['accuracyMeters'] as num?)?.toDouble(),
      coordinatesVisible: json['coordinatesVisible'] == true,
      trackingLockedReason: json['trackingLockedReason'] as String?,
    );
  }

  bool get hasCoordinates =>
      coordinatesVisible && latitude != null && longitude != null;
}

class LearnerDelivery {
  const LearnerDelivery({
    required this.id,
    required this.reservationId,
    required this.status,
    required this.requestedAt,
    this.assignedAt,
    this.arrivedPickupAt,
    this.pickedUpAt,
    this.onTheWayAt,
    this.arrivedDropoffAt,
    this.deliveredAt,
    this.cancelledAt,
    this.failedAt,
    this.learnerNote,
    this.driverNote,
    this.failureReason,
    required this.reservation,
    required this.pickupLocation,
    required this.dropoffLocation,
    this.driver,
    this.latestDriverPing,
    this.history = const [],
    this.learnerDeliveryCode,
    this.canTrack = false,
    this.assignedDriverPickupOverdue = false,
    this.trackingMessage,
  });

  final String id;
  final String reservationId;
  final String status;
  final DateTime requestedAt;
  final DateTime? assignedAt;
  final DateTime? arrivedPickupAt;
  final DateTime? pickedUpAt;
  final DateTime? onTheWayAt;
  final DateTime? arrivedDropoffAt;
  final DateTime? deliveredAt;
  final DateTime? cancelledAt;
  final DateTime? failedAt;
  final String? learnerNote;
  final String? driverNote;
  final String? failureReason;
  final LearnerDeliveryReservation reservation;
  final LearnerDeliveryLocation pickupLocation;
  final LearnerDeliveryLocation dropoffLocation;
  final LearnerDeliveryDriver? driver;
  final LearnerDeliveryDriverPing? latestDriverPing;
  final List<LearnerDeliveryHistoryItem> history;
  final String? learnerDeliveryCode;
  final bool canTrack;
  final bool assignedDriverPickupOverdue;
  final String? trackingMessage;

  factory LearnerDelivery.fromJson(Map<String, dynamic> json) {
    final reservationJson = json['reservation'];
    final pickupJson = json['pickupLocation'];
    final dropoffJson = json['dropoffLocation'];
    final driverJson = json['driver'];
    final latestDriverPingJson = json['latestDriverPing'];
    final historyJson = json['history'];

    return LearnerDelivery(
      id: json['id'] as String? ?? '',
      reservationId: json['reservationId'] as String? ?? '',
      status: json['status'] as String? ?? 'WAITING_FOR_DRIVER',
      requestedAt:
          DateTime.tryParse(json['requestedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      assignedAt: DateTime.tryParse(json['assignedAt'] as String? ?? ''),
      arrivedPickupAt: DateTime.tryParse(
        json['arrivedPickupAt'] as String? ?? '',
      ),
      pickedUpAt: DateTime.tryParse(json['pickedUpAt'] as String? ?? ''),
      onTheWayAt: DateTime.tryParse(json['onTheWayAt'] as String? ?? ''),
      arrivedDropoffAt: DateTime.tryParse(
        json['arrivedDropoffAt'] as String? ?? '',
      ),
      deliveredAt: DateTime.tryParse(json['deliveredAt'] as String? ?? ''),
      cancelledAt: DateTime.tryParse(json['cancelledAt'] as String? ?? ''),
      failedAt: DateTime.tryParse(json['failedAt'] as String? ?? ''),
      learnerNote: json['learnerNote'] as String?,
      driverNote: json['driverNote'] as String?,
      failureReason: json['failureReason'] as String?,
      reservation: LearnerDeliveryReservation.fromJson(
        reservationJson is Map<String, dynamic>
            ? reservationJson
            : const <String, dynamic>{},
      ),
      pickupLocation: LearnerDeliveryLocation.fromJson(
        pickupJson is Map<String, dynamic>
            ? pickupJson
            : const <String, dynamic>{},
      ),
      dropoffLocation: LearnerDeliveryLocation.fromJson(
        dropoffJson is Map<String, dynamic>
            ? dropoffJson
            : const <String, dynamic>{},
      ),
      driver: driverJson is Map<String, dynamic>
          ? LearnerDeliveryDriver.fromJson(driverJson)
          : null,
      latestDriverPing: latestDriverPingJson is Map<String, dynamic>
          ? LearnerDeliveryDriverPing.fromJson(latestDriverPingJson)
          : null,
      history: historyJson is List
          ? historyJson
                .whereType<Map>()
                .map(
                  (item) => LearnerDeliveryHistoryItem.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
      learnerDeliveryCode: json['learnerDeliveryCode'] as String?,
      canTrack: json['canTrack'] == true,
      assignedDriverPickupOverdue: json['assignedDriverPickupOverdue'] == true,
      trackingMessage: json['trackingMessage'] as String?,
    );
  }

  bool get shouldShowLearnerDeliveryCode =>
      isActive &&
      learnerDeliveryCode != null &&
      learnerDeliveryCode!.trim().isNotEmpty;

  bool get isActive {
    return const {
      'WAITING_FOR_DRIVER',
      'DRIVER_ASSIGNED',
      'ARRIVED_PICKUP',
      'PICKED_UP',
      'ON_THE_WAY',
      'ARRIVED_DROPOFF',
    }.contains(status);
  }

  bool get isLearnerLocationVisible => canTrack;

  bool get isTerminal {
    return const {
      'DELIVERED',
      'CANCELLED',
      'FAILED_PICKUP',
      'FAILED_DELIVERY',
      'DRIVER_NO_SHOW',
      'LEARNER_NO_SHOW',
      'AWAITING_RESOLUTION',
    }.contains(status);
  }
}
