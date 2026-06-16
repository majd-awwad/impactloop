import 'supplier_organization_profile.dart';
import 'supplier_profile_location.dart';

class SupplierProfileUser {
  const SupplierProfileUser({
    required this.id,
    required this.displayName,
    required this.email,
    this.profileImageUrl,
  });

  final String id;
  final String displayName;
  final String email;
  final String? profileImageUrl;

  factory SupplierProfileUser.fromJson(Map<String, dynamic> json) {
    return SupplierProfileUser(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      profileImageUrl: json['profileImageUrl'] as String?,
    );
  }
}

class SupplierProfileDetails {
  const SupplierProfileDetails({
    required this.id,
    required this.publicName,
    required this.supplierType,
    this.description,
    required this.verificationStatus,
    this.defaultPickupLocation,
    this.organizationProfile,
  });

  final String id;
  final String publicName;
  final String supplierType;
  final String? description;
  final String verificationStatus;
  final SupplierProfileLocation? defaultPickupLocation;
  final SupplierOrganizationProfile? organizationProfile;

  factory SupplierProfileDetails.fromJson(Map<String, dynamic> json) {
    final locationJson = json['defaultPickupLocation'];
    final organizationJson = json['organizationProfile'];

    return SupplierProfileDetails(
      id: json['id'] as String? ?? '',
      publicName: json['publicName'] as String? ?? '',
      supplierType: json['supplierType'] as String? ?? '',
      description: json['description'] as String?,
      verificationStatus: json['verificationStatus'] as String? ?? 'UNVERIFIED',
      defaultPickupLocation: locationJson is Map<String, dynamic>
          ? SupplierProfileLocation.fromJson(locationJson)
          : null,
      organizationProfile: organizationJson is Map<String, dynamic>
          ? SupplierOrganizationProfile.fromJson(organizationJson)
          : null,
    );
  }
}

class SupplierProfileResponse {
  const SupplierProfileResponse({
    required this.hasSupplierProfile,
    required this.user,
    this.supplier,
  });

  final bool hasSupplierProfile;
  final SupplierProfileUser user;
  final SupplierProfileDetails? supplier;

  factory SupplierProfileResponse.fromJson(Map<String, dynamic> json) {
    final supplierJson = json['supplier'];
    return SupplierProfileResponse(
      hasSupplierProfile: json['hasSupplierProfile'] as bool? ?? false,
      user: SupplierProfileUser.fromJson(
        json['user'] as Map<String, dynamic>? ?? const {},
      ),
      supplier: supplierJson is Map<String, dynamic>
          ? SupplierProfileDetails.fromJson(supplierJson)
          : null,
    );
  }
}
