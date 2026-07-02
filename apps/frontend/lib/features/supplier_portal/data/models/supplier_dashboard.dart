import 'supplier_dashboard_activity.dart';
import 'supplier_dashboard_insights.dart';
import 'supplier_dashboard_material.dart';
import 'supplier_dashboard_pickup.dart';
import 'supplier_dashboard_stats.dart';

class SupplierDefaultLocation {
  const SupplierDefaultLocation({
    required this.id,
    required this.city,
    this.area,
    this.visibility,
    required this.isApproximate,
  });

  final String id;
  final String city;
  final String? area;
  final String? visibility;
  final bool isApproximate;

  factory SupplierDefaultLocation.fromJson(Map<String, dynamic> json) {
    return SupplierDefaultLocation(
      id: json['id'] as String? ?? '',
      city: json['city'] as String? ?? '',
      area: json['area'] as String?,
      visibility: json['visibility'] as String?,
      isApproximate: json['isApproximate'] as bool? ?? true,
    );
  }
}

class SupplierOrganizationSummary {
  const SupplierOrganizationSummary({
    required this.organizationName,
    required this.organizationType,
  });

  final String organizationName;
  final String organizationType;

  factory SupplierOrganizationSummary.fromJson(Map<String, dynamic> json) {
    return SupplierOrganizationSummary(
      organizationName: json['organizationName'] as String? ?? '',
      organizationType: json['organizationType'] as String? ?? '',
    );
  }
}

class SupplierDashboardProfile {
  const SupplierDashboardProfile({
    required this.id,
    required this.userId,
    required this.publicName,
    required this.supplierType,
    this.description,
    required this.verificationStatus,
    this.defaultLocation,
    this.organization,
  });

  final String id;
  final String userId;
  final String publicName;
  final String supplierType;
  final String? description;
  final String verificationStatus;
  final SupplierDefaultLocation? defaultLocation;
  final SupplierOrganizationSummary? organization;

  factory SupplierDashboardProfile.fromJson(Map<String, dynamic> json) {
    final locationJson = json['defaultLocation'];
    final organizationJson = json['organization'];

    return SupplierDashboardProfile(
      id: json['id'] as String? ?? '',
      userId: json['userId'] as String? ?? '',
      publicName: json['publicName'] as String? ?? '',
      supplierType: json['supplierType'] as String? ?? '',
      description: json['description'] as String?,
      verificationStatus: json['verificationStatus'] as String? ?? 'PENDING',
      defaultLocation: locationJson is Map<String, dynamic>
          ? SupplierDefaultLocation.fromJson(locationJson)
          : null,
      organization: organizationJson is Map<String, dynamic>
          ? SupplierOrganizationSummary.fromJson(organizationJson)
          : null,
    );
  }
}

class SupplierDashboard {
  const SupplierDashboard({
    required this.hasSupplierProfile,
    this.message,
    this.supplier,
    required this.stats,
    required this.recentMaterials,
    required this.upcomingPickups,
    required this.recentActivity,
    required this.recentReservationRequests,
    this.mostViewedMaterial,
    required this.highDemandMaterials,
  });

  final bool hasSupplierProfile;
  final String? message;
  final SupplierDashboardProfile? supplier;
  final SupplierDashboardStats stats;
  final List<SupplierDashboardMaterial> recentMaterials;
  final List<SupplierDashboardPickup> upcomingPickups;
  final List<SupplierDashboardActivity> recentActivity;
  final List<SupplierRecentReservationRequest> recentReservationRequests;
  final SupplierDashboardMaterialInsight? mostViewedMaterial;
  final List<SupplierDashboardMaterialInsight> highDemandMaterials;

  factory SupplierDashboard.fromJson(Map<String, dynamic> json) {
    final supplierJson = json['supplier'];
    final mostViewedJson = json['mostViewedMaterial'];

    return SupplierDashboard(
      hasSupplierProfile: json['hasSupplierProfile'] as bool? ?? false,
      message: json['message'] as String?,
      supplier: supplierJson is Map<String, dynamic>
          ? SupplierDashboardProfile.fromJson(supplierJson)
          : null,
      stats: SupplierDashboardStats.fromJson(
        json['stats'] as Map<String, dynamic>? ?? const {},
      ),
      recentMaterials: (json['recentMaterials'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(SupplierDashboardMaterial.fromJson)
          .toList(),
      upcomingPickups: (json['upcomingPickups'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(SupplierDashboardPickup.fromJson)
          .toList(),
      recentActivity: (json['recentActivity'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(SupplierDashboardActivity.fromJson)
          .toList(),
      recentReservationRequests:
          (json['recentReservationRequests'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(SupplierRecentReservationRequest.fromJson)
              .toList(),
      mostViewedMaterial: mostViewedJson is Map<String, dynamic>
          ? SupplierDashboardMaterialInsight.fromJson(mostViewedJson)
          : null,
      highDemandMaterials:
          (json['highDemandMaterials'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(SupplierDashboardMaterialInsight.fromJson)
              .toList(),
    );
  }
}
