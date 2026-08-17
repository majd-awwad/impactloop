import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/l10n/learning_project_build_l10n.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_materials/build_material_card.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_materials/build_material_card_presentation.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/build_materials/build_project_materials_section.dart';

ProjectRequiredComponentItem _component({
  String name = 'Arduino Uno',
  double quantity = 1,
  String unit = 'piece',
}) {
  return ProjectRequiredComponentItem(
    id: 'component-1',
    name: LocalizedText(en: name, ar: name),
    materialType: 'Board',
    quantity: quantity,
    unit: unit,
    isRequired: true,
    canBeSubstituted: false,
  );
}

ProjectBuildItem _item({
  ProjectBuildItemStatus status = ProjectBuildItemStatus.missing,
  bool isReadyForBuild = false,
  String readinessLabel = 'Still missing',
  LinkedMaterialSummary? linkedMaterial,
  LinkedReservationSummary? linkedReservation,
  String? acquisitionState,
}) {
  return ProjectBuildItem(
    id: 'item-1',
    requiredComponentId: 'component-1',
    status: status,
    component: _component(),
    isReadyForBuild: isReadyForBuild,
    readinessLabel: readinessLabel,
    linkedMaterial: linkedMaterial,
    linkedReservation: linkedReservation,
    acquisitionState: acquisitionState,
  );
}

ProjectBuild _buildWithItems(List<ProjectBuildItem> items) {
  final ready = items.where((item) => item.isReadyForBuild).length;
  return ProjectBuild(
    id: 'build-1',
    projectId: 'project-1',
    status: ProjectBuildStatus.inProgress,
    project: const ProjectBuildProject(
      id: 'project-1',
      title: 'Demo',
      shortDescription: 'Demo',
    ),
    progress: ProjectBuildProgress(
      total: items.length,
      ready: ready,
      percent: items.isEmpty ? 0 : ((ready / items.length) * 100).round(),
    ),
    materialReadiness: ProjectBuildMaterialReadiness(
      ready: ready,
      linked: 0,
      reserved: 0,
      missing: items.length - ready,
      total: items.length,
    ),
    stepProgress: const ProjectBuildStepProgress(
      completed: 0,
      total: 0,
      percent: 0,
      steps: [],
    ),
    items: items,
  );
}

void main() {
  test('missing item keeps one primary CTA and hides status chips', () {
    final presentation = BuildMaterialCardPresentation.fromItem(
      _item(),
      isEditingLocked: false,
    );

    expect(presentation.primary?.kind, BuildMaterialActionKind.findMatching);
    expect(presentation.secondary?.kind, BuildMaterialActionKind.iHaveThis);
    expect(presentation.badgeLabel.ar, 'مفقود');
    expect(
      presentation.menuItems.map((action) => action.kind),
      isNot(contains(BuildMaterialActionKind.findMatching)),
    );
    expect(
      presentation.menuItems.map((action) => action.kind),
      contains(BuildMaterialActionKind.changeStatus),
    );
  });

  test('available item uses browse matching as the only primary action', () {
    final presentation = BuildMaterialCardPresentation.fromItem(
      _item(status: ProjectBuildItemStatus.available),
      isEditingLocked: false,
    );

    expect(presentation.primary?.kind, BuildMaterialActionKind.browseMatching);
    expect(presentation.secondary?.kind, BuildMaterialActionKind.browseAll);
    expect(presentation.badgeLabel.ar, 'متاح');
  });

  test('reserved item uses view reservation and change status', () {
    final presentation = BuildMaterialCardPresentation.fromItem(
      _item(
        status: ProjectBuildItemStatus.reserved,
        acquisitionState: 'reserved',
        linkedMaterial: const LinkedMaterialSummary(
          id: 'material-1',
          title: 'Breadboard',
          categoryNameEn: 'Electronics',
          condition: 'GOOD',
          status: 'RESERVED',
          isPubliclyAvailable: true,
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
          statusLabel: 'Accepted',
        ),
      ),
      isEditingLocked: false,
    );

    expect(presentation.primary?.kind, BuildMaterialActionKind.viewReservation);
    expect(presentation.primary?.outlined, isTrue);
    expect(presentation.secondary?.kind, BuildMaterialActionKind.changeStatus);
    expect(presentation.badgeLabel.ar, 'محجوز');
  });

  testWidgets('compact missing card does not render every status chip', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BuildMaterialCard(
            item: _item(),
            isUpdating: false,
            isEditingLocked: false,
            onAction: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('Arduino Uno'), findsOneWidget);
    expect(find.text('Find a matching material'), findsOneWidget);
    expect(find.text('I have this component'), findsOneWidget);
    expect(find.text('Missing'), findsOneWidget);
    expect(find.byType(ChoiceChip), findsNothing);
    expect(find.text('Already owned'), findsNothing);
    expect(find.text('Request this component'), findsNothing);
  });

  testWidgets('materials section header is compact and grouped', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BuildProjectMaterialsSection(
            buildRecord: _buildWithItems([
              _item(),
              _item(
                status: ProjectBuildItemStatus.alreadyOwned,
                isReadyForBuild: true,
                readinessLabel: 'Ready',
                acquisitionState: 'already_owned',
              ),
            ]),
            updatingItemIds: const {},
            isEditingLocked: false,
            onStatusChanged: (item, {required status, learnerNote}) async {},
            onEditNote: (_) {},
            onFindMaterials: (_) {},
            onRequestMaterial: (_) {},
            onShowMaterialCandidates: (_) {},
            onUnlinkMaterial: (_) {},
            onViewLinkedMaterial: (_) {},
            onReserveLinkedMaterial: (_) {},
            onViewReservation: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('Materials'), findsOneWidget);
    expect(find.text('1 of 2 ready'), findsOneWidget);
    expect(find.text('Still required · 1'), findsOneWidget);
    expect(find.text('Ready for the project · 1'), findsOneWidget);
    expect(find.text(LearningProjectBuildL10n.ownedDescription.en), findsOneWidget);
    expect(find.byType(ChoiceChip), findsNothing);
  });
}
