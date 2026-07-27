class SavedDropoffLocation {
  const SavedDropoffLocation({
    required this.country,
    required this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
    this.isApproximate = false,
  });

  final String country;
  final String city;
  final String? area;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
  final bool isApproximate;

  String get summary {
    final parts = <String>[
      if (addressLine?.trim().isNotEmpty == true) addressLine!.trim(),
      if (area?.trim().isNotEmpty == true) area!.trim(),
      city.trim(),
      country.trim(),
    ];
    return parts.where((part) => part.isNotEmpty).join(', ');
  }

  factory SavedDropoffLocation.fromJson(Map<String, dynamic> json) {
    return SavedDropoffLocation(
      country: json['country'] as String? ?? '',
      city: json['city'] as String? ?? '',
      area: json['area'] as String?,
      addressLine: json['addressLine'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      isApproximate: json['isApproximate'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'country': country,
      'city': city,
      if (area != null && area!.trim().isNotEmpty) 'area': area!.trim(),
      if (addressLine != null && addressLine!.trim().isNotEmpty)
        'addressLine': addressLine!.trim(),
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      'isApproximate': isApproximate,
    };
  }
}

class SavedDropoffAddress {
  const SavedDropoffAddress({
    required this.id,
    required this.label,
    required this.isDefault,
    required this.location,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String label;
  final bool isDefault;
  final SavedDropoffLocation location;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory SavedDropoffAddress.fromJson(Map<String, dynamic> json) {
    return SavedDropoffAddress(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      isDefault: json['isDefault'] == true,
      location: SavedDropoffLocation.fromJson(
        Map<String, dynamic>.from(json['location'] as Map? ?? const {}),
      ),
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      updatedAt:
          DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}
