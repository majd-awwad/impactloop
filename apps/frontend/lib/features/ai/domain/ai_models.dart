class AiMaterialCardItem {
  const AiMaterialCardItem({
    required this.materialId,
    required this.title,
    required this.priceLabel,
    this.thumbnailUrl,
    this.categoryLabel,
    this.condition,
    this.quantityLabel,
    this.locationLabel,
    this.distanceKm,
    this.pickupAllowed,
    this.deliveryAllowed,
  });

  factory AiMaterialCardItem.fromJson(Map<String, dynamic> json) {
    return AiMaterialCardItem(
      materialId: json['materialId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      thumbnailUrl: json['thumbnailUrl'] as String?,
      categoryLabel: json['categoryLabel'] as String?,
      condition: json['condition'] as String?,
      quantityLabel: json['quantityLabel'] as String?,
      priceLabel: json['priceLabel'] as String? ?? '',
      locationLabel: json['locationLabel'] as String?,
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      pickupAllowed: json['pickupAllowed'] as bool?,
      deliveryAllowed: json['deliveryAllowed'] as bool?,
    );
  }

  final String materialId;
  final String title;
  final String? thumbnailUrl;
  final String? categoryLabel;
  final String? condition;
  final String? quantityLabel;
  final String priceLabel;
  final String? locationLabel;
  final double? distanceKm;
  final bool? pickupAllowed;
  final bool? deliveryAllowed;
}

class AiProjectCardItem {
  const AiProjectCardItem({
    required this.projectId,
    required this.title,
    this.thumbnailUrl,
    this.difficulty,
    this.estimatedTimeLabel,
    this.interestLabels = const [],
    this.savedByLearner,
    this.activeBuildId,
    this.summary,
  });

  factory AiProjectCardItem.fromJson(Map<String, dynamic> json) {
    final interests = json['interestLabels'];
    return AiProjectCardItem(
      projectId: json['projectId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      thumbnailUrl: json['thumbnailUrl'] as String?,
      difficulty: json['difficulty'] as String?,
      estimatedTimeLabel: json['estimatedTimeLabel'] as String?,
      interestLabels: interests is List
          ? interests.whereType<String>().toList(growable: false)
          : const [],
      savedByLearner: json['savedByLearner'] as bool?,
      activeBuildId: json['activeBuildId'] as String?,
      summary: json['summary'] as String?,
    );
  }

  final String projectId;
  final String title;
  final String? thumbnailUrl;
  final String? difficulty;
  final String? estimatedTimeLabel;
  final List<String> interestLabels;
  final bool? savedByLearner;
  final String? activeBuildId;
  final String? summary;
}

class AiComponentListItem {
  const AiComponentListItem({
    required this.componentId,
    required this.name,
    required this.quantity,
    required this.required,
    this.unit,
    this.categoryLabel,
  });

  factory AiComponentListItem.fromJson(Map<String, dynamic> json) {
    return AiComponentListItem(
      componentId: json['componentId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String?,
      required: json['required'] == true,
      categoryLabel: json['categoryLabel'] as String?,
    );
  }

  final String componentId;
  final String name;
  final double quantity;
  final String? unit;
  final bool required;
  final String? categoryLabel;
}

class AiBuildChecklistItem {
  const AiBuildChecklistItem({
    required this.componentId,
    required this.name,
    required this.status,
    required this.readinessLabel,
    this.linkedMaterialId,
    this.linkedReservationId,
  });

  factory AiBuildChecklistItem.fromJson(Map<String, dynamic> json) {
    return AiBuildChecklistItem(
      componentId: json['componentId'] as String? ?? '',
      name: json['name'] as String? ?? '',
      status: json['status'] as String? ?? '',
      readinessLabel: json['readinessLabel'] as String? ?? '',
      linkedMaterialId: json['linkedMaterialId'] as String?,
      linkedReservationId: json['linkedReservationId'] as String?,
    );
  }

  final String componentId;
  final String name;
  final String status;
  final String readinessLabel;
  final String? linkedMaterialId;
  final String? linkedReservationId;
}

class AiComponentMatchGroup {
  const AiComponentMatchGroup({
    required this.componentId,
    required this.componentName,
    required this.materials,
  });

  factory AiComponentMatchGroup.fromJson(Map<String, dynamic> json) {
    final materialsJson = json['materials'];
    return AiComponentMatchGroup(
      componentId: json['componentId'] as String? ?? '',
      componentName: json['componentName'] as String? ?? '',
      materials: materialsJson is List
          ? materialsJson
                .whereType<Map>()
                .map(
                  (item) => AiMaterialCardItem.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .where((item) => item.materialId.isNotEmpty)
                .toList(growable: false)
          : const [],
    );
  }

  final String componentId;
  final String componentName;
  final List<AiMaterialCardItem> materials;
}

class AiComparisonItem {
  const AiComparisonItem({
    required this.id,
    required this.title,
    required this.facts,
  });

  factory AiComparisonItem.fromJson(Map<String, dynamic> json) {
    final factsJson = json['facts'];
    return AiComparisonItem(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      facts: factsJson is List
          ? factsJson.whereType<String>().toList(growable: false)
          : const [],
    );
  }

  final String id;
  final String title;
  final List<String> facts;
}

class AiRecommendationItem {
  const AiRecommendationItem({
    required this.itemType,
    required this.itemId,
    required this.title,
    required this.reasons,
    this.thumbnailUrl,
    this.priceLabel,
    this.categoryLabel,
    this.difficulty,
    this.estimatedTimeLabel,
    this.distanceKm,
    this.savedByLearner,
    this.activeBuildId,
  });

  factory AiRecommendationItem.fromJson(Map<String, dynamic> json) {
    final reasonsJson = json['reasons'];
    return AiRecommendationItem(
      itemType: json['itemType'] as String? ?? '',
      itemId: json['itemId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      reasons: reasonsJson is List
          ? reasonsJson.whereType<String>().toList(growable: false)
          : const [],
      thumbnailUrl: json['thumbnailUrl'] as String?,
      priceLabel: json['priceLabel'] as String?,
      categoryLabel: json['categoryLabel'] as String?,
      difficulty: json['difficulty'] as String?,
      estimatedTimeLabel: json['estimatedTimeLabel'] as String?,
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      savedByLearner: json['savedByLearner'] as bool?,
      activeBuildId: json['activeBuildId'] as String?,
    );
  }

  final String itemType;
  final String itemId;
  final String title;
  final List<String> reasons;
  final String? thumbnailUrl;
  final String? priceLabel;
  final String? categoryLabel;
  final String? difficulty;
  final String? estimatedTimeLabel;
  final double? distanceKm;
  final bool? savedByLearner;
  final String? activeBuildId;

  AiMaterialCardItem? toMaterialCardItem() {
    if (itemType != 'MATERIAL' || itemId.isEmpty) {
      return null;
    }

    return AiMaterialCardItem(
      materialId: itemId,
      title: title,
      priceLabel: priceLabel ?? '',
      thumbnailUrl: thumbnailUrl,
      categoryLabel: categoryLabel,
      locationLabel: distanceKm != null
          ? '${distanceKm!.toStringAsFixed(1)} km'
          : null,
      distanceKm: distanceKm,
    );
  }

  AiProjectCardItem? toProjectCardItem() {
    if (itemType != 'PROJECT' || itemId.isEmpty) {
      return null;
    }

    return AiProjectCardItem(
      projectId: itemId,
      title: title,
      thumbnailUrl: thumbnailUrl,
      difficulty: difficulty,
      estimatedTimeLabel: estimatedTimeLabel,
      savedByLearner: savedByLearner,
      activeBuildId: activeBuildId,
      interestLabels: categoryLabel == null || categoryLabel!.isEmpty
          ? const []
          : [categoryLabel!],
    );
  }

  String get primaryReason => reasons.isNotEmpty ? reasons.first : '';
}

class AiActionTarget {
  const AiActionTarget({
    required this.type,
    required this.id,
    required this.title,
  });

  factory AiActionTarget.fromJson(Map<String, dynamic> json) {
    return AiActionTarget(
      type: json['type'] as String? ?? '',
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
    );
  }

  final String type;
  final String id;
  final String title;
}

class AiExternalSourceItem {
  const AiExternalSourceItem({
    required this.title,
    required this.url,
    this.snippet,
  });

  factory AiExternalSourceItem.fromJson(Map<String, dynamic> json) {
    return AiExternalSourceItem(
      title: json['title'] as String? ?? '',
      url: json['url'] as String? ?? '',
      snippet: json['snippet'] as String?,
    );
  }

  final String title;
  final String url;
  final String? snippet;
}

class AiAuthoringKnownFact {
  const AiAuthoringKnownFact({
    required this.label,
    required this.value,
  });

  factory AiAuthoringKnownFact.fromJson(Map<String, dynamic> json) {
    return AiAuthoringKnownFact(
      label: json['label'] as String? ?? '',
      value: json['value'] as String? ?? '',
    );
  }

  final String label;
  final String value;
}

class AiAuthoringQuestion {
  const AiAuthoringQuestion({
    required this.prompt,
    required this.answerType,
    this.options = const [],
  });

  factory AiAuthoringQuestion.fromJson(Map<String, dynamic> json) {
    final options = json['options'];
    return AiAuthoringQuestion(
      prompt: json['prompt'] as String? ?? '',
      answerType: json['answerType'] as String? ?? 'FREE_TEXT',
      options: options is List
          ? options.whereType<String>().toList(growable: false)
          : const [],
    );
  }

  final String prompt;
  final String answerType;
  final List<String> options;
}

class AiAuthoringProposalProject {
  const AiAuthoringProposalProject({
    required this.title,
    required this.shortDescription,
    required this.description,
    required this.difficulty,
    this.estimatedMinutes,
  });

  factory AiAuthoringProposalProject.fromJson(Map<String, dynamic> json) {
    return AiAuthoringProposalProject(
      title: json['title'] as String? ?? '',
      shortDescription: json['shortDescription'] as String? ?? '',
      description: json['description'] as String? ?? '',
      difficulty: json['difficulty'] as String? ?? '',
      estimatedMinutes: (json['estimatedMinutes'] as num?)?.toInt(),
    );
  }

  final String title;
  final String shortDescription;
  final String description;
  final String difficulty;
  final int? estimatedMinutes;
}

class AiAuthoringProposalComponent {
  const AiAuthoringProposalComponent({
    this.id,
    required this.componentName,
    required this.materialType,
    required this.quantity,
    required this.unit,
    required this.componentRole,
    required this.isRequired,
    required this.canBeSubstituted,
    this.searchKeywords = const [],
    this.alternativeKeywords = const [],
    this.notes,
  });

  factory AiAuthoringProposalComponent.fromJson(Map<String, dynamic> json) {
    return AiAuthoringProposalComponent(
      id: json['id'] as String?,
      componentName: json['componentName'] as String? ?? '',
      materialType: json['materialType'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? '',
      componentRole: json['componentRole'] as String? ?? 'REQUIRED_MATERIAL',
      isRequired: json['isRequired'] == true,
      canBeSubstituted: json['canBeSubstituted'] == true,
      searchKeywords: (json['searchKeywords'] as List?)
              ?.whereType<String>()
              .toList(growable: false) ??
          const [],
      alternativeKeywords: (json['alternativeKeywords'] as List?)
              ?.whereType<String>()
              .toList(growable: false) ??
          const [],
      notes: json['notes'] as String?,
    );
  }

  final String? id;
  final String componentName;
  final String materialType;
  final double quantity;
  final String unit;
  final String componentRole;
  final bool isRequired;
  final bool canBeSubstituted;
  final List<String> searchKeywords;
  final List<String> alternativeKeywords;
  final String? notes;
}

class AiAuthoringProposalStep {
  const AiAuthoringProposalStep({
    required this.title,
    required this.description,
    this.safetyNote,
  });

  factory AiAuthoringProposalStep.fromJson(Map<String, dynamic> json) {
    return AiAuthoringProposalStep(
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      safetyNote: json['safetyNote'] as String?,
    );
  }

  final String title;
  final String description;
  final String? safetyNote;
}

class AuthoringDraftSnapshot {
  const AuthoringDraftSnapshot({
    required this.title,
    required this.shortDescription,
    required this.description,
    required this.difficulty,
    this.estimatedMinutes,
    this.components = const [],
    this.steps = const [],
  });

  final String title;
  final String shortDescription;
  final String description;
  final String difficulty;
  final int? estimatedMinutes;
  final List<AiAuthoringProposalComponent> components;
  final List<AiAuthoringProposalStep> steps;
}

class AiAuthoringReviewFieldDecisions {
  const AiAuthoringReviewFieldDecisions({
    required this.title,
    required this.shortDescription,
    required this.description,
    required this.difficulty,
    required this.estimatedMinutes,
  });

  factory AiAuthoringReviewFieldDecisions.fromJson(Map<String, dynamic> json) {
    return AiAuthoringReviewFieldDecisions(
      title: json['title'] as String? ?? 'UNREVIEWED',
      shortDescription: json['shortDescription'] as String? ?? 'UNREVIEWED',
      description: json['description'] as String? ?? 'UNREVIEWED',
      difficulty: json['difficulty'] as String? ?? 'UNREVIEWED',
      estimatedMinutes: json['estimatedMinutes'] as String? ?? 'UNREVIEWED',
    );
  }

  final String title;
  final String shortDescription;
  final String description;
  final String difficulty;
  final String estimatedMinutes;
}

class AiAuthoringRevisionRequest {
  const AiAuthoringRevisionRequest({
    required this.target,
    required this.comment,
    required this.status,
  });

  factory AiAuthoringRevisionRequest.fromJson(Map<String, dynamic> json) {
    return AiAuthoringRevisionRequest(
      target: json['target'] as String? ?? '',
      comment: json['comment'] as String? ?? '',
      status: json['status'] as String? ?? 'OPEN',
    );
  }

  final String target;
  final String comment;
  final String status;
}

class AiAuthoringReviewState {
  const AiAuthoringReviewState({
    required this.reviewStateId,
    required this.proposalId,
    required this.baseUpdatedAt,
    required this.status,
    required this.fieldDecisions,
    required this.componentDecision,
    required this.stepDecision,
    this.lockedTargets = const [],
    this.revisionRequests = const [],
  });

  factory AiAuthoringReviewState.fromJson(Map<String, dynamic> json) {
    final fieldJson = json['fieldDecisions'];
    return AiAuthoringReviewState(
      reviewStateId: json['reviewStateId'] as String? ?? '',
      proposalId: json['proposalId'] as String? ?? '',
      baseUpdatedAt: json['baseUpdatedAt'] as String? ?? '',
      status: json['status'] as String? ?? 'IN_REVIEW',
      fieldDecisions: fieldJson is Map
          ? AiAuthoringReviewFieldDecisions.fromJson(
              Map<String, dynamic>.from(fieldJson),
            )
          : const AiAuthoringReviewFieldDecisions(
              title: 'UNREVIEWED',
              shortDescription: 'UNREVIEWED',
              description: 'UNREVIEWED',
              difficulty: 'UNREVIEWED',
              estimatedMinutes: 'UNREVIEWED',
            ),
      componentDecision: json['componentDecision'] as String? ?? 'UNREVIEWED',
      stepDecision: json['stepDecision'] as String? ?? 'UNREVIEWED',
      lockedTargets: (json['lockedTargets'] as List?)
              ?.whereType<String>()
              .toList(growable: false) ??
          const [],
      revisionRequests: _mapJsonList(
        json['revisionRequests'],
        AiAuthoringRevisionRequest.fromJson,
      ),
    );
  }

  final String reviewStateId;
  final String proposalId;
  final String baseUpdatedAt;
  final String status;
  final AiAuthoringReviewFieldDecisions fieldDecisions;
  final String componentDecision;
  final String stepDecision;
  final List<String> lockedTargets;
  final List<AiAuthoringRevisionRequest> revisionRequests;

  bool get isReadyToApply =>
      status == 'READY_TO_APPLY' && !isApplied;

  bool get isApplied => status == 'APPLIED';

  bool get hasOpenRevisionRequests =>
      revisionRequests.any((request) => request.status == 'OPEN');

  bool get needsDiscussion =>
      status == 'DISCUSSION_NEEDED' || hasOpenRevisionRequests;
}

class AuthoringReviewProgress {
  const AuthoringReviewProgress({
    required this.resolved,
    required this.needsDiscussion,
    required this.unreviewed,
    required this.total,
    required this.status,
  });

  final int resolved;
  final int needsDiscussion;
  final int unreviewed;
  final int total;
  final String status;

  bool get isReadyToApply => status == 'READY_TO_APPLY';
}

class AiAuthoringSession {
  const AiAuthoringSession({
    required this.sessionId,
    required this.projectId,
    required this.baseUpdatedAt,
    required this.stage,
    required this.flowStatus,
    this.acceptedStages = const [],
    this.currentTurnId,
    this.componentReviewMode,
    this.stepReviewMode,
    this.currentComponentIndex,
    this.workingComponents = const [],
    this.acceptedComponentIndexes = const [],
    this.componentSourceTotal,
    this.awaitingComponentsFinalSave = false,
    this.currentStepIndex,
    this.workingSteps = const [],
    this.acceptedStepIndexes = const [],
    this.awaitingStepsFinalSave = false,
  });

  factory AiAuthoringSession.fromJson(Map<String, dynamic> json) {
    return AiAuthoringSession(
      sessionId: json['sessionId'] as String? ?? '',
      projectId: json['projectId'] as String? ?? '',
      baseUpdatedAt: json['baseUpdatedAt'] as String? ?? '',
      stage: json['stage'] as String? ?? 'OVERVIEW',
      flowStatus: json['flowStatus'] as String? ?? 'WAITING_FOR_USER',
      acceptedStages: (json['acceptedStages'] as List?)
              ?.whereType<String>()
              .toList(growable: false) ??
          const [],
      currentTurnId: json['currentTurnId'] as String?,
      componentReviewMode: json['componentReviewMode'] as String?,
      stepReviewMode: json['stepReviewMode'] as String?,
      currentComponentIndex: (json['currentComponentIndex'] as num?)?.toInt(),
      workingComponents: _mapJsonList(
        json['workingComponents'],
        AiAuthoringProposalComponent.fromJson,
      ),
      acceptedComponentIndexes: (json['acceptedComponentIndexes'] as List?)
              ?.map((value) => (value as num).toInt())
              .toList(growable: false) ??
          const [],
      componentSourceTotal: (json['componentSourceTotal'] as num?)?.toInt(),
      awaitingComponentsFinalSave: json['awaitingComponentsFinalSave'] == true,
      currentStepIndex: (json['currentStepIndex'] as num?)?.toInt(),
      workingSteps: _mapJsonList(
        json['workingSteps'],
        AiAuthoringProposalStep.fromJson,
      ),
      acceptedStepIndexes: (json['acceptedStepIndexes'] as List?)
              ?.map((value) => (value as num).toInt())
              .toList(growable: false) ??
          const [],
      awaitingStepsFinalSave: json['awaitingStepsFinalSave'] == true,
    );
  }

  final String sessionId;
  final String projectId;
  final String baseUpdatedAt;
  final String stage;
  final String flowStatus;
  final List<String> acceptedStages;
  final String? currentTurnId;
  final String? componentReviewMode;
  final String? stepReviewMode;
  final int? currentComponentIndex;
  final List<AiAuthoringProposalComponent> workingComponents;
  final List<int> acceptedComponentIndexes;
  final int? componentSourceTotal;
  final bool awaitingComponentsFinalSave;
  final int? currentStepIndex;
  final List<AiAuthoringProposalStep> workingSteps;
  final List<int> acceptedStepIndexes;
  final bool awaitingStepsFinalSave;

  bool get isComplete => stage == 'COMPLETE' || flowStatus == 'COMPLETE';
  bool get isStale => flowStatus == 'STALE';
  bool get isComponentOneByOne => componentReviewMode == 'ONE_BY_ONE';
  bool get isStepByStep => stepReviewMode == 'STEP_BY_STEP';

  int get workingComponentCount => workingComponents.length;
  int get acceptedComponentCount => acceptedComponentIndexes.length;
  int get workingStepCount => workingSteps.length;
  int get acceptedStepCount => acceptedStepIndexes.length;

  int get componentProgressTotal =>
      workingComponentCount > 0
          ? workingComponentCount
          : componentSourceTotal ?? workingComponentCount;

  int get componentProgressIndex => (currentComponentIndex ?? 0) + 1;
  int get stepProgressIndex => (currentStepIndex ?? 0) + 1;
}

class AiAuthoringTurn {
  const AiAuthoringTurn({
    required this.turnId,
    required this.sessionId,
    required this.stage,
    required this.projectId,
    required this.baseUpdatedAt,
    required this.status,
    required this.proposal,
    required this.explanation,
  });

  factory AiAuthoringTurn.fromJson(Map<String, dynamic> json) {
    return AiAuthoringTurn(
      turnId: json['turnId'] as String? ?? '',
      sessionId: json['sessionId'] as String? ?? '',
      stage: json['stage'] as String? ?? '',
      projectId: json['projectId'] as String? ?? '',
      baseUpdatedAt: json['baseUpdatedAt'] as String? ?? '',
      status: json['status'] as String? ?? 'PROPOSED',
      proposal: json['proposal'] is Map
          ? Map<String, dynamic>.from(json['proposal'] as Map)
          : const {},
      explanation: json['explanation'] as String? ?? '',
    );
  }

  final String turnId;
  final String sessionId;
  final String stage;
  final String projectId;
  final String baseUpdatedAt;
  final String status;
  final Map<String, dynamic> proposal;
  final String explanation;

  bool get isProposed => status == 'PROPOSED';
}

class AiAuthoringCanonicalProject {
  const AiAuthoringCanonicalProject({
    required this.id,
    required this.updatedAt,
    required this.title,
    required this.shortDescription,
    required this.description,
    required this.difficulty,
    this.estimatedMinutes,
    this.components = const [],
    this.steps = const [],
  });

  factory AiAuthoringCanonicalProject.fromJson(Map<String, dynamic> json) {
    return AiAuthoringCanonicalProject(
      id: json['id'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
      title: json['title'] as String? ?? '',
      shortDescription: json['shortDescription'] as String? ?? '',
      description: json['description'] as String? ?? '',
      difficulty: json['difficulty'] as String? ?? 'INTERMEDIATE',
      estimatedMinutes: (json['estimatedMinutes'] as num?)?.toInt(),
      components: _mapJsonList(
        json['components'],
        (component) => AiAuthoringProposalComponent.fromJson(component),
      ),
      steps: _mapJsonList(
        json['steps'],
        (step) => AiAuthoringProposalStep.fromJson(step),
      ),
    );
  }

  AuthoringDraftSnapshot toDraftSnapshot() {
    return AuthoringDraftSnapshot(
      title: title,
      shortDescription: shortDescription,
      description: description,
      difficulty: difficulty,
      estimatedMinutes: estimatedMinutes,
      components: components,
      steps: steps,
    );
  }

  final String id;
  final String updatedAt;
  final String title;
  final String shortDescription;
  final String description;
  final String difficulty;
  final int? estimatedMinutes;
  final List<AiAuthoringProposalComponent> components;
  final List<AiAuthoringProposalStep> steps;
}

class AiAuthoringCurrentSuggestion {
  const AiAuthoringCurrentSuggestion({
    required this.turnId,
    required this.stage,
    required this.explanation,
    required this.status,
    this.value,
    this.components = const [],
    this.component,
    this.componentIndex,
    this.componentTotal,
    this.steps = const [],
    this.step,
    this.stepIndex,
    this.stepTotal,
  });

  factory AiAuthoringCurrentSuggestion.fromJson(Map<String, dynamic> json) {
    return AiAuthoringCurrentSuggestion(
      turnId: json['turnId'] as String? ?? '',
      stage: json['stage'] as String? ?? '',
      explanation: json['explanation'] as String? ?? '',
      status: json['status'] as String? ?? 'PROPOSED',
      value: json['value'],
      components: _mapJsonList(
        json['components'],
        (component) => AiAuthoringProposalComponent.fromJson(component),
      ),
      component: json['component'] is Map
          ? Map<String, dynamic>.from(json['component'] as Map)
          : null,
      componentIndex: (json['componentIndex'] as num?)?.toInt(),
      componentTotal: (json['componentTotal'] as num?)?.toInt(),
      steps: _mapJsonList(
        json['steps'],
        (step) => AiAuthoringProposalStep.fromJson(step),
      ),
      step: json['step'] is Map
          ? Map<String, dynamic>.from(json['step'] as Map)
          : null,
      stepIndex: (json['stepIndex'] as num?)?.toInt(),
      stepTotal: (json['stepTotal'] as num?)?.toInt(),
    );
  }

  final String turnId;
  final String stage;
  final String explanation;
  final String status;
  final Object? value;
  final List<AiAuthoringProposalComponent> components;
  final Map<String, dynamic>? component;
  final int? componentIndex;
  final int? componentTotal;
  final List<AiAuthoringProposalStep> steps;
  final Map<String, dynamic>? step;
  final int? stepIndex;
  final int? stepTotal;

  bool get isProposed => status == 'PROPOSED';
  bool get hasComponentList => components.isNotEmpty;
  bool get hasStepList => steps.isNotEmpty;
}

class AiAuthoringSnapshot {
  const AiAuthoringSnapshot({
    required this.session,
    required this.currentTurn,
    required this.currentSuggestion,
    required this.canonicalProject,
    required this.availableActions,
    required this.progress,
  });

  factory AiAuthoringSnapshot.fromJson(Map<String, dynamic> json) {
    final progressJson = json['progress'];
    AiAuthoringTurn? currentTurn;
    if (json['currentTurn'] is Map) {
      currentTurn = AiAuthoringTurn.fromJson(
        Map<String, dynamic>.from(json['currentTurn'] as Map),
      );
    }
    AiAuthoringCurrentSuggestion? currentSuggestion;
    if (json['currentSuggestion'] is Map) {
      currentSuggestion = AiAuthoringCurrentSuggestion.fromJson(
        Map<String, dynamic>.from(json['currentSuggestion'] as Map),
      );
    } else if (currentTurn != null) {
      currentSuggestion = AiAuthoringCurrentSuggestion(
        turnId: currentTurn.turnId,
        stage: currentTurn.stage,
        explanation: currentTurn.explanation,
        status: currentTurn.status,
        value: currentTurn.proposal['value'],
        components: _mapJsonList(
          currentTurn.proposal['components'],
          (component) => AiAuthoringProposalComponent.fromJson(component),
        ),
        component: currentTurn.proposal['component'] is Map
            ? Map<String, dynamic>.from(
                currentTurn.proposal['component'] as Map,
              )
            : null,
        componentIndex: (currentTurn.proposal['index'] as num?)?.toInt(),
        componentTotal: (currentTurn.proposal['total'] as num?)?.toInt(),
        steps: _mapJsonList(
          currentTurn.proposal['steps'],
          (step) => AiAuthoringProposalStep.fromJson(step),
        ),
        step: currentTurn.proposal['title'] is String
            ? {
                'index': currentTurn.proposal['index'],
                'title': currentTurn.proposal['title'],
                'description': currentTurn.proposal['description'],
              }
            : null,
        stepIndex: (currentTurn.proposal['index'] as num?)?.toInt(),
        stepTotal: (currentTurn.proposal['total'] as num?)?.toInt(),
      );
    }
    return AiAuthoringSnapshot(
      session: AiAuthoringSnapshotSession.fromJson(
        Map<String, dynamic>.from(json['session'] as Map? ?? const {}),
      ),
      currentTurn: currentTurn,
      currentSuggestion: currentSuggestion,
      canonicalProject: AiAuthoringCanonicalProject.fromJson(
        Map<String, dynamic>.from(json['canonicalProject'] as Map? ?? const {}),
      ),
      availableActions: (json['availableActions'] as List?)
              ?.whereType<String>()
              .toList(growable: false) ??
          const [],
      progress: progressJson is Map
          ? AiAuthoringSnapshotProgress.fromJson(
              Map<String, dynamic>.from(progressJson),
            )
          : const AiAuthoringSnapshotProgress(completed: 0, total: 7),
    );
  }

  final AiAuthoringSnapshotSession session;
  final AiAuthoringTurn? currentTurn;
  final AiAuthoringCurrentSuggestion? currentSuggestion;
  final AiAuthoringCanonicalProject canonicalProject;
  final List<String> availableActions;
  final AiAuthoringSnapshotProgress progress;
}

class AiAuthoringSnapshotSession {
  const AiAuthoringSnapshotSession({
    required this.sessionId,
    required this.projectId,
    required this.stage,
    required this.status,
    required this.completedStages,
    required this.currentTurnId,
    required this.baseUpdatedAt,
    required this.isStale,
    this.componentReviewMode,
    this.awaitingComponentsFinalSave = false,
    this.currentComponentIndex,
    this.componentSourceTotal,
    this.stepReviewMode,
    this.awaitingStepsFinalSave = false,
    this.currentStepIndex,
    this.workingSteps = const [],
  });

  factory AiAuthoringSnapshotSession.fromJson(Map<String, dynamic> json) {
    return AiAuthoringSnapshotSession(
      sessionId: json['sessionId'] as String? ?? '',
      projectId: json['projectId'] as String? ?? '',
      stage: json['stage'] as String? ?? 'OVERVIEW',
      status: json['status'] as String? ?? 'WAITING_FOR_USER',
      completedStages: (json['completedStages'] as List?)
              ?.whereType<String>()
              .toList(growable: false) ??
          const [],
      currentTurnId: json['currentTurnId'] as String?,
      baseUpdatedAt: json['baseUpdatedAt'] as String? ?? '',
      isStale: json['isStale'] as bool? ?? false,
      componentReviewMode: json['componentReviewMode'] as String?,
      awaitingComponentsFinalSave: json['awaitingComponentsFinalSave'] == true,
      currentComponentIndex: (json['currentComponentIndex'] as num?)?.toInt(),
      componentSourceTotal: (json['componentSourceTotal'] as num?)?.toInt(),
      stepReviewMode: json['stepReviewMode'] as String?,
      awaitingStepsFinalSave: json['awaitingStepsFinalSave'] == true,
      currentStepIndex: (json['currentStepIndex'] as num?)?.toInt(),
      workingSteps: _mapJsonList(
        json['workingSteps'],
        (step) => AiAuthoringProposalStep.fromJson(step),
      ),
    );
  }

  final String sessionId;
  final String projectId;
  final String stage;
  final String status;
  final List<String> completedStages;
  final String? currentTurnId;
  final String baseUpdatedAt;
  final bool isStale;
  final String? componentReviewMode;
  final bool awaitingComponentsFinalSave;
  final int? currentComponentIndex;
  final int? componentSourceTotal;
  final String? stepReviewMode;
  final bool awaitingStepsFinalSave;
  final int? currentStepIndex;
  final List<AiAuthoringProposalStep> workingSteps;

  bool get isComplete => stage == 'COMPLETE' || status == 'COMPLETE';
  bool get isStepByStep => stepReviewMode == 'STEP_BY_STEP';
  int get workingStepCount =>
      workingSteps.isNotEmpty ? workingSteps.length : 0;
  int get stepProgressIndex => (currentStepIndex ?? 0) + 1;
  int get componentProgressTotal => componentSourceTotal ?? 0;
}

class AiAuthoringSnapshotProgress {
  const AiAuthoringSnapshotProgress({
    required this.completed,
    required this.total,
  });

  factory AiAuthoringSnapshotProgress.fromJson(Map<String, dynamic> json) {
    return AiAuthoringSnapshotProgress(
      completed: (json['completed'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 7,
    );
  }

  final int completed;
  final int total;
}

class AiAuthoringFieldChange {
  const AiAuthoringFieldChange({
    required this.target,
    required this.before,
    required this.after,
  });

  factory AiAuthoringFieldChange.fromJson(Map<String, dynamic> json) {
    return AiAuthoringFieldChange(
      target: json['target'] as String? ?? '',
      before: json['before'] as String? ?? '',
      after: json['after'] as String? ?? '',
    );
  }

  final String target;
  final String before;
  final String after;
}

class AiAuthoringProposalDiff {
  const AiAuthoringProposalDiff({
    required this.changedTargets,
    this.fieldChanges = const [],
    this.componentAdded = const [],
    this.componentRemoved = const [],
    this.componentUpdated = const [],
    this.stepAdded = const [],
    this.stepRemoved = const [],
    this.stepUpdated = const [],
    this.stepsReordered = false,
  });

  factory AiAuthoringProposalDiff.fromJson(Map<String, dynamic> json) {
    final componentJson = json['componentChanges'];
    final stepJson = json['stepChanges'];
    return AiAuthoringProposalDiff(
      changedTargets: (json['changedTargets'] as List?)
              ?.whereType<String>()
              .toList(growable: false) ??
          const [],
      fieldChanges: _mapJsonList(
        json['fieldChanges'],
        AiAuthoringFieldChange.fromJson,
      ),
      componentAdded: componentJson is Map
          ? (componentJson['added'] as List?)?.whereType<String>().toList() ??
              const []
          : const [],
      componentRemoved: componentJson is Map
          ? (componentJson['removed'] as List?)?.whereType<String>().toList() ??
              const []
          : const [],
      componentUpdated: componentJson is Map
          ? (componentJson['updated'] as List?)?.whereType<String>().toList() ??
              const []
          : const [],
      stepAdded: stepJson is Map
          ? (stepJson['added'] as List?)?.whereType<String>().toList() ??
              const []
          : const [],
      stepRemoved: stepJson is Map
          ? (stepJson['removed'] as List?)?.whereType<String>().toList() ??
              const []
          : const [],
      stepUpdated: stepJson is Map
          ? (stepJson['updated'] as List?)?.whereType<String>().toList() ??
              const []
          : const [],
      stepsReordered: stepJson is Map && stepJson['reordered'] == true,
    );
  }

  final List<String> changedTargets;
  final List<AiAuthoringFieldChange> fieldChanges;
  final List<String> componentAdded;
  final List<String> componentRemoved;
  final List<String> componentUpdated;
  final List<String> stepAdded;
  final List<String> stepRemoved;
  final List<String> stepUpdated;
  final bool stepsReordered;
}

List<T> _mapJsonList<T>(
  dynamic value,
  T Function(Map<String, dynamic> json) fromJson,
) {
  if (value is! List) {
    return const [];
  }

  return value
      .whereType<Map>()
      .map((item) => fromJson(Map<String, dynamic>.from(item)))
      .toList(growable: false);
}

class AiContentBlock {
  const AiContentBlock({
    required this.type,
    this.text,
    this.purpose,
    this.code,
    this.message,
    this.retryable,
    this.materialItems = const [],
    this.materialItem,
    this.projectItems = const [],
    this.projectItem,
    this.projectId,
    this.componentItems = const [],
    this.buildId,
    this.readyCount,
    this.totalRequired,
    this.checklistItems = const [],
    this.matchGroups = const [],
    this.comparisonSubject,
    this.comparisonItems = const [],
    this.recommendationType,
    this.recommendationItems = const [],
    this.pendingActionId,
    this.actionType,
    this.actionTitle,
    this.actionSummary,
    this.actionTarget,
    this.expiresAt,
    this.confirmLabel,
    this.cancelLabel,
    this.actionStatus,
    this.externalSources = const [],
    this.guideProjectStepId,
    this.stepNumber,
    this.totalSteps,
    this.guideTitle,
    this.guideDescription,
    this.guideImageUrl,
    this.progressPercent,
    this.completedSteps,
    this.authoringStatus,
    this.authoringSummary,
    this.authoringKnownFacts = const [],
    this.authoringNextQuestion,
    this.authoringRemainingTopics,
    this.authoringAssumptions = const [],
    this.authoringWarnings = const [],
    this.authoringProposalProject,
    this.authoringProposalCategoryDisplayName,
    this.authoringProposalComponents = const [],
    this.authoringProposalSteps = const [],
    this.authoringProposalAssumptions = const [],
    this.authoringProposalWarnings = const [],
    this.authoringProposalSafetyConsiderations = const [],
    this.authoringProposalBaseUpdatedAt,
    this.authoringProposalClarificationMessageId,
    this.authoringProposalId,
    this.authoringProposalVersion,
    this.authoringReviewState,
    this.authoringProposalDiff,
    this.authoringDiscussionTarget,
    this.authoringDiscussionProposalId,
    this.authoringDiscussionReviewStateId,
    this.authoringSession,
    this.authoringTurn,
  });

  factory AiContentBlock.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String? ?? '';

    switch (type) {
      case 'error':
        return AiContentBlock(
          type: type,
          code: json['code'] as String?,
          message: json['message'] as String?,
          retryable: json['retryable'] == true,
        );
      case 'text':
        return AiContentBlock(
          type: type,
          text: json['text'] as String?,
          purpose: json['purpose'] as String?,
        );
      case 'material_results':
        return AiContentBlock(
          type: type,
          materialItems: _mapJsonList(json['items'], AiMaterialCardItem.fromJson)
              .where((item) => item.materialId.isNotEmpty)
              .toList(growable: false),
        );
      case 'material_details':
        final itemJson = json['item'];
        return AiContentBlock(
          type: type,
          materialItem: itemJson is Map
              ? AiMaterialCardItem.fromJson(Map<String, dynamic>.from(itemJson))
              : null,
        );
      case 'project_results':
        return AiContentBlock(
          type: type,
          projectItems: _mapJsonList(json['items'], AiProjectCardItem.fromJson)
              .where((item) => item.projectId.isNotEmpty)
              .toList(growable: false),
        );
      case 'project_details':
        final projectJson = json['item'];
        return AiContentBlock(
          type: type,
          projectItem: projectJson is Map
              ? AiProjectCardItem.fromJson(Map<String, dynamic>.from(projectJson))
              : null,
        );
      case 'component_list':
        return AiContentBlock(
          type: type,
          projectId: json['projectId'] as String?,
          componentItems:
              _mapJsonList(json['items'], AiComponentListItem.fromJson)
                  .where((item) => item.componentId.isNotEmpty)
                  .toList(growable: false),
        );
      case 'build_checklist':
        return AiContentBlock(
          type: type,
          buildId: json['buildId'] as String?,
          projectId: json['projectId'] as String?,
          readyCount: (json['readyCount'] as num?)?.toInt(),
          totalRequired: (json['totalRequired'] as num?)?.toInt(),
          checklistItems:
              _mapJsonList(json['items'], AiBuildChecklistItem.fromJson)
                  .where((item) => item.componentId.isNotEmpty)
                  .toList(growable: false),
        );
      case 'component_matches':
        return AiContentBlock(
          type: type,
          buildId: json['buildId'] as String?,
          matchGroups: _mapJsonList(json['groups'], AiComponentMatchGroup.fromJson)
              .where((group) => group.componentId.isNotEmpty)
              .toList(growable: false),
        );
      case 'comparison':
        return AiContentBlock(
          type: type,
          comparisonSubject: json['subject'] as String?,
          comparisonItems:
              _mapJsonList(json['items'], AiComparisonItem.fromJson)
                  .where((item) => item.id.isNotEmpty)
                  .toList(growable: false),
        );
      case 'recommendations':
        return AiContentBlock(
          type: type,
          recommendationType: json['recommendationType'] as String?,
          recommendationItems:
              _mapJsonList(json['items'], AiRecommendationItem.fromJson)
                  .where((item) => item.itemId.isNotEmpty)
                  .toList(growable: false),
        );
      case 'action_confirmation':
        final targetJson = json['target'];
        return AiContentBlock(
          type: type,
          pendingActionId: json['pendingActionId'] as String?,
          actionType: json['actionType'] as String?,
          actionTitle: json['title'] as String?,
          actionSummary: json['summary'] as String?,
          actionTarget: targetJson is Map
              ? AiActionTarget.fromJson(Map<String, dynamic>.from(targetJson))
              : null,
          expiresAt: DateTime.tryParse(json['expiresAt'] as String? ?? ''),
          confirmLabel: json['confirmLabel'] as String?,
          cancelLabel: json['cancelLabel'] as String?,
        );
      case 'action_result':
        final resultTargetJson = json['target'];
        return AiContentBlock(
          type: type,
          actionType: json['actionType'] as String?,
          actionStatus: json['status'] as String?,
          actionTitle: json['title'] as String?,
          actionSummary: json['summary'] as String?,
          actionTarget: resultTargetJson is Map
              ? AiActionTarget.fromJson(
                  Map<String, dynamic>.from(resultTargetJson),
                )
              : null,
        );
      case 'build_step_guide':
        final readinessJson = json['materialReadiness'];
        return AiContentBlock(
          type: type,
          buildId: json['projectBuildId'] as String?,
          projectId: json['projectId'] as String?,
          actionTitle: json['projectTitle'] as String?,
          guideProjectStepId: json['projectStepId'] as String?,
          stepNumber: (json['stepNumber'] as num?)?.toInt(),
          totalSteps: (json['totalSteps'] as num?)?.toInt(),
          guideTitle: json['title'] as String?,
          guideDescription: json['description'] as String?,
          guideImageUrl: json['imageUrl'] as String?,
          progressPercent: (json['progressPercent'] as num?)?.toInt(),
          completedSteps: (json['completedSteps'] as num?)?.toInt(),
          readyCount: readinessJson is Map
              ? (readinessJson['ready'] as num?)?.toInt()
              : null,
          totalRequired: readinessJson is Map
              ? (readinessJson['total'] as num?)?.toInt()
              : null,
        );
      case 'external_sources':
        return AiContentBlock(
          type: type,
          externalSources:
              _mapJsonList(json['items'], AiExternalSourceItem.fromJson)
                  .where((item) => item.url.isNotEmpty)
                  .toList(growable: false),
        );
      case 'project_authoring_clarification':
        final nextQuestionJson = json['nextQuestion'];
        return AiContentBlock(
          type: type,
          authoringStatus: json['status'] as String?,
          authoringSummary: json['summary'] as String?,
          authoringKnownFacts:
              _mapJsonList(json['knownFacts'], AiAuthoringKnownFact.fromJson)
                  .where((fact) => fact.label.isNotEmpty && fact.value.isNotEmpty)
                  .toList(growable: false),
          authoringNextQuestion: nextQuestionJson is Map
              ? AiAuthoringQuestion.fromJson(
                  Map<String, dynamic>.from(nextQuestionJson),
                )
              : null,
          authoringRemainingTopics: (json['remainingTopics'] as num?)?.toInt(),
          authoringAssumptions: (json['assumptions'] as List?)
                  ?.whereType<String>()
                  .toList(growable: false) ??
              const [],
          authoringWarnings: (json['warnings'] as List?)
                  ?.whereType<String>()
                  .toList(growable: false) ??
              const [],
        );
      case 'project_authoring_proposal':
        final projectJson = json['project'];
        return AiContentBlock(
          type: type,
          authoringProposalId: json['proposalId'] as String?,
          authoringProposalVersion: (json['version'] as num?)?.toInt() ?? 1,
          authoringProposalCategoryDisplayName:
              json['categoryDisplayName'] as String?,
          authoringProposalProject: projectJson is Map
              ? AiAuthoringProposalProject.fromJson(
                  Map<String, dynamic>.from(projectJson),
                )
              : null,
          authoringProposalComponents: _mapJsonList(
            json['requiredComponents'],
            AiAuthoringProposalComponent.fromJson,
          ).where((component) => component.componentName.isNotEmpty).toList(
                growable: false,
              ),
          authoringProposalSteps: _mapJsonList(
            json['steps'],
            AiAuthoringProposalStep.fromJson,
          ).where((step) => step.title.isNotEmpty).toList(growable: false),
          authoringProposalAssumptions: (json['assumptions'] as List?)
                  ?.whereType<String>()
                  .toList(growable: false) ??
              const [],
          authoringProposalWarnings: (json['warnings'] as List?)
                  ?.whereType<String>()
                  .toList(growable: false) ??
              const [],
          authoringProposalSafetyConsiderations:
              (json['safetyConsiderations'] as List?)
                      ?.whereType<String>()
                      .toList(growable: false) ??
                  const [],
          authoringProposalBaseUpdatedAt: json['baseUpdatedAt'] as String?,
          authoringProposalClarificationMessageId:
              json['clarificationMessageId'] as String?,
        );
      case 'project_authoring_review_state':
        return AiContentBlock(
          type: type,
          authoringReviewState: AiAuthoringReviewState.fromJson(json),
        );
      case 'project_authoring_proposal_diff':
        return AiContentBlock(
          type: type,
          authoringProposalDiff: AiAuthoringProposalDiff.fromJson(json),
        );
      case 'project_authoring_discussion_context':
        return AiContentBlock(
          type: type,
          authoringDiscussionTarget: json['target'] as String?,
          authoringDiscussionProposalId: json['proposalId'] as String?,
          authoringDiscussionReviewStateId: json['reviewStateId'] as String?,
        );
      case 'project_authoring_session':
        return AiContentBlock(
          type: type,
          authoringSession: AiAuthoringSession.fromJson(json),
        );
      case 'project_authoring_turn':
        return AiContentBlock(
          type: type,
          authoringTurn: AiAuthoringTurn.fromJson(json),
        );
      default:
        return AiContentBlock(type: type.isEmpty ? 'unknown' : type);
    }
  }

  final String type;
  final String? text;
  final String? purpose;
  final String? code;
  final String? message;
  final bool? retryable;
  final List<AiMaterialCardItem> materialItems;
  final AiMaterialCardItem? materialItem;
  final List<AiProjectCardItem> projectItems;
  final AiProjectCardItem? projectItem;
  final String? projectId;
  final List<AiComponentListItem> componentItems;
  final String? buildId;
  final int? readyCount;
  final int? totalRequired;
  final List<AiBuildChecklistItem> checklistItems;
  final List<AiComponentMatchGroup> matchGroups;
  final String? comparisonSubject;
  final List<AiComparisonItem> comparisonItems;
  final String? recommendationType;
  final List<AiRecommendationItem> recommendationItems;
  final String? pendingActionId;
  final String? actionType;
  final String? actionTitle;
  final String? actionSummary;
  final AiActionTarget? actionTarget;
  final DateTime? expiresAt;
  final String? confirmLabel;
  final String? cancelLabel;
  final String? actionStatus;
  final List<AiExternalSourceItem> externalSources;
  final String? guideProjectStepId;
  final int? stepNumber;
  final int? totalSteps;
  final String? guideTitle;
  final String? guideDescription;
  final String? guideImageUrl;
  final int? progressPercent;
  final int? completedSteps;
  final String? authoringStatus;
  final String? authoringSummary;
  final List<AiAuthoringKnownFact> authoringKnownFacts;
  final AiAuthoringQuestion? authoringNextQuestion;
  final int? authoringRemainingTopics;
  final List<String> authoringAssumptions;
  final List<String> authoringWarnings;
  final AiAuthoringProposalProject? authoringProposalProject;
  final String? authoringProposalCategoryDisplayName;
  final List<AiAuthoringProposalComponent> authoringProposalComponents;
  final List<AiAuthoringProposalStep> authoringProposalSteps;
  final List<String> authoringProposalAssumptions;
  final List<String> authoringProposalWarnings;
  final List<String> authoringProposalSafetyConsiderations;
  final String? authoringProposalBaseUpdatedAt;
  final String? authoringProposalClarificationMessageId;
  final String? authoringProposalId;
  final int? authoringProposalVersion;
  final AiAuthoringReviewState? authoringReviewState;
  final AiAuthoringProposalDiff? authoringProposalDiff;
  final String? authoringDiscussionTarget;
  final String? authoringDiscussionProposalId;
  final String? authoringDiscussionReviewStateId;
  final AiAuthoringSession? authoringSession;
  final AiAuthoringTurn? authoringTurn;
}

enum AiConversationStatus {
  active,
  archived;

  String get apiValue => switch (this) {
        AiConversationStatus.active => 'ACTIVE',
        AiConversationStatus.archived => 'ARCHIVED',
      };
}

class AiConversationSummary {
  const AiConversationSummary({
    required this.id,
    required this.mode,
    required this.locale,
    required this.title,
    required this.preview,
    required this.updatedAt,
    this.status = AiConversationStatus.active,
  });

  factory AiConversationSummary.fromJson(Map<String, dynamic> json) {
    final rawStatus = json['status'] as String? ?? 'ACTIVE';
    return AiConversationSummary(
      id: json['id'] as String? ?? '',
      mode: json['mode'] as String? ?? 'LEARNER_ASSISTANT',
      locale: json['locale'] as String? ?? 'en',
      title: json['title'] as String?,
      preview: json['preview'] as String?,
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      status: rawStatus == 'ARCHIVED'
          ? AiConversationStatus.archived
          : AiConversationStatus.active,
    );
  }

  final String id;
  final String mode;
  final String locale;
  final String? title;
  final String? preview;
  final DateTime updatedAt;
  final AiConversationStatus status;
}

class AiMessageItem {
  const AiMessageItem({
    required this.id,
    required this.role,
    required this.status,
    required this.contentText,
    required this.contentBlocks,
    required this.createdAt,
    this.clientMessageId,
  });

  factory AiMessageItem.fromJson(Map<String, dynamic> json) {
    final blocksJson = json['contentBlocks'];
    return AiMessageItem(
      id: json['id'] as String? ?? '',
      role: json['role'] as String? ?? 'USER',
      status: json['status'] as String? ?? 'COMPLETED',
      contentText: json['contentText'] as String?,
      contentBlocks: blocksJson is List
          ? blocksJson
                .whereType<Map>()
                .map((block) => AiContentBlock.fromJson(
                      Map<String, dynamic>.from(block),
                    ))
                .toList(growable: false)
          : const [],
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      clientMessageId: json['clientMessageId'] as String?,
    );
  }

  final String id;
  final String role;
  final String status;
  final String? contentText;
  final List<AiContentBlock> contentBlocks;
  final DateTime createdAt;
  final String? clientMessageId;
}

class AiTurnResponse {
  const AiTurnResponse({
    required this.conversationId,
    required this.userMessageId,
    required this.assistantMessageId,
    required this.contentBlocks,
    required this.scopeClassification,
    this.authoringSnapshot,
  });

  factory AiTurnResponse.fromJson(Map<String, dynamic> json) {
    final blocksJson = json['contentBlocks'];
    final meta = json['meta'];
    final snapshotJson = json['authoringSnapshot'];
    return AiTurnResponse(
      conversationId: json['conversationId'] as String? ?? '',
      userMessageId: json['userMessageId'] as String? ?? '',
      assistantMessageId: json['assistantMessageId'] as String?,
      scopeClassification: meta is Map
          ? meta['scopeClassification'] as String? ?? ''
          : '',
      contentBlocks: blocksJson is List
          ? blocksJson
                .whereType<Map>()
                .map((block) => AiContentBlock.fromJson(
                      Map<String, dynamic>.from(block),
                    ))
                .toList(growable: false)
          : const [],
      authoringSnapshot: snapshotJson is Map
          ? AiAuthoringSnapshot.fromJson(
              Map<String, dynamic>.from(snapshotJson),
            )
          : null,
    );
  }

  final String conversationId;
  final String userMessageId;
  final String? assistantMessageId;
  final List<AiContentBlock> contentBlocks;
  final String scopeClassification;
  final AiAuthoringSnapshot? authoringSnapshot;
}

class AiConversationMessagesPage {
  const AiConversationMessagesPage({
    required this.conversation,
    required this.items,
  });

  factory AiConversationMessagesPage.fromJson(Map<String, dynamic> json) {
    final conversationJson = json['conversation'];
    final itemsJson = json['items'];

    return AiConversationMessagesPage(
      conversation: conversationJson is Map<String, dynamic>
          ? AiConversationSummary.fromJson(conversationJson)
          : AiConversationSummary(
              id: '',
              mode: 'LEARNER_ASSISTANT',
              locale: 'en',
              title: null,
              preview: null,
              updatedAt: DateTime.fromMillisecondsSinceEpoch(0),
            ),
      items: itemsJson is List
          ? itemsJson
                .whereType<Map>()
                .map((item) =>
                    AiMessageItem.fromJson(Map<String, dynamic>.from(item)))
                .toList(growable: false)
          : const [],
    );
  }

  final AiConversationSummary conversation;
  final List<AiMessageItem> items;
}

class AiConversationListPage {
  const AiConversationListPage({
    required this.items,
    this.total = 0,
    this.hasMore = false,
  });

  factory AiConversationListPage.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'];
    return AiConversationListPage(
      items: itemsJson is List
          ? itemsJson
                .whereType<Map>()
                .map((item) => AiConversationSummary.fromJson(
                      Map<String, dynamic>.from(item),
                    ))
                .toList(growable: false)
          : const [],
      total: (json['total'] as num?)?.toInt() ?? 0,
      hasMore: json['hasMore'] == true,
    );
  }

  final List<AiConversationSummary> items;
  final int total;
  final bool hasMore;
}
