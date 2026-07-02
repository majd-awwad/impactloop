import 'package:flutter/material.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_dashboard_colors.dart';

class SupplierDashboardStatCard extends StatelessWidget {
  const SupplierDashboardStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.helperText,
    required this.icon,
    required this.accentColor,
    this.highlight = false,
  });

  final String label;
  final String value;
  final String helperText;
  final IconData icon;
  final Color accentColor;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      height: 164,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: highlight
          ? context.supplierDecorations.highlightedStatCard
          : context.supplierDecorations.statCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 3,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              gradient: LinearGradient(
                colors: [
                  accentColor,
                  accentColor.withValues(alpha: 0.35),
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
                  color: accentColor.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: accentColor.withValues(alpha: 0.28),
                  ),
                ),
                child: Icon(icon, color: accentColor, size: 20),
              ),
              const Spacer(),
              if (highlight)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    context.s.statActionBadge,
                    style: context.supplierChip().copyWith(
                      color: accentColor,
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const Spacer(),
          Text(
            value,
            style: context.supplierTitle().copyWith(
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: context.supplierLabel().copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          Text(
            helperText,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: context.supplierBody().copyWith(
              fontSize: 12,
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
            accentColor: SupplierDashboardColors.available,
          ),
          SupplierDashboardStatCard(
            label: context.s.statPendingRequests,
            value: '$pendingRequests',
            helperText: context.s.statHelperWaitingResponse,
            icon: Icons.inbox_outlined,
            accentColor: SupplierDashboardColors.pending,
            highlight: pendingRequests > 0,
          ),
          SupplierDashboardStatCard(
            label: context.s.statScheduledPickups,
            value: '$scheduledPickups',
            helperText: context.s.statHelperAcceptedPickups,
            icon: Icons.local_shipping_outlined,
            accentColor: SupplierDashboardColors.accepted,
          ),
          SupplierDashboardStatCard(
            label: context.s.statReusedMaterials,
            value: '$reusedMaterials',
            helperText: context.s.statHelperCompletedReuse,
            icon: Icons.recycling_outlined,
            accentColor: SupplierDashboardColors.reused,
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

    final metrics = [
      _SecondaryMetric(
        label: context.s.statTotalMaterials,
        value: '$totalMaterials',
        icon: Icons.layers_outlined,
        accentColor: SupplierDashboardColors.totalMaterials,
      ),
      _SecondaryMetric(
        label: context.s.statAvailableMaterials,
        value: '$availableMaterials',
        icon: Icons.check_circle_outline,
        accentColor: SupplierDashboardColors.available,
      ),
      _SecondaryMetric(
        label: context.s.statReservedMaterials,
        value: '$reservedMaterials',
        icon: Icons.lock_outline,
        accentColor: SupplierDashboardColors.reserved,
      ),
      _SecondaryMetric(
        label: context.s.statTotalViews,
        value: '$totalViews',
        icon: Icons.visibility_outlined,
        accentColor: SupplierDashboardColors.views,
      ),
      _SecondaryMetric(
        label: context.s.statTotalLikes,
        value: '$totalLikes',
        icon: Icons.favorite_outline,
        accentColor: SupplierDashboardColors.likes,
      ),
      _SecondaryMetric(
        label: context.s.statFollowers,
        value: '$followersCount',
        icon: Icons.people_outline,
        accentColor: SupplierDashboardColors.followers,
      ),
    ];

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: metrics
          .map(
            (metric) => Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 8,
              ),
              decoration: BoxDecoration(
                color: colors.surfaceSolid.withValues(
                  alpha: colors.isDark ? 0.72 : 1,
                ),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: colors.border.withValues(
                    alpha: colors.isDark ? 0.35 : 0.55,
                  ),
                ),
                boxShadow: [
                  BoxShadow(
                    color: colors.cardShadow,
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(metric.icon, size: 14, color: metric.accentColor),
                  const SizedBox(width: 6),
                  Text(
                    metric.value,
                    style: context.supplierLabel().copyWith(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    metric.label,
                    style: context.supplierBody().copyWith(
                      fontSize: 11,
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
    required this.accentColor,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color accentColor;
}
