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
  ProjectBuildQuantityAllocation? quantityAllocation,
  String? acquisitionState,
  String? allocationResult,
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
    quantityAllocation: quantityAllocation,
    acquisitionState: acquisitionState,
    allocationResult: allocationResult,
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

  test('insufficient quantity state is displayed', () {
    final item = _baseItem(
      acquisitionState: 'selected',
      allocationResult: 'insufficient_quantity',
      linkedMaterial: _linkedMaterial,
      quantityAllocation: const ProjectBuildQuantityAllocation(
        outcome: 'insufficient_quantity',
        requiredQuantity: 4,
        requiredUnit: 'pieces',
        availableQuantity: 2,
      ),
    );

    final meta = ProjectBuildItemDisplayMeta.forItem(item);
    expect(meta.label.en, LearningProjectBuildL10n.selected.en);
    expect(meta.detail?.en, '2 available, 4 required');
    expect(meta.detail?.ar, 'المتوفر 2، المطلوب 4');
  });

  test('partial acquisition is not displayed as fully Acquired', () {
    final item = _baseItem(
      acquisitionState: 'acquired',
      allocationResult: 'insufficient_quantity',
      linkedMaterial: _linkedMaterial,
      linkedReservation: const LinkedReservationSummary(
        id: 'reservation-1',
        status: 'COMPLETED',
        materialId: 'material-1',
        needsAction: false,
        statusLabel: 'Reservation completed',
        quantityRequested: 2,
      ),
      quantityAllocation: const ProjectBuildQuantityAllocation(
        outcome: 'allocation_partial',
        requiredQuantity: 4,
        requiredUnit: 'pieces',
        acquiredQuantity: 2,
        isQuantityReady: false,
      ),
    );

    final meta = ProjectBuildItemDisplayMeta.forItem(item);
    expect(meta.label.en, LearningProjectBuildL10n.acquired.en);
    expect(meta.detail?.en, contains('Partially acquired —'));
    expect(
      ProjectBuildAcquisitionState.isAcquiredViaCompletedReservation(item),
      isFalse,
    );
  });

  test('completed incompatible acquisition displays Acquired with warning detail', () {
    final item = _baseItem(
      acquisitionState: 'acquired',
      allocationResult: 'incompatible_unit',
      linkedMaterial: _linkedMaterial,
      linkedReservation: const LinkedReservationSummary(
        id: 'reservation-1',
        status: 'COMPLETED',
        materialId: 'material-1',
        needsAction: false,
        statusLabel: 'Reservation completed',
        quantityRequested: 1,
      ),
      quantityAllocation: const ProjectBuildQuantityAllocation(
        outcome: 'incompatible_unit',
        requiredQuantity: 1,
        requiredUnit: 'piece',
        acquiredQuantity: 1,
        isQuantityReady: false,
        warning:
            'Linked material unit is not compatible with the required component unit.',
      ),
    );

    final meta = ProjectBuildItemDisplayMeta.forItem(item);
    expect(meta.label.en, LearningProjectBuildL10n.acquired.en);
    expect(ProjectBuildAcquisitionState.hasSelectedMaterial(item), isFalse);
    expect(ProjectBuildAcquisitionState.isPartiallyAcquired(item), isFalse);
  });

  test('selected incompatible unit stays Selected', () {
    final item = _baseItem(
      acquisitionState: 'selected',
      allocationResult: 'incompatible_unit',
      linkedMaterial: _linkedMaterial,
      quantityAllocation: const ProjectBuildQuantityAllocation(
        outcome: 'incompatible_unit',
        requiredQuantity: 1,
        requiredUnit: 'piece',
        isQuantityReady: false,
        warning:
            'Linked material unit is not compatible with the required component unit.',
      ),
    );

    final meta = ProjectBuildItemDisplayMeta.forItem(item);
    expect(meta.label.en, LearningProjectBuildL10n.selected.en);
    expect(ProjectBuildAcquisitionState.isPartiallyAcquired(item), isFalse);
  });

  test('sufficient completed acquisition displays Acquired', () {
    final item = _baseItem(
      isReadyForBuild: true,
      linkedMaterial: _linkedMaterial,
      linkedReservation: const LinkedReservationSummary(
        id: 'reservation-1',
        status: 'COMPLETED',
        materialId: 'material-1',
        needsAction: false,
        statusLabel: 'Ready for build — material acquired',
        quantityRequested: 4,
      ),
      quantityAllocation: const ProjectBuildQuantityAllocation(
        outcome: 'allocation_sufficient',
        requiredQuantity: 4,
        requiredUnit: 'pieces',
        acquiredQuantity: 4,
        isQuantityReady: true,
      ),
    );

    expect(ProjectBuildItemDisplayMeta.forItem(item).label.en, 'Acquired');
  });

  test('completed sufficient acquisition does not render Selected or insufficient', () {
    final item = _baseItem(
      isReadyForBuild: true,
      acquisitionState: 'acquired',
      allocationResult: 'sufficient',
      readinessLabel: 'Ready for build — material acquired',
      linkedMaterial: _linkedMaterial,
      linkedReservation: const LinkedReservationSummary(
        id: 'reservation-1',
        status: 'COMPLETED',
        materialId: 'material-1',
        needsAction: false,
        statusLabel: 'Ready for build — material acquired',
        quantityRequested: 1,
      ),
      quantityAllocation: const ProjectBuildQuantityAllocation(
        outcome: 'allocation_sufficient',
        requiredQuantity: 1,
        requiredUnit: 'pieces',
        acquiredQuantity: 1,
        isQuantityReady: true,
      ),
    );

    final meta = ProjectBuildItemDisplayMeta.forItem(item);

    expect(meta.label.en, LearningProjectBuildL10n.acquired.en);
    expect(meta.detail?.en, '1 acquired, 1 required');
    expect(
      ProjectBuildAcquisitionState.hasInsufficientQuantity(item),
      isFalse,
    );
    expect(ProjectBuildAcquisitionState.hasSelectedMaterial(item), isFalse);
    expect(meta.label.en, isNot(LearningProjectBuildL10n.selected.en));
    expect(meta.detail?.en, isNot(contains('available')));
  });

  test('completed sufficient acquisition ignores zero listing availability', () {
    final item = _baseItem(
      isReadyForBuild: true,
      acquisitionState: 'acquired',
      allocationResult: 'sufficient',
      linkedMaterial: _linkedMaterial,
      linkedReservation: const LinkedReservationSummary(
        id: 'reservation-1',
        status: 'COMPLETED',
        materialId: 'material-1',
        needsAction: false,
        statusLabel: 'Ready for build — material acquired',
        quantityRequested: 1,
      ),
      quantityAllocation: const ProjectBuildQuantityAllocation(
        outcome: 'allocation_sufficient',
        requiredQuantity: 1,
        requiredUnit: 'pieces',
        acquiredQuantity: 1,
        availableQuantity: 0,
        isQuantityReady: true,
      ),
    );

    expect(
      ProjectBuildItemDisplayMeta.forItem(item).label.en,
      LearningProjectBuildL10n.acquired.en,
    );
    expect(
      ProjectBuildAcquisitionState.hasInsufficientQuantity(item),
      isFalse,
    );
  });
}
