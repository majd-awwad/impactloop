import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../application/build_display_phase.dart';
import '../../../domain/models/project_build.dart';
import '../../l10n/project_build_page_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import '../build_materials/build_material_card_presentation.dart';
import '../build_materials/build_project_materials_section.dart';
import '../../../../project_help_sessions/presentation/widgets/build_help_session_section.dart';
import '../start_knowledge_check_section.dart';
import 'build_prepare_material_card.dart';
import 'build_prepare_material_semantics.dart';

class BuildPreparePhase extends StatefulWidget {
  const BuildPreparePhase({
    super.key,
    required this.projectId,
    required this.buildRecord,
    required this.updatingItemIds,
    required this.isEditingLocked,
    required this.onStartBuilding,
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

  final String projectId;
  final ProjectBuild buildRecord;
  final Set<String> updatingItemIds;
  final bool isEditingLocked;
  final VoidCallback onStartBuilding;
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
  State<BuildPreparePhase> createState() => _BuildPreparePhaseState();
}

class _BuildPreparePhaseState extends State<BuildPreparePhase> {
  static const _unresolvedPreviewCount = 3;

  bool _showReady = false;
  bool _showMoreUnresolved = false;
  bool _showMoreDetails = false;

  Future<void> _onAction(ProjectBuildItem item, BuildMaterialActionKind kind) {
    return handleBuildMaterialCardAction(
      context: context,
      item: item,
      kind: kind,
      isEditingLocked: widget.isEditingLocked,
      onStatusChanged: widget.onStatusChanged,
      onEditNote: widget.onEditNote,
      onFindMaterials: widget.onFindMaterials,
      onRequestMaterial: widget.onRequestMaterial,
      onShowMaterialCandidates: widget.onShowMaterialCandidates,
      onUnlinkMaterial: widget.onUnlinkMaterial,
      onViewLinkedMaterial: widget.onViewLinkedMaterial,
      onReserveLinkedMaterial: widget.onReserveLinkedMaterial,
      onViewReservation: widget.onViewReservation,
    );
  }

  @override
  Widget build(BuildContext context) {
    final build = widget.buildRecord;
    final palette = LearningUiPalette.of(context);
    final items = build.items;
    final needsAction = BuildPrepareMaterialSemantics.itemsInGroup(
      items,
      BuildPrepareMaterialGroup.needsAction,
    );
    final inProgress = BuildPrepareMaterialSemantics.itemsInGroup(
      items,
      BuildPrepareMaterialGroup.inProgress,
    );
    final ready = BuildPrepareMaterialSemantics.itemsInGroup(
      items,
      BuildPrepareMaterialGroup.ready,
    );
    final readyCount = build.materialReadiness.total > 0
        ? build.materialReadiness.ready
        : items.where((item) => item.isReadyForBuild).length;
    final totalCount = build.materialReadiness.total > 0
        ? build.materialReadiness.total
        : items.length;
    final allReady = BuildDisplayPhaseResolver.materialsAreReady(build);
    final progress = totalCount == 0
        ? 1.0
        : (readyCount / totalCount).clamp(0.0, 1.0);
    final percent = (progress * 100).round();
    final collapseReady =
        ready.isNotEmpty &&
        (needsAction.isNotEmpty || inProgress.isNotEmpty || ready.length > 3);
    final showReadyList = !collapseReady || _showReady;
    final hiddenUnresolved = (needsAction.length - _unresolvedPreviewCount)
        .clamp(0, needsAction.length);
    final visibleUnresolved = _showMoreUnresolved || hiddenUnresolved == 0
        ? needsAction
        : needsAction.take(_unresolvedPreviewCount).toList(growable: false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          ProjectBuildPageL10n.prepareMaterialsTitle.resolve(context),
          style: AppTextStyles.subtitle(
            context,
          ).copyWith(fontWeight: FontWeight.w800, fontSize: 18),
        ),
        const SizedBox(height: AppSpacing.xs),
        Row(
          children: [
            Expanded(
              child: Text(
                allReady
                    ? ProjectBuildPageL10n.allMaterialsReady.resolve(context)
                    : ProjectBuildPageL10n.materialsReadyCount(
                        readyCount,
                        totalCount,
                      ).resolve(context),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textSecondary,
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              '$percent%',
              style: AppTextStyles.label(
                context,
              ).copyWith(color: palette.lime, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        ClipRRect(
          borderRadius: AppRadius.pillAll,
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 8,
            backgroundColor: palette.mutedChip,
            color: palette.lime,
          ),
        ),
        if (needsAction.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          _PrepareCardGroup(
            title: ProjectBuildPageL10n.needsActionGroup(needsAction.length),
            items: visibleUnresolved,
            updatingItemIds: widget.updatingItemIds,
            isEditingLocked: widget.isEditingLocked,
            onAction: _onAction,
          ),
          if (hiddenUnresolved > 0)
            Center(
              child: TextButton(
                onPressed: () =>
                    setState(() => _showMoreUnresolved = !_showMoreUnresolved),
                child: Text(
                  (_showMoreUnresolved
                          ? ProjectBuildPageL10n.hideExtraMaterials
                          : ProjectBuildPageL10n.showMoreMaterials(
                              hiddenUnresolved,
                            ))
                      .resolve(context),
                ),
              ),
            ),
        ],
        if (inProgress.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          _PrepareCardGroup(
            title: ProjectBuildPageL10n.inProgressGroup(inProgress.length),
            items: inProgress,
            updatingItemIds: widget.updatingItemIds,
            isEditingLocked: widget.isEditingLocked,
            onAction: _onAction,
          ),
        ],
        if (ready.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          _PrepareReadyHeader(
            count: ready.length,
            showToggle: collapseReady,
            expanded: showReadyList,
            onToggle: () => setState(() => _showReady = !_showReady),
          ),
          if (showReadyList) ...[
            const SizedBox(height: AppSpacing.sm),
            _PrepareCardGroup(
              items: ready,
              updatingItemIds: widget.updatingItemIds,
              isEditingLocked: widget.isEditingLocked,
              onAction: _onAction,
            ),
          ],
        ],
        if (allReady && !widget.isEditingLocked) ...[
          const SizedBox(height: AppSpacing.lg),
          SizedBox(
            height: 48,
            child: FilledButton(
              onPressed: widget.onStartBuilding,
              child: Text(
                ProjectBuildPageL10n.startBuilding.resolve(context),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ] else if (!widget.isEditingLocked &&
            (build.status == ProjectBuildStatus.inProgress ||
                build.status == ProjectBuildStatus.paused)) ...[
          const SizedBox(height: AppSpacing.md),
          Center(
            child: TextButton(
              onPressed: () =>
                  setState(() => _showMoreDetails = !_showMoreDetails),
              child: Text(
                ProjectBuildPageL10n.learningAndHelp.resolve(context),
              ),
            ),
          ),
          if (_showMoreDetails) ...[
            if (build.status == ProjectBuildStatus.inProgress)
              StartKnowledgeCheckSection(
                projectId: widget.projectId,
                buildRecord: build,
              ),
            const SizedBox(height: AppSpacing.sm),
            BuildHelpSessionSection(buildRecord: build),
          ],
        ],
      ],
    );
  }
}

class _PrepareCardGroup extends StatelessWidget {
  const _PrepareCardGroup({
    this.title,
    required this.items,
    required this.updatingItemIds,
    required this.isEditingLocked,
    required this.onAction,
  });

  final LocalizedText? title;
  final List<ProjectBuildItem> items;
  final Set<String> updatingItemIds;
  final bool isEditingLocked;
  final Future<void> Function(
    ProjectBuildItem item,
    BuildMaterialActionKind kind,
  )
  onAction;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (title != null) ...[
          Text(
            title!.resolve(context),
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        for (var i = 0; i < items.length; i++) ...[
          BuildPrepareMaterialCard(
            item: items[i],
            isUpdating: updatingItemIds.contains(items[i].id),
            isEditingLocked: isEditingLocked,
            onAction: (kind) => onAction(items[i], kind),
          ),
          if (i != items.length - 1) const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _PrepareReadyHeader extends StatelessWidget {
  const _PrepareReadyHeader({
    required this.count,
    required this.showToggle,
    required this.expanded,
    required this.onToggle,
  });

  final int count;
  final bool showToggle;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Row(
      children: [
        Icon(Icons.check_rounded, size: 18, color: palette.lime),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            ProjectBuildPageL10n.readyGroup(count).resolve(context),
            style: AppTextStyles.body(
              context,
            ).copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        if (showToggle)
          TextButton(
            onPressed: onToggle,
            child: Text(
              (expanded
                      ? ProjectBuildPageL10n.hideReadyMaterials
                      : ProjectBuildPageL10n.showReadyMaterials)
                  .resolve(context),
            ),
          ),
      ],
    );
  }
}
