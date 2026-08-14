import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../domain/models/smart_build_plan.dart';
import '../../l10n/smart_build_plan_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import 'smart_build_plan_colored_icon.dart';

class SmartBuildPlanSummarySection extends StatelessWidget {
  const SmartBuildPlanSummarySection({
    super.key,
    required this.summary,
  });

  final SmartBuildPlanBuildSummary summary;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    final cards = [
      _SummaryStatCard(
        label: SmartBuildPlanL10n.summaryRequired.resolve(context),
        value: summary.requiredComponents,
        icon: Icons.inventory_2_outlined,
        colors: SmartBuildPlanIconColors.blue,
      ),
      _SummaryStatCard(
        label: SmartBuildPlanL10n.summarySatisfied.resolve(context),
        value: summary.alreadySatisfied,
        icon: Icons.check_circle_outline_rounded,
        colors: SmartBuildPlanIconColors.green,
      ),
      _SummaryStatCard(
        label: SmartBuildPlanL10n.summaryInProgress.resolve(context),
        value: summary.inProgress,
        icon: Icons.schedule_rounded,
        colors: SmartBuildPlanIconColors.blue,
      ),
      _SummaryStatCard(
        label: SmartBuildPlanL10n.summaryAttention.resolve(context),
        value: summary.attention,
        icon: Icons.warning_amber_rounded,
        colors: SmartBuildPlanIconColors.orange,
      ),
      _SummaryStatCard(
        label: SmartBuildPlanL10n.summaryRemaining.resolve(context),
        value: summary.optimizable,
        icon: Icons.auto_awesome_outlined,
        colors: SmartBuildPlanIconColors.teal,
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          SmartBuildPlanL10n.buildSummaryTitle.resolve(context),
          style: AppTextStyles.title(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth >= 900) {
              return Row(
                children: [
                  for (var index = 0; index < cards.length; index++) ...[
                    if (index > 0) const SizedBox(width: AppSpacing.sm),
                    Expanded(child: cards[index]),
                  ],
                ],
              );
            }

            if (constraints.maxWidth >= 520) {
              return Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: cards
                    .map(
                      (card) => SizedBox(
                        width: (constraints.maxWidth - AppSpacing.sm * 2) / 3,
                        child: card,
                      ),
                    )
                    .toList(growable: false),
              );
            }

            return Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: cards
                  .map(
                    (card) => SizedBox(
                      width: (constraints.maxWidth - AppSpacing.sm) / 2,
                      child: card,
                    ),
                  )
                  .toList(growable: false),
            );
          },
        ),
      ],
    );
  }
}

class _SummaryStatCard extends StatelessWidget {
  const _SummaryStatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.colors,
  });

  final String label;
  final int value;
  final IconData icon;
  final SmartBuildPlanIconColors colors;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: palette.cardShadow.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SmartBuildPlanIconBadge(
            icon: icon,
            colors: colors,
            size: 48,
            iconSize: 26,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              height: 1.2,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '$value',
            style: AppTextStyles.title(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 24,
            ),
          ),
        ],
      ),
    );
  }
}
