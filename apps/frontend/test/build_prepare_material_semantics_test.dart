import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/models/project_material_coverage.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/learning_project_build_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/project_build_page_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_journey/build_prepare_material_semantics.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_materials/build_material_card_presentation.dart';

ProjectRequiredComponentItem _component({
  String id = 'component-1',
  String name = 'Arduino Uno',
  double quantity = 1,
  String unit = 'piece',
  ComponentPublicAvailabilityStatus? publicAvailabilityStatus,
}) {
  return ProjectRequiredComponentItem(
    id: id,
    name: LocalizedText(en: name, ar: name),
    materialType: 'Board',
    quantity: quantity,
    unit: unit,
    isRequired: true,
    canBeSubstituted: false,
    publicAvailabilityStatus: publicAvailabilityStatus,
  );
}

LinkedMaterialSummary _material() {
  return const LinkedMaterialSummary(
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
}

ProjectBuildItem _item({
  String id = 'item-1',
  ProjectBuildItemStatus status = ProjectBuildItemStatus.missing,
  bool isReadyForBuild = false,
  String readinessLabel = 'Still missing',
  LinkedMaterialSummary? linkedMaterial,
  LinkedReservationSummary? linkedReservation,
  ProjectBuildQuantityAllocation? quantityAllocation,
  String? acquisitionState,
  String? allocationResult,
  ProjectRequiredComponentItem? component,
}) {
  return ProjectBuildItem(
    id: id,
    requiredComponentId: component?.id ?? 'component-1',
    status: status,
    component: component ?? _component(),
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
  group('BuildPrepareMaterialSemantics', () {
    test(
      'active reservation is in progress even when checklist status is missing',
      () {
        final item = _item(
          acquisitionState: 'missing',
          linkedMaterial: _material(),
          linkedReservation: const LinkedReservationSummary(
            id: 'reservation-1',
            status: 'ACCEPTED',
            materialId: 'material-1',
            needsAction: false,
            statusLabel: 'Accepted',
          ),
        );

        final semantics = BuildPrepareMaterialSemantics.fromItem(
          item,
          isEditingLocked: false,
        );

        expect(semantics.kind, BuildPrepareMaterialKind.reserved);
        expect(semantics.group, BuildPrepareMaterialGroup.inProgress);
        expect(
          semantics.subtitle.ar,
          isNot(ProjectBuildPageL10n.notProvidedYet.ar),
        );
        expect(
          semantics.subtitle.ar,
          ProjectBuildPageL10n.reservedMaterialBody.ar,
        );
        expect(
          semantics.primaryAction?.kind,
          BuildMaterialActionKind.viewReservation,
        );
        expect(
          semantics.menuItems.map((action) => action.kind),
          isNot(contains(BuildMaterialActionKind.findMatching)),
        );
      },
    );

    test('already owned ready material is not missing', () {
      final item = _item(
        status: ProjectBuildItemStatus.alreadyOwned,
        isReadyForBuild: true,
        readinessLabel: 'Already owned',
        acquisitionState: 'already_owned',
        allocationResult: 'not_applicable',
      );

      final semantics = BuildPrepareMaterialSemantics.fromItem(
        item,
        isEditingLocked: false,
      );

      expect(semantics.kind, BuildPrepareMaterialKind.readyOwned);
      expect(semantics.group, BuildPrepareMaterialGroup.ready);
      expect(semantics.statusLabel.ar, 'جاهز');
      expect(semantics.subtitle.ar, 'متوفر لديك · جاهز للاستخدام');
      expect(semantics.primaryAction, isNull);
      expect(semantics.density, BuildPrepareCardDensity.mini);
    });

    test('available checklist status is matches available, not missing', () {
      final item = _item(status: ProjectBuildItemStatus.available);

      final semantics = BuildPrepareMaterialSemantics.fromItem(
        item,
        isEditingLocked: false,
      );

      expect(semantics.kind, BuildPrepareMaterialKind.matchesAvailable);
      expect(semantics.group, BuildPrepareMaterialGroup.needsAction);
      expect(semantics.statusLabel.ar, 'خيارات متاحة');
      expect(
        semantics.primaryAction?.kind,
        BuildMaterialActionKind.browseMatching,
      );
      expect(semantics.primaryAction?.label.ar, 'عرض الخيارات');
      expect(
        semantics.secondaryAction?.kind,
        BuildMaterialActionKind.iHaveThis,
      );
    });

    test('insufficient allocated quantity is needs action, not missing', () {
      final item = _item(
        acquisitionState: 'selected',
        allocationResult: 'insufficient_quantity',
        linkedMaterial: _material(),
        quantityAllocation: const ProjectBuildQuantityAllocation(
          outcome: 'allocation_partial',
          requiredQuantity: 3,
          requiredUnit: 'piece',
          availableQuantity: 1,
          isQuantityReady: false,
        ),
      );

      final semantics = BuildPrepareMaterialSemantics.fromItem(
        item,
        isEditingLocked: false,
      );

      expect(semantics.kind, BuildPrepareMaterialKind.insufficientQuantity);
      expect(semantics.group, BuildPrepareMaterialGroup.needsAction);
      expect(semantics.statusLabel.ar, 'الكمية غير كافية');
      expect(semantics.subtitle.ar, 'المتوفر 1، المطلوب 3');
      expect(semantics.primaryAction?.label.ar, 'حل المشكلة');
    });

    test('incompatible unit is localized and not treated as missing', () {
      final item = _item(
        acquisitionState: 'selected',
        allocationResult: 'incompatible_unit',
        linkedMaterial: _material(),
        quantityAllocation: const ProjectBuildQuantityAllocation(
          outcome: 'incompatible_unit',
          requiredQuantity: 1,
          requiredUnit: 'piece',
          isQuantityReady: false,
          warning:
              'Linked material unit is not compatible with the required component unit.',
        ),
      );

      final semantics = BuildPrepareMaterialSemantics.fromItem(
        item,
        isEditingLocked: false,
      );

      expect(semantics.kind, BuildPrepareMaterialKind.incompatibleUnit);
      expect(semantics.group, BuildPrepareMaterialGroup.needsAction);
      expect(semantics.statusLabel.ar, 'الوحدة غير متوافقة');
      expect(
        semantics.subtitle.ar,
        LearningProjectBuildL10n.incompatibleUnitBody.ar,
      );
      expect(semantics.subtitle.ar, isNot(contains('compatible')));
    });

    test('unresolved missing stays missing', () {
      final item = _item();

      final semantics = BuildPrepareMaterialSemantics.fromItem(
        item,
        isEditingLocked: false,
      );

      expect(semantics.kind, BuildPrepareMaterialKind.missing);
      expect(semantics.group, BuildPrepareMaterialGroup.needsAction);
      expect(semantics.statusLabel.ar, 'مفقود');
      expect(semantics.subtitle.ar, 'لم يتم اختيار مادة لهذا المكوّن بعد');
      expect(
        semantics.primaryAction?.kind,
        BuildMaterialActionKind.findMatching,
      );
      expect(
        semantics.secondaryAction?.kind,
        BuildMaterialActionKind.iHaveThis,
      );
    });

    test('selected linked material without reservation is in progress', () {
      final item = _item(
        acquisitionState: 'selected',
        linkedMaterial: _material(),
      );

      final semantics = BuildPrepareMaterialSemantics.fromItem(
        item,
        isEditingLocked: false,
      );

      expect(semantics.kind, BuildPrepareMaterialKind.selected);
      expect(semantics.group, BuildPrepareMaterialGroup.inProgress);
      expect(semantics.statusLabel.ar, 'مادة مختارة');
    });

    test(
      'groups preserve visual priority: needs action, in progress, ready',
      () {
        final items = [
          _item(
            id: 'ready',
            isReadyForBuild: true,
            status: ProjectBuildItemStatus.alreadyOwned,
            acquisitionState: 'already_owned',
          ),
          _item(
            id: 'reserved',
            acquisitionState: 'missing',
            linkedMaterial: _material(),
            linkedReservation: const LinkedReservationSummary(
              id: 'reservation-1',
              status: 'PENDING',
              materialId: 'material-1',
              needsAction: false,
              statusLabel: 'Pending',
            ),
          ),
          _item(id: 'missing'),
        ];

        expect(
          BuildPrepareMaterialSemantics.itemsInGroup(
            items,
            BuildPrepareMaterialGroup.needsAction,
          ).map((item) => item.id),
          ['missing'],
        );
        expect(
          BuildPrepareMaterialSemantics.itemsInGroup(
            items,
            BuildPrepareMaterialGroup.inProgress,
          ).map((item) => item.id),
          ['reserved'],
        );
        expect(
          BuildPrepareMaterialSemantics.itemsInGroup(
            items,
            BuildPrepareMaterialGroup.ready,
          ).map((item) => item.id),
          ['ready'],
        );
      },
    );

    test(
      'public availability can mark unresolved items as matches available',
      () {
        final item = _item(
          component: _component(
            publicAvailabilityStatus:
                ComponentPublicAvailabilityStatus.available,
          ),
        );

        expect(
          BuildPrepareMaterialSemantics.resolveKind(item),
          BuildPrepareMaterialKind.matchesAvailable,
        );
      },
    );

    test(
      'already owned without readiness or a link is needs-update, not missing or ready',
      () {
        final item = _item(
          status: ProjectBuildItemStatus.alreadyOwned,
          isReadyForBuild: false,
          acquisitionState: 'already_owned',
        );

        final semantics = BuildPrepareMaterialSemantics.fromItem(
          item,
          isEditingLocked: false,
        );

        expect(semantics.kind, BuildPrepareMaterialKind.needsUpdate);
        expect(semantics.group, BuildPrepareMaterialGroup.needsAction);
        expect(semantics.statusLabel.ar, 'يحتاج تحديث');
        expect(
          semantics.subtitle.ar,
          ProjectBuildPageL10n.ownedNeedsUpdateBody.ar,
        );
        expect(semantics.statusLabel.ar, isNot('مفقود'));
        expect(semantics.statusLabel.ar, isNot('جاهز'));
        expect(
          semantics.primaryAction?.kind,
          BuildMaterialActionKind.changeStatus,
        );
      },
    );

    test('ready owned unlinked keeps change-status in the menu', () {
      final item = _item(
        status: ProjectBuildItemStatus.alreadyOwned,
        isReadyForBuild: true,
        readinessLabel: 'Already owned',
        acquisitionState: 'already_owned',
        allocationResult: 'not_applicable',
      );

      final semantics = BuildPrepareMaterialSemantics.fromItem(
        item,
        isEditingLocked: false,
      );

      expect(semantics.kind, BuildPrepareMaterialKind.readyOwned);
      expect(semantics.secondaryAction, isNull);
      expect(semantics.menuItems, isNotEmpty);
      expect(
        semantics.menuItems.map((action) => action.kind),
        containsAll([
          BuildMaterialActionKind.changeStatus,
          BuildMaterialActionKind.editNote,
        ]),
      );
      expect(
        semantics.menuItems.map((action) => action.kind),
        isNot(contains(BuildMaterialActionKind.findMatching)),
      );
      expect(
        semantics.menuItems.map((action) => action.kind),
        isNot(contains(BuildMaterialActionKind.reserve)),
      );
    });

    test('ready owned linked shows view-material and keeps menu actions', () {
      final item = _item(
        status: ProjectBuildItemStatus.alreadyOwned,
        isReadyForBuild: true,
        readinessLabel: 'Already owned',
        acquisitionState: 'already_owned',
        linkedMaterial: _material(),
      );

      final semantics = BuildPrepareMaterialSemantics.fromItem(
        item,
        isEditingLocked: false,
      );

      expect(semantics.kind, BuildPrepareMaterialKind.readyOwned);
      expect(
        semantics.secondaryAction?.kind,
        BuildMaterialActionKind.viewMaterial,
      );
      expect(
        semantics.secondaryAction?.label.ar,
        LearningProjectBuildL10n.viewMaterial.ar,
      );
      expect(
        semantics.menuItems.map((action) => action.kind),
        contains(BuildMaterialActionKind.changeStatus),
      );
      expect(
        semantics.menuItems.map((action) => action.kind),
        contains(BuildMaterialActionKind.unlink),
      );
      expect(
        semantics.menuItems.map((action) => action.kind),
        isNot(contains(BuildMaterialActionKind.viewMaterial)),
      );
      expect(
        semantics.menuItems.map((action) => action.kind),
        isNot(contains(BuildMaterialActionKind.findMatching)),
      );
      expect(
        semantics.menuItems.map((action) => action.kind),
        isNot(contains(BuildMaterialActionKind.reserve)),
      );
    });

    test('ready acquired linked shows view-material and remove/use-another', () {
      final item = _item(
        isReadyForBuild: true,
        readinessLabel: 'Acquired',
        acquisitionState: 'acquired',
        allocationResult: 'sufficient',
        linkedMaterial: _material(),
        linkedReservation: const LinkedReservationSummary(
          id: 'reservation-1',
          status: 'COMPLETED',
          materialId: 'material-1',
          needsAction: false,
          statusLabel: 'Completed',
        ),
      );

      final semantics = BuildPrepareMaterialSemantics.fromItem(
        item,
        isEditingLocked: false,
      );

      expect(semantics.kind, BuildPrepareMaterialKind.readyAcquired);
      expect(
        semantics.secondaryAction?.kind,
        BuildMaterialActionKind.viewMaterial,
      );
      expect(
        semantics.menuItems.map((action) => action.kind),
        containsAll([
          BuildMaterialActionKind.changeStatus,
          BuildMaterialActionKind.removeFromComponent,
          BuildMaterialActionKind.useAnother,
        ]),
      );
      expect(
        semantics.menuItems.map((action) => action.kind),
        isNot(contains(BuildMaterialActionKind.findMatching)),
      );
      expect(
        semantics.menuItems.map((action) => action.kind),
        isNot(contains(BuildMaterialActionKind.reserve)),
      );
    });
  });
}
