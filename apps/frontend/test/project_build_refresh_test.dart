import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/application/project_build_refresh.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build_material_link.dart';

void main() {
  test('refresh controller polls only while active reservations remain', () async {
    var refreshCount = 0;
    final controller = ProjectBuildRefreshController(
      onRefresh: () => refreshCount++,
      interval: const Duration(milliseconds: 50),
    );

    final activeBuild = ProjectBuild(
      id: 'build-1',
      projectId: 'project-1',
      status: ProjectBuildStatus.inProgress,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'Rolling Workshop Storage Crate',
        shortDescription: 'Build a rolling crate',
      ),
      progress: const ProjectBuildProgress(total: 1, ready: 0, percent: 0),
      materialReadiness: const ProjectBuildMaterialReadiness(
        ready: 0,
        linked: 1,
        reserved: 1,
        missing: 0,
        total: 1,
      ),
      stepProgress: const ProjectBuildStepProgress(
        completed: 0,
        total: 1,
        percent: 0,
        steps: [],
      ),
      items: [
        ProjectBuildItem(
          id: 'item-1',
          requiredComponentId: 'component-1',
          status: ProjectBuildItemStatus.missing,
          component: const ProjectRequiredComponentItem(
            id: 'component-1',
            name: LocalizedText(en: 'Plastic crate', ar: 'صندوق بلاستيك'),
            materialType: 'Storage',
            quantity: 1,
            unit: 'piece',
            isRequired: true,
            canBeSubstituted: false,
          ),
          isReadyForBuild: false,
          readinessLabel: 'Reservation in progress — not ready yet',
          linkedMaterial: const LinkedMaterialSummary(
            id: 'material-1',
            title: 'Sorted Plastic Bottle Caps Bag',
            categoryNameEn: 'Storage',
            condition: 'GOOD',
            status: 'REUSED',
            isPubliclyAvailable: false,
            isFree: true,
            currency: 'NIS',
            supplierName: 'Supplier',
            city: 'Ramallah',
            pickupAllowed: true,
            deliveryAllowed: false,
          ),
          linkedReservation: const LinkedReservationSummary(
            id: 'reservation-1',
            status: 'ACCEPTED',
            materialId: 'material-1',
            needsAction: false,
            statusLabel: 'Accepted — pickup or delivery in progress',
          ),
        ),
      ],
    );

    final acquiredBuild = ProjectBuild(
      id: 'build-1',
      projectId: 'project-1',
      status: ProjectBuildStatus.inProgress,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'Rolling Workshop Storage Crate',
        shortDescription: 'Build a rolling crate',
      ),
      progress: const ProjectBuildProgress(total: 1, ready: 1, percent: 100),
      materialReadiness: const ProjectBuildMaterialReadiness(
        ready: 1,
        linked: 1,
        reserved: 0,
        missing: 0,
        total: 1,
      ),
      stepProgress: const ProjectBuildStepProgress(
        completed: 0,
        total: 1,
        percent: 0,
        steps: [],
      ),
      items: [
        ProjectBuildItem(
          id: 'item-1',
          requiredComponentId: 'component-1',
          status: ProjectBuildItemStatus.missing,
          component: activeBuild.items.single.component,
          isReadyForBuild: true,
          readinessLabel: 'Ready for build — material acquired',
          linkedMaterial: activeBuild.items.single.linkedMaterial,
          linkedReservation: const LinkedReservationSummary(
            id: 'reservation-1',
            status: 'COMPLETED',
            materialId: 'material-1',
            needsAction: false,
            statusLabel: 'Ready for build — material acquired',
          ),
        ),
      ],
    );

    controller.syncPolling(activeBuild);
    expect(controller.isPollingActive, isTrue);

    await Future<void>.delayed(const Duration(milliseconds: 120));
    expect(refreshCount, greaterThanOrEqualTo(1));

    controller.syncPolling(acquiredBuild);
    expect(controller.isPollingActive, isFalse);

    final beforeDisposeCount = refreshCount;
    await Future<void>.delayed(const Duration(milliseconds: 120));
    expect(refreshCount, beforeDisposeCount);

    controller.dispose();

    final countAfterDispose = refreshCount;
    await Future<void>.delayed(const Duration(milliseconds: 120));
    expect(refreshCount, countAfterDispose);
  });
}
