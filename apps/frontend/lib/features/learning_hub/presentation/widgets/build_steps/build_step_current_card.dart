import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/utils/content_text_direction.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../domain/models/project_build.dart';
import '../../l10n/learning_project_build_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import 'build_step_number_badge.dart';

class BuildStepCurrentCard extends StatelessWidget {
  const BuildStepCurrentCard({
    super.key,
    required this.step,
    required this.isCompleting,
    required this.canComplete,
    required this.onComplete,
    this.compact = true,
  });

  final ProjectBuildStepView step;
  final bool isCompleting;
  final bool canComplete;
  final VoidCallback onComplete;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final padding = compact ? AppSpacing.sm : AppSpacing.md;
    final description = step.description.trim();

    return Container(
      width: double.infinity,
      padding: EdgeInsetsDirectional.all(padding),
      decoration: BoxDecoration(
        color: palette.limeSoft.withValues(alpha: 0.45),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.lime, width: 1.4),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              BuildStepNumberBadge(
                number: step.stepNumber,
                emphasized: true,
                size: compact ? 32 : 36,
              ),
              const Spacer(),
              Text(
                LearningProjectBuildL10n.stepStatusCurrent.resolve(context),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.lime,
                  fontWeight: FontWeight.w800,
                  fontSize: compact ? 11 : 12,
                  letterSpacing: 0.2,
                  height: 1.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          ContentDirectionalText(
            step.title,
            overflow: TextOverflow.visible,
            style: AppTextStyles.subtitle(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: compact ? 16 : 18,
              height: 1.3,
            ),
          ),
          if (description.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            ContentDirectionalText(
              description,
              overflow: TextOverflow.visible,
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
                fontSize: compact ? 14 : 15,
                height: 1.4,
              ),
            ),
          ],
          if (canComplete || isCompleting) ...[
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              height: compact ? 44 : 48,
              width: double.infinity,
              child: FilledButton(
                onPressed: canComplete && !isCompleting ? onComplete : null,
                style: AppStatusButtonStyle.filled(
                  context,
                  AppStatusTone.primary,
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                  ),
                ),
                child: isCompleting
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        LearningProjectBuildL10n.finishedThisStep.resolve(
                          context,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
