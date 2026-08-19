import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/utils/content_text_direction.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_network_image.dart';
import '../../../domain/models/project_build.dart';
import '../../l10n/project_build_page_l10n.dart';
import '../../l10n/smart_build_plan_l10n.dart';
import '../../l10n/step_learning_check_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import '../../../../project_notebook/presentation/l10n/project_notebook_l10n.dart';
import '../build_materials/build_project_materials_section.dart';
import '../build_steps/build_step_compact_row.dart';
import '../build_steps/build_step_current_card.dart';
import '../start_knowledge_check_section.dart';
import '../step_learning_check_sheet.dart';
import '../../../../project_help_sessions/presentation/widgets/build_help_session_compact_action.dart';

class BuildActivePhase extends StatefulWidget {
  const BuildActivePhase({
    super.key,
    required this.projectId,
    required this.buildRecord,
    required this.completingStepIds,
    required this.updatingItemIds,
    required this.isEditingLocked,
    required this.showResumeBanner,
    required this.openingGuide,
    required this.onCompleteCurrentStep,
    required this.onOpenStepCheck,
    required this.onNeedHelp,
    required this.onOpenBuildGuide,
    required this.onOpenNotebook,
    required this.onOpenSmartPlan,
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
  final Set<String> completingStepIds;
  final Set<String> updatingItemIds;
  final bool isEditingLocked;
  final bool showResumeBanner;
  final bool openingGuide;
  final VoidCallback onCompleteCurrentStep;
  final Future<void> Function(ProjectBuildStepView step) onOpenStepCheck;
  final VoidCallback onNeedHelp;
  final VoidCallback onOpenBuildGuide;
  final VoidCallback onOpenNotebook;
  final VoidCallback onOpenSmartPlan;
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
  State<BuildActivePhase> createState() => _BuildActivePhaseState();
}

class _BuildActivePhaseState extends State<BuildActivePhase> {
  bool _showMaterials = false;

  @override
  Widget build(BuildContext context) {
    final build = widget.buildRecord;
    final palette = LearningUiPalette.of(context);
    final steps = build.stepProgress.steps;
    ProjectBuildStepView? current;
    for (final step in steps) {
      if (step.state == ProjectBuildStepState.current) {
        current = step;
        break;
      }
    }
    final currentNumber =
        current?.stepNumber ?? build.stepProgress.currentStep?.stepNumber ?? 1;
    final total = build.stepProgress.total;
    final percent = build.stepProgress.percent.clamp(0, 100);
    final progress = total == 0 ? 0.0 : (percent / 100).clamp(0.0, 1.0);
    final showResume =
        widget.showResumeBanner &&
        current != null &&
        build.stepProgress.completed > 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ContentDirectionalText(
          build.project.title,
          style: AppTextStyles.title(
            context,
          ).copyWith(fontWeight: FontWeight.w800, fontSize: 22, height: 1.25),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          ProjectBuildPageL10n.stepOfTotalWithPercent(
            current: currentNumber,
            total: total,
            percent: percent,
          ).resolve(context),
          style: AppTextStyles.body(
            context,
          ).copyWith(color: palette.textSecondary, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: AppSpacing.sm),
        ClipRRect(
          borderRadius: AppRadius.pillAll,
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 8,
            backgroundColor: palette.mutedChip,
            color: palette.lime,
          ),
        ),
        if (showResume) ...[
          const SizedBox(height: AppSpacing.md),
          _ResumeBanner(step: current, total: total),
        ],
        if (current != null) ...[
          const SizedBox(height: AppSpacing.md),
          _FocusedCurrentStep(
            step: current,
            isCompleting: widget.completingStepIds.contains(current.stepId),
            canComplete: !widget.isEditingLocked,
            onComplete: widget.onCompleteCurrentStep,
            onNeedHelp: widget.onNeedHelp,
            onOpenCheck: () => widget.onOpenStepCheck(current as ProjectBuildStepView),
          ),
        ],
        if (steps.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text(
            ProjectBuildPageL10n.buildJourney.resolve(context),
            style: AppTextStyles.subtitle(
              context,
            ).copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        for (final step in steps)
          if (step.state != ProjectBuildStepState.current) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: BuildStepCompactRow(
                step: step,
                compact: true,
                footer: step.state == ProjectBuildStepState.completed
                    ? StepLearningCheckStatusRow(
                        projectId: widget.projectId,
                        buildRecord: build,
                        step: step,
                        onOpenCheck: () => widget.onOpenStepCheck(step),
                      )
                    : null,
              ),
            ),
          ],
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => setState(() => _showMaterials = !_showMaterials),
                child: Text(
                  (_showMaterials
                          ? ProjectBuildPageL10n.hideMaterials
                          : ProjectBuildPageL10n.showMaterials)
                      .resolve(context),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: OutlinedButton(
                onPressed: _openBuildTools,
                child: Text(
                  ProjectBuildPageL10n.buildTools.resolve(context),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
        ),
        if (_showMaterials) ...[
          const SizedBox(height: AppSpacing.sm),
          BuildProjectMaterialsSection(
            buildRecord: build,
            updatingItemIds: widget.updatingItemIds,
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
          ),
        ],
      ],
    );
  }

  Future<void> _openBuildTools() async {
    final build = widget.buildRecord;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.md,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    ProjectBuildPageL10n.buildTools.resolve(sheetContext),
                    style: AppTextStyles.title(
                      sheetContext,
                    ).copyWith(fontSize: 18),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.smart_toy_outlined),
                    title: Text(
                      ProjectBuildPageL10n.askAi.resolve(sheetContext),
                    ),
                    enabled: !widget.openingGuide,
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      widget.onOpenBuildGuide();
                    },
                  ),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.menu_book_outlined),
                    title: Text(
                      ProjectNotebookL10n.projectNotebook.resolve(sheetContext),
                    ),
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      widget.onOpenNotebook();
                    },
                  ),
                  BuildHelpSessionToolsTile(
                    buildRecord: build,
                    hostContext: context,
                  ),
                  if (build.status == ProjectBuildStatus.inProgress ||
                      build.status == ProjectBuildStatus.paused)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(Icons.auto_awesome_outlined),
                      title: Text(
                        SmartBuildPlanL10n.openFromBuild.resolve(sheetContext),
                      ),
                      onTap: () {
                        Navigator.of(sheetContext).pop();
                        widget.onOpenSmartPlan();
                      },
                    ),
                  if (!widget.isEditingLocked &&
                      (build.status == ProjectBuildStatus.inProgress ||
                          build.status == ProjectBuildStatus.paused)) ...[
                    const SizedBox(height: AppSpacing.sm),
                    StartKnowledgeCheckSection(
                      projectId: widget.projectId,
                      buildRecord: build,
                    ),
                  ],
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _ResumeBanner extends StatelessWidget {
  const _ResumeBanner({required this.step, required this.total});

  final ProjectBuildStepView step;
  final int total;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(AppSpacing.sm + 2),
      decoration: BoxDecoration(
        color: palette.limeSoft.withValues(alpha: 0.55),
        borderRadius: AppRadius.lgAll,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            ProjectBuildPageL10n.welcomeBack.resolve(context),
            style: AppTextStyles.label(
              context,
            ).copyWith(fontWeight: FontWeight.w800, color: palette.lime),
          ),
          const SizedBox(height: 4),
          Text(
            ProjectBuildPageL10n.stoppedAtStep(
              step.stepNumber,
              total,
            ).resolve(context),
            style: AppTextStyles.body(context).copyWith(fontSize: 13),
          ),
          ContentDirectionalText(
            step.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.body(context).copyWith(fontSize: 14),
          ),
        ],
      ),
    );
  }
}

