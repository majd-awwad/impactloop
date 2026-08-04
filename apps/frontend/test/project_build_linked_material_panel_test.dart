import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build_material_link.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/learning_project_build_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_build_material_linking.dart';

ProjectBuildItem _panelItem({
  required bool isReadyForBuild,
  String? acquisitionState,
  String? allocationResult,
  String reservationStatus = 'COMPLETED',
  bool includeReservation = true,
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
        : 'Partially acquired — insufficient quantity',
    acquisitionState: acquisitionState,
    allocationResult: allocationResult,
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
      availabilityWarning:
          'This linked material is no longer available on the platform.',
    ),
    linkedReservation: includeReservation
        ? LinkedReservationSummary(
            id: 'reservation-1',
            status: reservationStatus,
            materialId: 'material-1',
            needsAction: false,
            statusLabel: 'Reservation completed',
            quantityRequested: 1,
          )
        : null,
  );
}

void main() {
  testWidgets('completed sufficient acquisition shows acquired and ready once', (
    tester,
  ) async {
    final item = _panelItem(
      isReadyForBuild: true,
      acquisitionState: 'acquired',
      allocationResult: 'sufficient',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProjectBuildLinkedMaterialPanel(
            material: item.linkedMaterial!,
            item: item,
            isBusy: false,
            onViewMaterial: () {},
            onUnlink: () {},
          ),
        ),
      ),
    );

    expect(
      find.text('This linked material is no longer available on the platform.'),
      findsNothing,
    );
    expect(find.text(LearningProjectBuildL10n.acquired.en), findsNothing);
    expect(
      find.text(LearningProjectBuildL10n.readyForBuildMaterialAcquired.en),
      findsOneWidget,
    );
    expect(find.text(LearningProjectBuildL10n.partiallyAcquired.en), findsNothing);
  });

  testWidgets('completed incompatible acquisition shows acquired warning only', (
    tester,
  ) async {
    final item = _panelItem(
      isReadyForBuild: false,
      acquisitionState: 'acquired',
      allocationResult: 'incompatible_unit',
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProjectBuildLinkedMaterialPanel(
            material: item.linkedMaterial!,
            item: item,
            isBusy: false,
            onViewMaterial: () {},
            onUnlink: () {},
          ),
        ),
      ),
    );

    expect(find.text(LearningProjectBuildL10n.acquired.en), findsNothing);
    expect(
      find.text(LearningProjectBuildL10n.acquiredIncompatibleUnit.en),
      findsOneWidget,
    );
    expect(find.text(LearningProjectBuildL10n.partiallyAcquired.en), findsNothing);
    expect(find.text('Selected'), findsNothing);
  });

  testWidgets('incomplete unavailable material still shows warning', (
    tester,
  ) async {
    final item = ProjectBuildItem(
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
      acquisitionState: 'reserved',
      allocationResult: 'not_applicable',
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
        availabilityWarning:
            'This linked material is no longer available on the platform.',
      ),
      linkedReservation: const LinkedReservationSummary(
        id: 'reservation-1',
        status: 'ACCEPTED',
        materialId: 'material-1',
        needsAction: false,
        statusLabel: 'Accepted — pickup or delivery in progress',
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProjectBuildLinkedMaterialPanel(
            material: item.linkedMaterial!,
            item: item,
            isBusy: false,
            onViewMaterial: () {},
            onUnlink: () {},
          ),
        ),
      ),
    );

    expect(
      find.text('This linked material is no longer available on the platform.'),
      findsOneWidget,
    );
    expect(
      find.text('Accepted — pickup or delivery in progress'),
      findsOneWidget,
    );
  });

  testWidgets('selected material without reservation shows reserve action', (
    tester,
  ) async {
    final item = _panelItem(
      isReadyForBuild: false,
      acquisitionState: 'selected',
      allocationResult: 'sufficient',
      includeReservation: false,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ProjectBuildLinkedMaterialPanel(
            material: item.linkedMaterial!,
            item: item,
            isBusy: false,
            onViewMaterial: () {},
            onReserveMaterial: () {},
            onUnlink: () {},
          ),
        ),
      ),
    );

    expect(
      find.text(LearningProjectBuildL10n.materialSelectedReserveOrAcquire.en),
      findsOneWidget,
    );
    expect(find.text('Reserve this material'), findsOneWidget);
  });
}
