import 'learning_project.dart';
import 'project_build_material_link.dart';

export 'project_build_material_link.dart';

enum ProjectBuildStatus { inProgress, paused, completed, archived }

extension ProjectBuildStatusApi on ProjectBuildStatus {
  String get apiValue {
    return switch (this) {
      ProjectBuildStatus.inProgress => 'IN_PROGRESS',
      ProjectBuildStatus.paused => 'PAUSED',
      ProjectBuildStatus.completed => 'COMPLETED',
      ProjectBuildStatus.archived => 'ARCHIVED',
    };
  }
}

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

enum ProjectBuildStepState { locked, current, completed }

enum ProjectBuildNextAction {
  prepareMaterials,
  completeCurrentStep,
  buildCompleted,
}

class ProjectBuildMaterialReadiness {
  const ProjectBuildMaterialReadiness({
    required this.ready,
    required this.linked,
    required this.reserved,
    required this.missing,
    required this.total,
  });

  final int ready;
  final int linked;
  final int reserved;
  final int missing;
  final int total;
}

class ProjectBuildStepView {
  const ProjectBuildStepView({
    required this.stepId,
    required this.stepNumber,
    required this.title,
    required this.description,
    required this.state,
    this.imageUrl,
    this.completedAt,
  });

  final String stepId;
  final int stepNumber;
  final String title;
  final String description;
  final ProjectBuildStepState state;
  final String? imageUrl;
  final DateTime? completedAt;
}

class ProjectBuildCurrentStep {
  const ProjectBuildCurrentStep({
    required this.stepId,
    required this.stepNumber,
    required this.title,
  });

  final String stepId;
  final int stepNumber;
  final String title;
}

class ProjectBuildStepProgress {
  const ProjectBuildStepProgress({
    required this.completed,
    required this.total,
    required this.percent,
    required this.steps,
    this.currentStep,
    this.nextAction,
  });

  final int completed;
  final int total;
  final int percent;
  final ProjectBuildCurrentStep? currentStep;
  final ProjectBuildNextAction? nextAction;
  final List<ProjectBuildStepView> steps;
}

class BuildGuideConversationResult {
  const BuildGuideConversationResult({
    required this.conversationId,
    required this.buildContext,
  });

  final String conversationId;
  final BuildGuideContext buildContext;
}

class BuildGuideContext {
  const BuildGuideContext({
    required this.buildId,
    required this.projectId,
    required this.projectTitle,
    required this.buildStatus,
    required this.materialReadiness,
    required this.stepProgress,
    this.currentStep,
  });

  final String buildId;
  final String projectId;
  final String projectTitle;
  final ProjectBuildStatus buildStatus;
  final ProjectBuildMaterialReadiness materialReadiness;
  final ProjectBuildCurrentStep? currentStep;
  final ProjectBuildStepProgressSummary stepProgress;

  factory BuildGuideContext.fromProjectBuild(ProjectBuild build) {
    return BuildGuideContext(
      buildId: build.id,
      projectId: build.projectId,
      projectTitle: build.project.title,
      buildStatus: build.status,
      materialReadiness: build.materialReadiness,
      currentStep: build.stepProgress.currentStep,
      stepProgress: ProjectBuildStepProgressSummary(
        completed: build.stepProgress.completed,
        total: build.stepProgress.total,
        percent: build.stepProgress.percent,
      ),
    );
  }
}

class ProjectBuildStepProgressSummary {
  const ProjectBuildStepProgressSummary({
    required this.completed,
    required this.total,
    required this.percent,
  });

  final int completed;
  final int total;
  final int percent;
}

class ProjectBuildCompletionStoryPhoto {
  const ProjectBuildCompletionStoryPhoto({
    required this.id,
    required this.imageUrl,
    this.caption,
    required this.sortOrder,
  });

  final String id;
  final String imageUrl;
  final String? caption;
  final int sortOrder;
}

class ProjectBuildCompletionStory {
  const ProjectBuildCompletionStory({
    this.reflection,
    this.caption,
    this.updatedAt,
    this.photos = const [],
  });

  final String? reflection;
  final String? caption;
  final DateTime? updatedAt;
  final List<ProjectBuildCompletionStoryPhoto> photos;
}

class ProjectBuildImpactSummary {
  const ProjectBuildImpactSummary({
    required this.projectId,
    required this.projectTitle,
    required this.attemptNumber,
    this.completedAt,
    this.startedAt,
    this.elapsedMs,
    this.requiredMaterialComponentCount = 0,
    this.readyMaterialComponentCount = 0,
    this.alreadyOwnedComponentCount = 0,
    this.acquiredViaImpactLoopCount = 0,
    this.uniqueAcquiredMaterialCount = 0,
    this.completedStepCount = 0,
    this.totalStepCount = 0,
    this.materialCategoriesUsed = const [],
  });

  final String projectId;
  final String projectTitle;
  final int attemptNumber;
  final DateTime? completedAt;
  final DateTime? startedAt;
  final int? elapsedMs;
  final int requiredMaterialComponentCount;
  final int readyMaterialComponentCount;
  final int alreadyOwnedComponentCount;
  final int acquiredViaImpactLoopCount;
  final int uniqueAcquiredMaterialCount;
  final int completedStepCount;
  final int totalStepCount;
  final List<String> materialCategoriesUsed;
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
    required this.isReadyForBuild,
    required this.readinessLabel,
    this.learnerNote,
    this.linkedMaterial,
    this.linkedReservation,
    this.quantityAllocation,
    this.acquisitionState,
    this.allocationResult,
  });

  final String id;
  final String requiredComponentId;
  final ProjectBuildItemStatus status;
  final ProjectRequiredComponentItem component;
  final String? learnerNote;
  final LinkedMaterialSummary? linkedMaterial;
  final LinkedReservationSummary? linkedReservation;
  final bool isReadyForBuild;
  final String readinessLabel;
  final ProjectBuildQuantityAllocation? quantityAllocation;
  final String? acquisitionState;
  final String? allocationResult;
}

class ProjectBuild {
  const ProjectBuild({
    required this.id,
    required this.projectId,
    required this.status,
    required this.project,
    required this.progress,
    required this.items,
    required this.materialReadiness,
    required this.stepProgress,
    this.attemptNumber = 1,
    this.isReadOnly = false,
    this.startedAt,
    this.completedAt,
    this.pausedAt,
    this.archivedAt,
    this.updatedAt,
    this.guideConversationId,
    this.completionStory,
    this.impactSummary,
  });

  final String id;
  final String projectId;
  final int attemptNumber;
  final ProjectBuildStatus status;
  final bool isReadOnly;
  final ProjectBuildProject project;
  final ProjectBuildProgress progress;
  final ProjectBuildMaterialReadiness materialReadiness;
  final ProjectBuildStepProgress stepProgress;
  final List<ProjectBuildItem> items;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final DateTime? pausedAt;
  final DateTime? archivedAt;
  final DateTime? updatedAt;
  final String? guideConversationId;
  final ProjectBuildCompletionStory? completionStory;
  final ProjectBuildImpactSummary? impactSummary;

  bool get isEditingLocked =>
      isReadOnly ||
      status == ProjectBuildStatus.paused ||
      status == ProjectBuildStatus.completed ||
      status == ProjectBuildStatus.archived;
}