class _FocusedCurrentStep extends StatelessWidget {
  const _FocusedCurrentStep({
    required this.step,
    required this.isCompleting,
    required this.canComplete,
    required this.onComplete,
    required this.onNeedHelp,
    required this.onOpenCheck,
  });

  final ProjectBuildStepView step;
  final bool isCompleting;
  final bool canComplete;
  final VoidCallback onComplete;
  final VoidCallback onNeedHelp;
  final VoidCallback onOpenCheck;

  @override
  Widget build(BuildContext context) {
    final imageUrl = step.imageUrl?.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (imageUrl != null && imageUrl.isNotEmpty) ...[
          ClipRRect(
            borderRadius: AppRadius.lgAll,
            child: AppNetworkImage(
              url: imageUrl,
              height: 160,
              width: double.infinity,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        BuildStepCurrentCard(
          step: step,
          compact: true,
          isCompleting: isCompleting,
          canComplete: canComplete,
          onComplete: onComplete,
        ),
        const SizedBox(height: AppSpacing.xs),
        Row(
          children: [
            Expanded(
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton(
                  onPressed: onNeedHelp,
                  child: Text(ProjectBuildPageL10n.needHelp.resolve(context)),
                ),
              ),
            ),
            TextButton(
              onPressed: onOpenCheck,
              child: Text(
                StepLearningCheckL10n.optionalAction.resolve(context),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
