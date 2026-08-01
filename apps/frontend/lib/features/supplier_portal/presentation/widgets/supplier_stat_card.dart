import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import 'package:frontend/features/supplier_portal/presentation/theme/supplier_theme_extension.dart';

class SupplierStatCard extends StatelessWidget {
  const SupplierStatCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    this.subtitle,
    this.progress,
    this.highlight = false,
    this.badge,
  });

  final String label;
  final String value;
  final IconData icon;
  final String? subtitle;
  final double? progress;
  final bool highlight;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: highlight
          ? decorations.highlightedStatCard
          : decorations.statCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: colors.accent, size: 20),
              const Spacer(),
              if (badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: decorations.badge(
                    background: colors.chipSelected,
                  ),
                  child: Text(
                    badge!,
                    style: context.supplierChip().copyWith(
                      color: colors.accent,
                      fontSize: 11,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(value, style: context.supplierTitle().copyWith(fontSize: 20)),
          Text(label, style: context.supplierBody()),
          if (subtitle != null) ...[
            Text(
              subtitle!,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: context.supplierBody().copyWith(fontSize: 12),
            ),
          ],
          if (progress != null) ...[
            const Spacer(),
            const SizedBox(height: AppSpacing.xs),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppSpacing.xs),
              child: LinearProgressIndicator(
                minHeight: 6,
                value: progress!.clamp(0, 1),
                backgroundColor: colors.chipUnselected.withValues(alpha: 0.8),
                color: colors.accent,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class SupplierImpactCard extends StatelessWidget {
  const SupplierImpactCard({
    super.key,
    required this.reusedMaterials,
    required this.reusedQuantity,
    required this.totalMaterials,
  });

  final int reusedMaterials;
  final double reusedQuantity;
  final int totalMaterials;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    final progress = totalMaterials == 0
        ? 0.0
        : reusedMaterials / totalMaterials;
    final quantityText = reusedQuantity.toStringAsFixed(
      reusedQuantity.truncateToDouble() == reusedQuantity ? 0 : 1,
    );

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: decorations.highlightedStatCard,
      child: Row(
        children: [
          SizedBox(
            width: 56,
            height: 56,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: progress.clamp(0, 1),
                  strokeWidth: 6,
                  backgroundColor: colors.chipUnselected,
                  color: colors.accent,
                ),
                Icon(Icons.recycling_rounded, color: colors.accent, size: 22),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  context.s.reuseImpact,
                  style: context.supplierLabel().copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  context.s.reusedMaterialsSummary(
                    reusedMaterials,
                    quantityText,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.supplierBody(),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  context.s.reuseImpactNote,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.supplierBody().copyWith(fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SupplierRatingCard extends StatelessWidget {
  const SupplierRatingCard({
    super.key,
    required this.averageRating,
    required this.totalReviews,
  });

  final double averageRating;
  final int totalReviews;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    final activeStars = averageRating.round().clamp(0, 5);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: decorations.statCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.star_rounded, color: colors.accent, size: 20),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              for (var index = 0; index < 5; index++)
                Icon(
                  index < activeStars
                      ? Icons.star_rounded
                      : Icons.star_border_rounded,
                  color: colors.accent,
                  size: 18,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            totalReviews == 0
                ? context.s.noReviewsYet
                : averageRating.toStringAsFixed(1),
            style: context.supplierTitle().copyWith(fontSize: 20),
          ),
          Text(
            totalReviews == 0
                ? context.s.ratingLabel
                : context.s.reviewsCount(totalReviews),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.supplierBody(),
          ),
        ],
      ),
    );
  }
}

class SupplierLifecycleCard extends StatelessWidget {
  const SupplierLifecycleCard({
    super.key,
    required this.total,
    required this.available,
    required this.reserved,
    required this.reused,
  });

  final int total;
  final int available;
  final int reserved;
  final int reused;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;
    final items = [
      (context.s.lifecycleListed, total),
      (context.s.lifecycleAvailable, available),
      (context.s.lifecycleReserved, reserved),
      (context.s.lifecycleReused, reused),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: decorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            context.s.materialLifecycle,
            style: context.supplierSectionTitle(),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              for (var index = 0; index < items.length; index++) ...[
                Expanded(
                  child: _LifecycleNode(
                    label: items[index].$1,
                    value: items[index].$2,
                    isActive: items[index].$2 > 0,
                  ),
                ),
                if (index < items.length - 1)
                  Container(
                    width: AppSpacing.md,
                    height: 2,
                    color: colors.border.withValues(alpha: 0.7),
                  ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

class _LifecycleNode extends StatelessWidget {
  const _LifecycleNode({
    required this.label,
    required this.value,
    required this.isActive,
  });

  final String label;
  final int value;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final decorations = context.supplierDecorations;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.sm,
      ),
      decoration: decorations.lifecycleNode(isActive: isActive),
      child: Column(
        children: [
          Text(
            '$value',
            style: context.supplierLabel().copyWith(
              color: isActive ? colors.accent : colors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.supplierBody().copyWith(fontSize: 11),
          ),
        ],
      ),
    );
  }
}
