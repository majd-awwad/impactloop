import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/application/build_display_phase.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';

void main() {
  group('BuildDisplayPhaseResolver', () {
    test('completed and archived builds map to complete', () {
      expect(
        BuildDisplayPhaseResolver.resolve(
          _build(status: ProjectBuildStatus.completed),
          learnerStartedBuild: false,
        ),
        BuildDisplayPhase.complete,
      );
      expect(
        BuildDisplayPhaseResolver.resolve(
          _build(status: ProjectBuildStatus.archived),
          learnerStartedBuild: true,
        ),
        BuildDisplayPhase.complete,
      );
    });

    test('missing materials stay in prepare', () {
      expect(
        BuildDisplayPhaseResolver.resolve(
          _build(
            ready: 1,
            total: 2,
            nextAction: ProjectBuildNextAction.prepareMaterials,
          ),
          learnerStartedBuild: false,
        ),
        BuildDisplayPhase.prepare,
      );
    });

    test('ready materials without starting stay in prepare', () {
      expect(
        BuildDisplayPhaseResolver.resolve(
          _build(
            ready: 2,
            total: 2,
            includeCurrentStep: false,
          ),
          learnerStartedBuild: false,
        ),
        BuildDisplayPhase.prepare,
      );
    });

    test('ready materials after start enter build', () {
      expect(
        BuildDisplayPhaseResolver.resolve(
          _build(ready: 2, total: 2),
          learnerStartedBuild: true,
        ),
        BuildDisplayPhase.build,
      );
    });

    test('progressed steps enter build even without local start flag', () {
      expect(
        BuildDisplayPhaseResolver.resolve(
          _build(ready: 2, total: 2, completedSteps: 1, currentStepNumber: 2),
          learnerStartedBuild: false,
        ),
        BuildDisplayPhase.build,
      );
    });

    test('all steps complete while in progress enter reflect', () {
      expect(
        BuildDisplayPhaseResolver.resolve(
          _build(
            ready: 2,
            total: 2,
            completedSteps: 2,
            nextAction: ProjectBuildNextAction.buildCompleted,
            allStepsCompleted: true,
          ),
          learnerStartedBuild: true,
        ),
        BuildDisplayPhase.reflect,
      );
    });
  });
}

ProjectBuild _build({
  ProjectBuildStatus status = ProjectBuildStatus.inProgress,
  int ready = 1,
  int total = 2,
  int completedSteps = 0,
  int? currentStepNumber,
  ProjectBuildNextAction? nextAction,
  bool allStepsCompleted = false,
  bool includeCurrentStep = true,
}) {
  final steps = includeCurrentStep
      ? <ProjectBuildStepView>[
          ProjectBuildStepView(
            stepId: 'step-1',
            stepNumber: 1,
            title: 'Cut PVC',
            description: 'Cut the pipes.',
            state: allStepsCompleted || completedSteps >= 1
                ? ProjectBuildStepState.completed
                : ProjectBuildStepState.current,
          ),
          ProjectBuildStepView(
            stepId: 'step-2',
            stepNumber: 2,
            title: 'Assemble',
            description: 'Join the frame.',
            state: allStepsCompleted
                ? ProjectBuildStepState.completed
                : completedSteps >= 1
                    ? ProjectBuildStepState.current
                    : ProjectBuildStepState.locked,
          ),
        ]
      : const <ProjectBuildStepView>[];

  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: status,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'PVC Plant Stand',
      shortDescription: 'A simple plant stand build',
    ),
    progress: ProjectBuildProgress(
      total: total,
      ready: ready,
      percent: total == 0 ? 0 : ((ready / total) * 100).round(),
    ),
    materialReadiness: ProjectBuildMaterialReadiness(
      ready: ready,
      linked: ready,
      reserved: 0,
      missing: (total - ready).clamp(0, total),
      total: total,
    ),
    stepProgress: ProjectBuildStepProgress(
      completed: completedSteps,
      total: 2,
      percent: completedSteps == 0 ? 0 : 50 * completedSteps,
      currentStep: currentStepNumber == null
          ? null
          : ProjectBuildCurrentStep(
              stepId: 'step-$currentStepNumber',
              stepNumber: currentStepNumber,
              title: currentStepNumber == 1 ? 'Cut PVC' : 'Assemble',
            ),
      nextAction: nextAction,
      steps: steps,
    ),
    items: const [],
  );
}
