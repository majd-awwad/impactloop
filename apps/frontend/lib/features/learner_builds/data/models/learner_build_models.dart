import '../../../learning_hub/domain/models/project_build.dart';

class LearnerBuildListProject {
  const LearnerBuildListProject({
    required this.id,
    required this.title,
    required this.shortDescription,
    this.coverImageUrl,
    this.estimatedDurationMinutes,
    this.difficulty,
  });

  final String id;
  final String title;
  final String shortDescription;
  final String? coverImageUrl;
  final int? estimatedDurationMinutes;
  final String? difficulty;

  factory LearnerBuildListProject.fromJson(Map<String, dynamic> json) {
    return LearnerBuildListProject(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? 'Project',
      shortDescription: json['shortDescription'] as String? ?? '',
      coverImageUrl: json['coverImageUrl'] as String?,
      estimatedDurationMinutes:
          (json['estimatedDurationMinutes'] as num?)?.toInt(),
      difficulty: json['difficulty'] as String?,
    );
  }
}

class LearnerBuildListItem {
  const LearnerBuildListItem({
    required this.id,
    required this.projectId,
    required this.attemptNumber,
    required this.status,
    required this.project,
    required this.startedAt,
    required this.updatedAt,
    this.completedAt,
    this.pausedAt,
    this.archivedAt,
    this.itemCount = 0,
    this.stepProgressCount = 0,
    this.completionStoryPreview,
    this.previewPhotoUrl,
    this.impactSummary,
  });

  final String id;
  final String projectId;
  final int attemptNumber;
  final ProjectBuildStatus status;
  final LearnerBuildListProject project;
  final DateTime startedAt;
  final DateTime updatedAt;
  final DateTime? completedAt;
  final DateTime? pausedAt;
  final DateTime? archivedAt;
  final int itemCount;
  final int stepProgressCount;
  final String? completionStoryPreview;
  final String? previewPhotoUrl;
  final ProjectBuildImpactSummary? impactSummary;

  factory LearnerBuildListItem.fromJson(Map<String, dynamic> json) {
    final projectJson = json['project'];
    final project = projectJson is Map
        ? LearnerBuildListProject.fromJson(
            Map<String, dynamic>.from(projectJson),
          )
        : const LearnerBuildListProject(
            id: '',
            title: 'Project',
            shortDescription: '',
          );

    return LearnerBuildListItem(
      id: json['id'] as String? ?? '',
      projectId: json['projectId'] as String? ?? project.id,
      attemptNumber: (json['attemptNumber'] as num?)?.toInt() ?? 1,
      status: _mapStatus(json['status']),
      project: project,
      startedAt: DateTime.parse(json['startedAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      completedAt: json['completedAt'] == null
          ? null
          : DateTime.tryParse(json['completedAt'] as String),
      pausedAt: json['pausedAt'] == null
          ? null
          : DateTime.tryParse(json['pausedAt'] as String),
      archivedAt: json['archivedAt'] == null
          ? null
          : DateTime.tryParse(json['archivedAt'] as String),
      itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
      stepProgressCount: (json['stepProgressCount'] as num?)?.toInt() ?? 0,
      completionStoryPreview: json['completionStoryPreview'] as String?,
      previewPhotoUrl: json['previewPhotoUrl'] as String?,
      impactSummary: _mapImpactSummary(json['impactSummary']),
    );
  }

  static ProjectBuildStatus _mapStatus(Object? raw) {
    return switch ((raw as String?)?.toUpperCase()) {
      'COMPLETED' => ProjectBuildStatus.completed,
      'ARCHIVED' => ProjectBuildStatus.archived,
      'PAUSED' => ProjectBuildStatus.paused,
      _ => ProjectBuildStatus.inProgress,
    };
  }

  static ProjectBuildImpactSummary? _mapImpactSummary(Object? raw) {
    if (raw is! Map) {
      return null;
    }

    final json = Map<String, dynamic>.from(raw);
    final categoriesJson = json['materialCategoriesUsed'];
    final categories = categoriesJson is List
        ? categoriesJson.whereType<String>().toList(growable: false)
        : const <String>[];

    return ProjectBuildImpactSummary(
      projectId: json['projectId'] as String? ?? '',
      projectTitle: json['projectTitle'] as String? ?? '',
      attemptNumber: (json['attemptNumber'] as num?)?.toInt() ?? 1,
      completedAt: json['completedAt'] == null
          ? null
          : DateTime.tryParse(json['completedAt'] as String),
      startedAt: json['startedAt'] == null
          ? null
          : DateTime.tryParse(json['startedAt'] as String),
      elapsedMs: (json['elapsedMs'] as num?)?.toInt(),
      requiredMaterialComponentCount:
          (json['requiredMaterialComponentCount'] as num?)?.toInt() ?? 0,
      readyMaterialComponentCount:
          (json['readyMaterialComponentCount'] as num?)?.toInt() ?? 0,
      alreadyOwnedComponentCount:
          (json['alreadyOwnedComponentCount'] as num?)?.toInt() ?? 0,
      acquiredViaImpactLoopCount:
          (json['acquiredViaImpactLoopCount'] as num?)?.toInt() ?? 0,
      uniqueAcquiredMaterialCount:
          (json['uniqueAcquiredMaterialCount'] as num?)?.toInt() ?? 0,
      completedStepCount: (json['completedStepCount'] as num?)?.toInt() ?? 0,
      totalStepCount: (json['totalStepCount'] as num?)?.toInt() ?? 0,
      materialCategoriesUsed: categories,
    );
  }
}

class LearnerBuildListResult {
  const LearnerBuildListResult({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<LearnerBuildListItem> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory LearnerBuildListResult.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'];
    final pagination = json['pagination'];
    final pageInfo = pagination is Map
        ? Map<String, dynamic>.from(pagination)
        : const <String, dynamic>{};

    return LearnerBuildListResult(
      items: itemsJson is List
          ? itemsJson
                .whereType<Map>()
                .map(
                  (item) => LearnerBuildListItem.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const <LearnerBuildListItem>[],
      page: (pageInfo['page'] as num?)?.toInt() ?? 1,
      limit: (pageInfo['limit'] as num?)?.toInt() ?? 20,
      total: (pageInfo['total'] as num?)?.toInt() ?? 0,
      totalPages: (pageInfo['totalPages'] as num?)?.toInt() ?? 0,
    );
  }
}
