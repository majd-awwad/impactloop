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

class SmartBuildPlanPlanSummaryCard extends StatelessWidget {
  const SmartBuildPlanPlanSummaryCard({
    super.key,
    required this.plan,
  });

  final SmartBuildPlan plan;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);
    final formatters = LocalizedFormatters(context.l10n);
    final summary = plan.summary;
    final primaryLabel = plan.labels.isNotEmpty
        ? plan.labels.first
        : SmartBuildPlanLabel.bestOverall;
    final subtotalValue = summary.hasUnknownPrices && summary.materialSubtotal <= 0
        ? SmartBuildPlanL10n.priceUnknown.resolve(context)
        : formatters.nis(summary.materialSubtotal, decimalDigits: 2);

    final metrics = <_HeroMetricData>[
      _HeroMetricData(
        icon: Icons.view_module_outlined,
        colors: SmartBuildPlanIconColors.green,
        value: '${summary.totalCoveredComponents}/${summary.totalRequiredComponents}',
        label: SmartBuildPlanL10n.componentsCoveredMetric.resolve(context),
      ),
      _HeroMetricData(
        icon: Icons.payments_outlined,
        colors: SmartBuildPlanIconColors.green,
        value: subtotalValue,
        label: SmartBuildPlanL10n.materialSubtotal.resolve(context),
      ),
      _HeroMetricData(
        icon: Icons.storefront_outlined,
        colors: SmartBuildPlanIconColors.blue,
        value: '${summary.supplierCount}',
        label: SmartBuildPlanL10n.suppliers.resolve(context),
      ),
      _HeroMetricData(
        icon: Icons.location_on_outlined,
        colors: SmartBuildPlanIconColors.purple,
        value: '${summary.pickupLocationCount}',
        label: SmartBuildPlanL10n.pickupLocations.resolve(context),
      ),
      _HeroMetricData(
        icon: Icons.help_outline_rounded,
        colors: SmartBuildPlanIconColors.orange,
        value: '${summary.priceUnknownCount}',
        label: SmartBuildPlanL10n.unknownPrices.resolve(context),
      ),
    ];

    return Container(
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                SmartBuildPlanL10n.planLabel(primaryLabel).resolve(context),
                style: AppTextStyles.title(context).copyWith(
                  color: palette.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                ),
              ),
              if (primaryLabel == SmartBuildPlanLabel.bestOverall)
                AppStatusBadge(
                  label: SmartBuildPlanL10n.recommendedPlanBadge.resolve(context),
                  tone: AppStatusTone.primary,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
        LayoutBuilder(
          builder: (context, constraints) {
            if (constraints.maxWidth >= 480) {
              return Row(
                children: [
                  for (var index = 0; index < metrics.length; index++) ...[
                    if (index > 0)
                      Container(
                        width: 1,
                        height: 48,
                        margin: const EdgeInsetsDirectional.symmetric(
                          horizontal: AppSpacing.sm,
                        ),
                        color: palette.borderSubtle,
                      ),
                    Expanded(child: _HeroMetric(data: metrics[index])),
                  ],
                ],
              );
            }

              return SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    for (var index = 0; index < metrics.length; index++) ...[
                      if (index > 0) const SizedBox(width: AppSpacing.lg),
                      SizedBox(
                        width: 120,
                        child: _HeroMetric(data: metrics[index]),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            width: double.infinity,
            padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: palette.pageBackground,
              borderRadius: AppRadius.mdAll,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline_rounded, size: 16, color: palette.textSecondary),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    [
                      SmartBuildPlanL10n.knownPricesOnly.resolve(context),
                      if (!summary.deliveryFeeIncluded)
                        SmartBuildPlanL10n.deliveryFeeNote.resolve(context),
                    ].join(' '),
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textSecondary,
                      height: 1.45,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroMetricData {
  const _HeroMetricData({
    required this.icon,
    required this.colors,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final SmartBuildPlanIconColors colors;
  final String value;
  final String label;
}

class _HeroMetric extends StatelessWidget {
  const _HeroMetric({required this.data});

  final _HeroMetricData data;

  @override
  Widget build(BuildContext context) {
    final palette = LearningUiPalette.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        SmartBuildPlanColoredIcon(
          icon: data.icon,
          colors: data.colors,
          size: 22,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          data.value,
          textAlign: TextAlign.center,
          style: AppTextStyles.title(context).copyWith(
            color: palette.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 16,
          ),
        ),
        Text(
          data.label,
          textAlign: TextAlign.center,
          maxLines: 2,
          style: AppTextStyles.label(context).copyWith(
            color: palette.textSecondary,
            height: 1.2,
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}
