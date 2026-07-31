import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../shared/widgets/app_section_card.dart';
import '../../../application/supplier_material_requests_providers.dart';
import '../../../data/models/supplier_dashboard.dart';
import '../../../data/models/supplier_dashboard_insights.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_dashboard_colors.dart';

/// A concise, priority-ordered set of supplier actions derived from dashboard data.
class SupplierDashboardInsightsPanel extends ConsumerWidget {
  const SupplierDashboardInsightsPanel({super.key, required this.dashboard});

  final SupplierDashboard dashboard;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unansweredCount = ref
        .watch(supplierUnansweredMaterialRequestsCountProvider)
        .maybeWhen(data: (count) => count, orElse: () => 0);
    final tiles = _buildTiles(context, unansweredCount).take(3).toList();
    final colors = context.supplierColors;

    return AppSectionCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.s.actionableInsights,
            style: context.supplierSectionTitle(),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            context.s.actionableInsightsSubtitle,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          if (tiles.isEmpty)
            _AllCaughtUpState()
          else
            LayoutBuilder(
              builder: (context, constraints) {
                final columns = constraints.maxWidth >= 600 ? tiles.length : 1;
                final width =
                    (constraints.maxWidth - (AppSpacing.sm * (columns - 1))) /
                    columns;

                return Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final tile in tiles)
                      SizedBox(
                        width: width,
                        child: _InsightTile(spec: tile),
                      ),
                  ],
                );
              },
            ),
        ],
      ),
    );
  }

  List<_InsightSpec> _buildTiles(BuildContext context, int unansweredCount) {
    final stats = dashboard.stats;
    final activeMaterials = stats.materials.available;
    final reusedMaterials = stats.materials.reused;
    final hasHighDemand = dashboard.highDemandMaterials.any(
      (material) => material.demandCount > 0,
    );
    final location = dashboard.supplier?.defaultLocation;
    final locationSet =
        dashboard.hasSupplierProfile &&
        location != null &&
        location.id.isNotEmpty &&
        (location.city.trim().isNotEmpty ||
            location.area?.trim().isNotEmpty == true);
    final tiles = <_InsightSpec>[];

    if (stats.reservations.pending > 0) {
      tiles.add(
        _InsightSpec(
          title: context.s.requestsNeedAttention,
          message: context.s.pendingRequestsMessage(stats.reservations.pending),
          actionLabel: context.s.reviewRequests,
          route: '/supplier/reservations',
          icon: Icons.inbox_outlined,
          accent: SupplierDashboardColors.pending,
        ),
      );
    }

    if (unansweredCount > 0) {
      tiles.add(
        _InsightSpec(
          title: context.s.learnerMaterialRequestsInsightTitle,
          message: context.s.learnerMaterialRequestsInsightMessage(
            unansweredCount,
          ),
          actionLabel: context.s.reviewLearnerMaterialRequests,
          route: '/supplier/material-requests?unansweredByMe=true',
          icon: Icons.handshake_outlined,
          accent: SupplierDashboardColors.accepted,
        ),
      );
    }

    if (!locationSet) {
      tiles.add(
        _InsightSpec(
          title: context.s.pickupReadiness,
          message: dashboard.hasSupplierProfile
              ? context.s.pickupLocationMissing
              : context.s.completeProfileForPickup,
          actionLabel: context.s.updateProfile,
          route: '/supplier/profile',
          icon: Icons.location_on_outlined,
          accent: SupplierDashboardColors.accepted,
        ),
      );
    }

    if (hasHighDemand) {
      tiles.add(
        _InsightSpec(
          title: context.s.highDemandMaterialsTitle,
          message: context.s.strongDemandInsight,
          actionLabel: context.s.viewMaterials,
          route: '/supplier/materials',
          icon: Icons.trending_up_outlined,
          accent: SupplierDashboardColors.pending,
        ),
      );
    }

    if (activeMaterials == 0 || reusedMaterials == 0) {
      final addMaterial = activeMaterials == 0;
      tiles.add(
        _InsightSpec(
          title: context.s.growReuse,
          message: addMaterial
              ? context.s.growReuseEmpty
              : context.s.growReuseActiveListings,
          actionLabel: addMaterial
              ? context.s.addMaterial
              : context.s.viewMaterials,
          route: addMaterial
              ? '/supplier/materials/new'
              : '/supplier/materials',
          icon: Icons.eco_outlined,
          accent: SupplierDashboardColors.reused,
        ),
      );
    }

    return tiles;
  }
}

class _InsightSpec {
  const _InsightSpec({
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.route,
    required this.icon,
    required this.accent,
  });

  final String title;
  final String message;
  final String actionLabel;
  final String route;
  final IconData icon;
  final Color accent;
}

class _InsightTile extends StatelessWidget {
  const _InsightTile({required this.spec});

