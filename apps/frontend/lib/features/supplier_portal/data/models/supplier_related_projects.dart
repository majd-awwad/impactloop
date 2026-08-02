class SupplierRelatedProjectsResult {
  const SupplierRelatedProjectsResult({
    required this.materialId,
    required this.relatedProjectCount,
    required this.items,
  });

  final String materialId;
  final int relatedProjectCount;
  final List<SupplierRelatedProjectItem> items;

  factory SupplierRelatedProjectsResult.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'];
    return SupplierRelatedProjectsResult(
      materialId: json['materialId'] as String? ?? '',
      relatedProjectCount: (json['relatedProjectCount'] as num?)?.toInt() ?? 0,
      items: itemsJson is List
          ? itemsJson
                .whereType<Map<String, dynamic>>()
                .map(SupplierRelatedProjectItem.fromJson)
                .toList(growable: false)
          : const [],
    );
  }
}

class SupplierRelatedProjectItem {
  const SupplierRelatedProjectItem({
    required this.projectId,
    required this.title,
    this.coverImageUrl,
    required this.difficulty,
    required this.matchedComponentId,
    required this.matchedComponentName,
    required this.matchReasonCode,
    required this.rankingScore,
  });

  final String projectId;
  final String title;
  final String? coverImageUrl;
  final String difficulty;
  final String matchedComponentId;
  final String matchedComponentName;
  final String matchReasonCode;
  final int rankingScore;

  factory SupplierRelatedProjectItem.fromJson(Map<String, dynamic> json) {
    return SupplierRelatedProjectItem(
      projectId: json['projectId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      coverImageUrl: json['coverImageUrl'] as String?,
      difficulty: json['difficulty'] as String? ?? 'BEGINNER',
      matchedComponentId: json['matchedComponentId'] as String? ?? '',
      matchedComponentName: json['matchedComponentName'] as String? ?? '',
      matchReasonCode: json['matchReasonCode'] as String? ?? 'CATEGORY_MATCH',
      rankingScore: (json['rankingScore'] as num?)?.toInt() ?? 0,
    );
  }
}
