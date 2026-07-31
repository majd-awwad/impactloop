import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/supplier_verification_access.dart';
import '../../data/models/supplier_dashboard.dart';
import '../../data/models/supplier_dashboard_stats.dart';
import '../controllers/supplier_dashboard_providers.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/dashboard/supplier_category_demand_panel.dart';
import '../widgets/dashboard/supplier_dashboard_chart_card.dart';
import '../widgets/dashboard/supplier_dashboard_hero.dart';
import '../widgets/dashboard/supplier_dashboard_quick_actions_panel.dart';
import '../widgets/dashboard/supplier_dashboard_recent_activity_panel.dart';
import '../widgets/dashboard/supplier_dashboard_insights_panel.dart';
import '../widgets/dashboard/supplier_dashboard_stat_card.dart';
import '../widgets/dashboard/supplier_materials_status_chart.dart';
import '../widgets/dashboard/supplier_project_impact_panel.dart';
import '../widgets/dashboard/supplier_reservation_status_chart.dart';
import '../widgets/supplier_empty_dashboard_state.dart';

class SupplierDashboardPage extends ConsumerWidget {
  const SupplierDashboardPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(supplierDashboardProvider);

    return dashboardAsync.when(
      data: (dashboard) => _DashboardContent(dashboard: dashboard),
      loading: () => const SupplierDashboardLoading(),
      error: (_, _) => SupplierDashboardErrorCard(
        onRetry: () => ref.invalidate(supplierDashboardProvider),
      ),
    );
  }
}

class _DashboardContent extends ConsumerStatefulWidget {
  const _DashboardContent({required this.dashboard});

  final SupplierDashboard dashboard;

  @override
  ConsumerState<_DashboardContent> createState() => _DashboardContentState();
}

class _DashboardContentState extends ConsumerState<_DashboardContent> {
  bool _approvalBannerDismissed = false;

