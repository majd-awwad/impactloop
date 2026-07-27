class AdminAuditLogFilterOption {
  const AdminAuditLogFilterOption({required this.value, required this.label});

  final String value;
  final String label;

  factory AdminAuditLogFilterOption.fromJson(Map<String, dynamic> json) {
    return AdminAuditLogFilterOption(
      value: json['value'] as String? ?? '',
      label: json['label'] as String? ?? '',
    );
  }
}

class AdminAuditLogActorOption {
  const AdminAuditLogActorOption({
    required this.id,
    required this.displayName,
    required this.email,
  });

  final String id;
  final String displayName;
  final String email;

  String get label {
    if (displayName.trim().isEmpty) return email;
    if (email.trim().isEmpty) return displayName;
    return '$displayName · $email';
  }

  factory AdminAuditLogActorOption.fromJson(Map<String, dynamic> json) {
    return AdminAuditLogActorOption(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
    );
  }
}

class AdminAuditLogFilterOptions {
  const AdminAuditLogFilterOptions({
    required this.actions,
    required this.targetTypes,
    required this.actors,
  });

  final List<AdminAuditLogFilterOption> actions;
  final List<AdminAuditLogFilterOption> targetTypes;
  final List<AdminAuditLogActorOption> actors;

  factory AdminAuditLogFilterOptions.fromJson(Map<String, dynamic> json) {
    return AdminAuditLogFilterOptions(
      actions: (json['actions'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminAuditLogFilterOption.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      targetTypes: (json['targetTypes'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminAuditLogFilterOption.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
      actors: (json['actors'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) => AdminAuditLogActorOption.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(),
    );
  }
}

class AdminAuditLogSummary {
  const AdminAuditLogSummary({
    required this.total,
    required this.today,
    required this.thisWeek,
    required this.mostRecentAt,
  });

  final int total;
  final int today;
  final int thisWeek;
  final String? mostRecentAt;

  factory AdminAuditLogSummary.fromJson(Map<String, dynamic> json) {
    return AdminAuditLogSummary(
      total: (json['total'] as num?)?.toInt() ?? 0,
      today: (json['today'] as num?)?.toInt() ?? 0,
      thisWeek: (json['thisWeek'] as num?)?.toInt() ?? 0,
      mostRecentAt: json['mostRecentAt'] as String?,
    );
  }
}

class AdminAuditLogItem {
  const AdminAuditLogItem({
    required this.id,
    required this.action,
    required this.actionLabel,
    required this.actorUserId,
    required this.actorName,
    required this.actorEmail,
    required this.targetType,
    required this.targetId,
    required this.targetLabel,
    required this.metadata,
    required this.createdAt,
  });

  final String id;
  final String action;
  final String actionLabel;
  final String actorUserId;
  final String actorName;
  final String actorEmail;
  final String targetType;
  final String? targetId;
  final String targetLabel;
  final Map<String, dynamic>? metadata;
  final String createdAt;

  factory AdminAuditLogItem.fromJson(Map<String, dynamic> json) {
    final rawMetadata = json['metadata'];
    return AdminAuditLogItem(
      id: json['id'] as String? ?? '',
      action: json['action'] as String? ?? '',
      actionLabel: json['actionLabel'] as String? ?? '',
      actorUserId: json['actorUserId'] as String? ?? '',
      actorName: json['actorName'] as String? ?? '',
      actorEmail: json['actorEmail'] as String? ?? '',
      targetType: json['targetType'] as String? ?? '',
      targetId: json['targetId'] as String?,
      targetLabel: json['targetLabel'] as String? ?? '',
      metadata: rawMetadata is Map
          ? Map<String, dynamic>.from(rawMetadata)
          : null,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class AdminAuditLogsListResponse {
  const AdminAuditLogsListResponse({
    required this.items,
    required this.pagination,
    required this.filterOptions,
    required this.summary,
  });

  final List<AdminAuditLogItem> items;
  final AdminAuditLogsPagination pagination;
  final AdminAuditLogFilterOptions filterOptions;
  final AdminAuditLogSummary summary;

  factory AdminAuditLogsListResponse.fromJson(Map<String, dynamic> json) {
    return AdminAuditLogsListResponse(
      items: (json['items'] as List<dynamic>? ?? const [])
          .whereType<Map>()
          .map(
            (item) =>
                AdminAuditLogItem.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList(),
      pagination: AdminAuditLogsPagination.fromJson(
        json['pagination'] as Map<String, dynamic>? ?? const {},
      ),
      filterOptions: AdminAuditLogFilterOptions.fromJson(
        json['filterOptions'] as Map<String, dynamic>? ?? const {},
      ),
      summary: AdminAuditLogSummary.fromJson(
        json['summary'] as Map<String, dynamic>? ?? const {},
      ),
    );
  }
}

class AdminAuditLogsPagination {
  const AdminAuditLogsPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory AdminAuditLogsPagination.fromJson(Map<String, dynamic> json) {
    final total = (json['total'] as num?)?.toInt() ?? 0;
    final limit = (json['limit'] as num?)?.toInt() ?? 20;
    final totalPages =
        (json['totalPages'] as num?)?.toInt() ??
        (total == 0 ? 1 : ((total + limit - 1) / limit).ceil());

    return AdminAuditLogsPagination(
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: limit,
      total: total,
      totalPages: totalPages,
    );
  }
}
