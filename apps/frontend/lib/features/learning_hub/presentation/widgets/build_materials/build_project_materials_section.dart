import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../domain/models/project_build.dart';
import '../../l10n/learning_project_build_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import 'build_material_actions_menu.dart';
import 'build_material_card.dart';
import 'build_material_card_presentation.dart';
import 'build_project_materials_header.dart';

class BuildProjectMaterialsSection extends StatelessWidget {
  const BuildProjectMaterialsSection({
    super.key,
    required this.buildRecord,
    required this.updatingItemIds,
    required this.isEditingLocked,
    required this.onStatusChanged,
    required this.onEditNote,
    required this.onFindMaterials,
    required this.onRequestMaterial,
    required this.onShowMaterialCandidates,
    required this.onUnlinkMaterial,
    required this.onViewLinkedMaterial,
    required this.onReserveLinkedMaterial,
    required this.onViewReservation,
  });

  final ProjectBuild buildRecord;
  final Set<String> updatingItemIds;
  final bool isEditingLocked;
  final Future<void> Function(
    ProjectBuildItem item, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
  })
  onStatusChanged;
  final ValueChanged<ProjectBuildItem> onEditNote;
  final ValueChanged<ProjectBuildItem> onFindMaterials;
  final ValueChanged<ProjectBuildItem> onRequestMaterial;
  final ValueChanged<ProjectBuildItem> onShowMaterialCandidates;
  final ValueChanged<ProjectBuildItem> onUnlinkMaterial;
  final ValueChanged<ProjectBuildItem> onViewLinkedMaterial;
  final ValueChanged<ProjectBuildItem> onReserveLinkedMaterial;
  final ValueChanged<ProjectBuildItem> onViewReservation;

  @override
  Widget build(BuildContext context) {
    final stillRequired = buildRecord.items
        .where((item) => !item.isReadyForBuild)
        .toList(growable: false);
    final readyItems = buildRecord.items
        .where((item) => item.isReadyForBuild)
        .toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        BuildProjectMaterialsHeader.fromBuild(buildRecord),
        if (buildRecord.items.isEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          const _EmptyMaterialsMessage(),
        ] else ...[
          if (stillRequired.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _SubsectionLabel(
              text: LearningProjectBuildL10n.stillRequiredCount(
                stillRequired.length,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            ..._cards(context, stillRequired),
          ],
          if (readyItems.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _SubsectionLabel(
              text: LearningProjectBuildL10n.readyForProjectCount(
                readyItems.length,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            ..._cards(context, readyItems),
          ],
        ],
      ],
    );
  }

  List<Widget> _cards(BuildContext context, List<ProjectBuildItem> items) {
    return [
      for (var index = 0; index < items.length; index++) ...[
        BuildMaterialCard(
          item: items[index],
          isUpdating: updatingItemIds.contains(items[index].id),
          isEditingLocked: isEditingLocked,
          onAction: (kind) => _handleAction(context, items[index], kind),
        ),
        if (index != items.length - 1) const SizedBox(height: AppSpacing.sm),
      ],
    ];
  }

  Future<void> _handleAction(
    BuildContext context,
    ProjectBuildItem item,
    BuildMaterialActionKind kind,
  ) {
    return handleBuildMaterialCardAction(
      context: context,
      item: item,
      kind: kind,
      isEditingLocked: isEditingLocked,
      onStatusChanged: onStatusChanged,
      onEditNote: onEditNote,
      onFindMaterials: onFindMaterials,
      onRequestMaterial: onRequestMaterial,
      onShowMaterialCandidates: onShowMaterialCandidates,
      onUnlinkMaterial: onUnlinkMaterial,
      onViewLinkedMaterial: onViewLinkedMaterial,
      onReserveLinkedMaterial: onReserveLinkedMaterial,
      onViewReservation: onViewReservation,
    );
  }
}

Future<void> handleBuildMaterialCardAction({
  required BuildContext context,
  required ProjectBuildItem item,
  required BuildMaterialActionKind kind,
  required bool isEditingLocked,
  required Future<void> Function(
    ProjectBuildItem item, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
  })
  onStatusChanged,
  required ValueChanged<ProjectBuildItem> onEditNote,
  required ValueChanged<ProjectBuildItem> onFindMaterials,
  required ValueChanged<ProjectBuildItem> onRequestMaterial,
  required ValueChanged<ProjectBuildItem> onShowMaterialCandidates,
  required ValueChanged<ProjectBuildItem> onUnlinkMaterial,
  required ValueChanged<ProjectBuildItem> onViewLinkedMaterial,
  required ValueChanged<ProjectBuildItem> onReserveLinkedMaterial,
  required ValueChanged<ProjectBuildItem> onViewReservation,
}) async {
  if (isEditingLocked) {
    return;
  }
  switch (kind) {
    case BuildMaterialActionKind.findMatching:
    case BuildMaterialActionKind.browseMatching:
    case BuildMaterialActionKind.changeAlternative:
    case BuildMaterialActionKind.useAnother:
      onShowMaterialCandidates(item);
    case BuildMaterialActionKind.browseAll:
      onFindMaterials(item);
    case BuildMaterialActionKind.iHaveThis:
      await onStatusChanged(item, status: ProjectBuildItemStatus.alreadyOwned);
    case BuildMaterialActionKind.requestComponent:
      onRequestMaterial(item);
    case BuildMaterialActionKind.useAlternative:
      await onStatusChanged(item, status: ProjectBuildItemStatus.alternative);
    case BuildMaterialActionKind.changeStatus:
      final next = await BuildMaterialStatusSheet.show(
        context,
        current: item.status,
      );
      if (next != null && next != item.status) {
        await onStatusChanged(item, status: next);
      }
    case BuildMaterialActionKind.viewReservation:
      onViewReservation(item);
    case BuildMaterialActionKind.viewMaterial:
    case BuildMaterialActionKind.viewAlternative:
      onViewLinkedMaterial(item);
    case BuildMaterialActionKind.reserve:
      onReserveLinkedMaterial(item);
    case BuildMaterialActionKind.unlink:
    case BuildMaterialActionKind.removeFromComponent:
      onUnlinkMaterial(item);
    case BuildMaterialActionKind.editNote:
      onEditNote(item);
  }
}

class _SubsectionLabel extends StatelessWidget {
  const _SubsectionLabel({required this.text});

  final LocalizedText text;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return Text(
      text.resolve(context),
      style: AppTextStyles.label(
        context,
      ).copyWith(color: palette.textSecondary),
    );
  }
}

class _EmptyMaterialsMessage extends StatelessWidget {
  const _EmptyMaterialsMessage();

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return Text(
      LearningProjectBuildL10n.noRequiredComponents.resolve(context),
      style: AppTextStyles.body(context).copyWith(color: palette.textSecondary),
    );
  }
}
