class ForwardGeocodeResult {
  const ForwardGeocodeResult({
    required this.latitude,
    required this.longitude,
    this.country,
    this.city,
    this.area,
    this.addressLine,
    this.displayName,
    required this.provider,
  });

  final double latitude;
  final double longitude;
  final String? country;
  final String? city;
  final String? area;
  final String? addressLine;
  final String? displayName;
  final String provider;

  factory ForwardGeocodeResult.fromJson(Map<String, dynamic> json) {
    return ForwardGeocodeResult(
      latitude: _readRequiredNumber(json['latitude']),
      longitude: _readRequiredNumber(json['longitude']),
      country: _readNullableString(json['country']),
      city: _readNullableString(json['city']),
      area: _readNullableString(json['area']),
      addressLine: _readNullableString(json['addressLine']),
      displayName: _readNullableString(json['displayName']),
      provider: json['provider'] as String? ?? 'nominatim',
    );
  }

  static double _readRequiredNumber(Object? value) {
    if (value is num) {
      return value.toDouble();
    }

    final parsed = double.tryParse(value?.toString() ?? '');
    if (parsed == null) {
      throw const FormatException('Geocode result is missing coordinates');
    }

    return parsed;
  }

  static String? _readNullableString(Object? value) {
    if (value is! String) {
      return null;
    }

    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}
