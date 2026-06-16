import 'package:flutter/material.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';

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
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: highlight
          ? SupplierDecorations.highlightedStatCard
          : SupplierDecorations.statCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AuthDarkColors.accent, size: 20),
              const Spacer(),
              if (badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: SupplierDecorations.badge(
                    background: AuthDarkColors.chipSelected,
                  ),
                  child: Text(
                    badge!,
                    style: AuthDarkTextStyles.chip(
                      context,
                    ).copyWith(color: AuthDarkColors.accent, fontSize: 11),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            value,
            style: AuthDarkTextStyles.title(context).copyWith(fontSize: 22),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(label, style: AuthDarkTextStyles.body(context)),
          if (subtitle != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              subtitle!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AuthDarkTextStyles.body(context).copyWith(fontSize: 12),
            ),
          ],
          if (progress != null) ...[
            const Spacer(),
            const SizedBox(height: AppSpacing.md),
            ClipRRect(
              borderRadius: BorderRadius.circular(AppSpacing.xs),
              child: LinearProgressIndicator(
                minHeight: 6,
                value: progress!.clamp(0, 1),
                backgroundColor: AuthDarkColors.chipUnselected.withValues(
                  alpha: 0.8,
                ),
                color: AuthDarkColors.accent,
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
    final progress = totalMaterials == 0
        ? 0.0
        : reusedMaterials / totalMaterials;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: SupplierDecorations.highlightedStatCard,
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
                  backgroundColor: AuthDarkColors.chipUnselected,
                  color: AuthDarkColors.accent,
                ),
                Icon(
                  Icons.recycling_rounded,
                  color: AuthDarkColors.accent,
                  size: 22,
                ),
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
                  'Reuse impact',
                  style: AuthDarkTextStyles.label(context).copyWith(
                    color: AuthDarkColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '$reusedMaterials reused · ${reusedQuantity.toStringAsFixed(reusedQuantity.truncateToDouble() == reusedQuantity ? 0 : 1)} units',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AuthDarkTextStyles.body(context),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Impact is calculated from completed reuse data.',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AuthDarkTextStyles.body(
                    context,
                  ).copyWith(fontSize: 12),
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
    final activeStars = averageRating.round().clamp(0, 5);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: SupplierDecorations.statCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.star_rounded, color: AuthDarkColors.accent, size: 20),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              for (var index = 0; index < 5; index++)
                Icon(
                  index < activeStars
                      ? Icons.star_rounded
                      : Icons.star_border_rounded,
                  color: AuthDarkColors.accent,
                  size: 18,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            totalReviews == 0
                ? 'No reviews yet'
                : averageRating.toStringAsFixed(1),
            style: AuthDarkTextStyles.title(context).copyWith(fontSize: 20),
          ),
          Text(
            totalReviews == 0 ? 'Rating' : '$totalReviews reviews',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AuthDarkTextStyles.body(context),
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
    final items = [
      ('Listed', total),
      ('Available', available),
      ('Reserved', reserved),
      ('Reused', reused),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: SupplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'Material lifecycle',
            style: AuthDarkTextStyles.sectionTitle(context),
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
                    color: AuthDarkColors.border.withValues(alpha: 0.7),
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
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.sm,
      ),
      decoration: SupplierDecorations.lifecycleNode(isActive: isActive),
      child: Column(
        children: [
          Text(
            '$value',
            style: AuthDarkTextStyles.label(context).copyWith(
              color: isActive
                  ? AuthDarkColors.accent
                  : AuthDarkColors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AuthDarkTextStyles.body(context).copyWith(fontSize: 11),
          ),
        ],
      ),
    );
  }
}
