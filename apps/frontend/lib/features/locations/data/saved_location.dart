class SavedLocation {
  const SavedLocation({
    required this.id,
    required this.label,
    this.country = 'Palestine',
    required this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
    this.isDefault = false,
  });

  final String id;
  final String label;
  final String country;
  final String city;
  final String? area;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
  final bool isDefault;

  bool get hasCoordinates => latitude != null && longitude != null;

  String get displayLabel {
    final parts = [
      label,
      city,
      if (area != null && area!.trim().isNotEmpty) area!,
    ];

    return parts.join(' - ');
  }

  factory SavedLocation.fromJson(Map<String, dynamic> json) {
    return SavedLocation(
      id: _stringOrFallback(json['id'], fallback: ''),
      label: _stringOrFallback(json['label'], fallback: 'Saved location'),
      country: _stringOrFallback(json['country'], fallback: 'Palestine'),
      city: _stringOrFallback(json['city'], fallback: 'Unknown city'),
      area: _nullableString(json['area']),
      addressLine: _nullableString(json['addressLine']),
      latitude: _numberFromDynamic(json['latitude']),
      longitude: _numberFromDynamic(json['longitude']),
      isDefault: json['isDefault'] == true,
    );
  }

  static String _stringOrFallback(Object? value, {required String fallback}) {
    final normalized = _nullableString(value);
    return normalized == null || normalized.isEmpty ? fallback : normalized;
  }

  static String? _nullableString(Object? value) {
    if (value == null) return null;
    final normalized = value.toString().trim();
    return normalized.isEmpty ? null : normalized;
  }

  static double? _numberFromDynamic(Object? value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }
}

class SavedLocationPayload {
  const SavedLocationPayload({
    required this.label,
    this.country = 'Palestine',
    required this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
    this.isDefault = false,
  });

  final String label;
  final String country;
  final String city;
  final String? area;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
  final bool isDefault;

  Map<String, dynamic> toCreateJson() {
    return {
      'label': label,
      'country': country,
      'city': city,
      if (_nonEmpty(area) != null) 'area': _nonEmpty(area),
      if (_nonEmpty(addressLine) != null) 'addressLine': _nonEmpty(addressLine),
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      'isDefault': isDefault,
    };
  }

  Map<String, dynamic> toUpdateJson() {
    return {
      'label': label,
      'country': country,
      'city': city,
      'area': _nonEmpty(area),
      'addressLine': _nonEmpty(addressLine),
      'latitude': latitude,
      'longitude': longitude,
      'isDefault': isDefault,
    };
  }

  static String? _nonEmpty(String? value) {
    final normalized = value?.trim();
    return normalized == null || normalized.isEmpty ? null : normalized;
  }
}
