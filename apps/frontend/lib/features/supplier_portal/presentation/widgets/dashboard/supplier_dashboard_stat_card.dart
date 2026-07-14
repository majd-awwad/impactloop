import 'package:flutter/material.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../shared/widgets/app_section_card.dart';
import '../../../../../shared/widgets/app_status_badge.dart';
import '../../theme/supplier_theme_extension.dart';

class SupplierDashboardStatCard extends StatelessWidget {
  const SupplierDashboardStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.helperText,
    required this.icon,
    required this.tone,
    this.highlight = false,
  });

  final String label;
  final String value;
  final String helperText;
  final IconData icon;
  final AppStatusTone tone;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final textTheme = Theme.of(context).textTheme;
    final statusStyle = AppStatusStyle.of(context, tone);

    return AppSectionCard(
      height: 136,
      padding: const EdgeInsets.all(AppSpacing.lg),
      tone: tone,
      emphasized: highlight,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: statusStyle.background,
              borderRadius: AppRadius.mdAll,
              border: Border.all(color: statusStyle.border),
            ),
            child: Icon(icon, color: statusStyle.foreground, size: 21),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        value,
                        style: textTheme.headlineMedium?.copyWith(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (highlight)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.sm,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: statusStyle.background,
                          borderRadius: AppRadius.pillAll,
                        ),
                        child: Text(
                          context.s.statActionBadge,
                          style: textTheme.labelSmall?.copyWith(
                            color: statusStyle.foreground,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                  ],
                ),
                Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.labelLarge?.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  helperText,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.bodySmall?.copyWith(
                    color: colors.textSecondary,
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

class SupplierDashboardMainStatGrid extends StatelessWidget {
  const SupplierDashboardMainStatGrid({
    super.key,
    required this.activeMaterials,
    required this.pendingRequests,
    required this.scheduledPickups,
    required this.reusedMaterials,
  });

  final int activeMaterials;
  final int pendingRequests;
  final int scheduledPickups;
  final int reusedMaterials;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1180
            ? 4
            : constraints.maxWidth >= 520
            ? 2
            : 1;
        final cardWidth =
            (constraints.maxWidth - (AppSpacing.lg * (columns - 1))) / columns;
        final cards = [
          SupplierDashboardStatCard(
            label: context.s.statActiveMaterials,
            value: '$activeMaterials',
            helperText: context.s.statHelperVisibleToLearners,
            icon: Icons.inventory_2_outlined,
            tone: AppStatusTone.success,
          ),
          SupplierDashboardStatCard(
            label: context.s.statPendingRequests,
            value: '$pendingRequests',
            helperText: context.s.statHelperWaitingResponse,
            icon: Icons.inbox_outlined,
            tone: AppStatusTone.warning,
            highlight: pendingRequests > 0,
          ),
          SupplierDashboardStatCard(
            label: context.s.statScheduledPickups,
            value: '$scheduledPickups',
            helperText: context.s.statHelperAcceptedPickups,
            icon: Icons.local_shipping_outlined,
            tone: AppStatusTone.info,
          ),
          SupplierDashboardStatCard(
            label: context.s.statReusedMaterials,
            value: '$reusedMaterials',
            helperText: context.s.statHelperCompletedReuse,
            icon: Icons.recycling_outlined,
            tone: AppStatusTone.primary,
          ),
        ];

        return Wrap(
          spacing: AppSpacing.lg,
          runSpacing: AppSpacing.lg,
          children: [
            for (final card in cards) SizedBox(width: cardWidth, child: card),
          ],
        );
      },
    );
  }
}

class SupplierDashboardSecondaryMetricsRow extends StatelessWidget {
  const SupplierDashboardSecondaryMetricsRow({
    super.key,
    required this.totalMaterials,
    required this.availableMaterials,
    required this.reservedMaterials,
    required this.totalViews,
    required this.totalLikes,
    required this.followersCount,
  });

  final int totalMaterials;
  final int availableMaterials;
  final int reservedMaterials;
  final int totalViews;
  final int totalLikes;
  final int followersCount;

  @override
  Widget build(BuildContext context) {
    final metrics = [
      _SecondaryMetric(
        label: context.s.statTotalMaterials,
        value: '$totalMaterials',
        icon: Icons.layers_outlined,
        tone: AppStatusTone.success,
      ),
      _SecondaryMetric(
        label: context.s.statAvailableMaterials,
        value: '$availableMaterials',
        icon: Icons.check_circle_outline,
        tone: AppStatusTone.success,
      ),
      _SecondaryMetric(
        label: context.s.statReservedMaterials,
        value: '$reservedMaterials',
        icon: Icons.lock_outline,
        tone: AppStatusTone.warning,
      ),
      _SecondaryMetric(
        label: context.s.statTotalViews,
        value: '$totalViews',
        icon: Icons.visibility_outlined,
        tone: AppStatusTone.info,
      ),
      _SecondaryMetric(
        label: context.s.statTotalLikes,
        value: '$totalLikes',
        icon: Icons.favorite_outline,
        tone: AppStatusTone.danger,
      ),
      _SecondaryMetric(
        label: context.s.statFollowers,
        value: '$followersCount',
        icon: Icons.people_outline,
        tone: AppStatusTone.primary,
      ),
    ];

    return AppSectionCard(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
      borderRadius: AppRadius.mdAll,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final columns = constraints.maxWidth >= 1180
              ? 6
              : constraints.maxWidth >= 640
              ? 3
              : constraints.maxWidth >= 360
              ? 2
              : 1;
          final width =
              (constraints.maxWidth - (AppSpacing.md * (columns - 1))) /
              columns;

          return Wrap(
            spacing: AppSpacing.md,
            runSpacing: AppSpacing.md,
            children: [
              for (var index = 0; index < metrics.length; index++)
                SizedBox(
                  width: width,
                  child: _SecondaryMetricItem(
                    metric: metrics[index],
                    showDivider: columns == 6 && index < metrics.length - 1,
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _SecondaryMetric {
  const _SecondaryMetric({
    required this.label,
    required this.value,
    required this.icon,
    required this.tone,
  });

  final String label;
  final String value;
  final IconData icon;
  final AppStatusTone tone;
}

class _SecondaryMetricItem extends StatelessWidget {
  const _SecondaryMetricItem({required this.metric, required this.showDivider});

  final _SecondaryMetric metric;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final statusStyle = AppStatusStyle.of(context, metric.tone);

    return Container(
      height: 70,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      decoration: BoxDecoration(
        border: showDivider
            ? BorderDirectional(
                end: BorderSide(color: colors.border.withValues(alpha: 0.7)),
              )
            : null,
      ),
      child: Row(
        children: [
          Icon(metric.icon, size: 18, color: statusStyle.foreground),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  metric.value,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                  ),
                ),
                Text(
                  metric.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.labelSmall?.copyWith(color: colors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
