class ProjectFollowStatus {
  const ProjectFollowStatus({
    required this.projectId,
    required this.followersCount,
    required this.isFollowing,
  });

  final String projectId;
  final int followersCount;
  final bool isFollowing;

  factory ProjectFollowStatus.fromJson(Map<String, dynamic> json) {
    return ProjectFollowStatus(
      projectId: json['projectId'] as String? ?? '',
      followersCount: _intFromDynamic(json['followersCount']) ?? 0,
      isFollowing: json['isFollowing'] == true,
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
