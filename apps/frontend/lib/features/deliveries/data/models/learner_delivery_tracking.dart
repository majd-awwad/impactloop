class LearnerDeliveryTrackingLocation {
  const LearnerDeliveryTrackingLocation({
    required this.latitude,
    required this.longitude,
    required this.capturedAt,
    this.accuracyMeters,
  });

  final double latitude;
  final double longitude;
  final DateTime capturedAt;
  final double? accuracyMeters;

  factory LearnerDeliveryTrackingLocation.fromJson(Map<String, dynamic> json) {
    return LearnerDeliveryTrackingLocation(
      latitude: (json['latitude'] as num).toDouble(),
      longitude: (json['longitude'] as num).toDouble(),
      capturedAt:
          DateTime.tryParse(json['capturedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      accuracyMeters: (json['accuracyMeters'] as num?)?.toDouble(),
    );
  }
}

class LearnerDeliveryTracking {
  const LearnerDeliveryTracking({
    required this.deliveryId,
    required this.reservationId,
    required this.materialTitle,
    required this.status,
    required this.canTrack,
    required this.trackingMessage,
    required this.isLocationStale,
    this.driverDisplayName,
    this.latestDriverLocation,
    this.pickupCity,
    this.pickupArea,
    this.dropoffCity,
    this.dropoffArea,
    this.dropoffLatitude,
    this.dropoffLongitude,
  });

  final String deliveryId;
  final String reservationId;
  final String materialTitle;
  final String status;
  final bool canTrack;
  final String trackingMessage;
  final bool isLocationStale;
  final String? driverDisplayName;
  final LearnerDeliveryTrackingLocation? latestDriverLocation;
  final String? pickupCity;
  final String? pickupArea;
  final String? dropoffCity;
  final String? dropoffArea;
  final double? dropoffLatitude;
  final double? dropoffLongitude;

  String get pickupSummary {
    final parts = [pickupArea, pickupCity]
        .whereType<String>()
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList();
    return parts.isEmpty ? 'Pickup location' : parts.join(', ');
  }

  String get dropoffSummary {
    final parts = [dropoffArea, dropoffCity]
        .whereType<String>()
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList();
    return parts.isEmpty ? 'Drop-off location' : parts.join(', ');
  }

  String get routeLabel => 'Pickup: $pickupSummary → Drop-off: $dropoffSummary';

  bool get isTerminal {
    switch (status) {
      case 'DELIVERED':
      case 'CANCELLED':
      case 'FAILED_PICKUP':
      case 'FAILED_DELIVERY':
      case 'DRIVER_NO_SHOW':
      case 'LEARNER_NO_SHOW':
      case 'AWAITING_RESOLUTION':
        return true;
      default:
        return false;
    }
  }

  factory LearnerDeliveryTracking.fromJson(Map<String, dynamic> json) {
    final locationJson = json['latestDriverLocation'];

    return LearnerDeliveryTracking(
      deliveryId: json['deliveryId'] as String? ?? '',
      reservationId: json['reservationId'] as String? ?? '',
      materialTitle: json['materialTitle'] as String? ?? '',
      status: json['status'] as String? ?? '',
      canTrack: json['canTrack'] == true,
      trackingMessage: json['trackingMessage'] as String? ?? '',
      isLocationStale: json['isLocationStale'] == true,
      driverDisplayName: json['driverDisplayName'] as String?,
      latestDriverLocation: locationJson is Map<String, dynamic>
          ? LearnerDeliveryTrackingLocation.fromJson(locationJson)
          : null,
      pickupCity: json['pickupCity'] as String?,
      pickupArea: json['pickupArea'] as String?,
      dropoffCity: json['dropoffCity'] as String?,
      dropoffArea: json['dropoffArea'] as String?,
      dropoffLatitude: (json['dropoffLatitude'] as num?)?.toDouble(),
      dropoffLongitude: (json['dropoffLongitude'] as num?)?.toDouble(),
    );
  }
}
