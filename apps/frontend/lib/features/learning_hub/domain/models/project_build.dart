import 'learning_project.dart';

enum ProjectBuildStatus { inProgress, completed, archived }

enum ProjectBuildItemStatus {
  missing,
  alreadyOwned,
  available,
  reserved,
  alternative,
}

extension ProjectBuildItemStatusApi on ProjectBuildItemStatus {
  String get apiValue {
    return switch (this) {
      ProjectBuildItemStatus.missing => 'MISSING',
      ProjectBuildItemStatus.alreadyOwned => 'ALREADY_OWNED',
      ProjectBuildItemStatus.available => 'AVAILABLE',
      ProjectBuildItemStatus.reserved => 'RESERVED',
      ProjectBuildItemStatus.alternative => 'ALTERNATIVE',
    };
  }
}

class ProjectBuildProgress {
  const ProjectBuildProgress({
    required this.total,
    required this.ready,
    required this.percent,
  });

  final int total;
  final int ready;
  final int percent;
}

class ProjectBuildProject {
  const ProjectBuildProject({
    required this.id,
    required this.title,
    required this.shortDescription,
    this.coverImageUrl,
  });

  final String id;
  final String title;
  final String shortDescription;
  final String? coverImageUrl;
}

class ProjectBuildItem {
  const ProjectBuildItem({
    required this.id,
    required this.requiredComponentId,
    required this.status,
    required this.component,
    this.learnerNote,
  });

  final String id;
  final String requiredComponentId;
  final ProjectBuildItemStatus status;
  final ProjectRequiredComponentItem component;
  final String? learnerNote;
}

class ProjectBuild {
  const ProjectBuild({
    required this.id,
    required this.projectId,
    required this.status,
    required this.project,
    required this.progress,
    required this.items,
    this.startedAt,
    this.completedAt,
    this.updatedAt,
  });

  final String id;
  final String projectId;
  final ProjectBuildStatus status;
  final ProjectBuildProject project;
  final ProjectBuildProgress progress;
  final List<ProjectBuildItem> items;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final DateTime? updatedAt;
}
