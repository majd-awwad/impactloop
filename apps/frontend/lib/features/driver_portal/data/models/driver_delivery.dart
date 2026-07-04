class DriverDeliveryMaterial {
  const DriverDeliveryMaterial({
    required this.id,
    required this.title,
    required this.quantityRequested,
    required this.unit,
  });

  final String id;
  final String title;
  final double quantityRequested;
  final String unit;

  factory DriverDeliveryMaterial.fromJson(Map<String, dynamic> json) {
    return DriverDeliveryMaterial(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Material',
      quantityRequested: _doubleFromJson(json['quantityRequested']) ?? 0,
      unit: json['unit'] as String? ?? '',
    );
  }

  String get quantityLabel {
    final quantity = quantityRequested % 1 == 0
        ? quantityRequested.toInt().toString()
        : quantityRequested.toStringAsFixed(2);
    return unit.trim().isEmpty ? quantity : '$quantity $unit';
  }
}

class DriverDeliveryParty {
  const DriverDeliveryParty({this.id, required this.displayName, this.phone});

  final String? id;
  final String displayName;
  final String? phone;

  factory DriverDeliveryParty.fromJson(Map<String, dynamic> json) {
    return DriverDeliveryParty(
      id: json['id'] as String?,
      displayName: json['displayName'] as String? ?? 'Unknown',
      phone: json['phone'] as String?,
    );
  }
}

class DriverSafeLocation {
  const DriverSafeLocation({
    this.id,
    this.country,
    this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
    this.isApproximate,
  });

  final String? id;
  final String? country;
  final String? city;
  final String? area;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
  final bool? isApproximate;

  factory DriverSafeLocation.fromJson(Map<String, dynamic> json) {
    return DriverSafeLocation(
      id: json['id'] as String?,
      country: json['country'] as String?,
      city: json['city'] as String?,
      area: json['area'] as String?,
      addressLine: json['addressLine'] as String?,
      latitude: _doubleFromJson(json['latitude']),
      longitude: _doubleFromJson(json['longitude']),
      isApproximate: json['isApproximate'] as bool?,
    );
  }

  String get safeSummary {
    final parts = [city, area]
        .where((item) => item != null && item.trim().isNotEmpty)
        .cast<String>()
        .toList(growable: false);
    return parts.isEmpty ? 'Location unavailable' : parts.join(', ');
  }

  String get exactSummary {
    final parts = [addressLine, area, city, country]
        .where((item) => item != null && item.trim().isNotEmpty)
        .cast<String>()
        .toList(growable: false);
    return parts.isEmpty ? safeSummary : parts.join(', ');
  }

  bool get hasExactCoordinates => latitude != null && longitude != null;
}

class DriverDelivery {
  const DriverDelivery({
    required this.id,
    required this.reservationId,
    required this.status,
    required this.requestedAt,
    this.pickupWindowStart,
    this.pickupWindowEnd,
    required this.material,
    required this.supplier,
    this.learner,
    required this.pickupLocation,
    required this.dropoffLocation,
    this.assignedAt,
    this.arrivedPickupAt,
    this.pickedUpAt,
    this.onTheWayAt,
    this.arrivedDropoffAt,
    this.deliveredAt,
    this.learnerNote,
    this.driverNote,
    this.supplierPickupWindowStart,
    this.supplierPickupWindowEnd,
    this.confirmedDeliveryWindowStart,
    this.confirmedDeliveryWindowEnd,
    this.canDriverReportPickupFailed = false,
    this.canDriverReportDeliveryFailed = false,
    this.canDriverReportDriverIssue = false,
  });

  final String id;
  final String reservationId;
  final String status;
  final DateTime requestedAt;
  final DateTime? pickupWindowStart;
  final DateTime? pickupWindowEnd;
  final DriverDeliveryMaterial material;
  final DriverDeliveryParty supplier;
  final DriverDeliveryParty? learner;
  final DriverSafeLocation pickupLocation;
  final DriverSafeLocation dropoffLocation;
  final DateTime? assignedAt;
  final DateTime? arrivedPickupAt;
  final DateTime? pickedUpAt;
  final DateTime? onTheWayAt;
  final DateTime? arrivedDropoffAt;
  final DateTime? deliveredAt;
  final String? learnerNote;
  final String? driverNote;
  final DateTime? supplierPickupWindowStart;
  final DateTime? supplierPickupWindowEnd;
  final DateTime? confirmedDeliveryWindowStart;
  final DateTime? confirmedDeliveryWindowEnd;
  final bool canDriverReportPickupFailed;
  final bool canDriverReportDeliveryFailed;
  final bool canDriverReportDriverIssue;

