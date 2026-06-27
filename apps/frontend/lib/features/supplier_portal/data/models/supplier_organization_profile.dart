import 'supplier_profile_location.dart';

class SupplierOrganizationProfile {
  const SupplierOrganizationProfile({
    required this.id,
    required this.organizationName,
    required this.organizationType,
    this.contactPersonName,
    this.workingDays,
    this.workingHours,
    this.verificationDocumentStatus,
    this.businessLocation,
  });

  final String id;
  final String organizationName;
  final String organizationType;
  final String? contactPersonName;
  final List<String>? workingDays;
  final Map<String, dynamic>? workingHours;
  final String? verificationDocumentStatus;
  final SupplierProfileLocation? businessLocation;

  factory SupplierOrganizationProfile.fromJson(Map<String, dynamic> json) {
    final businessLocationJson = json['businessLocation'];
    final workingHoursJson = json['workingHours'];

    return SupplierOrganizationProfile(
      id: json['id'] as String? ?? '',
      organizationName: json['organizationName'] as String? ?? '',
      organizationType: json['organizationType'] as String? ?? '',
      contactPersonName: json['contactPersonName'] as String?,
      workingDays: (json['workingDays'] as List<dynamic>?)
          ?.whereType<String>()
          .toList(),
      workingHours: workingHoursJson is Map<String, dynamic>
          ? Map<String, dynamic>.from(workingHoursJson)
          : null,
      verificationDocumentStatus: json['verificationDocumentStatus'] as String?,
      businessLocation: businessLocationJson is Map<String, dynamic>
          ? SupplierProfileLocation.fromJson(businessLocationJson)
          : null,
    );
  }
}
