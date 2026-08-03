enum DriverProfileStatus { active, inactive, suspended, unknown }

enum DriverOperationalAvailability { available, offline, onDelivery, unknown }

enum DriverTransportationType { car, motorcycle, bicycle, walking, unknown }

DriverProfileStatus parseDriverProfileStatus(Object? value) {
  return switch (value?.toString().trim().toUpperCase()) {
    'ACTIVE' => DriverProfileStatus.active,
    'INACTIVE' => DriverProfileStatus.inactive,
    'SUSPENDED' => DriverProfileStatus.suspended,
    _ => DriverProfileStatus.unknown,
  };
}

DriverOperationalAvailability parseDriverOperationalAvailability(
  Object? value,
) {
  return switch (value?.toString().trim().toUpperCase()) {
    'AVAILABLE' => DriverOperationalAvailability.available,
    'OFFLINE' => DriverOperationalAvailability.offline,
    'ON_DELIVERY' => DriverOperationalAvailability.onDelivery,
    _ => DriverOperationalAvailability.unknown,
  };
}

DriverTransportationType parseDriverTransportationType(Object? value) {
  return switch (value?.toString().trim().toUpperCase()) {
    'CAR' => DriverTransportationType.car,
    'MOTORCYCLE' => DriverTransportationType.motorcycle,
    'BICYCLE' => DriverTransportationType.bicycle,
    'WALKING' => DriverTransportationType.walking,
    _ => DriverTransportationType.unknown,
  };
}

String? driverTransportationTypeApiValue(DriverTransportationType value) {
  return switch (value) {
    DriverTransportationType.car => 'CAR',
    DriverTransportationType.motorcycle => 'MOTORCYCLE',
    DriverTransportationType.bicycle => 'BICYCLE',
    DriverTransportationType.walking => 'WALKING',
    DriverTransportationType.unknown => null,
  };
}

class DriverOperationalProfile {
  const DriverOperationalProfile({
    required this.status,
    required this.rawStatus,
    required this.availability,
    required this.rawAvailability,
    required this.acceptingNewJobs,
    required this.activeDeliveryCount,
    required this.maxActiveDeliveries,
    required this.canAcceptMore,
    required this.city,
    required this.area,
    required this.transportationType,
    required this.rawTransportationType,
    required this.vehicleLabel,
    required this.vehiclePlate,
    required this.capacityNotes,
    required this.updatedAt,
  });

  final DriverProfileStatus status;
  final String? rawStatus;
  final DriverOperationalAvailability availability;
  final String? rawAvailability;
  final bool? acceptingNewJobs;
  final int? activeDeliveryCount;
  final int? maxActiveDeliveries;
  final bool? canAcceptMore;
  final String? city;
  final String? area;
  final DriverTransportationType transportationType;
  final String? rawTransportationType;
  final String? vehicleLabel;
  final String? vehiclePlate;
  final String? capacityNotes;
  final DateTime? updatedAt;

  bool get isAdministrativelyActive => status == DriverProfileStatus.active;

  factory DriverOperationalProfile.fromJson(Map<String, dynamic> json) {
    final rawStatus = _nullableString(json['status']);
    final rawAvailability = _nullableString(json['availability']);
    final rawTransportationType = _nullableString(json['transportationType']);

    return DriverOperationalProfile(
      status: parseDriverProfileStatus(rawStatus),
      rawStatus: rawStatus,
      availability: parseDriverOperationalAvailability(rawAvailability),
      rawAvailability: rawAvailability,
      acceptingNewJobs: json['acceptingNewJobs'] as bool?,
      activeDeliveryCount: (json['activeDeliveryCount'] as num?)?.toInt(),
      maxActiveDeliveries: (json['maxActiveDeliveries'] as num?)?.toInt(),
      canAcceptMore: json['canAcceptMore'] as bool?,
      city: _nullableString(json['city']),
      area: _nullableString(json['area']),
      transportationType: parseDriverTransportationType(rawTransportationType),
      rawTransportationType: rawTransportationType,
      vehicleLabel: _nullableString(json['vehicleLabel']),
      vehiclePlate: _nullableString(json['vehiclePlate']),
      capacityNotes: _nullableString(json['capacityNotes']),
      updatedAt: DateTime.tryParse(_nullableString(json['updatedAt']) ?? ''),
    );
  }
}

class UpdateDriverOperationalProfileRequest {
  const UpdateDriverOperationalProfileRequest({
    required this.city,
    required this.area,
    required this.transportationType,
    required this.vehicleLabel,
    required this.vehiclePlate,
    required this.capacityNotes,
  });

  final String city;
  final String area;
  final DriverTransportationType transportationType;
  final String? vehicleLabel;
  final String? vehiclePlate;
  final String? capacityNotes;

  Map<String, dynamic> toJson() {
    final transportation = driverTransportationTypeApiValue(transportationType);
    return {
      'city': city.trim(),
      'area': area.trim(),
      'transportationType': ?transportation,
      'vehicleLabel': _trimmedOrNull(vehicleLabel),
      'vehiclePlate': _trimmedOrNull(vehiclePlate),
      'capacityNotes': _trimmedOrNull(capacityNotes),
    };
  }
}

class UpdateDriverAvailabilityRequest {
  const UpdateDriverAvailabilityRequest({required this.acceptingNewJobs});

  final bool acceptingNewJobs;

  Map<String, dynamic> toJson() => {'acceptingNewJobs': acceptingNewJobs};
}

String? _nullableString(Object? value) {
  if (value is! String) return null;
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}

String? _trimmedOrNull(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}
