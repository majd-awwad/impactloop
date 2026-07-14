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
    final accent = statusStyle.foreground;

    return AppSectionCard(
      height: 164,
      padding: const EdgeInsets.all(AppSpacing.md),
      tone: tone,
      emphasized: highlight,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 3,
            decoration: BoxDecoration(
              borderRadius: AppRadius.pillAll,
              gradient: LinearGradient(
                colors: [
                  accent,
                  accent.withValues(alpha: 0.35),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: statusStyle.background,
                  borderRadius: AppRadius.mdAll,
                  border: Border.all(
                    color: statusStyle.border,
                  ),
                ),
                child: Icon(icon, color: accent, size: 20),
              ),
              const Spacer(),
              if (highlight)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: statusStyle.background,
                    borderRadius: AppRadius.pillAll,
                  ),
                  child: Text(
                    context.s.statActionBadge,
                    style: textTheme.labelSmall?.copyWith(
                      color: accent,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const Spacer(),
          Text(
            value,
            style: textTheme.headlineMedium?.copyWith(
              color: colors.textPrimary,
              fontSize: 28,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: textTheme.labelLarge?.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          Text(
            helperText,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: textTheme.bodySmall?.copyWith(
              color: colors.textSecondary,
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
        final columns = _columnsForWidth(constraints.maxWidth);
        final cardWidth =
            (constraints.maxWidth - (AppSpacing.md * (columns - 1))) / columns;

        final cards = [
          SupplierDashboardStatCard(
            label: context.s.statActiveMaterials,
            value: '$activeMaterials',
            helperText: context.s.statHelperVisibleToLearners,
            icon: Icons.inventory_2_outlined,
            tone: AppStatusTone.primary,
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
            tone: AppStatusTone.success,
          ),
          SupplierDashboardStatCard(
            label: context.s.statReusedMaterials,
            value: '$reusedMaterials',
            helperText: context.s.statHelperCompletedReuse,
            icon: Icons.recycling_outlined,
            tone: AppStatusTone.success,
          ),
        ];

        return Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: cards
              .map(
                (card) => SizedBox(
                  width: cardWidth,
                  child: card,
                ),
              )
              .toList(),
        );
      },
    );
  }

  int _columnsForWidth(double width) {
    if (width >= 1180) {
      return 4;
    }
    if (width >= 640) {
      return 2;
    }
    if (width >= 420) {
      return 2;
    }
    return 1;
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
    final colors = context.supplierColors;
    final textTheme = Theme.of(context).textTheme;

    final metrics = [
      _SecondaryMetric(
        label: context.s.statTotalMaterials,
        value: '$totalMaterials',
        icon: Icons.layers_outlined,
      ),
      _SecondaryMetric(
        label: context.s.statAvailableMaterials,
        value: '$availableMaterials',
        icon: Icons.check_circle_outline,
      ),
      _SecondaryMetric(
        label: context.s.statReservedMaterials,
        value: '$reservedMaterials',
        icon: Icons.lock_outline,
      ),
      _SecondaryMetric(
        label: context.s.statTotalViews,
        value: '$totalViews',
        icon: Icons.visibility_outlined,
      ),
      _SecondaryMetric(
        label: context.s.statTotalLikes,
        value: '$totalLikes',
        icon: Icons.favorite_outline,
      ),
      _SecondaryMetric(
        label: context.s.statFollowers,
        value: '$followersCount',
        icon: Icons.people_outline,
      ),
    ];

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: metrics
          .map(
            (metric) => AppSectionCard(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              borderRadius: AppRadius.mdAll,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(metric.icon, size: 14, color: colors.accent),
                  const SizedBox(width: 6),
                  Text(
                    metric.value,
                    style: textTheme.labelMedium?.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    metric.label,
                    style: textTheme.labelSmall?.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class _SecondaryMetric {
  const _SecondaryMetric({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;
}
