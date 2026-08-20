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
    this.learnerType,
    this.skillLevel,
    this.bio,
    this.interests = const [],
    this.publishedProjectsLikesCount = 0,
    this.supplier,
  });

  final String id;
  final String displayName;
  final String? avatarUrl;
  final List<String> publicRoles;
  final String? learnerType;
  final String? skillLevel;
  final String? bio;
  final List<String> interests;
  final int publishedProjectsCount;
  final int publishedProjectsLikesCount;
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
      learnerType: _nonEmptyString(json['learnerType']),
      skillLevel: _nonEmptyString(json['skillLevel']),
      bio: _nonEmptyString(json['bio']),
      interests: _uniqueInterests(json['interests']),
      publishedProjectsCount:
          (json['publishedProjectsCount'] as num?)?.toInt() ?? 0,
      publishedProjectsLikesCount:
          (json['publishedProjectsLikesCount'] as num?)?.toInt() ?? 0,
      supplier: supplierJson is Map
          ? PublicUserSupplierSummary.fromJson(
              Map<String, dynamic>.from(supplierJson),
            )
          : null,
    );
  }
}

String? _nonEmptyString(Object? value) {
  final trimmed = value?.toString().trim() ?? '';
  return trimmed.isEmpty ? null : trimmed;
}

List<String> _uniqueInterests(Object? value) {
  if (value is! List) {
    return const [];
  }
  final seen = <String>{};
  final interests = <String>[];
  for (final item in value) {
    final trimmed = item.toString().trim();
    if (trimmed.isEmpty || !seen.add(trimmed.toLowerCase())) {
      continue;
    }
    interests.add(trimmed);
  }
  return List.unmodifiable(interests);
}

typedef PublicUserProfileBundle = ({
  PublicUserProfile profile,
  LearningProjectsResult projects,
});
