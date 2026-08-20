import '../../learning_hub/domain/models/learning_project.dart';
import '../../material_discovery/domain/discovery_material.dart';

class LandingPublicStats {
  const LandingPublicStats({
    required this.availableMaterialsCount,
    required this.publishedProjectsCount,
    required this.reusedMaterialsCount,
  });

  final int availableMaterialsCount;
  final int publishedProjectsCount;
  final int reusedMaterialsCount;

  static const empty = LandingPublicStats(
    availableMaterialsCount: 0,
    publishedProjectsCount: 0,
    reusedMaterialsCount: 0,
  );

  factory LandingPublicStats.fromJson(Map<String, dynamic> json) {
    return LandingPublicStats(
      availableMaterialsCount: _intFrom(json['availableMaterialsCount']),
      publishedProjectsCount: _intFrom(json['publishedProjectsCount']),
      reusedMaterialsCount: _intFrom(json['reusedMaterialsCount']),
    );
  }

  static int _intFrom(Object? value) {
    if (value is int) {
      return value;
    }
    if (value is num) {
      return value.toInt();
    }
    return int.tryParse('$value') ?? 0;
  }
}

class LandingCommunityMember {
  const LandingCommunityMember({required this.displayName, this.avatarUrl});

  final String displayName;
  final String? avatarUrl;

  factory LandingCommunityMember.fromJson(Map<String, dynamic> json) {
    final displayName = '${json['displayName'] ?? ''}'.trim();
    final avatarUrl = '${json['avatarUrl'] ?? ''}'.trim();

    return LandingCommunityMember(
      displayName: displayName,
      avatarUrl: avatarUrl.isEmpty ? null : avatarUrl,
    );
  }
}

class LandingPublicContent {
  const LandingPublicContent({
    required this.stats,
    required this.materials,
    required this.projects,
    this.communityMembers = const [],
  });

  final LandingPublicStats stats;
  final List<DiscoveryMaterial> materials;
  final List<LearningProject> projects;
  final List<LandingCommunityMember> communityMembers;

  static const empty = LandingPublicContent(
    stats: LandingPublicStats.empty,
    materials: [],
    projects: [],
    communityMembers: [],
  );

  bool get hasMaterials => materials.isNotEmpty;
  bool get hasProjects => projects.isNotEmpty;
}

abstract class LandingPublicRepository {
  Future<LandingPublicContent> fetchLanding();
}
