class AppNotification {
  const AppNotification({
    required this.id,
    required this.notificationType,
    required this.title,
    required this.body,
    required this.isRead,
    required this.createdAt,
    this.relatedEntityType,
    this.relatedEntityId,
  });

  final String id;
  final String notificationType;
  final String title;
  final String body;
  final bool isRead;
  final DateTime createdAt;
  final String? relatedEntityType;
  final String? relatedEntityId;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: json['id'] as String? ?? '',
      notificationType: json['notificationType'] as String? ?? '',
      title: json['title'] as String? ?? '',
      body: json['body'] as String? ?? '',
      isRead: json['isRead'] == true,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      relatedEntityType: json['relatedEntityType'] as String?,
      relatedEntityId: json['relatedEntityId'] as String?,
    );
  }

  AppNotification copyWith({
    String? id,
    String? notificationType,
    String? title,
    String? body,
    bool? isRead,
    DateTime? createdAt,
    String? relatedEntityType,
    String? relatedEntityId,
  }) {
    return AppNotification(
      id: id ?? this.id,
      notificationType: notificationType ?? this.notificationType,
      title: title ?? this.title,
      body: body ?? this.body,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt ?? this.createdAt,
      relatedEntityType: relatedEntityType ?? this.relatedEntityType,
      relatedEntityId: relatedEntityId ?? this.relatedEntityId,
    );
  }
}

class AppNotificationsPage {
  const AppNotificationsPage({
    required this.items,
    required this.unreadCount,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<AppNotification> items;
  final int unreadCount;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory AppNotificationsPage.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'];
    final pagination = json['pagination'];

    return AppNotificationsPage(
      items: itemsJson is List
          ? itemsJson
                .whereType<Map>()
                .map(
                  (item) => AppNotification.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      page: pagination is Map ? (pagination['page'] as num?)?.toInt() ?? 1 : 1,
      limit:
          pagination is Map ? (pagination['limit'] as num?)?.toInt() ?? 20 : 20,
      total:
          pagination is Map ? (pagination['total'] as num?)?.toInt() ?? 0 : 0,
      totalPages: pagination is Map
          ? (pagination['totalPages'] as num?)?.toInt() ?? 0
          : 0,
    );
  }
}
