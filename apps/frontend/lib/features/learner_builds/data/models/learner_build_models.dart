import '../../../learning_hub/domain/models/project_build.dart';

enum LearnerBuildLearningStatus {
  notAvailable,
  notStarted,
  inProgress,
  reviewRecommended,
  completed,
}

class LearnerBuildLearningProgressCounts {
  const LearnerBuildLearningProgressCounts({
    required this.handled,
    required this.total,
  });

  final int handled;
  final int total;

  factory LearnerBuildLearningProgressCounts.fromJson(
    Map<String, dynamic> json,
  ) {
    return LearnerBuildLearningProgressCounts(
      handled: (json['handled'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

class LearnerBuildLearningListSummary {
  const LearnerBuildLearningListSummary({
    required this.status,
    required this.hasLearningGoal,
    required this.startCheck,
    required this.stepChecks,
    required this.finalCheck,
    required this.understoodConceptCount,
    required this.reviewConceptCount,
    this.goalOutcome,
    this.hasReflection = false,
  });

  final LearnerBuildLearningStatus status;
  final bool hasLearningGoal;
  final LearnerBuildLearningProgressCounts startCheck;
  final LearnerBuildLearningProgressCounts stepChecks;
  final LearnerBuildLearningProgressCounts finalCheck;
  final int understoodConceptCount;
  final int reviewConceptCount;
  final String? goalOutcome;
  final bool hasReflection;

  int get checksHandled =>
      startCheck.handled + stepChecks.handled + finalCheck.handled;

  int get checksTotal => startCheck.total + stepChecks.total + finalCheck.total;

  factory LearnerBuildLearningListSummary.fromJson(Map<String, dynamic> json) {
    LearnerBuildLearningProgressCounts progress(String key) {
      final raw = json[key];
      if (raw is Map) {
        return LearnerBuildLearningProgressCounts.fromJson(
          Map<String, dynamic>.from(raw),
        );
      }
      return const LearnerBuildLearningProgressCounts(handled: 0, total: 0);
    }

    return LearnerBuildLearningListSummary(
      status: _mapLearningStatus(json['status']),
      hasLearningGoal: json['hasLearningGoal'] == true,
      startCheck: progress('startCheck'),
      stepChecks: progress('stepChecks'),
      finalCheck: progress('finalCheck'),
      understoodConceptCount:
          (json['understoodConceptCount'] as num?)?.toInt() ?? 0,
      reviewConceptCount: (json['reviewConceptCount'] as num?)?.toInt() ?? 0,
      goalOutcome: json['goalOutcome'] as String?,
      hasReflection: json['hasReflection'] == true,
    );
  }

  static LearnerBuildLearningStatus _mapLearningStatus(Object? raw) {
    return switch ((raw as String?)?.toUpperCase()) {
      'NOT_STARTED' => LearnerBuildLearningStatus.notStarted,
      'IN_PROGRESS' => LearnerBuildLearningStatus.inProgress,
      'REVIEW_RECOMMENDED' => LearnerBuildLearningStatus.reviewRecommended,
      'COMPLETED' => LearnerBuildLearningStatus.completed,
      _ => LearnerBuildLearningStatus.notAvailable,
    };
  }
}

class PortfolioLearningConcept {
  const PortfolioLearningConcept({
    required this.conceptKey,
    required this.labelEn,
    required this.labelAr,
  });

  final String conceptKey;
  final String labelEn;
  final String labelAr;

  String labelFor(String languageCode) =>
      languageCode == 'ar' ? labelAr : labelEn;

  factory PortfolioLearningConcept.fromJson(Map<String, dynamic> json) {
    return PortfolioLearningConcept(
      conceptKey: json['conceptKey'] as String? ?? '',
      labelEn: json['labelEn'] as String? ?? '',
      labelAr: json['labelAr'] as String? ?? '',
    );
  }
}

class PortfolioLearningStory {
  const PortfolioLearningStory({
    this.goal,
    this.goalOutcome,
    this.confidenceBefore,
    this.confidenceAfter,
    this.reflection,
    this.startCheck,
    this.stepChecks,
    this.finalCheck,
    this.understoodConcepts = const [],
    this.reviewConcepts = const [],
  });

  final String? goal;
  final String? goalOutcome;
  final int? confidenceBefore;
  final int? confidenceAfter;
  final String? reflection;
  final LearnerBuildLearningProgressCounts? startCheck;
  final LearnerBuildLearningProgressCounts? stepChecks;
  final LearnerBuildLearningProgressCounts? finalCheck;
  final List<PortfolioLearningConcept> understoodConcepts;
  final List<PortfolioLearningConcept> reviewConcepts;

  bool get hasMeaningfulContent =>
      (goal != null && goal!.trim().isNotEmpty) ||
      goalOutcome != null ||
      confidenceBefore != null ||
      confidenceAfter != null ||
      (reflection != null && reflection!.trim().isNotEmpty) ||
      understoodConcepts.isNotEmpty ||
      reviewConcepts.isNotEmpty;

  factory PortfolioLearningStory.fromJson(Map<String, dynamic> json) {
    LearnerBuildLearningProgressCounts? progress(String key) {
      final raw = json[key];
      if (raw is! Map) {
        return null;
      }
      return LearnerBuildLearningProgressCounts.fromJson(
        Map<String, dynamic>.from(raw),
      );
    }

    List<PortfolioLearningConcept> concepts(String key) {
      final raw = json[key];
      if (raw is! List) {
        return const [];
      }
      return raw
          .whereType<Map>()
          .map(
            (item) => PortfolioLearningConcept.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(growable: false);
    }

    return PortfolioLearningStory(
      goal: json['goal'] as String?,
      goalOutcome: json['goalOutcome'] as String?,
      confidenceBefore: (json['confidenceBefore'] as num?)?.toInt(),
      confidenceAfter: (json['confidenceAfter'] as num?)?.toInt(),
      reflection: json['reflection'] as String?,
      startCheck: progress('startCheck'),
      stepChecks: progress('stepChecks'),
      finalCheck: progress('finalCheck'),
      understoodConcepts: concepts('understoodConcepts'),
      reviewConcepts: concepts('reviewConcepts'),
    );
  }
}

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
    this.learning,
    this.portfolioLearning,
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
  final LearnerBuildLearningListSummary? learning;
  final PortfolioLearningStory? portfolioLearning;

  factory LearnerBuildListItem.fromJson(
    Map<String, dynamic> json, {
    bool portfolioMode = false,
  }) {
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

    final learningJson = json['learning'];
    LearnerBuildLearningListSummary? learning;
    PortfolioLearningStory? portfolioLearning;
    if (learningJson is Map) {
      final map = Map<String, dynamic>.from(learningJson);
      if (portfolioMode) {
        final story = PortfolioLearningStory.fromJson(map);
        if (story.hasMeaningfulContent) {
          portfolioLearning = story;
        }
      } else if (map.containsKey('status')) {
        learning = LearnerBuildLearningListSummary.fromJson(map);
      }
    }

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
      learning: learning,
      portfolioLearning: portfolioLearning,
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

  factory LearnerBuildListResult.fromJson(
    Map<String, dynamic> json, {
    bool portfolioMode = false,
  }) {
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
                    portfolioMode: portfolioMode,
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
