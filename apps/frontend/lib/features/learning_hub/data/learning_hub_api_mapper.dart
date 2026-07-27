import 'package:flutter/material.dart';

import '../domain/models/learning_project.dart';
import '../domain/models/learning_project_draft_component.dart';
import '../domain/models/learning_project_submission.dart';
import '../domain/models/project_build.dart';

class LearningHubApiMapper {
  const LearningHubApiMapper._();

  static LearningProject fromListItemJson(Map<String, dynamic> json) {
    return _mapProject(json, includeDetailFields: false);
  }

  static LearningProject fromDetailJson(Map<String, dynamic> json) {
    return _mapProject(json, includeDetailFields: true);
  }

  static ProjectBuild fromBuildJson(Map<String, dynamic> json) {
    final projectJson = _asMap(json['project']) ?? const <String, dynamic>{};
    final progressJson = _asMap(json['progress']) ?? const <String, dynamic>{};
    final materialReadinessJson =
        _asMap(json['materialReadiness']) ?? const <String, dynamic>{};
    final stepProgressJson =
        _asMap(json['stepProgress']) ?? const <String, dynamic>{};
    final itemsJson = json['items'];

    return ProjectBuild(
      id: _stringOrFallback(json['id'], fallback: ''),
      projectId: _stringOrFallback(json['projectId'], fallback: ''),
      status: _mapBuildStatus(json['status']),
      startedAt: _dateTimeFromDynamic(json['startedAt']),
      completedAt: _dateTimeFromDynamic(json['completedAt']),
      updatedAt: _dateTimeFromDynamic(json['updatedAt']),
      guideConversationId: _nullableString(json['guideConversationId']),
      project: ProjectBuildProject(
        id: _stringOrFallback(projectJson['id'], fallback: ''),
        title: _stringOrFallback(projectJson['title'], fallback: 'Project'),
        shortDescription: _stringOrFallback(
          projectJson['shortDescription'],
          fallback: '',
        ),
        coverImageUrl: _nullableString(projectJson['coverImageUrl']),
      ),
      progress: ProjectBuildProgress(
        total: _intFromDynamic(progressJson['total']) ?? 0,
        ready:
            _intFromDynamic(progressJson['ready']) ??
            _intFromDynamic(progressJson['handled']) ??
            0,
        percent: _intFromDynamic(progressJson['percent']) ?? 0,
      ),
      materialReadiness: ProjectBuildMaterialReadiness(
        ready: _intFromDynamic(materialReadinessJson['ready']) ?? 0,
        linked: _intFromDynamic(materialReadinessJson['linked']) ?? 0,
        reserved: _intFromDynamic(materialReadinessJson['reserved']) ?? 0,
        missing: _intFromDynamic(materialReadinessJson['missing']) ?? 0,
        total: _intFromDynamic(materialReadinessJson['total']) ??
            (_intFromDynamic(progressJson['total']) ?? 0),
      ),
      stepProgress: _mapBuildStepProgress(stepProgressJson),
      items: itemsJson is List
          ? itemsJson
                .whereType<Map>()
                .map((item) => _mapBuildItem(Map<String, dynamic>.from(item)))
                .toList(growable: false)
          : const <ProjectBuildItem>[],
    );
  }

