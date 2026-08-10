import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build_material_link.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_build_acquisition_state.dart';

ProjectBuildItem _item({
  required bool isReadyForBuild,
  String reservationStatus = 'ACCEPTED',
  bool includeReservation = true,
  bool includeMaterial = true,
  String? acquisitionState,
  String? allocationResult,
}) {
  return ProjectBuildItem(
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
    isReadyForBuild: isReadyForBuild,
    readinessLabel: isReadyForBuild
        ? 'Ready for build — material acquired'
        : 'Reservation in progress — not ready yet',
    acquisitionState: acquisitionState,
    allocationResult: allocationResult,
    linkedMaterial: includeMaterial
        ? const LinkedMaterialSummary(
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
            availabilityWarning:
                'This linked material is no longer available on the platform.',
          )
        : null,
    linkedReservation: includeReservation
        ? LinkedReservationSummary(
            id: 'reservation-1',
            status: reservationStatus,
            materialId: 'material-1',
            needsAction: false,
            statusLabel: reservationStatus == 'COMPLETED'
                ? 'Ready for build — material acquired'
                : 'Accepted — pickup or delivery in progress',
          )
        : null,
  );
}

void main() {
  group('ProjectBuildAcquisitionState', () {
    test('completed linked reservation maps to acquired', () {
      final item = _item(
        isReadyForBuild: true,
        reservationStatus: 'COMPLETED',
        acquisitionState: 'acquired',
        allocationResult: 'sufficient',
      );

      expect(ProjectBuildAcquisitionState.isAcquired(item), isTrue);
      expect(
        ProjectBuildAcquisitionState.isAcquiredViaCompletedReservation(item),
        isTrue,
      );
      expect(
        ProjectBuildAcquisitionState.shouldShowClassificationControls(item),
        isFalse,
      );
    });

    test('awaiting resolution hides classification controls', () {
      final item = _item(
        isReadyForBuild: false,
        reservationStatus: 'AWAITING_RESOLUTION',
      );

      expect(
        ProjectBuildAcquisitionState.isAwaitingResolution(item),
        isTrue,
      );
      expect(
        ProjectBuildAcquisitionState.shouldShowClassificationControls(item),
        isFalse,
      );
    });

    test('selected material hides classification controls', () {
      final item = _item(
        isReadyForBuild: false,
        includeReservation: false,
      );

      expect(
        ProjectBuildAcquisitionState.hasSelectedMaterial(item),
        isTrue,
      );
      expect(
        ProjectBuildAcquisitionState.shouldShowClassificationControls(item),
        isFalse,
      );
    });

    test('already owned remains distinct from acquired', () {
      final acquired = _item(
        isReadyForBuild: true,
        reservationStatus: 'COMPLETED',
      );
      final alreadyOwned = ProjectBuildItem(
        id: 'item-2',
        requiredComponentId: 'component-2',
        status: ProjectBuildItemStatus.alreadyOwned,
        component: acquired.component,
        isReadyForBuild: true,
        readinessLabel: 'Marked as already owned',
        acquisitionState: 'already_owned',
        allocationResult: 'not_applicable',
      );

      expect(
        ProjectBuildAcquisitionState.isAcquiredViaCompletedReservation(
          alreadyOwned,
        ),
        isFalse,
      );
      expect(
        ProjectBuildAcquisitionState.shouldShowClassificationControls(
          alreadyOwned,
        ),
        isFalse,
      );
    });

    test('completed reservation suppresses unavailable warning', () {
      final item = _item(isReadyForBuild: true, reservationStatus: 'COMPLETED');

      expect(
        ProjectBuildAcquisitionState.shouldShowAvailabilityWarning(
          material: item.linkedMaterial!,
          linkedReservation: item.linkedReservation,
        ),
        isFalse,
      );
    });

    test('incomplete unavailable material still shows warning', () {
      final item = _item(isReadyForBuild: false, reservationStatus: 'ACCEPTED');

      expect(
        ProjectBuildAcquisitionState.shouldShowAvailabilityWarning(
          material: item.linkedMaterial!,
          linkedReservation: item.linkedReservation,
        ),
        isTrue,
      );
    });

    test('build needs refresh only while reservations are active', () {
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
        items: [_item(isReadyForBuild: false, reservationStatus: 'ACCEPTED')],
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
        items: [_item(isReadyForBuild: true, reservationStatus: 'COMPLETED')],
      );

      final selectedOnlyBuild = ProjectBuild(
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
          _item(
            isReadyForBuild: false,
            includeReservation: false,
            includeMaterial: true,
          ),
        ],
      );

      expect(
        ProjectBuildAcquisitionState.buildNeedsActiveRefresh(activeBuild),
        isTrue,
      );
      expect(
        ProjectBuildAcquisitionState.buildNeedsActiveRefresh(acquiredBuild),
        isFalse,
      );
      expect(
        ProjectBuildAcquisitionState.itemNeedsActiveRefresh(
          selectedOnlyBuild.items.single,
        ),
        isFalse,
      );
      expect(
        ProjectBuildAcquisitionState.buildNeedsActiveRefresh(selectedOnlyBuild),
        isFalse,
      );
    });
  });
}
