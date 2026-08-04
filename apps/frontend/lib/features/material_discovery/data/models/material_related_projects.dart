class MaterialRelatedProjectsPage {
  const MaterialRelatedProjectsPage({
    required this.materialId,
    required this.items,
    required this.pagination,
  });

  final String materialId;
  final List<MaterialRelatedProjectItem> items;
  final MaterialRelatedProjectsPagination pagination;

  factory MaterialRelatedProjectsPage.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'];
    final paginationJson = json['pagination'];

    return MaterialRelatedProjectsPage(
      materialId: json['materialId'] as String? ?? '',
      items: itemsJson is List
          ? itemsJson
                .whereType<Map<String, dynamic>>()
                .map(MaterialRelatedProjectItem.fromJson)
                .toList(growable: false)
          : const [],
      pagination: paginationJson is Map<String, dynamic>
          ? MaterialRelatedProjectsPagination.fromJson(paginationJson)
          : const MaterialRelatedProjectsPagination(
              page: 1,
              limit: 4,
              total: 0,
              totalPages: 0,
            ),
    );
  }
}

class MaterialRelatedProjectsPagination {
  const MaterialRelatedProjectsPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory MaterialRelatedProjectsPagination.fromJson(
    Map<String, dynamic> json,
  ) {
    return MaterialRelatedProjectsPagination(
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 4,
      total: (json['total'] as num?)?.toInt() ?? 0,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 0,
    );
  }
}

class MaterialRelatedProjectItem {
  const MaterialRelatedProjectItem({
    required this.project,
    required this.bestMatchedComponent,
    required this.match,
    this.learnerContext,
  });

  final MaterialRelatedProjectSummary project;
  final MaterialRelatedProjectComponent bestMatchedComponent;
  final MaterialRelatedProjectMatch match;
  final MaterialRelatedProjectLearnerContext? learnerContext;

  String get projectId => project.id;

  factory MaterialRelatedProjectItem.fromJson(Map<String, dynamic> json) {
    final projectJson = json['project'];
    final componentJson = json['bestMatchedComponent'];
    final matchJson = json['match'];
    final learnerContextJson = json['learnerContext'];

    return MaterialRelatedProjectItem(
      project: projectJson is Map<String, dynamic>
          ? MaterialRelatedProjectSummary.fromJson(projectJson)
          : const MaterialRelatedProjectSummary(
              id: '',
              title: '',
              shortDescription: null,
              coverImageUrl: null,
              category: MaterialRelatedProjectCategory(
                id: '',
                nameEn: '',
                nameAr: '',
              ),
              difficulty: 'BEGINNER',
              estimatedDurationMinutes: null,
              likesCount: 0,
              requiredMaterialComponentCount: 0,
            ),
      bestMatchedComponent: componentJson is Map<String, dynamic>
          ? MaterialRelatedProjectComponent.fromJson(componentJson)
          : const MaterialRelatedProjectComponent(
              componentId: '',
              componentName: '',
              componentRole: 'REQUIRED_MATERIAL',
              requiredQuantity: 1,
              unit: 'piece',
              canBeSubstituted: false,
            ),
      match: matchJson is Map<String, dynamic>
          ? MaterialRelatedProjectMatch.fromJson(matchJson)
          : const MaterialRelatedProjectMatch(
              matchType: MaterialRelatedProjectMatchType.compatible,
              compatibilityScore: 0,
              matchReasons: [],
              additionalMatchedComponentsCount: 0,
            ),
      learnerContext: learnerContextJson is Map<String, dynamic>
          ? MaterialRelatedProjectLearnerContext.fromJson(learnerContextJson)
          : null,
    );
  }
}

class MaterialRelatedProjectSummary {
  const MaterialRelatedProjectSummary({
    required this.id,
    required this.title,
    required this.shortDescription,
    required this.coverImageUrl,
    required this.category,
    required this.difficulty,
    required this.estimatedDurationMinutes,
    required this.likesCount,
    required this.requiredMaterialComponentCount,
  });

  final String id;
  final String title;
  final String? shortDescription;
  final String? coverImageUrl;
  final MaterialRelatedProjectCategory category;
  final String difficulty;
  final int? estimatedDurationMinutes;
  final int likesCount;
  final int requiredMaterialComponentCount;

