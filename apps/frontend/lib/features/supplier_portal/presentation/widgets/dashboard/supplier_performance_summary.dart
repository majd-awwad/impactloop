import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../data/models/supplier_dashboard.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_dashboard_colors.dart';

/// Actionable next-step guidance derived from existing dashboard data.
class SupplierPerformanceSummary extends StatelessWidget {
  const SupplierPerformanceSummary({super.key, required this.dashboard});

  final SupplierDashboard dashboard;

  @override
  Widget build(BuildContext context) {
    final stats = dashboard.stats;
    final supplier = dashboard.supplier;
    final pending = stats.reservations.pending;
    final activeMaterials = stats.materials.available;
    final reusedMaterials = stats.materials.reused;
    final totalViews = stats.engagement.totalViews;
    final totalLikes = stats.engagement.totalLikes;
    final hasHighDemand = dashboard.highDemandMaterials.isNotEmpty;
    final locationSet = _hasPickupLocation(
      dashboard.hasSupplierProfile,
      supplier?.defaultLocation,
    );

    final allCaughtUp = pending == 0 && locationSet;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.dashboardCard,
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
              color: context.supplierColors.textSecondary,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (allCaughtUp) ...[
            const _AllCaughtUpBanner(),
            if (activeMaterials == 0) ...[
              const SizedBox(height: AppSpacing.md),
              _AddMaterialInsight(),
            ],
            if (hasHighDemand) ...[
              const SizedBox(height: AppSpacing.md),
              const _HighDemandInsight(),
            ],
            if (totalViews > 0 && totalLikes <= 1) ...[
              const SizedBox(height: AppSpacing.md),
              const _EngagementInsight(),
            ],
            if (activeMaterials > 0 || reusedMaterials > 0) ...[
              const SizedBox(height: AppSpacing.md),
              _GrowReuseInsight(
                activeMaterials: activeMaterials,
                reusedMaterials: reusedMaterials,
                compact: true,
              ),
            ],
          ] else
            LayoutBuilder(
              builder: (context, constraints) {
                final wide = constraints.maxWidth >= 760;

                final requests = _RequestsInsight(pending: pending);
                final pickup = _PickupInsight(
                  locationSet: locationSet,
                  hasProfile: dashboard.hasSupplierProfile,
                );
                final growReuse = _GrowReuseInsight(
                  activeMaterials: activeMaterials,
                  reusedMaterials: reusedMaterials,
                );
                final highDemand = hasHighDemand
                    ? const _HighDemandInsight()
                    : null;
                final engagement = totalViews > 0 && totalLikes <= 1
                    ? const _EngagementInsight()
                    : null;
                final addMaterial = activeMaterials == 0
                    ? const _AddMaterialInsight()
                    : null;

                if (wide) {
                  return IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          flex: 3,
                          child: Column(
                            children: [
                              requests,
                              if (addMaterial != null) ...[
                                const SizedBox(height: AppSpacing.sm),
                                addMaterial,
                              ],
                              if (highDemand != null) ...[
                                const SizedBox(height: AppSpacing.sm),
                                highDemand,
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          flex: 2,
                          child: Column(
                            children: [
                              Expanded(child: pickup),
                              const SizedBox(height: AppSpacing.sm),
                              Expanded(child: growReuse),
                              if (engagement != null) ...[
                                const SizedBox(height: AppSpacing.sm),
                                engagement,
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  );
                }

                return Column(
                  children: [
                    requests,
                    if (addMaterial != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      addMaterial,
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    pickup,
                    const SizedBox(height: AppSpacing.sm),
                    growReuse,
                    if (highDemand != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      highDemand,
                    ],
                    if (engagement != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      engagement,
                    ],
                  ],
                );
              },
            ),
        ],
      ),
    );
  }

  static bool _hasPickupLocation(
    bool hasProfile,
    SupplierDefaultLocation? location,
  ) {
    if (!hasProfile || location == null) {
      return false;
    }

    return location.id.isNotEmpty &&
        (location.city.trim().isNotEmpty ||
            location.area?.trim().isNotEmpty == true);
  }
}

class _InsightShell extends StatelessWidget {
  const _InsightShell({
    required this.accent,
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.muted = false,
  });

  final Color accent;
  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: 0.32),
        borderRadius: AppRadius.lgAll,
        border: BorderDirectional(
          start: BorderSide(
            color: muted ? colors.border.withValues(alpha: 0.35) : accent,
            width: 3,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 16, color: muted ? colors.textMuted : accent),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: context.supplierLabel().copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            message,
            style: context.supplierBody().copyWith(
              color: muted
                  ? colors.textSecondary
                  : colors.textPrimary.withValues(alpha: 0.92),
              fontSize: 13,
              height: 1.4,
            ),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.sm),
            TextButton(
              onPressed: onAction,
              style: TextButton.styleFrom(
                foregroundColor: accent,
                padding: EdgeInsets.zero,
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text('$actionLabel →'),
            ),
          ],
        ],
      ),
    );
  }
}

