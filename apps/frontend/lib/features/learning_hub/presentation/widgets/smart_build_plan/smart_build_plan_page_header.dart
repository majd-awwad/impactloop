import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../core/format/localized_formatters.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_back_action.dart';
import '../../l10n/smart_build_plan_l10n.dart';
import '../../theme/learning_ui_palette.dart';

class SmartBuildPlanPageHeader extends StatelessWidget {
  const SmartBuildPlanPageHeader({
    super.key,
    required this.projectTitle,
    required this.generatedAt,
    required this.isRefreshing,
    required this.onBack,
    required this.onRefresh,
  });

  final String? projectTitle;
  final DateTime generatedAt;
  final bool isRefreshing;
  final VoidCallback onBack;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final formatters = LocalizedFormatters(context.l10n);

    return Container(
      decoration: BoxDecoration(
        color: palette.cardSurface,
        border: Border(
          bottom: BorderSide(color: palette.borderSubtle),
        ),
      ),
      padding: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.xs,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.md,
      ),
      child: SafeArea(
        bottom: false,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final stacked = constraints.maxWidth < 560;

            final titleBlock = Row(
              children: [
                AppBackAction.compact(onBack: onBack),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        SmartBuildPlanL10n.pageTitle.resolve(context),
                        style: AppTextStyles.title(context).copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      if (projectTitle != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          projectTitle!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTextStyles.label(context).copyWith(
                            color: palette.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            );

            final actions = Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Flexible(
                  child: Text(
                    SmartBuildPlanL10n.updatedAt(
                      formatters.dateTime(generatedAt),
                    ).resolve(context),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.end,
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textSecondary,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Tooltip(
                  message: SmartBuildPlanL10n.refreshPlan.resolve(context),
                  child: OutlinedButton.icon(
                    onPressed: isRefreshing ? null : onRefresh,
                  icon: isRefreshing
                      ? const SizedBox.square(
                          dimension: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.refresh_rounded, size: 18),
                  label: Text(SmartBuildPlanL10n.refreshPlan.resolve(context)),
                  style: OutlinedButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.sm,
                    ),
                  ),
                  ),
                ),
              ],
            );

            if (stacked) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  titleBlock,
                  const SizedBox(height: AppSpacing.sm),
                  actions,
                ],
              );
            }

            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: titleBlock),
                const SizedBox(width: AppSpacing.md),
                actions,
              ],
            );
          },
        ),
      ),
    );
  }
}
