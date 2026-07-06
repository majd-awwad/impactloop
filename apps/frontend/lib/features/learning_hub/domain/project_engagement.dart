class ProjectEngagement {
  const ProjectEngagement({
    required this.projectId,
    required this.likesCount,
    required this.isLiked,
  });

  final String projectId;
  final int likesCount;
  final bool isLiked;

  factory ProjectEngagement.fromJson(Map<String, dynamic> json) {
    return ProjectEngagement(
      projectId: json['projectId'] as String? ?? '',
      likesCount: _intFromDynamic(json['likesCount']) ?? 0,
      isLiked: json['isLiked'] == true,
    );
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
}
