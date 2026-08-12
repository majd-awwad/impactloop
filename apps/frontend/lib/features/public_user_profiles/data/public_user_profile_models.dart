import '../../learning_hub/domain/learning_projects_result.dart';

class PublicUserSupplierSummary {
  const PublicUserSupplierSummary({
    required this.id,
    required this.displayName,
    required this.isVerified,
    required this.availableMaterialsCount,
    this.avatarUrl,
  });

  final String id;
  final String displayName;
  final String? avatarUrl;
  final bool isVerified;
  final int availableMaterialsCount;

  factory PublicUserSupplierSummary.fromJson(Map<String, dynamic> json) =>
      PublicUserSupplierSummary(
        id: json['id']?.toString() ?? '',
        displayName: json['displayName']?.toString() ?? '',
        avatarUrl: json['avatarUrl']?.toString(),
        isVerified: json['isVerified'] == true,
        availableMaterialsCount:
            (json['availableMaterialsCount'] as num?)?.toInt() ?? 0,
      );
}

class PublicUserProfile {
  const PublicUserProfile({
    required this.id,
    required this.displayName,
    required this.publicRoles,
    required this.publishedProjectsCount,
    this.avatarUrl,
    this.supplier,
  });

  final String id;
  final String displayName;
  final String? avatarUrl;
  final List<String> publicRoles;
  final int publishedProjectsCount;
  final PublicUserSupplierSummary? supplier;

  factory PublicUserProfile.fromJson(Map<String, dynamic> json) {
    final supplierJson = json['supplier'];
    return PublicUserProfile(
      id: json['id']?.toString() ?? '',
      displayName: json['displayName']?.toString() ?? '',
      avatarUrl: json['avatarUrl']?.toString(),
      publicRoles:
          (json['publicRoles'] as List?)
              ?.map((role) => role.toString())
              .toList(growable: false) ??
          const [],
      publishedProjectsCount:
          (json['publishedProjectsCount'] as num?)?.toInt() ?? 0,
      supplier: supplierJson is Map
          ? PublicUserSupplierSummary.fromJson(
              Map<String, dynamic>.from(supplierJson),
            )
          : null,
    );
  }
}

typedef PublicUserProfileBundle = ({
  PublicUserProfile profile,
  LearningProjectsResult projects,
});