  @override
  Widget build(BuildContext context) {
    final stats = widget.dashboard.stats;
    final scheduledPickups = stats.operational.scheduledPickups > 0
        ? stats.operational.scheduledPickups
        : widget.dashboard.upcomingPickups.length;
    final supplierProfile = ref
        .watch(authControllerProvider)
        .user
        ?.supplierProfile;
    final showApprovedBanner =
        !_approvalBannerDismissed &&
        isOrganizationSupplierType(supplierProfile?.supplierType) &&
        normalizeVerificationStatus(supplierProfile?.verificationStatus) ==
            'APPROVED';

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact =
            constraints.maxWidth < AppSpacing.supplierLayoutBreakpoint;
        final phone = constraints.maxWidth < 600;
        final pagePadding = phone
            ? const EdgeInsets.all(AppSpacing.sm + AppSpacing.xs)
            : context.supplierDecorations.pagePadding(compact: compact);

        return SingleChildScrollView(
          padding: pagePadding,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (showApprovedBanner) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Theme.of(
                        context,
                      ).colorScheme.primary.withValues(alpha: 0.25),
                    ),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        Icons.verified_outlined,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Your supplier account has been approved. You can now publish materials.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                      IconButton(
                        tooltip: 'Dismiss',
                        onPressed: () =>
                            setState(() => _approvalBannerDismissed = true),
                        icon: const Icon(Icons.close, size: 20),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
              ],
              if (!widget.dashboard.hasSupplierProfile)
                const SupplierMissingProfileCard()
              else if (widget.dashboard.supplier != null)
                SupplierDashboardHero(
                  supplier: widget.dashboard.supplier!,
                  compact: compact,
                  mobile: phone,
                ),
              SizedBox(height: phone ? AppSpacing.sm : AppSpacing.lg),
              SupplierDashboardMainStatGrid(
                activeMaterials: stats.materials.available,
                pendingRequests: stats.reservations.pending,
                scheduledPickups: scheduledPickups,
                reusedMaterials: stats.materials.reused,
              ),
              SizedBox(height: phone ? AppSpacing.xs : AppSpacing.sm),
              SupplierDashboardSecondaryMetricsRow(
                totalMaterials: stats.materials.total,
                availableMaterials: stats.materials.available,
                reservedMaterials: stats.materials.reserved,
                totalViews: stats.engagement.totalViews,
                totalLikes: stats.engagement.totalLikes,
                followersCount: stats.engagement.followersCount,
              ),
              SizedBox(height: phone ? AppSpacing.md : AppSpacing.xl),
              LayoutBuilder(
                builder: (context, constraints) {
                  final operations = _OperationsSnapshotPanel(
                    stats: stats,
                    mobile: phone,
                  );
                  final impact = SupplierProjectImpactPanel(
                    projectSupport: widget.dashboard.projectSupport,
                  );
                  final engagement = SupplierDashboardEngagementPanel(
                    dashboard: widget.dashboard,
                  );

                  if (widget.dashboard.hasSupplierProfile &&
                      constraints.maxWidth >= 1180) {
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(flex: 3, child: operations),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(
                          flex: 2,
                          child: Column(
                            children: [
                              impact,
                              const SizedBox(height: AppSpacing.lg),
                              engagement,
                            ],
                          ),
                        ),
                      ],
                    );
                  }

                  return Column(
                    children: [
                      operations,
                      if (widget.dashboard.hasSupplierProfile) ...[
                        SizedBox(height: phone ? AppSpacing.md : AppSpacing.lg),
                        impact,
                        const SizedBox(height: AppSpacing.lg),
                        engagement,
                      ],
                    ],
                  );
                },
              ),
              const SizedBox(height: AppSpacing.xl),
              const SupplierCategoryDemandPanel(),
              const SizedBox(height: AppSpacing.xl),
              LayoutBuilder(
                builder: (context, constraints) {
                  final insights = SupplierDashboardInsightsPanel(
                    dashboard: widget.dashboard,
                  );
                  final quickActions =
                      const SupplierDashboardQuickActionsPanel();

                  if (constraints.maxWidth >= 1180) {
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(flex: 3, child: insights),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(flex: 2, child: quickActions),
                      ],
                    );
                  }

                  if (constraints.maxWidth >= 800) {
                    return Column(
                      children: [
                        insights,
                        const SizedBox(height: AppSpacing.lg),
                        quickActions,
                      ],
                    );
                  }

                  return Column(
                    children: [
                      insights,
                      const SizedBox(height: AppSpacing.lg),
                      quickActions,
                    ],
                  );
                },
              ),
              const SizedBox(height: AppSpacing.xl),
              LayoutBuilder(
                builder: (context, constraints) {
                  final recentActivity = SupplierDashboardRecentActivityPanel(
                    activity: widget.dashboard.recentActivity,
                    upcomingPickups: widget.dashboard.upcomingPickups,
                    stats: stats,
                  );
                  final highDemand = SupplierDashboardHighDemandPanel(
                    dashboard: widget.dashboard,
                  );

                  if (constraints.maxWidth >= 980) {
                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(flex: 3, child: recentActivity),
                        const SizedBox(width: AppSpacing.lg),
                        Expanded(flex: 2, child: highDemand),
                      ],
                    );
                  }

                  return Column(
                    children: [
                      recentActivity,
                      const SizedBox(height: AppSpacing.lg),
                      highDemand,
                    ],
                  );
                },
              ),
              if (widget.dashboard.hasSupplierProfile &&
                  stats.materials.total == 0 &&
                  widget.dashboard.recentMaterials.isEmpty) ...[
                const SizedBox(height: AppSpacing.xl),
                const SupplierEmptyDashboardState(),
              ],
            ],
          ),
        );
      },
    );
  }
}

class _OperationsSnapshotPanel extends StatelessWidget {
  const _OperationsSnapshotPanel({required this.stats, required this.mobile});

  final SupplierDashboardStats stats;
  final bool mobile;

  @override
  Widget build(BuildContext context) {
    final reservationChart = SupplierDashboardChartCard(
      title: context.s.reservationStatus,
      subtitle: context.s.chartReservationSubtitle,
      compact: mobile,
      child: SupplierReservationStatusChart(
        pending: stats.reservations.pending,
        accepted: stats.reservations.accepted,
        completed: stats.reservations.completed,
      ),
    );
    final materialsChart = SupplierDashboardChartCard(
      title: context.s.materialsStatus,
      subtitle: context.s.chartMaterialsSubtitle,
      compact: mobile,
      child: SupplierMaterialsStatusChart(
        available: stats.materials.available,
        reservedOrPending:
            stats.materials.reserved + stats.materials.pendingReservation,
        reused: stats.materials.reused,
        unavailable: stats.materials.unavailable,
        compact: mobile,
      ),
    );

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(mobile ? AppSpacing.md : AppSpacing.lg),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.s.operationsSnapshot,
            style: context.supplierSectionTitle(),
          ),
          SizedBox(height: mobile ? AppSpacing.sm : AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              if (constraints.maxWidth >= 680) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: reservationChart),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(child: materialsChart),
                  ],
                );
              }
              return Column(
                children: [
                  reservationChart,
                  SizedBox(height: mobile ? AppSpacing.sm : AppSpacing.md),
                  materialsChart,
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
