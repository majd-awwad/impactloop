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
      case 'external_sources':
        return AiContentBlock(
          type: type,
          externalSources:
              _mapJsonList(json['items'], AiExternalSourceItem.fromJson)
                  .where((item) => item.url.isNotEmpty)
                  .toList(growable: false),
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
    );
  }

  final String id;
  final String role;
  final String status;
  final String? contentText;
  final List<AiContentBlock> contentBlocks;
  final DateTime createdAt;
}

class AiTurnResponse {
  const AiTurnResponse({
    required this.conversationId,
    required this.userMessageId,
    required this.assistantMessageId,
    required this.contentBlocks,
    required this.scopeClassification,
  });

  factory AiTurnResponse.fromJson(Map<String, dynamic> json) {
    final blocksJson = json['contentBlocks'];
    final meta = json['meta'];
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
    );
  }

  final String conversationId;
  final String userMessageId;
  final String? assistantMessageId;
  final List<AiContentBlock> contentBlocks;
  final String scopeClassification;
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
