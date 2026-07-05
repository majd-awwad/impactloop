class ProjectSaveStatus {
  const ProjectSaveStatus({required this.projectId, required this.isSaved});

  final String projectId;
  final bool isSaved;

  factory ProjectSaveStatus.fromJson(Map<String, dynamic> json) {
    return ProjectSaveStatus(
      projectId: json['projectId'] as String? ?? '',
      isSaved: json['isSaved'] == true,
    );
  }
}
