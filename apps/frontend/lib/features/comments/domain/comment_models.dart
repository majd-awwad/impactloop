class CommentAuthor {
  const CommentAuthor({
    required this.id,
    required this.displayName,
    this.avatarUrl,
  });

  final String id;
  final String displayName;
  final String? avatarUrl;

  factory CommentAuthor.fromJson(Map<String, dynamic> json) {
    return CommentAuthor(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? 'User',
      avatarUrl: json['avatarUrl'] as String?,
    );
  }
}

class CommentReplyTo {
  const CommentReplyTo({required this.id, required this.author});

  final String id;
  final CommentAuthor author;

  factory CommentReplyTo.fromJson(Map<String, dynamic> json) {
    final authorJson = json['author'];
    return CommentReplyTo(
      id: json['id'] as String? ?? '',
      author: authorJson is Map<String, dynamic>
          ? CommentAuthor.fromJson(authorJson)
          : const CommentAuthor(id: '', displayName: 'User'),
    );
  }
}

class CommentItem {
  const CommentItem({
    required this.id,
    required this.body,
    required this.status,
    required this.isDeleted,
    required this.createdAt,
    required this.updatedAt,
    required this.author,
    required this.canEdit,
    required this.canDelete,
    this.materialId,
    this.learningProjectId,
    this.parentCommentId,
    this.rootCommentId,
    this.replyToCommentId,
    this.editedAt,
    this.deletedAt,
    this.replyTo,
    this.repliesCount = 0,
  });

  final String id;
  final String? materialId;
  final String? learningProjectId;
  final String? parentCommentId;
  final String? rootCommentId;
  final String? replyToCommentId;
  final String? body;
  final String status;
  final bool isDeleted;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? editedAt;
  final DateTime? deletedAt;
  final CommentAuthor author;
  final CommentReplyTo? replyTo;
  final int repliesCount;
  final bool canEdit;
  final bool canDelete;

  factory CommentItem.fromJson(Map<String, dynamic> json) {
    final authorJson = json['author'];
    final replyToJson = json['replyTo'];

    return CommentItem(
      id: json['id'] as String? ?? '',
      materialId: json['materialId'] as String?,
      learningProjectId: json['learningProjectId'] as String?,
      parentCommentId: json['parentCommentId'] as String?,
      rootCommentId: json['rootCommentId'] as String?,
      replyToCommentId: json['replyToCommentId'] as String?,
      body: json['body'] as String?,
      status: json['status'] as String? ?? 'VISIBLE',
      isDeleted: json['isDeleted'] == true,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      updatedAt:
          DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      editedAt: DateTime.tryParse(json['editedAt'] as String? ?? ''),
      deletedAt: DateTime.tryParse(json['deletedAt'] as String? ?? ''),
      author: authorJson is Map<String, dynamic>
          ? CommentAuthor.fromJson(authorJson)
          : const CommentAuthor(id: '', displayName: 'User'),
      replyTo: replyToJson is Map<String, dynamic>
          ? CommentReplyTo.fromJson(replyToJson)
          : null,
      repliesCount: (json['repliesCount'] as num?)?.toInt() ?? 0,
      canEdit: json['canEdit'] == true,
      canDelete: json['canDelete'] == true,
    );
  }
}

class CommentsPagination {
  const CommentsPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory CommentsPagination.fromJson(Map<String, dynamic>? json) {
    return CommentsPagination(
      page: (json?['page'] as num?)?.toInt() ?? 1,
      limit: (json?['limit'] as num?)?.toInt() ?? 20,
      total: (json?['total'] as num?)?.toInt() ?? 0,
      totalPages: (json?['totalPages'] as num?)?.toInt() ?? 1,
    );
  }

  bool get hasMore => page < totalPages;
}

class CommentsPage {
  const CommentsPage({required this.items, required this.pagination});

  final List<CommentItem> items;
  final CommentsPagination pagination;

  factory CommentsPage.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    final items = rawItems is List
        ? rawItems
              .whereType<Map<String, dynamic>>()
              .map(CommentItem.fromJson)
              .toList()
        : <CommentItem>[];

    final paginationJson = json['pagination'];
    return CommentsPage(
      items: items,
      pagination: CommentsPagination.fromJson(
        paginationJson is Map<String, dynamic> ? paginationJson : null,
      ),
    );
  }
}

enum CommentTargetType { material, learningProject }
