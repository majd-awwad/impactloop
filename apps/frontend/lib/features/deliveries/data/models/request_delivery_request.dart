class DeliveryLocationInput {
  const DeliveryLocationInput({
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

  Map<String, dynamic> toJson() {
    return {
      'country': country,
      'city': city,
      if (area != null && area!.trim().isNotEmpty) 'area': area!.trim(),
      if (addressLine != null && addressLine!.trim().isNotEmpty)
        'addressLine': addressLine!.trim(),
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      'visibility': 'PRIVATE',
      'isApproximate': isApproximate,
    };
  }
}

class RequestDeliveryRequest {
  const RequestDeliveryRequest({
    required this.dropoffLocation,
    this.learnerNote,
  });

  final DeliveryLocationInput dropoffLocation;
  final String? learnerNote;

  Map<String, dynamic> toJson() {
    return {
      'dropoffLocation': dropoffLocation.toJson(),
      if (learnerNote != null && learnerNote!.trim().isNotEmpty)
        'learnerNote': learnerNote!.trim(),
    };
  }
}