  factory DriverDelivery.fromJson(Map<String, dynamic> json) {
    return DriverDelivery(
      id: json['id'] as String? ?? '',
      reservationId: json['reservationId'] as String? ?? '',
      status: json['status'] as String? ?? 'WAITING_FOR_DRIVER',
      requestedAt: _dateFromJson(json['requestedAt']) ?? DateTime.now(),
      pickupWindowStart: _dateFromJson(json['pickupWindowStart']),
      pickupWindowEnd: _dateFromJson(json['pickupWindowEnd']),
      material: DriverDeliveryMaterial.fromJson(
        Map<String, dynamic>.from(json['material'] as Map? ?? const {}),
      ),
      supplier: DriverDeliveryParty.fromJson(
        Map<String, dynamic>.from(json['supplier'] as Map? ?? const {}),
      ),
      learner: json['learner'] is Map
          ? DriverDeliveryParty.fromJson(
              Map<String, dynamic>.from(json['learner'] as Map),
            )
          : null,
      pickupLocation: DriverSafeLocation.fromJson(
        Map<String, dynamic>.from(json['pickupLocation'] as Map? ?? const {}),
      ),
      dropoffLocation: DriverSafeLocation.fromJson(
        Map<String, dynamic>.from(json['dropoffLocation'] as Map? ?? const {}),
      ),
      assignedAt: _dateFromJson(json['assignedAt']),
      arrivedPickupAt: _dateFromJson(json['arrivedPickupAt']),
      pickedUpAt: _dateFromJson(json['pickedUpAt']),
      onTheWayAt: _dateFromJson(json['onTheWayAt']),
      arrivedDropoffAt: _dateFromJson(json['arrivedDropoffAt']),
      deliveredAt: _dateFromJson(json['deliveredAt']),
      learnerNote: json['learnerNote'] as String?,
      driverNote: json['driverNote'] as String?,
      supplierPickupWindowStart:
          _dateFromJson(json['supplierPickupWindowStart']),
      supplierPickupWindowEnd: _dateFromJson(json['supplierPickupWindowEnd']),
      confirmedDeliveryWindowStart:
          _dateFromJson(json['confirmedDeliveryWindowStart']),
      confirmedDeliveryWindowEnd:
          _dateFromJson(json['confirmedDeliveryWindowEnd']),
      canDriverReportPickupFailed:
          json['canDriverReportPickupFailed'] == true,
      canDriverReportDeliveryFailed:
          json['canDriverReportDeliveryFailed'] == true,
      canDriverReportDriverIssue:
          json['canDriverReportDriverIssue'] == true,
    );
  }

  bool get isAssigned => learner != null;

  String? get nextStatus {
    switch (status) {
      case 'DRIVER_ASSIGNED':
        return 'ARRIVED_PICKUP';
      case 'ARRIVED_PICKUP':
        return 'PICKED_UP';
      case 'PICKED_UP':
        return 'ON_THE_WAY';
      case 'ON_THE_WAY':
        return 'ARRIVED_DROPOFF';
      case 'ARRIVED_DROPOFF':
        return 'DELIVERED';
      default:
        return null;
    }
  }

  bool get isAutoPingEligible => isDriverAutoPingEligibleStatus(status);
}

const driverAutoPingEligibleStatuses = {
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
};

bool isDriverAutoPingEligibleStatus(String status) {
  return driverAutoPingEligibleStatuses.contains(status);
}

DateTime? _dateFromJson(Object? value) {
  if (value is! String || value.trim().isEmpty) {
    return null;
  }

  return DateTime.tryParse(value)?.toLocal();
}

double? _doubleFromJson(Object? value) {
  if (value is num) {
    return value.toDouble();
  }

  if (value is String) {
    return double.tryParse(value);
  }

  return null;
}
