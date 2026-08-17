import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../domain/models/project_build.dart';
import '../../l10n/learning_project_build_l10n.dart';

class BuildStepStatusChip extends StatelessWidget {
  const BuildStepStatusChip({super.key, required this.state});

  final ProjectBuildStepState state;

  @override
  Widget build(BuildContext context) {
    final style = AppStatusStyle.of(context, _tone);
    final icon = switch (state) {
      ProjectBuildStepState.locked => Icons.schedule_rounded,
      ProjectBuildStepState.current => Icons.play_arrow_rounded,
      ProjectBuildStepState.completed => Icons.check_rounded,
    };

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: style.background,
        borderRadius: AppRadius.pillAll,
        border: Border.all(color: style.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: style.foreground),
          const SizedBox(width: 4),
          Text(
            _label.resolve(context),
            maxLines: 1,
            softWrap: false,
            overflow: TextOverflow.ellipsis,
            style: AppTextStyles.label(context).copyWith(
              color: style.foreground,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }

  LocalizedText get _label => switch (state) {
    ProjectBuildStepState.locked => LearningProjectBuildL10n.stepStatusLocked,
    ProjectBuildStepState.current => LearningProjectBuildL10n.stepStatusCurrent,
    ProjectBuildStepState.completed => LearningProjectBuildL10n.stepStatusDone,
  };

  AppStatusTone get _tone => switch (state) {
    ProjectBuildStepState.locked => AppStatusTone.neutral,
    ProjectBuildStepState.current => AppStatusTone.primary,
    ProjectBuildStepState.completed => AppStatusTone.success,
  };
}
