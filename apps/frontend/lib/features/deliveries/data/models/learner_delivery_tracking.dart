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
    required this.status,
    required this.canTrack,
    required this.trackingMessage,
    this.latestDriverLocation,
  });

  final String deliveryId;
  final String status;
  final bool canTrack;
  final String trackingMessage;
  final LearnerDeliveryTrackingLocation? latestDriverLocation;

  factory LearnerDeliveryTracking.fromJson(Map<String, dynamic> json) {
    final locationJson = json['latestDriverLocation'];

    return LearnerDeliveryTracking(
      deliveryId: json['deliveryId'] as String? ?? '',
      status: json['status'] as String? ?? '',
      canTrack: json['canTrack'] == true,
      trackingMessage: json['trackingMessage'] as String? ?? '',
      latestDriverLocation: locationJson is Map<String, dynamic>
          ? LearnerDeliveryTrackingLocation.fromJson(locationJson)
          : null,
    );
  }
}