  final _InsightSpec spec;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      height: 176,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: spec.accent.withValues(alpha: colors.isDark ? 0.14 : 0.07),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: spec.accent.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: spec.accent.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(spec.icon, size: 18, color: spec.accent),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            spec.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: context.supplierLabel().copyWith(
              color: colors.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            spec.message,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 12,
              height: 1.25,
            ),
          ),
          const Spacer(),
          TextButton.icon(
            onPressed: () => context.push(spec.route),
            style: TextButton.styleFrom(
              foregroundColor: spec.accent,
              padding: EdgeInsets.zero,
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            icon: const Icon(Icons.arrow_forward_rounded, size: 14),
            label: Text(
              spec.actionLabel,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

class _AllCaughtUpState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: 0.38),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.55)),
      ),
      child: Row(
        children: [
          Icon(
            Icons.check_circle_outline,
            color: SupplierDashboardColors.completed,
            size: 20,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              context.s.allCaughtUp,
              style: context.supplierBody().copyWith(
                color: colors.textSecondary,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// High-demand materials presented separately from supplier engagement.
class SupplierDashboardHighDemandPanel extends StatelessWidget {
  const SupplierDashboardHighDemandPanel({super.key, required this.dashboard});

  final SupplierDashboard dashboard;

  @override
  Widget build(BuildContext context) {
    final highDemand = dashboard.highDemandMaterials
        .where((material) => material.demandCount > 0)
        .take(2)
        .toList();

    return _HighDemandPanel(materials: highDemand);
  }
}

/// Supplier engagement presented as a companion card for project impact.
class SupplierDashboardEngagementPanel extends StatelessWidget {
  const SupplierDashboardEngagementPanel({super.key, required this.dashboard});

  final SupplierDashboard dashboard;

  @override
  Widget build(BuildContext context) => _EngagementPanel(dashboard: dashboard);
}

class _SupportingCard extends StatelessWidget {
  const _SupportingCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return AppSectionCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: context.supplierSectionTitle()),
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle,
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          child,
        ],
      ),
    );
  }
}

class _HighDemandPanel extends StatelessWidget {
  const _HighDemandPanel({required this.materials});

  final List<SupplierDashboardMaterialInsight> materials;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return _SupportingCard(
      title: context.s.highDemandMaterialsTitle,
      subtitle: context.s.highDemandMaterialsSubtitle,
      child: materials.isEmpty
          ? Text(
              context.s.noHighDemandMaterialsYet,
              style: context.supplierBody().copyWith(
                color: colors.textSecondary,
                fontSize: 13,
              ),
            )
          : Column(
              children: [
                for (var index = 0; index < materials.length; index++) ...[
                  if (index > 0) const SizedBox(height: AppSpacing.md),
                  _HighDemandMaterialRow(material: materials[index]),
                ],
              ],
            ),
    );
  }
}

class _HighDemandMaterialRow extends StatelessWidget {
  const _HighDemandMaterialRow({required this.material});

  final SupplierDashboardMaterialInsight material;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: SupplierDashboardColors.pending.withValues(alpha: 0.07),
        borderRadius: AppRadius.mdAll,
        border: Border.all(
          color: SupplierDashboardColors.pending.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: SupplierDashboardColors.pending.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(
              Icons.trending_up_outlined,
              color: SupplierDashboardColors.pending,
              size: 20,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  material.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.supplierLabel().copyWith(
                    color: colors.textPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  context.s.activeRequestsLabel(material.demandCount),
                  style: context.supplierBody().copyWith(
                    color: colors.textSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextButton.icon(
                  onPressed: () =>
                      context.push('/supplier/materials/${material.id}'),
                  style: TextButton.styleFrom(
                    foregroundColor: colors.accent,
                    padding: EdgeInsets.zero,
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  icon: const Icon(Icons.arrow_forward_rounded, size: 15),
                  label: Text(context.s.manageMaterial),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EngagementPanel extends StatelessWidget {
  const _EngagementPanel({required this.dashboard});

  final SupplierDashboard dashboard;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final engagement = dashboard.stats.engagement;
    final material = dashboard.mostViewedMaterial;

    return _SupportingCard(
      title: context.s.supplierEngagementTitle,
      subtitle: context.s.mostViewedMaterialTitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (material == null)
            Text(
              context.s.noViewedMaterialsYet,
              style: context.supplierBody().copyWith(
                color: colors.textSecondary,
                fontSize: 13,
              ),
            )
          else
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: colors.backgroundElevated.withValues(alpha: 0.42),
                borderRadius: AppRadius.mdAll,
                border: Border.all(color: colors.border.withValues(alpha: 0.7)),
              ),
              child: Text(
                material.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: context.supplierLabel().copyWith(
                  color: colors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: _EngagementMetric(
                  label: context.s.statTotalViews,
                  value: '${engagement.totalViews}',
                  icon: Icons.visibility_outlined,
                  color: SupplierDashboardColors.views,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _EngagementMetric(
                  label: context.s.statTotalLikes,
                  value: '${engagement.totalLikes}',
                  icon: Icons.favorite_outline,
                  color: SupplierDashboardColors.likes,
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _EngagementMetric(
                  label: context.s.statFollowers,
                  value: '${engagement.followersCount}',
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

class _EngagementMetric extends StatelessWidget {
  const _EngagementMetric({
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
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: color, size: 19),
        const SizedBox(height: AppSpacing.sm),
        Text(
          value,
          style: context.supplierSectionTitle().copyWith(fontSize: 20),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          label,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: context.supplierBody().copyWith(
            color: colors.textSecondary,
            fontSize: 11,
            height: 1.2,
          ),
        ),
      ],
    );
  }
}