  static BuildGuideConversationResult fromBuildGuideConversationJson(
    Map<String, dynamic> json,
  ) {
    final conversationJson =
        _asMap(json['conversation']) ?? const <String, dynamic>{};
    final buildContextJson =
        _asMap(json['buildContext']) ?? const <String, dynamic>{};
    final materialReadinessJson =
        _asMap(buildContextJson['materialReadiness']) ??
        const <String, dynamic>{};
    final stepProgressJson =
        _asMap(buildContextJson['stepProgress']) ?? const <String, dynamic>{};
    final currentStepJson = _asMap(buildContextJson['currentStep']);

    return BuildGuideConversationResult(
      conversationId: _stringOrFallback(conversationJson['id'], fallback: ''),
      buildContext: BuildGuideContext(
        buildId: _stringOrFallback(buildContextJson['buildId'], fallback: ''),
        projectId:
            _stringOrFallback(buildContextJson['projectId'], fallback: ''),
        projectTitle:
            _stringOrFallback(buildContextJson['projectTitle'], fallback: ''),
        buildStatus: _mapBuildStatus(buildContextJson['buildStatus']),
        materialReadiness: ProjectBuildMaterialReadiness(
          ready: _intFromDynamic(materialReadinessJson['ready']) ?? 0,
          linked: _intFromDynamic(materialReadinessJson['linked']) ?? 0,
          reserved: _intFromDynamic(materialReadinessJson['reserved']) ?? 0,
          missing: _intFromDynamic(materialReadinessJson['missing']) ?? 0,
          total: _intFromDynamic(materialReadinessJson['total']) ?? 0,
        ),
        currentStep: currentStepJson == null
            ? null
            : ProjectBuildCurrentStep(
                stepId: _stringOrFallback(
                  currentStepJson['stepId'],
                  fallback: '',
                ),
                stepNumber: _intFromDynamic(currentStepJson['stepNumber']) ?? 0,
                title: _stringOrFallback(currentStepJson['title'], fallback: ''),
              ),
        stepProgress: ProjectBuildStepProgressSummary(
          completed: _intFromDynamic(stepProgressJson['completed']) ?? 0,
          total: _intFromDynamic(stepProgressJson['total']) ?? 0,
          percent: _intFromDynamic(stepProgressJson['percent']) ?? 0,
        ),
      ),
    );
  }

  static ProjectBuildStepProgress _mapBuildStepProgress(
    Map<String, dynamic> json,
  ) {
    final stepsJson = json['steps'];
    final currentStepJson = _asMap(json['currentStep']);

    return ProjectBuildStepProgress(
      completed: _intFromDynamic(json['completed']) ?? 0,
      total: _intFromDynamic(json['total']) ?? 0,
      percent: _intFromDynamic(json['percent']) ?? 0,
      nextAction: _mapBuildNextAction(json['nextAction']),
      currentStep: currentStepJson == null
          ? null
          : ProjectBuildCurrentStep(
              stepId: _stringOrFallback(currentStepJson['stepId'], fallback: ''),
              stepNumber: _intFromDynamic(currentStepJson['stepNumber']) ?? 0,
              title: _stringOrFallback(currentStepJson['title'], fallback: ''),
            ),
      steps: stepsJson is List
          ? stepsJson
                .whereType<Map>()
                .map(
                  (step) => _mapBuildStepView(Map<String, dynamic>.from(step)),
                )
                .toList(growable: false)
          : const <ProjectBuildStepView>[],
    );
  }

  static ProjectBuildStepView _mapBuildStepView(Map<String, dynamic> json) {
    return ProjectBuildStepView(
      stepId: _stringOrFallback(json['stepId'], fallback: ''),
      stepNumber: _intFromDynamic(json['stepNumber']) ?? 0,
      title: _stringOrFallback(json['title'], fallback: ''),
      description: _stringOrFallback(json['description'], fallback: ''),
      imageUrl: _nullableString(json['imageUrl']),
      completedAt: _dateTimeFromDynamic(json['completedAt']),
      state: _mapBuildStepState(json['state']),
    );
  }

  static ProjectBuildStepState _mapBuildStepState(Object? value) {
    return switch (_stringOrFallback(value, fallback: 'LOCKED').toUpperCase()) {
      'CURRENT' => ProjectBuildStepState.current,
      'COMPLETED' => ProjectBuildStepState.completed,
      _ => ProjectBuildStepState.locked,
    };
  }

  static ProjectBuildNextAction? _mapBuildNextAction(Object? value) {
    return switch (_stringOrFallback(value, fallback: '').toUpperCase()) {
      'PREPARE_MATERIALS' => ProjectBuildNextAction.prepareMaterials,
      'COMPLETE_CURRENT_STEP' => ProjectBuildNextAction.completeCurrentStep,
      'BUILD_COMPLETED' => ProjectBuildNextAction.buildCompleted,
      _ => null,
    };
  }