class _RequestsInsight extends StatelessWidget {
  const _RequestsInsight({required this.pending});

  final int pending;

  @override
  Widget build(BuildContext context) {
    if (pending > 0) {
      return _InsightShell(
        accent: SupplierDashboardColors.pending,
        icon: Icons.inbox_outlined,
        title: context.s.requestsNeedAttention,
        message: context.s.pendingRequestsMessage(pending),
        actionLabel: context.s.reviewRequests,
        onAction: () => context.push('/supplier/reservations'),
      );
    }

    return _InsightShell(
      accent: SupplierDashboardColors.completed,
      icon: Icons.check_circle_outline,
      title: context.s.requestsNeedAttention,
      message: context.s.noPendingRequests,
      muted: true,
    );
  }
}

class _PickupInsight extends StatelessWidget {
  const _PickupInsight({required this.locationSet, required this.hasProfile});

  final bool locationSet;
  final bool hasProfile;

  @override
  Widget build(BuildContext context) {
    if (locationSet) {
      return _InsightShell(
        accent: SupplierDashboardColors.accepted,
        icon: Icons.local_shipping_outlined,
        title: context.s.pickupReadiness,
        message: context.s.pickupLocationSet,
        muted: true,
      );
    }

    return _InsightShell(
      accent: SupplierDashboardColors.accepted,
      icon: Icons.location_on_outlined,
      title: context.s.pickupReadiness,
      message: hasProfile
          ? context.s.pickupLocationMissing
          : context.s.completeProfileForPickup,
      actionLabel: context.s.updateProfile,
      onAction: () => context.push('/supplier/profile'),
    );
  }
}

class _GrowReuseInsight extends StatelessWidget {
  const _GrowReuseInsight({
    required this.activeMaterials,
    required this.reusedMaterials,
    this.compact = false,
  });

  final int activeMaterials;
  final int reusedMaterials;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final String message;
    final String? actionLabel;
    final VoidCallback? onAction;

    if (activeMaterials > 0 && reusedMaterials == 0) {
      message = context.s.growReuseActiveListings;
      actionLabel = compact ? null : context.s.viewMaterials;
      onAction = compact ? null : () => context.push('/supplier/materials');
    } else if (reusedMaterials > 0) {
      message = context.s.growReuseStarting;
      actionLabel = compact ? null : context.s.viewMaterials;
      onAction = compact ? null : () => context.push('/supplier/materials');
    } else {
      message = context.s.growReuseEmpty;
      actionLabel = compact ? null : context.s.addMaterial;
      onAction = compact ? null : () => context.push('/supplier/materials/new');
    }

    return _InsightShell(
      accent: SupplierDashboardColors.reused,
      icon: Icons.eco_outlined,
      title: context.s.growReuse,
      message: message,
      actionLabel: actionLabel,
      onAction: onAction,
      muted: compact,
    );
  }
}

class _AllCaughtUpBanner extends StatelessWidget {
  const _AllCaughtUpBanner();

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: colors.backgroundElevated.withValues(alpha: 0.35),
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.border.withValues(alpha: 0.22)),
      ),
      child: Row(
        children: [
          Icon(
            Icons.check_circle_outline,
            size: 20,
            color: SupplierDashboardColors.completed.withValues(alpha: 0.85),
          ),
          const SizedBox(width: AppSpacing.md),
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

class _HighDemandInsight extends StatelessWidget {
  const _HighDemandInsight();

  @override
  Widget build(BuildContext context) {
    return _InsightShell(
      accent: SupplierDashboardColors.pending,
      icon: Icons.trending_up_outlined,
      title: context.s.highDemandMaterialsTitle,
      message: context.s.strongDemandInsight,
      actionLabel: context.s.viewMaterials,
      onAction: () => context.push('/supplier/materials'),
    );
  }
}

class _EngagementInsight extends StatelessWidget {
  const _EngagementInsight();

  @override
  Widget build(BuildContext context) {
    return _InsightShell(
      accent: SupplierDashboardColors.views,
      icon: Icons.visibility_outlined,
      title: context.s.statTotalViews,
      message: context.s.improveEngagementInsight,
      actionLabel: context.s.viewMaterials,
      onAction: () => context.push('/supplier/materials'),
    );
  }
}

class _AddMaterialInsight extends StatelessWidget {
  const _AddMaterialInsight();

  @override
  Widget build(BuildContext context) {
    return _InsightShell(
      accent: SupplierDashboardColors.available,
      icon: Icons.add_box_outlined,
      title: context.s.addMaterial,
      message: context.s.addFirstMaterialInsight,
      actionLabel: context.s.addMaterial,
      onAction: () => context.push('/supplier/materials/new'),
    );
  }
}
