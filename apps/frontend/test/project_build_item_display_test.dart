import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/learning_project_build_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_build_acquisition_state.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_build_item_display.dart';

const _linkedMaterial = LinkedMaterialSummary(
  id: 'material-1',
  title: 'Arduino Uno',
  categoryNameEn: 'Electronics',
  condition: 'GOOD',
  status: 'AVAILABLE',
  isPubliclyAvailable: true,
  isFree: true,
  currency: 'NIS',
  supplierName: 'Supplier',
  city: 'Ramallah',
  pickupAllowed: true,
  deliveryAllowed: false,
);

const _component = ProjectRequiredComponentItem(
  id: 'component-1',
  name: LocalizedText(en: 'Arduino', ar: 'Arduino'),
  materialType: 'Board',
  quantity: 1,
  unit: 'piece',
  isRequired: true,
  canBeSubstituted: false,
);

ProjectBuildItem _baseItem({
  ProjectBuildItemStatus status = ProjectBuildItemStatus.missing,
  bool isReadyForBuild = false,
  String readinessLabel = 'Still missing',
  LinkedMaterialSummary? linkedMaterial,
  LinkedReservationSummary? linkedReservation,
}) {
  return ProjectBuildItem(
    id: 'item-1',
    requiredComponentId: 'component-1',
    status: status,
    component: _component,
    isReadyForBuild: isReadyForBuild,
    readinessLabel: readinessLabel,
    linkedMaterial: linkedMaterial,
    linkedReservation: linkedReservation,
  );
}

void main() {
  test('linked material without reservation renders Selected', () {
    final item = _baseItem(
      readinessLabel:
          'Material selected — reserve or acquire it before building.',
      linkedMaterial: _linkedMaterial,
    );

    final meta = ProjectBuildItemDisplayMeta.forItem(item);

    expect(meta.label.en, 'Selected');
    expect(meta.label.en, isNot('Missing'));
  });

  test('raw MISSING status does not visually override Selected', () {
    final item = _baseItem(
      status: ProjectBuildItemStatus.missing,
      readinessLabel:
          'Material selected — reserve or acquire it before building.',
      linkedMaterial: _linkedMaterial,
    );

    expect(item.status, ProjectBuildItemStatus.missing);
    expect(ProjectBuildItemDisplayMeta.forItem(item).label.en, 'Selected');
  });

  test('selected material remains not ready for build', () {
    final item = _baseItem(
      linkedMaterial: _linkedMaterial,
      readinessLabel:
          'Material selected — reserve or acquire it before building.',
    );

    expect(item.isReadyForBuild, isFalse);
    expect(ProjectBuildAcquisitionState.hasSelectedMaterial(item), isTrue);
  });

  test('selected material hides classification controls', () {
    final item = _baseItem(linkedMaterial: _linkedMaterial);

    expect(
      ProjectBuildAcquisitionState.shouldShowClassificationControls(item),
      isFalse,
    );
  });

  test('missing still appears when no material is linked', () {
    final item = _baseItem();

    expect(ProjectBuildItemDisplayMeta.forItem(item).label.en, 'Missing');
    expect(
      ProjectBuildAcquisitionState.shouldShowClassificationControls(item),
      isTrue,
    );
  });

  test('active linked reservation renders Reserved', () {
    final item = _baseItem(
      linkedMaterial: _linkedMaterial,
      linkedReservation: const LinkedReservationSummary(
        id: 'reservation-1',
        status: 'ACCEPTED',
        materialId: 'material-1',
        needsAction: false,
        statusLabel: 'Accepted',
      ),
      readinessLabel: 'Reservation in progress — not ready yet',
    );

    expect(ProjectBuildItemDisplayMeta.forItem(item).label.en, 'Reserved');
    expect(
      ProjectBuildAcquisitionState.shouldShowClassificationControls(item),
      isFalse,
    );
  });

  test('awaiting resolution renders Needs attention', () {
    final item = _baseItem(
      linkedReservation: const LinkedReservationSummary(
        id: 'reservation-1',
        status: 'AWAITING_RESOLUTION',
        materialId: 'material-1',
        needsAction: true,
        statusLabel: 'Reservation requires resolution',
      ),
      readinessLabel: 'Reservation requires resolution',
    );

    expect(
      ProjectBuildItemDisplayMeta.forItem(item).label.en,
      'Needs attention',
    );
  });

  test('completed linked reservation renders Acquired', () {
    final item = _baseItem(
      isReadyForBuild: true,
      linkedMaterial: _linkedMaterial,
      linkedReservation: const LinkedReservationSummary(
        id: 'reservation-1',
        status: 'COMPLETED',
        materialId: 'material-1',
        needsAction: false,
        statusLabel: 'Ready for build — material acquired',
      ),
      readinessLabel: 'Ready for build — material acquired',
    );

    expect(ProjectBuildItemDisplayMeta.forItem(item).label.en, 'Acquired');
  });

  test('already owned remains distinct from Selected and Acquired', () {
    final alreadyOwned = _baseItem(
      status: ProjectBuildItemStatus.alreadyOwned,
      isReadyForBuild: true,
      readinessLabel: 'Marked as already owned',
    );
    final selected = _baseItem(linkedMaterial: _linkedMaterial);
    final acquired = _baseItem(
      isReadyForBuild: true,
      linkedMaterial: _linkedMaterial,
      linkedReservation: const LinkedReservationSummary(
        id: 'reservation-1',
        status: 'COMPLETED',
        materialId: 'material-1',
        needsAction: false,
        statusLabel: 'Completed',
      ),
    );

    expect(
      ProjectBuildItemDisplayMeta.forItem(alreadyOwned).label.en,
      LearningProjectBuildL10n.alreadyOwned.en,
    );
    expect(
      ProjectBuildItemDisplayMeta.forItem(selected).label.en,
      LearningProjectBuildL10n.selected.en,
    );
    expect(
      ProjectBuildItemDisplayMeta.forItem(acquired).label.en,
      LearningProjectBuildL10n.acquired.en,
    );
  });
}