  static LearningProjectSubmission submissionFromJson(
    Map<String, dynamic> json,
  ) {
    final categoryJson = _asMap(json['category']);
    final categoryNameEn = _stringOrFallback(
      categoryJson?['nameEn'],
      fallback: 'Projects',
    );
    final categoryNameAr = _stringOrFallback(
      categoryJson?['nameAr'],
      fallback: categoryNameEn,
    );

    return LearningProjectSubmission(
      id: _stringOrFallback(json['id'], fallback: ''),
      title: _stringOrFallback(json['title'], fallback: 'Untitled project'),
      shortDescription: _stringOrFallback(
        json['shortDescription'],
        fallback: '',
      ),
      description: _nullableString(json['description']),
      status: LearningProjectSubmissionStatus.fromApiValue(
        _stringOrFallback(json['status'], fallback: 'PENDING_REVIEW'),
      ),
      category: LocalizedText(en: categoryNameEn, ar: categoryNameAr),
      difficulty: _stringOrFallback(json['difficulty'], fallback: 'BEGINNER'),
      estimatedDurationMinutes: _intFromDynamic(
        json['estimatedDurationMinutes'] ?? json['estimatedTimeMinutes'],
      ),
      coverImageUrl: _nullableString(json['coverImageUrl']),
      submittedAt: _dateTimeFromDynamic(json['submittedAt']),
      reviewedAt: _dateTimeFromDynamic(json['reviewedAt']),
      createdAt: _dateTimeFromDynamic(json['createdAt']),
      updatedAt: _dateTimeFromDynamic(json['updatedAt']),
      reviewNote: _nullableString(json['reviewNote']),
      changesRequestedReason: _nullableString(json['changesRequestedReason']),
      rejectionReason: _nullableString(json['rejectionReason']),
      publicProjectPath: _nullableString(json['publicProjectPath']),
      availableActions: LearningProjectSubmissionActions.fromJson(
        json['availableActions'],
      ),
      requiredComponents: _mapSubmissionComponents(json['requiredComponents']),
      steps: _mapSubmissionSteps(json['steps']),
      links: _mapSubmissionLinks(json['links']),
    );
  }

  static LearningProjectAuthoringSession authoringSessionFromJson(
    Map<String, dynamic> json,
  ) {
    final updatedAt = _dateTimeFromDynamic(json['updatedAt']);
    return LearningProjectAuthoringSession(
      learningProjectId: _stringOrFallback(
        json['learningProjectId'],
        fallback: '',
      ),
      conversationId: _stringOrFallback(json['conversationId'], fallback: ''),
      status: _stringOrFallback(json['status'], fallback: ''),
      mode: _stringOrFallback(json['mode'], fallback: ''),
      title: _stringOrFallback(json['title'], fallback: ''),
      updatedAt: updatedAt ?? DateTime.fromMillisecondsSinceEpoch(0),
    );
  }

