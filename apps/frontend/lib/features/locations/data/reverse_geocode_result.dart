class ReverseGeocodeResult {
  const ReverseGeocodeResult({
    this.country,
    this.city,
    this.area,
    this.addressLine,
    this.displayName,
    required this.provider,
  });

  final String? country;
  final String? city;
  final String? area;
  final String? addressLine;
  final String? displayName;
  final String provider;

  factory ReverseGeocodeResult.fromJson(Map<String, dynamic> json) {
    return ReverseGeocodeResult(
      country: _readNullableString(json['country']),
      city: _readNullableString(json['city']),
      area: _readNullableString(json['area']),
      addressLine: _readNullableString(json['addressLine']),
      displayName: _readNullableString(json['displayName']),
      provider: json['provider'] as String? ?? 'nominatim',
    );
  }

  static String? _readNullableString(Object? value) {
    if (value is! String) {
      return null;
    }

    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
  }
}
