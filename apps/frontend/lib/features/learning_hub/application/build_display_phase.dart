import '../domain/models/project_build.dart';

/// Frontend-only journey stage derived from the existing build payload.
enum BuildDisplayPhase { prepare, build, reflect, complete }

class BuildDisplayPhaseResolver {
  const BuildDisplayPhaseResolver._();

  static bool materialsAreReady(ProjectBuild build) {
    if (build.stepProgress.nextAction ==
        ProjectBuildNextAction.prepareMaterials) {
      return false;
    }

    if (build.items.isNotEmpty) {
      return build.items.every((item) => item.isReadyForBuild);
    }

    if (build.materialReadiness.total <= 0) {
      return true;
    }

    return build.materialReadiness.ready >= build.materialReadiness.total;
  }

  static bool hasStartedPracticalBuild(ProjectBuild build) {
    return build.stepProgress.completed > 0 ||
        (build.stepProgress.currentStep != null &&
            build.stepProgress.currentStep!.stepNumber > 1);
  }

  static bool stepsAreComplete(ProjectBuild build) {
    if (build.stepProgress.nextAction ==
        ProjectBuildNextAction.buildCompleted) {
      return true;
    }

    final steps = build.stepProgress.steps;
    if (steps.isEmpty) {
      return false;
    }
    return steps.every((step) => step.state == ProjectBuildStepState.completed);
  }

  static BuildDisplayPhase resolve(
    ProjectBuild build, {
    required bool learnerStartedBuild,
  }) {
    if (build.status == ProjectBuildStatus.completed ||
        build.status == ProjectBuildStatus.archived) {
      return BuildDisplayPhase.complete;
    }

    if (stepsAreComplete(build)) {
      return BuildDisplayPhase.reflect;
    }

    if (!materialsAreReady(build)) {
      return BuildDisplayPhase.prepare;
    }

    if (learnerStartedBuild ||
        hasStartedPracticalBuild(build) ||
        build.stepProgress.currentStep != null ||
        build.stepProgress.nextAction ==
            ProjectBuildNextAction.completeCurrentStep ||
        build.stepProgress.steps.any(
          (step) => step.state == ProjectBuildStepState.current,
        )) {
      return BuildDisplayPhase.build;
    }

    return BuildDisplayPhase.prepare;
  }
}