  factory MaterialRelatedProjectSummary.fromJson(Map<String, dynamic> json) {
    final categoryJson = json['category'];

    return MaterialRelatedProjectSummary(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      shortDescription: json['shortDescription'] as String?,
      coverImageUrl: json['coverImageUrl'] as String?,
      category: categoryJson is Map<String, dynamic>
          ? MaterialRelatedProjectCategory.fromJson(categoryJson)
          : const MaterialRelatedProjectCategory(
              id: '',
              nameEn: '',
              nameAr: '',
            ),
      difficulty: json['difficulty'] as String? ?? 'BEGINNER',
      estimatedDurationMinutes: (json['estimatedDurationMinutes'] as num?)
          ?.toInt(),
      likesCount: (json['likesCount'] as num?)?.toInt() ?? 0,
      requiredMaterialComponentCount:
          (json['requiredMaterialComponentCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class MaterialRelatedProjectCategory {
  const MaterialRelatedProjectCategory({
    required this.id,
    required this.nameEn,
    required this.nameAr,
  });

  final String id;
  final String nameEn;
  final String nameAr;

  factory MaterialRelatedProjectCategory.fromJson(Map<String, dynamic> json) {
    return MaterialRelatedProjectCategory(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
    );
  }
}

class MaterialRelatedProjectComponent {
  const MaterialRelatedProjectComponent({
    required this.componentId,
    required this.componentName,
    required this.componentRole,
    required this.requiredQuantity,
    required this.unit,
    required this.canBeSubstituted,
  });

  final String componentId;
  final String componentName;
  final String componentRole;
  final num requiredQuantity;
  final String unit;
  final bool canBeSubstituted;

  factory MaterialRelatedProjectComponent.fromJson(Map<String, dynamic> json) {
    return MaterialRelatedProjectComponent(
      componentId: json['componentId'] as String? ?? '',
      componentName: json['componentName'] as String? ?? '',
      componentRole: json['componentRole'] as String? ?? 'REQUIRED_MATERIAL',
      requiredQuantity: json['requiredQuantity'] as num? ?? 1,
      unit: json['unit'] as String? ?? 'piece',
      canBeSubstituted: json['canBeSubstituted'] as bool? ?? false,
    );
  }
}

enum MaterialRelatedProjectMatchType {
  exact,
  compatible,
  alternative;

  static MaterialRelatedProjectMatchType parse(String? raw) {
    switch (raw?.toUpperCase()) {
      case 'EXACT':
        return MaterialRelatedProjectMatchType.exact;
      case 'ALTERNATIVE':
        return MaterialRelatedProjectMatchType.alternative;
      case 'COMPATIBLE':
      default:
        return MaterialRelatedProjectMatchType.compatible;
    }
  }
}

class MaterialRelatedProjectMatch {
  const MaterialRelatedProjectMatch({
    required this.matchType,
    required this.compatibilityScore,
    required this.matchReasons,
    required this.additionalMatchedComponentsCount,
  });

  final MaterialRelatedProjectMatchType matchType;
  final int compatibilityScore;
  final List<String> matchReasons;
  final int additionalMatchedComponentsCount;

  factory MaterialRelatedProjectMatch.fromJson(Map<String, dynamic> json) {
    final reasonsJson = json['matchReasons'];

    return MaterialRelatedProjectMatch(
      matchType: MaterialRelatedProjectMatchType.parse(
        json['matchType'] as String?,
      ),
      compatibilityScore: (json['compatibilityScore'] as num?)?.toInt() ?? 0,
      matchReasons: reasonsJson is List
          ? reasonsJson.whereType<String>().toList(growable: false)
          : const [],
      additionalMatchedComponentsCount:
          (json['additionalMatchedComponentsCount'] as num?)?.toInt() ?? 0,
    );
  }
}

enum MaterialRelatedProjectLearnerAction {
  startBuild,
  continueBuild;

  static MaterialRelatedProjectLearnerAction? parse(String? raw) {
    switch (raw?.toUpperCase()) {
      case 'START_BUILD':
        return MaterialRelatedProjectLearnerAction.startBuild;
      case 'CONTINUE_BUILD':
        return MaterialRelatedProjectLearnerAction.continueBuild;
      default:
        return null;
    }
  }
}

class MaterialRelatedProjectLearnerContext {
  const MaterialRelatedProjectLearnerContext({
    required this.hasActiveBuild,
    required this.buildId,
    required this.buildStatus,
    required this.action,
  });

  final bool hasActiveBuild;
  final String? buildId;
  final String? buildStatus;
  final MaterialRelatedProjectLearnerAction? action;

  factory MaterialRelatedProjectLearnerContext.fromJson(
    Map<String, dynamic> json,
  ) {
    return MaterialRelatedProjectLearnerContext(
      hasActiveBuild: json['hasActiveBuild'] as bool? ?? false,
      buildId: json['buildId'] as String?,
      buildStatus: json['buildStatus'] as String?,
      action: MaterialRelatedProjectLearnerAction.parse(
        json['action'] as String?,
      ),
    );
  }
}
