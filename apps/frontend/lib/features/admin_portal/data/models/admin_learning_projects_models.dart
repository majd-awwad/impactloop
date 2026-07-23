class AdminLearningProjectsSummary {
  const AdminLearningProjectsSummary({
    required this.total,
    required this.pendingReview,
    required this.published,
    required this.changesRequested,
    required this.rejectedHidden,
  });

  final int total;
  final int pendingReview;
  final int published;
  final int changesRequested;
  final int rejectedHidden;

  factory AdminLearningProjectsSummary.fromJson(Map<String, dynamic> json) {
    return AdminLearningProjectsSummary(
      total: (json['total'] as num?)?.toInt() ?? 0,
      pendingReview: (json['pendingReview'] as num?)?.toInt() ?? 0,
      published: (json['published'] as num?)?.toInt() ?? 0,
      changesRequested: (json['changesRequested'] as num?)?.toInt() ?? 0,
      rejectedHidden: (json['rejectedHidden'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminLearningProjectCategory {
  const AdminLearningProjectCategory({
    required this.id,
    required this.nameEn,
    required this.nameAr,
  });

  final String id;
  final String nameEn;
  final String nameAr;

  factory AdminLearningProjectCategory.fromJson(Map<String, dynamic> json) {
    return AdminLearningProjectCategory(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
    );
  }
}

class AdminLearningProjectAuthor {
  const AdminLearningProjectAuthor({
    required this.id,
    required this.displayName,
    required this.email,
    this.primaryRole,
  });

  final String id;
  final String displayName;
  final String email;
  final String? primaryRole;

  factory AdminLearningProjectAuthor.fromJson(Map<String, dynamic> json) {
    return AdminLearningProjectAuthor(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      primaryRole: json['primaryRole'] as String?,
    );
  }
}

class AdminLearningProjectReviewer {
  const AdminLearningProjectReviewer({
    required this.id,
    required this.displayName,
    required this.email,
  });

  final String id;
  final String displayName;
  final String email;

  factory AdminLearningProjectReviewer.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const AdminLearningProjectReviewer(
        id: '',
        displayName: '',
        email: '',
      );
    }
    return AdminLearningProjectReviewer(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
    );
  }
}

class AdminLearningProjectListItem {
  const AdminLearningProjectListItem({
    required this.id,
    required this.title,
    required this.shortDescription,
    this.coverImageUrl,
    required this.status,
    required this.difficulty,
    required this.category,
    required this.author,
    required this.componentsCount,
    required this.stepsCount,
    required this.createdAt,
    this.submittedAt,
    this.reviewedAt,
  });

  final String id;
  final String title;
  final String shortDescription;
  final String? coverImageUrl;
  final String status;
  final String difficulty;
  final AdminLearningProjectCategory category;
  final AdminLearningProjectAuthor author;
  final int componentsCount;
  final int stepsCount;
  final String createdAt;
  final String? submittedAt;
  final String? reviewedAt;

  factory AdminLearningProjectListItem.fromJson(Map<String, dynamic> json) {
    return AdminLearningProjectListItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      shortDescription: json['shortDescription'] as String? ?? '',
      coverImageUrl: json['coverImageUrl'] as String?,
      status: json['status'] as String? ?? '',
      difficulty: json['difficulty'] as String? ?? '',
      category: AdminLearningProjectCategory.fromJson(
        json['category'] as Map<String, dynamic>? ?? const {},
      ),
      author: AdminLearningProjectAuthor.fromJson(
        json['author'] as Map<String, dynamic>? ?? const {},
      ),
      componentsCount: (json['componentsCount'] as num?)?.toInt() ?? 0,
      stepsCount: (json['stepsCount'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] as String? ?? '',
      submittedAt: json['submittedAt'] as String?,
      reviewedAt: json['reviewedAt'] as String?,
    );
  }
}

class AdminLearningProjectAllowedActions {
  const AdminLearningProjectAllowedActions({
    required this.canApprove,
    required this.canRequestChanges,
    required this.canReject,
    required this.canHide,
    required this.canRestore,
    required this.canArchive,
    this.canEditComponents = false,
  });

  final bool canApprove;
  final bool canRequestChanges;
  final bool canReject;
  final bool canHide;
  final bool canRestore;
  final bool canArchive;
  final bool canEditComponents;

  factory AdminLearningProjectAllowedActions.fromJson(
    Map<String, dynamic>? json,
  ) {
    if (json == null) {
      return const AdminLearningProjectAllowedActions(
        canApprove: false,
        canRequestChanges: false,
        canReject: false,
        canHide: false,
        canRestore: false,
        canArchive: false,
      );
    }
    return AdminLearningProjectAllowedActions(
      canApprove: json['canApprove'] as bool? ?? false,
      canRequestChanges: json['canRequestChanges'] as bool? ?? false,
      canReject: json['canReject'] as bool? ?? false,
      canHide: json['canHide'] as bool? ?? false,
      canRestore: json['canRestore'] as bool? ?? false,
      canArchive: json['canArchive'] as bool? ?? false,
      canEditComponents: json['canEditComponents'] as bool? ?? false,
    );
  }
}

class AdminComponentQualityIssue {
  const AdminComponentQualityIssue({
    required this.code,
    required this.message,
    required this.severity,
    this.componentId,
  });

  final String code;
  final String message;
  final String severity;
  final String? componentId;

  bool get isHard => severity == 'hard';

  factory AdminComponentQualityIssue.fromJson(Map<String, dynamic> json) {
    return AdminComponentQualityIssue(
      code: json['code'] as String? ?? '',
      message: json['message'] as String? ?? '',
      severity: json['severity'] as String? ?? 'soft',
      componentId: json['componentId'] as String?,
    );
  }
}

class AdminComponentItemQuality {
  const AdminComponentItemQuality({
    this.hardIssues = const [],
    this.softWarnings = const [],
  });

  final List<AdminComponentQualityIssue> hardIssues;
  final List<AdminComponentQualityIssue> softWarnings;

  factory AdminComponentItemQuality.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const AdminComponentItemQuality();
    }

    return AdminComponentItemQuality(
      hardIssues: (json['hardIssues'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminComponentQualityIssue.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      softWarnings: (json['softWarnings'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminComponentQualityIssue.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
    );
  }
}

class AdminLearningProjectComponentQuality {
  const AdminLearningProjectComponentQuality({
    this.hardIssues = const [],
    this.softWarnings = const [],
    this.canApprove = true,
  });

  final List<AdminComponentQualityIssue> hardIssues;
  final List<AdminComponentQualityIssue> softWarnings;
  final bool canApprove;

  factory AdminLearningProjectComponentQuality.fromJson(
    Map<String, dynamic>? json,
  ) {
    if (json == null) {
      return const AdminLearningProjectComponentQuality();
    }

    return AdminLearningProjectComponentQuality(
      hardIssues: (json['hardIssues'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminComponentQualityIssue.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      softWarnings: (json['softWarnings'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminComponentQualityIssue.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      canApprove: json['canApprove'] as bool? ?? true,
    );
  }
}

bool adminApproveBlockedByComponentQuality(
  AdminLearningProjectComponentQuality quality,
) => !quality.canApprove;

bool adminApproveNeedsSoftWarningConfirmation(
  AdminLearningProjectComponentQuality quality,
) => quality.canApprove && quality.softWarnings.isNotEmpty;

class AdminLearningProjectImage {
  const AdminLearningProjectImage({
    required this.id,
    required this.imageUrl,
    required this.sortOrder,
  });

  final String id;
  final String imageUrl;
  final int sortOrder;

  factory AdminLearningProjectImage.fromJson(Map<String, dynamic> json) {
    return AdminLearningProjectImage(
      id: json['id'] as String? ?? '',
      imageUrl: json['imageUrl'] as String? ?? '',
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminLearningProjectComponent {
  const AdminLearningProjectComponent({
    required this.id,
    required this.name,
    required this.materialType,
    required this.quantity,
    required this.unit,
    required this.componentRole,
    required this.isRequired,
    this.canBeSubstituted = false,
    this.categoryId,
    this.category,
    this.searchKeywords = const [],
    this.alternativeKeywords = const [],
    this.notes,
    this.providedByUser = false,
    this.confirmedByUser = false,
    this.reviewStatus = 'PENDING_REVIEW',
    this.quality = const AdminComponentItemQuality(),
  });

  final String id;
  final String name;
  final String materialType;
  final double quantity;
  final String unit;
  final String componentRole;
  final bool isRequired;
  final bool canBeSubstituted;
  final String? categoryId;
  final AdminLearningProjectCategory? category;
  final List<String> searchKeywords;
  final List<String> alternativeKeywords;
  final String? notes;
  final bool providedByUser;
  final bool confirmedByUser;
  final String reviewStatus;
  final AdminComponentItemQuality quality;

  factory AdminLearningProjectComponent.fromJson(Map<String, dynamic> json) {
    final keywords = json['searchKeywords'];
    final alternativeKeywords = json['alternativeKeywords'];
    return AdminLearningProjectComponent(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      materialType: json['materialType'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? '',
      componentRole: json['componentRole'] as String? ?? '',
      isRequired: json['isRequired'] as bool? ?? true,
      canBeSubstituted: json['canBeSubstituted'] as bool? ?? false,
      categoryId: json['categoryId'] as String?,
      category: json['category'] is Map
          ? AdminLearningProjectCategory.fromJson(
              Map<String, dynamic>.from(json['category'] as Map),
            )
          : null,
      searchKeywords: keywords is List
          ? keywords.whereType<String>().toList(growable: false)
          : const [],
      alternativeKeywords: alternativeKeywords is List
          ? alternativeKeywords.whereType<String>().toList(growable: false)
          : const [],
      notes: json['notes'] as String?,
      providedByUser: json['providedByUser'] as bool? ?? false,
      confirmedByUser: json['confirmedByUser'] as bool? ?? false,
      reviewStatus: json['reviewStatus'] as String? ?? 'PENDING_REVIEW',
      quality: AdminComponentItemQuality.fromJson(
        json['quality'] as Map<String, dynamic>?,
      ),
    );
  }
}

class AdminLearningProjectStep {
  const AdminLearningProjectStep({
    required this.id,
    required this.stepNumber,
    required this.title,
    required this.description,
    this.imageUrl,
  });

  final String id;
  final int stepNumber;
  final String title;
  final String description;
  final String? imageUrl;

  factory AdminLearningProjectStep.fromJson(Map<String, dynamic> json) {
    return AdminLearningProjectStep(
      id: json['id'] as String? ?? '',
      stepNumber: (json['stepNumber'] as num?)?.toInt() ?? 0,
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      imageUrl: json['imageUrl'] as String?,
    );
  }
}

class AdminLearningProjectLink {
  const AdminLearningProjectLink({
    required this.id,
    required this.linkType,
    required this.url,
    this.title,
    this.sourceName,
  });

  final String id;
  final String linkType;
  final String url;
  final String? title;
  final String? sourceName;

  factory AdminLearningProjectLink.fromJson(Map<String, dynamic> json) {
    return AdminLearningProjectLink(
      id: json['id'] as String? ?? '',
      linkType: json['linkType'] as String? ?? '',
      url: json['url'] as String? ?? '',
      title: json['title'] as String?,
      sourceName: json['sourceName'] as String?,
    );
  }
}

class AdminLearningProjectDetail {
  const AdminLearningProjectDetail({
    required this.id,
    required this.title,
    required this.shortDescription,
    required this.description,
    required this.status,
    required this.difficulty,
    this.estimatedDurationMinutes,
    this.coverImageUrl,
    required this.category,
    required this.author,
    required this.createdAt,
    required this.updatedAt,
    this.submittedAt,
    this.reviewedAt,
    this.reviewNote,
    this.rejectionReason,
    this.changesRequestedReason,
    this.hiddenAt,
    this.hiddenReason,
    this.archivedAt,
    this.archivedReason,
    required this.reviewedBy,
    required this.images,
    required this.requiredComponents,
    required this.steps,
    required this.links,
    required this.tags,
    required this.allowedActions,
    this.componentQuality = const AdminLearningProjectComponentQuality(),
  });

  final String id;
  final String title;
  final String shortDescription;
  final String description;
  final String status;
  final String difficulty;
  final int? estimatedDurationMinutes;
  final String? coverImageUrl;
  final AdminLearningProjectCategory category;
  final AdminLearningProjectAuthor author;
  final String createdAt;
  final String updatedAt;
  final String? submittedAt;
  final String? reviewedAt;
  final String? reviewNote;
  final String? rejectionReason;
  final String? changesRequestedReason;
  final String? hiddenAt;
  final String? hiddenReason;
  final String? archivedAt;
  final String? archivedReason;
  final AdminLearningProjectReviewer reviewedBy;
  final List<AdminLearningProjectImage> images;
  final List<AdminLearningProjectComponent> requiredComponents;
  final List<AdminLearningProjectStep> steps;
  final List<AdminLearningProjectLink> links;
  final List<String> tags;
  final AdminLearningProjectAllowedActions allowedActions;
  final AdminLearningProjectComponentQuality componentQuality;

  factory AdminLearningProjectDetail.fromJson(Map<String, dynamic> json) {
    return AdminLearningProjectDetail(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      shortDescription: json['shortDescription'] as String? ?? '',
      description: json['description'] as String? ?? '',
      status: json['status'] as String? ?? '',
      difficulty: json['difficulty'] as String? ?? '',
      estimatedDurationMinutes: (json['estimatedDurationMinutes'] as num?)
          ?.toInt(),
      coverImageUrl: json['coverImageUrl'] as String?,
      category: AdminLearningProjectCategory.fromJson(
        json['category'] as Map<String, dynamic>? ?? const {},
      ),
      author: AdminLearningProjectAuthor.fromJson(
        json['author'] as Map<String, dynamic>? ?? const {},
      ),
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
      submittedAt: json['submittedAt'] as String?,
      reviewedAt: json['reviewedAt'] as String?,
      reviewNote: json['reviewNote'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      changesRequestedReason: json['changesRequestedReason'] as String?,
      hiddenAt: json['hiddenAt'] as String?,
      hiddenReason: json['hiddenReason'] as String?,
      archivedAt: json['archivedAt'] as String?,
      archivedReason: json['archivedReason'] as String?,
      reviewedBy: AdminLearningProjectReviewer.fromJson(
        json['reviewedBy'] as Map<String, dynamic>?,
      ),
      images: (json['images'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminLearningProjectImage.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      requiredComponents:
          (json['requiredComponents'] as List<dynamic>? ?? const [])
              .whereType<Map>()
              .map(
                (item) => AdminLearningProjectComponent.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(),
      steps: (json['steps'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminLearningProjectStep.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      links: (json['links'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminLearningProjectLink.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      tags: (json['tags'] as List<dynamic>? ?? const [])
          .map((tag) => tag.toString())
          .toList(),
      allowedActions: AdminLearningProjectAllowedActions.fromJson(
        json['allowedActions'] as Map<String, dynamic>?,
      ),
      componentQuality: AdminLearningProjectComponentQuality.fromJson(
        json['componentQuality'] as Map<String, dynamic>?,
      ),
    );
  }
}

class AdminLearningProjectsFilterOptions {
  const AdminLearningProjectsFilterOptions({
    required this.statuses,
    required this.categories,
    required this.difficulties,
  });

  final List<String> statuses;
  final List<AdminLearningProjectCategory> categories;
  final List<String> difficulties;

  factory AdminLearningProjectsFilterOptions.fromJson(
    Map<String, dynamic> json,
  ) {
    return AdminLearningProjectsFilterOptions(
      statuses: (json['statuses'] as List<dynamic>? ?? const [])
          .map((value) => value.toString())
          .toList(),
      categories: (json['categories'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminLearningProjectCategory.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      difficulties: (json['difficulties'] as List<dynamic>? ?? const [])
          .map((value) => value.toString())
          .toList(),
    );
  }
}

class AdminLearningProjectsPagination {
  const AdminLearningProjectsPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory AdminLearningProjectsPagination.fromJson(Map<String, dynamic> json) {
    return AdminLearningProjectsPagination(
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 20,
      total: (json['total'] as num?)?.toInt() ?? 0,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}

class AdminLearningProjectsListResponse {
  const AdminLearningProjectsListResponse({
    required this.summary,
    required this.items,
    required this.pagination,
    required this.filterOptions,
  });

  final AdminLearningProjectsSummary summary;
  final List<AdminLearningProjectListItem> items;
  final AdminLearningProjectsPagination pagination;
  final AdminLearningProjectsFilterOptions filterOptions;

  factory AdminLearningProjectsListResponse.fromJson(
    Map<String, dynamic> json,
  ) {
    return AdminLearningProjectsListResponse(
      summary: AdminLearningProjectsSummary.fromJson(
        json['summary'] as Map<String, dynamic>? ?? const {},
      ),
      items: (json['items'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminLearningProjectListItem.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      pagination: AdminLearningProjectsPagination.fromJson(
        json['pagination'] as Map<String, dynamic>? ?? const {},
      ),
      filterOptions: AdminLearningProjectsFilterOptions.fromJson(
        json['filterOptions'] as Map<String, dynamic>? ?? const {},
      ),
    );
  }
}
