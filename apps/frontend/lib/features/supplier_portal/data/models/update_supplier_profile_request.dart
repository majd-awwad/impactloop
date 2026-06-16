class UpdateSupplierProfileLocationRequest {
  const UpdateSupplierProfileLocationRequest({
    required this.country,
    required this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
    required this.visibility,
    required this.isApproximate,
    required this.locationType,
  });

  final String country;
  final String city;
  final String? area;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
  final String visibility;
  final bool isApproximate;
  final String locationType;

  Map<String, dynamic> toJson() {
    return {
      'country': country,
      'city': city,
      'area': area,
      'addressLine': addressLine,
      'latitude': latitude,
      'longitude': longitude,
      'visibility': visibility,
      'isApproximate': isApproximate,
      'locationType': locationType,
    };
  }
}

class UpdateSupplierOrganizationProfileRequest {
  const UpdateSupplierOrganizationProfileRequest({
    required this.organizationName,
    required this.organizationType,
    this.contactPersonName,
    this.workingDays,
    this.workingHours,
    this.businessLocation,
  });

  final String organizationName;
  final String organizationType;
  final String? contactPersonName;
  final List<String>? workingDays;
  final Map<String, String>? workingHours;
  final UpdateSupplierProfileLocationRequest? businessLocation;

  Map<String, dynamic> toJson() {
    return {
      'organizationName': organizationName,
      'organizationType': organizationType,
      'contactPersonName': contactPersonName,
      'workingDays': workingDays,
      'workingHours': workingHours,
      'businessLocation': businessLocation?.toJson(),
    };
  }
}

class UpdateSupplierProfileRequest {
  const UpdateSupplierProfileRequest({
    required this.publicName,
    required this.supplierType,
    this.description,
    required this.defaultPickupLocation,
    this.organizationProfile,
  });

  final String publicName;
  final String supplierType;
  final String? description;
  final UpdateSupplierProfileLocationRequest defaultPickupLocation;
  final UpdateSupplierOrganizationProfileRequest? organizationProfile;

  Map<String, dynamic> toJson() {
    return {
      'publicName': publicName,
      'supplierType': supplierType,
      'description': description,
      'defaultPickupLocation': defaultPickupLocation.toJson(),
      'organizationProfile': organizationProfile?.toJson(),
    };
  }
}
