class SupplierProfileLocation {
  const SupplierProfileLocation({
    required this.id,
    required this.country,
    required this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
    this.visibility,
    required this.isApproximate,
    this.locationType,
  });

  final String id;
  final String country;
  final String city;
  final String? area;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
  final String? visibility;
  final bool isApproximate;
  final String? locationType;

  String get summary {
    final parts = [city, if (area != null && area!.isNotEmpty) area!];
    return parts.where((part) => part.isNotEmpty).join(', ');
  }

  bool get hasCoordinates => latitude != null && longitude != null;

  static double? _parseCoordinate(dynamic value) {
    if (value == null) {
      return null;
    }

    if (value is num) {
      return value.toDouble();
    }

    if (value is String) {
      return double.tryParse(value);
    }

    return null;
  }

  factory SupplierProfileLocation.fromJson(Map<String, dynamic> json) {
    return SupplierProfileLocation(
      id: json['id'] as String? ?? '',
      country: json['country'] as String? ?? '',
      city: json['city'] as String? ?? '',
      area: json['area'] as String?,
      addressLine: json['addressLine'] as String?,
      latitude: _parseCoordinate(json['latitude']),
      longitude: _parseCoordinate(json['longitude']),
      visibility: _parseVisibility(json['visibility']),
      isApproximate: json['isApproximate'] as bool? ?? true,
      locationType: json['locationType'] as String?,
    );
  }

  Map<String, dynamic> toUpdateJson() {
    return {
      'country': country,
      'city': city,
      'area': area,
      'addressLine': addressLine,
      'latitude': latitude,
      'longitude': longitude,
      'visibility': visibility ?? 'ORDER_ONLY',
      'isApproximate': isApproximate,
      'locationType': locationType ?? 'PICKUP_POINT',
    };
  }
}

String? _parseVisibility(dynamic value) {
  if (value is! String) return null;
  final normalized = value.trim().toUpperCase();
  if (normalized.isEmpty) return null;

  return switch (normalized) {
    // Compatibility normalization for legacy payloads. The management model
    // stores visibility and approximation as separate fields.
    'PUBLIC_APPROXIMATE' => 'PUBLIC',
    'PUBLIC' || 'ORDER_ONLY' || 'PRIVATE' => normalized,
    _ => normalized,
  };
}
