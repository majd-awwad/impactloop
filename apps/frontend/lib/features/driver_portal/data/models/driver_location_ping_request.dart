class DriverLocationPingRequest {
  const DriverLocationPingRequest({
    required this.latitude,
    required this.longitude,
    this.accuracyMeters,
    this.heading,
    this.speed,
    this.capturedAt,
  });

  final double latitude;
  final double longitude;
  final double? accuracyMeters;
  final double? heading;
  final double? speed;
  final DateTime? capturedAt;

  Map<String, dynamic> toJson() {
    return {
      'latitude': latitude,
      'longitude': longitude,
      if (accuracyMeters != null) 'accuracyMeters': accuracyMeters,
      if (heading != null) 'heading': heading,
      if (speed != null) 'speed': speed,
      if (capturedAt != null) 'capturedAt': capturedAt!.toUtc().toIso8601String(),
    };
  }
}