  static LearningProject _mapProject(
    Map<String, dynamic> json, {
    required bool includeDetailFields,
  }) {
    final categoryJson = _asMap(json['category']);
    final categoryNameEn = _stringOrFallback(
      categoryJson?['nameEn'],
      fallback: 'Projects',
    );
    final categoryNameAr = _stringOrFallback(
      categoryJson?['nameAr'],
      fallback: categoryNameEn,
    );
    final title = _stringOrFallback(
      json['title'],
      fallback: 'Untitled project',
    );
    final shortDescription = _stringOrFallback(
      json['shortDescription'],
      fallback: 'No description available.',
    );
    final description = _stringOrFallback(
      json['description'],
      fallback: shortDescription,
    );
    final id = _stringOrFallback(json['id'], fallback: '');
    final difficultyKey = _stringOrFallback(
      json['difficulty'],
      fallback: 'BEGINNER',
    );
    final durationMinutes = _intFromDynamic(json['estimatedDurationMinutes']);
    final coverImageUrl = _nullableString(json['coverImageUrl']);
    final rating = _parseRatingSummary(json['ratingSummary']);
    final likesCount = _intFromDynamic(json['likesCount']) ?? 0;
    final isLiked = json['isLiked'] == true;
    final isSaved = json['isSaved'] == true;
    final followersCount = _intFromDynamic(json['followersCount']) ?? 0;
    final isFollowing = json['isFollowing'] == true;
    final isFeatured =
        json['isFeatured'] == true || json['isSpotlight'] == true;
    final tags = _mapTags(json['tags']);
    final recentReviews = includeDetailFields
        ? _mapProjectReviews(json['recentReviews'])
        : const <ProjectReviewItem>[];
    final viewerReview = includeDetailFields
        ? _mapProjectReview(json['viewerReview'])
        : null;

    final requiredComponents = includeDetailFields
        ? _mapRequiredComponents(json['requiredComponents'])
        : const <ProjectRequiredComponentItem>[];
    final components = includeDetailFields
        ? requiredComponents.map((component) => component.name).toList()
        : const <LocalizedText>[];
    final steps = includeDetailFields
        ? _mapSteps(json['steps'])
        : const <ProjectStep>[];
    final links = includeDetailFields
        ? _mapLinks(json['links'])
        : const <ProjectLinkItem>[];

    final imageUrl =
        coverImageUrl ??
        (includeDetailFields ? _firstImageUrl(json['images']) : null);

    final componentCount = includeDetailFields ? components.length : 0;
    final componentCountLabel = componentCount == 0
        ? const LocalizedText(en: '', ar: '')
        : LocalizedText(
            en: formatComponentCount(componentCount),
            ar: formatComponentCount(componentCount),
          );

    return LearningProject(
      id: id,
      category: LocalizedText(en: categoryNameEn, ar: categoryNameAr),
      title: LocalizedText(en: title, ar: title),
      summary: LocalizedText(en: shortDescription, ar: shortDescription),
      longDescription: includeDetailFields
          ? LocalizedText(en: description, ar: description)
          : null,
      difficulty: mapDifficultyLabel(difficultyKey),
      duration: LocalizedText(
        en: formatDurationMinutes(durationMinutes),
        ar: formatDurationMinutes(durationMinutes),
      ),
      ratingLabel: const LocalizedText(en: 'learners', ar: 'متعلم'),
      ratingValue: rating.value,
      ratingCount: rating.count,
      hasRatings: rating.hasRatings,
      recommendationImpressionId: _nullableString(
        json['recommendationImpressionId'],
      ),
      componentCountLabel: componentCountLabel,
      components: components,
      requiredComponents: requiredComponents,
      steps: steps,
      links: links,
      imageUrl: imageUrl,
      heroIconData: heroIconForCategory(categoryNameEn, id: id),
      cardGradient: gradientForCategory(categoryNameEn, id: id),
      isFeatured: isFeatured,
      likesCount: likesCount,
      isLiked: isLiked,
      isSaved: isSaved,
      followersCount: followersCount,
      isFollowing: isFollowing,
      recentReviews: recentReviews,
      viewerReview: viewerReview,
      tags: tags,
    );
  }

  static LocalizedText mapDifficultyLabel(String difficulty) {
    switch (difficulty.trim().toUpperCase()) {
      case 'BEGINNER':
        return const LocalizedText(en: 'Easy', ar: 'سهل');
      case 'ADVANCED':
        return const LocalizedText(en: 'Advanced', ar: 'متقدم');
      case 'INTERMEDIATE':
      default:
        return const LocalizedText(en: 'Medium', ar: 'متوسط');
    }
  }

