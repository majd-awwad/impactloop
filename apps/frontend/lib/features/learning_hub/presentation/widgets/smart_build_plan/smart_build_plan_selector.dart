import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_text_styles.dart';
import '../../../../../core/format/localized_formatters.dart';
import '../../../../../l10n/l10n.dart';
import '../../../../../shared/models/localized_text.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../../domain/models/smart_build_plan.dart';
import '../../l10n/smart_build_plan_l10n.dart';
import '../../theme/learning_ui_palette.dart';
import 'smart_build_plan_colored_icon.dart';

class SmartBuildPlanSelector extends StatelessWidget {
  const SmartBuildPlanSelector({
    super.key,
    required this.plans,
    required this.selectedIndex,
    required this.onSelected,
  });

  final List<SmartBuildPlan> plans;
  final int selectedIndex;
  final ValueChanged<int> onSelected;

  @override
  Widget build(BuildContext context) {
    if (plans.isEmpty) {
      return const SizedBox.shrink();
    }

    final palette = LearningUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          SmartBuildPlanL10n.planSelectorTitle.resolve(context),
          style: AppTextStyles.title(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        LayoutBuilder(
          builder: (context, constraints) {
            final useColumn = constraints.maxWidth < 680;

            if (useColumn) {
              return Column(
                children: [
                  for (var index = 0; index < plans.length; index++) ...[
                    if (index > 0) const SizedBox(height: AppSpacing.sm),
                    _PlanOptionCard(
                      plan: plans[index],
                      selected: index == selectedIndex,
                      onTap: () => onSelected(index),
                    ),
                  ],
                ],
              );
            }

            return IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var index = 0; index < plans.length; index++) ...[
                    if (index > 0) const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _PlanOptionCard(
                        plan: plans[index],
                        selected: index == selectedIndex,
                        onTap: () => onSelected(index),
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}

class _PlanOptionCard extends StatelessWidget {
  const _PlanOptionCard({
    required this.plan,
    required this.selected,
    required this.onTap,
  });

  final SmartBuildPlan plan;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final primaryStyle = AppStatusStyle.of(context, AppStatusTone.primary);
    final formatters = LocalizedFormatters(context.l10n);
    final labels = plan.labels.isNotEmpty
        ? plan.labels
        : [SmartBuildPlanLabel.bestOverall];
    final primaryLabel = labels.first;
    final secondaryLabels = labels.skip(1).toList(growable: false);
    final metricText = _metricText(context, formatters, primaryLabel, plan);

    final iconSpec = _iconSpecForLabel(primaryLabel);

    return Semantics(
      button: true,
      selected: selected,
      label: labels.map((label) => SmartBuildPlanL10n.planLabel(label).en).join(', '),
      child: GestureDetector(
        key: ValueKey(plan.key),
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Material(
          color: selected ? primaryStyle.selectedBackground : palette.cardSurface,
          borderRadius: AppRadius.lgAll,
          elevation: selected ? 2 : 0,
          shadowColor: primaryStyle.selectedBorder.withValues(alpha: 0.15),
          child: Container(
            constraints: const BoxConstraints(minHeight: 112),
            padding: const EdgeInsetsDirectional.all(AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: AppRadius.lgAll,
              border: Border.all(
                color: selected ? primaryStyle.selectedBorder : palette.borderSubtle,
                width: selected ? 2 : 1,
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SmartBuildPlanIconBadge(
                      icon: iconSpec.icon,
                      colors: iconSpec.colors,
                      size: 44,
                      iconSize: 24,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        SmartBuildPlanL10n.planLabel(primaryLabel).resolve(context),
                        style: AppTextStyles.body(context).copyWith(
                          color: palette.textPrimary,
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                    ),
                    if (selected && primaryLabel == SmartBuildPlanLabel.bestOverall)
                      AppStatusBadge(
                        label: SmartBuildPlanL10n.recommendedPlanBadge.resolve(context),
                        tone: AppStatusTone.primary,
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  SmartBuildPlanL10n.planHelper(primaryLabel).resolve(context),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                    height: 1.45,
                  ),
                ),
                if (secondaryLabels.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.sm),
                  ...secondaryLabels.map(
                    (label) => Padding(
                      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
                      child: Text(
                        SmartBuildPlanL10n.planAlsoLabel(label).resolve(context),
                        style: AppTextStyles.label(context).copyWith(
                          color: primaryStyle.foreground,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: Container(
                    padding: const EdgeInsetsDirectional.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: selected
                          ? primaryStyle.background
                          : palette.pageBackground,
                      borderRadius: AppRadius.mdAll,
                      border: Border.all(
                        color: selected ? primaryStyle.border : palette.borderSubtle,
                      ),
                    ),
                    child: Text(
                      metricText,
                      style: AppTextStyles.label(context).copyWith(
                        color: selected ? primaryStyle.foreground : palette.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  _PlanIconSpec _iconSpecForLabel(SmartBuildPlanLabel label) {
    return switch (label) {
      SmartBuildPlanLabel.bestOverall => _PlanIconSpec(
        icon: Icons.emoji_events_outlined,
        colors: SmartBuildPlanIconColors.green,
      ),
      SmartBuildPlanLabel.cheapest => _PlanIconSpec(
        icon: Icons.payments_outlined,
        colors: SmartBuildPlanIconColors.amber,
      ),
      SmartBuildPlanLabel.fewestPickupLocations => _PlanIconSpec(
        icon: Icons.location_on_outlined,
        colors: SmartBuildPlanIconColors.purple,
      ),
    };
  }

  String _metricText(
    BuildContext context,
    LocalizedFormatters formatters,
    SmartBuildPlanLabel label,
    SmartBuildPlan plan,
  ) {
    final summary = plan.summary;
    return switch (label) {
      SmartBuildPlanLabel.bestOverall =>
        SmartBuildPlanL10n.planCoveredMetric(
          summary.totalCoveredComponents,
          summary.totalRequiredComponents,
        ).resolve(context),
      SmartBuildPlanLabel.cheapest => summary.hasUnknownPrices && summary.materialSubtotal <= 0
          ? SmartBuildPlanL10n.priceUnknown.resolve(context)
          : formatters.nis(
              summary.materialSubtotal,
              decimalDigits: 2,
            ),
      SmartBuildPlanLabel.fewestPickupLocations =>
        SmartBuildPlanL10n.planPickupMetric(summary.pickupLocationCount).resolve(context),
    };
  }
}

class _PlanIconSpec {
  const _PlanIconSpec({
    required this.icon,
    required this.colors,
  });

  final IconData icon;
  final SmartBuildPlanIconColors colors;
}
