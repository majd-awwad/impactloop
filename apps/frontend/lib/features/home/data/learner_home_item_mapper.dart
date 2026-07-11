import '../../learning_hub/data/learning_hub_api_mapper.dart';
import '../../material_discovery/data/material_discovery_api_mapper.dart';
import '../domain/learner_home_models.dart';

class LearnerHomeItemMapper {
  const LearnerHomeItemMapper._();

  static LearnerHomeItem? fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String? ?? '';
    final score = (json['score'] as num?)?.toInt() ?? 0;
    final reasons = _parseReasons(json['reasons']);

    switch (type) {
      case 'material':
        final materialJson = json['material'];
        if (materialJson is! Map) {
          return null;
        }

        return LearnerHomeMaterialRecommendation(
          score: score,
          reasons: reasons,
          material: MaterialDiscoveryApiMapper.fromJson(
            Map<String, dynamic>.from(materialJson),
          ),
        );
      case 'project':
        final projectJson = json['project'];
        if (projectJson is! Map) {
          return null;
        }

        return LearnerHomeProjectRecommendation(
          score: score,
          reasons: reasons,
          project: LearningHubApiMapper.fromListItemJson(
            Map<String, dynamic>.from(projectJson),
          ),
        );
      case 'continue_project':
        final buildJson = json['build'];
        if (buildJson is! Map) {
          return null;
        }

        final build = Map<String, dynamic>.from(buildJson);
        final projectJson = build['project'];
        final progressJson = build['progress'];
        final project = projectJson is Map
            ? Map<String, dynamic>.from(projectJson)
            : const <String, dynamic>{};
        final progress = progressJson is Map
            ? Map<String, dynamic>.from(progressJson)
            : const <String, dynamic>{};

        return LearnerHomeContinueProjectRecommendation(
          score: score,
          reasons: reasons,
          projectId:
              build['projectId'] as String? ??
              project['id'] as String? ??
              '',
          projectTitle: project['title'] as String? ?? 'Project',
          shortDescription: project['shortDescription'] as String? ?? '',
          coverImageUrl: project['coverImageUrl'] as String?,
          progressPercent: (progress['percent'] as num?)?.toInt() ?? 0,
          readyCount: (progress['ready'] as num?)?.toInt() ?? 0,
          totalCount: (progress['total'] as num?)?.toInt() ?? 0,
        );
      default:
        return null;
    }
  }

  static List<String> _parseReasons(Object? json) {
    if (json is! List) {
      return const [];
    }

    return json
        .whereType<String>()
        .map((reason) => reason.trim())
        .where((reason) => reason.isNotEmpty)
        .toList(growable: false);
  }
}
