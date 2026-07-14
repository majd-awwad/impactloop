class AiContentBlock {
  const AiContentBlock({    required this.type,
    this.text,
    this.purpose,
    this.code,
    this.message,
    this.retryable,
  });

  factory AiContentBlock.fromJson(Map<String, dynamic> json) {
    final type = json['type'] as String? ?? '';
    if (type == 'error') {
      return AiContentBlock(
        type: type,
        code: json['code'] as String?,
        message: json['message'] as String?,
        retryable: json['retryable'] == true,
      );
    }

    return AiContentBlock(
      type: type,
      text: json['text'] as String?,
      purpose: json['purpose'] as String?,
    );
  }

  final String type;
  final String? text;
  final String? purpose;
  final String? code;
  final String? message;
  final bool? retryable;
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
