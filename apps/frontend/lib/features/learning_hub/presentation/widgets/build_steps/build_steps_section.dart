import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../domain/models/project_build.dart';
import '../../l10n/learning_project_build_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import '../step_learning_check_sheet.dart';
import 'build_step_compact_row.dart';
import 'build_step_current_card.dart';

class BuildStepsSection extends StatelessWidget {
  const BuildStepsSection({
    super.key,
    required this.projectId,
    required this.buildRecord,
    required this.completingStepIds,
    required this.isEditingLocked,
    required this.onCompleteCurrentStep,
    required this.onOpenStepCheck,
  });

  final String projectId;
  final ProjectBuild buildRecord;
  final Set<String> completingStepIds;
  final bool isEditingLocked;
  final VoidCallback onCompleteCurrentStep;
  final Future<void> Function(ProjectBuildStepView step) onOpenStepCheck;

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 600;
    final stepProgress = buildRecord.stepProgress;
    final materialsReady =
        stepProgress.nextAction != ProjectBuildNextAction.prepareMaterials;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _BuildStepsHeader(
          completed: stepProgress.completed,
          total: stepProgress.total,
          percent: stepProgress.percent,
          compact: compact,
          materialsReady: materialsReady,
        ),
        if (stepProgress.steps.isEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            LearningProjectBuildL10n.noBuildStepsYet.resolve(context),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.body(context).copyWith(
              color: LearningUiPalette.of(context).textSecondary,
              fontSize: compact ? 14 : 15,
            ),
          ),
        ] else ...[
          const SizedBox(height: AppSpacing.sm),
          for (var index = 0; index < stepProgress.steps.length; index++) ...[
            _stepTile(context, stepProgress.steps[index], compact),
            if (index != stepProgress.steps.length - 1)
              const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ],
    );
  }

  Widget _stepTile(
    BuildContext context,
    ProjectBuildStepView step,
    bool compact,
  ) {
    final isCompleting = completingStepIds.contains(step.stepId);
    final isCurrent = step.state == ProjectBuildStepState.current;
    final canComplete = !isEditingLocked && isCurrent;

    if (isCurrent) {
      return BuildStepCurrentCard(
        step: step,
        compact: compact,
        isCompleting: isCompleting,
        canComplete: canComplete,
        onComplete: onCompleteCurrentStep,
      );
    }

    return BuildStepCompactRow(
      step: step,
      compact: compact,
      footer: step.state == ProjectBuildStepState.completed
          ? StepLearningCheckStatusRow(
              projectId: projectId,
              buildRecord: buildRecord,
              step: step,
              onOpenCheck: () => onOpenStepCheck(step),
            )
          : null,
    );
  }
}

class _BuildStepsHeader extends StatelessWidget {
  const _BuildStepsHeader({
    required this.completed,
    required this.total,
    required this.percent,
    required this.compact,
    required this.materialsReady,
  });

  final int completed;
  final int total;
  final int percent;
  final bool compact;
  final bool materialsReady;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final progress = total == 0 ? 0.0 : (percent / 100).clamp(0.0, 1.0);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                LearningProjectBuildL10n.buildStepsTitle.resolve(context),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.title(context).copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: compact ? 22 : 24,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Directionality(
              textDirection: TextDirection.ltr,
              child: Text(
                '$completed/$total',
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textSecondary,
                  fontSize: compact ? 14 : 15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
        if (total > 0) ...[
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: AppRadius.pillAll,
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: palette.mutedChip,
              color: palette.lime,
            ),
          ),
        ],
        if (!materialsReady) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            LearningProjectBuildL10n.prepareMaterialsBeforeSteps.resolve(
              context,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
              fontSize: compact ? 13 : 14,
              height: 1.3,
            ),
          ),
        ],
      ],
    );
  }
}
