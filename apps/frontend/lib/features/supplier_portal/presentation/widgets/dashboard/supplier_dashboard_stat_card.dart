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
    this.mobile = false,
    this.highlight = false,
  });

  final String label;
  final String value;
  final String helperText;
  final IconData icon;
  final AppStatusTone tone;
  final bool mobile;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final textTheme = Theme.of(context).textTheme;
    final statusStyle = AppStatusStyle.of(context, tone);

    return AppSectionCard(
      height: mobile ? 120 : 136,
      padding: EdgeInsets.all(mobile ? AppSpacing.md : AppSpacing.lg),
      tone: tone,
      emphasized: highlight,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: mobile ? 36 : 40,
            height: mobile ? 36 : 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: statusStyle.background,
              borderRadius: AppRadius.mdAll,
              border: Border.all(color: statusStyle.border),
            ),
            child: Icon(
              icon,
              color: statusStyle.foreground,
              size: mobile ? 19 : 21,
            ),
          ),
          SizedBox(width: mobile ? AppSpacing.xs : AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        value,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: (mobile
                                ? textTheme.titleLarge
                                : textTheme.headlineMedium)
                            ?.copyWith(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w700,
                              height: 1.1,
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
                Flexible(
                  child: Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: textTheme.labelLarge?.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                      height: 1.25,
                    ),
                  ),
                ),
                Text(
                  helperText,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.bodySmall?.copyWith(
                    color: colors.textSecondary,
                    height: 1.25,
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
        final mobile = constraints.maxWidth < 600;
        final columns = mobile
            ? 1
            : constraints.maxWidth >= 1180
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
            mobile: mobile,
          ),
          SupplierDashboardStatCard(
            label: context.s.statPendingRequests,
            value: '$pendingRequests',
            helperText: context.s.statHelperWaitingResponse,
            icon: Icons.inbox_outlined,
            tone: AppStatusTone.warning,
            mobile: mobile,
            highlight: pendingRequests > 0,
          ),
          SupplierDashboardStatCard(
            label: context.s.statScheduledPickups,
            value: '$scheduledPickups',
            helperText: context.s.statHelperAcceptedPickups,
            icon: Icons.local_shipping_outlined,
            tone: AppStatusTone.info,
            mobile: mobile,
          ),
          SupplierDashboardStatCard(
            label: context.s.statReusedMaterials,
            value: '$reusedMaterials',
            helperText: context.s.statHelperCompletedReuse,
            icon: Icons.recycling_outlined,
            tone: AppStatusTone.primary,
            mobile: mobile,
          ),
        ];

        return Wrap(
          spacing: mobile ? AppSpacing.sm : AppSpacing.lg,
          runSpacing: mobile ? AppSpacing.sm : AppSpacing.lg,
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

    final mobile = MediaQuery.sizeOf(context).width < 600;

    return AppSectionCard(
      padding: EdgeInsets.symmetric(
        horizontal: mobile ? AppSpacing.sm : AppSpacing.md,
        vertical: mobile ? AppSpacing.sm : AppSpacing.md,
      ),
      borderRadius: AppRadius.mdAll,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final mobile = constraints.maxWidth < 600;
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
            spacing: mobile ? AppSpacing.sm : AppSpacing.md,
            runSpacing: mobile ? AppSpacing.sm : AppSpacing.md,
            children: [
              for (var index = 0; index < metrics.length; index++)
                SizedBox(
                  width: width,
                  child: _SecondaryMetricItem(
                    metric: metrics[index],
                    showDivider: columns == 6 && index < metrics.length - 1,
                    mobile: mobile,
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
  const _SecondaryMetricItem({
    required this.metric,
    required this.showDivider,
    required this.mobile,
  });

  final _SecondaryMetric metric;
  final bool showDivider;
  final bool mobile;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final statusStyle = AppStatusStyle.of(context, metric.tone);

    return Container(
      height: mobile ? 56 : 70,
      padding: EdgeInsets.symmetric(
        horizontal: mobile ? AppSpacing.sm : AppSpacing.md,
      ),
      decoration: BoxDecoration(
        border: showDivider
            ? BorderDirectional(
                end: BorderSide(color: colors.border.withValues(alpha: 0.7)),
              )
            : null,
      ),
      child: Row(
        children: [
          Icon(
            metric.icon,
            size: mobile ? 16 : 18,
            color: statusStyle.foreground,
          ),
          SizedBox(width: mobile ? AppSpacing.sm : AppSpacing.md),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  metric.value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                    height: 1.2,
                  ),
                ),
                Flexible(
                  child: Text(
                    metric.label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: colors.textSecondary,
                      height: 1.2,
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
