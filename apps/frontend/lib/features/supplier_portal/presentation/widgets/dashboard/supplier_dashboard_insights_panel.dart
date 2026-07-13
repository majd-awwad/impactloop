import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_spacing.dart';
import '../../../../../shared/widgets/app_section_card.dart';
import '../../../data/models/supplier_dashboard.dart';
import '../../../data/models/supplier_dashboard_insights.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_dashboard_colors.dart';

/// Bottom dashboard insights: high demand + supplier engagement.
class SupplierDashboardInsightsPanel extends StatelessWidget {
  const SupplierDashboardInsightsPanel({super.key, required this.dashboard});

  final SupplierDashboard dashboard;

  static const _maxHighDemand = 3;

  @override
  Widget build(BuildContext context) {
    final highDemandMaterials = dashboard.highDemandMaterials
        .where((material) => material.demandCount > 0)
        .take(_maxHighDemand)
        .toList();
    final engagement = dashboard.stats.engagement;

    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= 980;

        final highDemandCard = _HighDemandCard(materials: highDemandMaterials);
        final engagementCard = _SupplierEngagementCard(
          mostViewed: engagement.totalViews > 0
              ? dashboard.mostViewedMaterial
              : null,
          totalViews: engagement.totalViews,
          totalLikes: engagement.totalLikes,
          followersCount: engagement.followersCount,
        );

        if (wide) {
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(flex: 3, child: highDemandCard),
              const SizedBox(width: AppSpacing.md),
              Expanded(flex: 2, child: engagementCard),
            ],
          );
        }

        return Column(
          children: [
            highDemandCard,
            const SizedBox(height: AppSpacing.md),
            engagementCard,
          ],
        );
      },
    );
  }
}

class _WhiteDashboardCard extends StatelessWidget {
  const _WhiteDashboardCard({
    required this.title,
    this.subtitle,
    required this.child,
  });

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return AppSectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: context.supplierSectionTitle()),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle!,
              style: context.supplierBody().copyWith(
                color: colors.textSecondary,
                fontSize: 12,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

class _HighDemandCard extends StatelessWidget {
  const _HighDemandCard({required this.materials});

  final List<SupplierDashboardMaterialInsight> materials;

  @override
  Widget build(BuildContext context) {
    return _WhiteDashboardCard(
      title: context.s.highDemandMaterialsTitle,
      subtitle: context.s.highDemandMaterialsSubtitle,
      child: materials.isEmpty
          ? Text(
              context.s.noHighDemandMaterialsYet,
              style: context.supplierBody().copyWith(
                color: context.supplierColors.textSecondary,
                fontSize: 13,
              ),
            )
          : Column(
              children: materials
                  .map(
                    (material) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: _HighDemandRow(material: material),
                    ),
                  )
                  .toList(),
            ),
    );
  }
}

class _HighDemandRow extends StatelessWidget {
  const _HighDemandRow({required this.material});

