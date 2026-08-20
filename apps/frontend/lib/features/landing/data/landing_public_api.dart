import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import '../../learning_hub/data/learning_hub_api_mapper.dart';
import '../../learning_hub/domain/models/learning_project.dart';
import '../../material_discovery/data/material_discovery_api_mapper.dart';
import '../../material_discovery/domain/discovery_material.dart';
import '../domain/landing_public_content.dart';

class ApiLandingPublicRepository implements LandingPublicRepository {
  const ApiLandingPublicRepository(this._client);

  final Dio _client;

  static const _path = '/api/public/landing';

  @override
  Future<LandingPublicContent> fetchLanding() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(_path),
      parseContent,
    );
  }

  static LandingPublicContent parseContent(Map<String, dynamic> json) {
    final statsJson = json['stats'];
    final materialsJson = json['materials'];
    final projectsJson = json['projects'];

    return LandingPublicContent(
      stats: statsJson is Map<String, dynamic>
          ? LandingPublicStats.fromJson(statsJson)
          : LandingPublicStats.empty,
      materials: _mapMaterials(materialsJson),
      projects: _mapProjects(projectsJson),
      communityMembers: _mapCommunityMembers(json['communityMembers']),
    );
  }

  static List<DiscoveryMaterial> _mapMaterials(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map(
          (item) => MaterialDiscoveryApiMapper.fromJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .where((material) => material.status.toUpperCase() == 'AVAILABLE')
        .toList(growable: false);
  }

  static List<LearningProject> _mapProjects(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map(
          (item) => LearningHubApiMapper.fromListItemJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .toList(growable: false);
  }

  static List<LandingCommunityMember> _mapCommunityMembers(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map(
          (item) =>
              LandingCommunityMember.fromJson(Map<String, dynamic>.from(item)),
        )
        .where((member) => member.displayName.isNotEmpty)
        .take(4)
        .toList(growable: false);
  }
}

class FakeLandingPublicRepository implements LandingPublicRepository {
  const FakeLandingPublicRepository({
    this.content = LandingPublicContent.empty,
    this.error,
  });

  final LandingPublicContent content;
  final Object? error;

  @override
  Future<LandingPublicContent> fetchLanding() async {
    if (error != null) {
      throw error!;
    }
    return content;
  }
}