  static String formatDurationMinutes(int? minutes) {
    if (minutes == null || minutes <= 0) {
      return 'Flexible timing';
    }

    if (minutes < 60) {
      return '$minutes min';
    }

    final hours = minutes ~/ 60;
    final remainder = minutes % 60;
    final hourLabel = hours == 1 ? '1 hr' : '$hours hrs';

    if (remainder == 0) {
      return hourLabel;
    }

    return '$hourLabel $remainder min';
  }

  static String formatComponentCount(int count) {
    if (count == 1) {
      return '1 component';
    }

    return '$count components';
  }

  static List<ProjectRequiredComponentItem> _mapRequiredComponents(
    Object? raw,
  ) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map((item) {
          final name = _stringOrFallback(
            item['componentName'],
            fallback: 'Component',
          );
          return ProjectRequiredComponentItem(
            id: _stringOrFallback(item['id'], fallback: ''),
            name: LocalizedText(en: name, ar: name),
            materialType: _stringOrFallback(
              item['materialType'],
              fallback: 'General',
            ),
            quantity: _numberFromDynamic(item['quantity']) ?? 1,
            unit: _stringOrFallback(item['unit'], fallback: 'piece'),
            isRequired: item['isRequired'] != false,
            canBeSubstituted: item['canBeSubstituted'] == true,
            categoryId: _nullableString(item['categoryId']),
            notes: _nullableString(item['notes']),
          );
        })
        .toList(growable: false);
  }

  static List<LearningProjectSubmissionComponent> _mapSubmissionComponents(
    Object? raw,
  ) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map((item) {
          final name = _stringOrFallback(
            item['componentName'] ?? item['name'],
            fallback: 'Component',
          );
          return LearningProjectSubmissionComponent(
            id: _stringOrFallback(item['id'], fallback: ''),
            name: name,
            quantity: _numberFromDynamic(item['quantity']) ?? 1,
            unit: _stringOrFallback(item['unit'], fallback: 'piece'),
            role: LearningProjectComponentRole.fromApiValue(
              _stringOrFallback(
                item['componentRole'],
                fallback: 'REQUIRED_MATERIAL',
              ),
            ),
            isRequired: item['isRequired'] != false,
            canBeSubstituted: item['canBeSubstituted'] == true,
            materialCategoryId: _nullableString(item['categoryId']),
            materialType: _nullableString(item['materialType']),
            searchKeywords: _stringList(item['searchKeywords']),
            notes: _nullableString(item['notes']),
          );
        })
        .toList(growable: false);
  }

  static List<LearningProjectSubmissionStep> _mapSubmissionSteps(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    final steps = raw.whereType<Map>().toList(growable: false);
    steps.sort((a, b) {
      final left = _intFromDynamic(a['stepNumber']) ?? 0;
      final right = _intFromDynamic(b['stepNumber']) ?? 0;
      return left.compareTo(right);
    });

    return steps
        .map(
          (item) => LearningProjectSubmissionStep(
            id: _nullableString(item['id']),
            stepNumber: _intFromDynamic(item['stepNumber']),
            title: _stringOrFallback(item['title'], fallback: 'Step'),
            description: _stringOrFallback(item['description'], fallback: ''),
          ),
        )
        .toList(growable: false);
  }

  static List<LearningProjectSubmissionLink> _mapSubmissionLinks(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map(
          (item) => LearningProjectSubmissionLink(
            id: _nullableString(item['id']),
            url: _stringOrFallback(item['url'], fallback: ''),
            title: _nullableString(item['title']),
          ),
        )
        .where((link) => link.url.trim().isNotEmpty)
        .toList(growable: false);
  }

  static List<ProjectStep> _mapSteps(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    final steps = raw.whereType<Map>().toList(growable: false);
    steps.sort((a, b) {
      final left = _intFromDynamic(a['stepNumber']) ?? 0;
      final right = _intFromDynamic(b['stepNumber']) ?? 0;
      return left.compareTo(right);
    });

    return steps
        .map((item) {
          final title = _stringOrFallback(item['title'], fallback: 'Step');
          return ProjectStep(
            title: LocalizedText(en: title, ar: title),
          );
        })
        .toList(growable: false);
  }

  static List<ProjectLinkItem> _mapLinks(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map((item) {
          final url = _stringOrFallback(item['url'], fallback: '');
          final title = _nullableString(item['title']);
          final sourceName = _nullableString(item['sourceName']);
          final labelText = title ?? sourceName ?? url;
          return ProjectLinkItem(
            label: LocalizedText(en: labelText, ar: labelText),
            urlLabel: LocalizedText(en: url, ar: url),
            url: url,
          );
        })
        .toList(growable: false);
  }

  static ProjectBuildItem _mapBuildItem(Map<String, dynamic> json) {
    final componentJson =
        _asMap(json['component']) ?? const <String, dynamic>{};
    final name = _stringOrFallback(
      componentJson['componentName'],
      fallback: 'Component',
    );

    return ProjectBuildItem(
      id: _stringOrFallback(json['id'], fallback: ''),
      requiredComponentId: _stringOrFallback(
        json['requiredComponentId'],
        fallback: '',
      ),
      status: _mapBuildItemStatus(json['status']),
      learnerNote: _nullableString(json['learnerNote']),
      linkedMaterial: _mapLinkedMaterial(json['linkedMaterial']),
      linkedReservation: _mapLinkedReservation(json['linkedReservation']),
      isReadyForBuild: json['isReadyForBuild'] == true,
      readinessLabel: _stringOrFallback(
        json['readinessLabel'],
        fallback: 'Still missing',
      ),
      component: ProjectRequiredComponentItem(
        id: _stringOrFallback(componentJson['id'], fallback: ''),
        name: LocalizedText(en: name, ar: name),
        materialType: _stringOrFallback(
          componentJson['materialType'],
          fallback: 'General',
        ),
        quantity: _numberFromDynamic(componentJson['quantity']) ?? 1,
        unit: _stringOrFallback(componentJson['unit'], fallback: 'piece'),
        isRequired: componentJson['isRequired'] != false,
        canBeSubstituted: componentJson['canBeSubstituted'] == true,
        categoryId: _nullableString(componentJson['categoryId']),
        notes: _nullableString(componentJson['notes']),
      ),
    );
  }

  static LinkedMaterialSummary? _mapLinkedMaterial(Object? raw) {
    final json = _asMap(raw);
    if (json == null) {
      return null;
    }

    final id = _stringOrFallback(json['id'], fallback: '');
    if (id.isEmpty) {
      return null;
    }

    final category = _asMap(json['category']);
    return LinkedMaterialSummary(
      id: id,
      title: _stringOrFallback(json['title'], fallback: 'Material'),
      imageUrl: _nullableString(json['imageUrl']),
      categoryNameEn: _stringOrFallback(
        category?['nameEn'],
        fallback: 'Material',
      ),
      condition: _stringOrFallback(json['condition'], fallback: 'GOOD'),
      status: _stringOrFallback(json['status'], fallback: 'AVAILABLE'),
      isPubliclyAvailable: json['isPubliclyAvailable'] != false,
      availabilityWarning: _nullableString(json['availabilityWarning']),
      isFree: json['isFree'] == true,
      price: _numberFromDynamic(json['price']),
      currency: _stringOrFallback(json['currency'], fallback: 'NIS'),
      supplierName: _stringOrFallback(
        json['supplierName'],
        fallback: 'Supplier',
      ),
      supplierType: _nullableString(json['supplierType']),
      supplierVerified: json['supplierVerified'] == true,
      city: _stringOrFallback(json['city'], fallback: ''),
      area: _nullableString(json['area']),
      pickupAllowed: json['pickupAllowed'] != false,
      deliveryAllowed: json['deliveryAllowed'] == true,
    );
  }

  static LinkedReservationSummary? _mapLinkedReservation(Object? raw) {
    final json = _asMap(raw);
    if (json == null) {
      return null;
    }

    final id = _stringOrFallback(json['id'], fallback: '');
    if (id.isEmpty) {
      return null;
    }

    return LinkedReservationSummary(
      id: id,
      status: _stringOrFallback(json['status'], fallback: ''),
      materialId: _stringOrFallback(json['materialId'], fallback: ''),
      needsAction: json['needsAction'] == true,
      statusLabel: _stringOrFallback(json['statusLabel'], fallback: ''),
    );
  }

  static BuildMaterialCandidatesResult fromMaterialCandidatesJson(
    Map<String, dynamic> json,
  ) {
    final itemsJson = json['items'];
    final items = itemsJson is List
        ? itemsJson
              .whereType<Map>()
              .map(
                (item) =>
                    _mapMaterialCandidate(Map<String, dynamic>.from(item)),
              )
              .toList(growable: false)
        : const <BuildMaterialCandidate>[];

    return BuildMaterialCandidatesResult(
      itemId: _stringOrFallback(json['itemId'], fallback: ''),
      componentId: _stringOrFallback(json['componentId'], fallback: ''),
      searchTerm: _stringOrFallback(json['searchTerm'], fallback: ''),
      items: items,
    );
  }

  static BuildMaterialCandidate _mapMaterialCandidate(
    Map<String, dynamic> json,
  ) {
    final hintsJson = json['matchHints'];
    final hints = hintsJson is List
        ? hintsJson.whereType<String>().toList(growable: false)
        : const <String>[];

    return BuildMaterialCandidate(
      id: _stringOrFallback(json['id'], fallback: ''),
      title: _stringOrFallback(json['title'], fallback: 'Material'),
      imageUrl: _nullableString(json['imageUrl']),
      categoryNameEn: _stringOrFallback(
        _asMap(json['category'])?['nameEn'],
        fallback: 'Material',
      ),
      condition: _stringOrFallback(json['condition'], fallback: 'GOOD'),
      status: _stringOrFallback(json['status'], fallback: 'AVAILABLE'),
      isFree: json['isFree'] == true,
      price: _numberFromDynamic(json['price']),
      currency: _stringOrFallback(json['currency'], fallback: 'NIS'),
      supplierName: _stringOrFallback(
        json['supplierName'],
        fallback: 'Supplier',
      ),
      city: _stringOrFallback(json['city'], fallback: ''),
      area: _nullableString(json['area']),
      pickupAllowed: json['pickupAllowed'] != false,
      deliveryAllowed: json['deliveryAllowed'] == true,
      matchHints: hints,
    );
  }

  static ProjectBuildStatus _mapBuildStatus(Object? raw) {
    return switch (_stringOrFallback(raw, fallback: 'IN_PROGRESS')) {
      'COMPLETED' => ProjectBuildStatus.completed,
      'ARCHIVED' => ProjectBuildStatus.archived,
      _ => ProjectBuildStatus.inProgress,
    };
  }

  static ProjectBuildItemStatus _mapBuildItemStatus(Object? raw) {
    return switch (_stringOrFallback(raw, fallback: 'MISSING')) {
      'ALREADY_OWNED' => ProjectBuildItemStatus.alreadyOwned,
      'AVAILABLE' => ProjectBuildItemStatus.available,
      'RESERVED' => ProjectBuildItemStatus.reserved,
      'ALTERNATIVE' => ProjectBuildItemStatus.alternative,
      _ => ProjectBuildItemStatus.missing,
    };
  }

  static List<String> _mapTags(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<String>()
        .map((tag) => tag.trim())
        .where((tag) => tag.isNotEmpty)
        .toSet()
        .toList(growable: false);
  }

  static List<String> _stringList(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<String>()
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .toList(growable: false);
  }

  static ({bool hasRatings, double value, int count}) _parseRatingSummary(
    Object? raw,
  ) {
    if (raw is! Map) {
      return (hasRatings: false, value: 0, count: 0);
    }

    final average = _numberFromDynamic(raw['average'] ?? raw['rating']);
    final count = _intFromDynamic(raw['count']) ?? 0;

    if (average == null || count <= 0) {
      return (hasRatings: false, value: 0, count: 0);
    }

    return (hasRatings: true, value: average, count: count);
  }

  static List<ProjectReviewItem> _mapProjectReviews(Object? raw) {
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map(_mapProjectReview)
        .whereType<ProjectReviewItem>()
        .toList(growable: false);
  }

  static ProjectReviewItem? _mapProjectReview(Object? raw) {
    final json = _asMap(raw);
    if (json == null) {
      return null;
    }

    final id = _stringOrFallback(json['id'], fallback: '');
    final projectId = _stringOrFallback(json['projectId'], fallback: '');
    final rating = _intFromDynamic(json['rating']) ?? 0;

    if (id.isEmpty || projectId.isEmpty || rating <= 0) {
      return null;
    }

    return ProjectReviewItem(
      id: id,
      projectId: projectId,
      reviewerName: _stringOrFallback(
        json['reviewerName'],
        fallback: 'Learner',
      ),
      rating: rating,
      comment: _nullableString(json['comment']),
      isViewerReview: json['isViewerReview'] == true,
      createdAt: _dateTimeFromDynamic(json['createdAt']),
      updatedAt: _dateTimeFromDynamic(json['updatedAt']),
    );
  }

  static String? _firstImageUrl(Object? raw) {
    if (raw is! List || raw.isEmpty) {
      return null;
    }

    for (final item in raw) {
      if (item is Map) {
        final url = _nullableString(item['imageUrl']);
        if (url != null) {
          return url;
        }
      }
    }

    return null;
  }

  static IconData heroIconForCategory(
    String categoryName, {
    required String id,
  }) {
    switch (categoryName.toLowerCase()) {
      case 'robotics':
        return Icons.smart_toy_outlined;
      case 'electronics':
        return Icons.memory_rounded;
      case 'energy':
        return Icons.bolt_outlined;
      case 'handmade':
      case 'wood & panels':
      case 'wood':
        return Icons.handyman_outlined;
      case 'agriculture':
        return Icons.eco_outlined;
      case 'internet of things':
      case 'iot':
        return Icons.sensors_outlined;
      default:
        return Icons.school_outlined;
    }
  }

  static List<int> gradientForCategory(
    String categoryName, {
    required String id,
  }) {
    switch (categoryName.toLowerCase()) {
      case 'robotics':
        return [0xFF1F2937, 0xFF243B53];
      case 'electronics':
        return [0xFF1C3F66, 0xFF121E2D];
      case 'energy':
        return [0xFF35596C, 0xFF173038];
      case 'handmade':
      case 'wood & panels':
      case 'wood':
        return [0xFF2E4738, 0xFF17211B];
      case 'agriculture':
        return [0xFF2F5A43, 0xFF173024];
      case 'internet of things':
      case 'iot':
        return [0xFF39506B, 0xFF1C2432];
      default:
        final hash = id.hashCode.abs();
        return [0xFF200000 + (hash % 0x003F00), 0xFF120000 + (hash % 0x001F00)];
    }
  }

  static Map<String, dynamic>? _asMap(Object? value) {
    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    return null;
  }

  static String _stringOrFallback(Object? value, {required String fallback}) {
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }

    return fallback;
  }

  static String? _nullableString(Object? value) {
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }

    return null;
  }

  static int? _intFromDynamic(Object? value) {
    if (value is int) {
      return value;
    }

    if (value is num) {
      return value.toInt();
    }

    if (value is String) {
      return int.tryParse(value);
    }

    return null;
  }

  static double? _numberFromDynamic(Object? value) {
    if (value is num) {
      return value.toDouble();
    }

    if (value is String) {
      return double.tryParse(value);
    }

    return null;
  }

  static DateTime? _dateTimeFromDynamic(Object? value) {
    if (value is String && value.trim().isNotEmpty) {
      return DateTime.tryParse(value.trim());
    }

    return null;
  }
}