  final SupplierDashboardMaterialInsight material;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surfaceSolid.withValues(alpha: colors.isDark ? 0.5 : 0.6),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: colors.border.withValues(alpha: colors.isDark ? 0.25 : 0.45),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _MaterialThumb(imageUrl: material.coverImageUrl),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  material.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.supplierLabel().copyWith(fontSize: 13),
                ),
                const SizedBox(height: 4),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    _StatusBadge(status: material.status),
                    if (material.categoryName != null)
                      Text(
                        material.categoryName!,
                        style: context.supplierBody().copyWith(
                          color: colors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  context.s.activeRequestsLabel(material.demandCount),
                  style: context.supplierBody().copyWith(
                    color: colors.textPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  context.s.viewsCountLabel(material.viewsCount),
                  style: context.supplierBody().copyWith(
                    color: colors.textSecondary,
                    fontSize: 11,
                  ),
                ),
                TextButton(
                  onPressed: () =>
                      context.push('/supplier/materials/${material.id}'),
                  style: TextButton.styleFrom(
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    '${context.s.manageMaterial} →',
                    style: TextStyle(fontSize: 11, color: colors.accent),
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

class _SupplierEngagementCard extends StatelessWidget {
  const _SupplierEngagementCard({
    required this.mostViewed,
    required this.totalViews,
    required this.totalLikes,
    required this.followersCount,
  });

  final SupplierDashboardMaterialInsight? mostViewed;
  final int totalViews;
  final int totalLikes;
  final int followersCount;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return _WhiteDashboardCard(
      title: context.s.supplierEngagementTitle,
      subtitle: context.s.mostViewedMaterialTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (mostViewed == null)
            Text(
              context.s.noViewedMaterialsYet,
              style: context.supplierBody().copyWith(
                color: colors.textSecondary,
                fontSize: 13,
              ),
            )
          else
            _MostViewedRow(material: mostViewed!),
          const SizedBox(height: AppSpacing.md),
          Divider(height: 1, color: colors.border.withValues(alpha: 0.35)),
          const SizedBox(height: AppSpacing.sm),
          Text(
            context.s.engagementTotalsLabel,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _EngagementMiniStat(
                  label: context.s.statTotalMaterialViews,
                  value: '$totalViews',
                  icon: Icons.visibility_outlined,
                  color: SupplierDashboardColors.views,
                ),
              ),
              Expanded(
                child: _EngagementMiniStat(
                  label: context.s.statTotalMaterialLikes,
                  value: '$totalLikes',
                  icon: Icons.favorite_outline,
                  color: SupplierDashboardColors.likes,
                ),
              ),
              Expanded(
                child: _EngagementMiniStat(
                  label: context.s.statFollowers,
                  value: '$followersCount',
                  icon: Icons.people_outline,
                  color: SupplierDashboardColors.followers,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MostViewedRow extends StatelessWidget {
  const _MostViewedRow({required this.material});

  final SupplierDashboardMaterialInsight material;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _MaterialThumb(imageUrl: material.coverImageUrl, size: 48),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                material.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: context.supplierLabel().copyWith(fontSize: 14),
              ),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  _StatusBadge(status: material.status),
                  if (material.categoryName != null)
                    Text(
                      material.categoryName!,
                      style: context.supplierBody().copyWith(
                        color: colors.textSecondary,
                        fontSize: 11,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                context.s.viewsCountLabel(material.viewsCount),
                style: context.supplierBody().copyWith(
                  color: SupplierDashboardColors.views,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              TextButton(
                onPressed: () =>
                    context.push('/supplier/materials/${material.id}'),
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                child: Text(
                  '${context.s.manageMaterial} →',
                  style: TextStyle(fontSize: 11, color: colors.accent),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _EngagementMiniStat extends StatelessWidget {
  const _EngagementMiniStat({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Column(
      children: [
        Icon(icon, size: 16, color: color),
        const SizedBox(height: 4),
        Text(
          value,
          style: context.supplierLabel().copyWith(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
        Text(
          label,
          textAlign: TextAlign.center,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: context.supplierBody().copyWith(
            color: colors.textSecondary,
            fontSize: 10,
          ),
        ),
      ],
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: colors.border.withValues(alpha: 0.35)),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: context.supplierBody().copyWith(
          fontSize: 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _MaterialThumb extends StatelessWidget {
  const _MaterialThumb({this.imageUrl, this.size = 40});

  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Container(
        width: size,
        height: size,
        color: colors.backgroundElevated.withValues(alpha: 0.4),
        child: imageUrl == null || imageUrl!.isEmpty
            ? Icon(
                Icons.image_outlined,
                color: colors.textMuted,
                size: size * 0.4,
              )
            : Image.network(
                imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Icon(
                  Icons.broken_image_outlined,
                  color: colors.textMuted,
                  size: size * 0.4,
                ),
              ),
      ),
    );
  }
}
