import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../auth/application/auth_controller.dart';
import '../../application/supplier_verification_access.dart';
import '../../data/models/supplier_dashboard.dart';
import '../controllers/supplier_dashboard_providers.dart';
import '../theme/supplier_theme_extension.dart';
import '../widgets/dashboard/supplier_dashboard_chart_card.dart';
import '../widgets/dashboard/supplier_dashboard_hero.dart';
import '../widgets/dashboard/supplier_dashboard_quick_actions_panel.dart';
import '../widgets/dashboard/supplier_dashboard_recent_activity_panel.dart';
import '../widgets/dashboard/supplier_dashboard_stat_card.dart';
import '../widgets/dashboard/supplier_materials_status_chart.dart';
import '../widgets/dashboard/supplier_performance_summary.dart';
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
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final stats = widget.dashboard.stats;
    final scheduledPickups = widget.dashboard.upcomingPickups.isNotEmpty
        ? widget.dashboard.upcomingPickups.length
        : stats.reservations.accepted;
    final supplierProfile = ref.watch(authControllerProvider).user?.supplierProfile;
    final showApprovedBanner = !_approvalBannerDismissed &&
        isOrganizationSupplierType(supplierProfile?.supplierType) &&
        normalizeVerificationStatus(supplierProfile?.verificationStatus) ==
            'APPROVED';

    return SingleChildScrollView(
      padding: context.supplierDecorations.pagePadding(compact: compact),
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
                  color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.25),
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
            const SizedBox(height: 16),
          ],
          if (!widget.dashboard.hasSupplierProfile)
            const SupplierMissingProfileCard()
          else if (widget.dashboard.supplier != null)
            SupplierDashboardHero(
              supplier: widget.dashboard.supplier!,
              compact: compact,
            ),
          const SizedBox(height: AppSpacing.lg),
          SupplierDashboardStatGrid(
            activeMaterials: stats.materials.available,
            pendingRequests: stats.reservations.pending,
            scheduledPickups: scheduledPickups,
            reusedMaterials: stats.materials.reused,
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            context.s.operationsSnapshot,
            style: context.supplierSectionTitle(),
          ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 980;

              final reservationChart = SupplierDashboardChartCard(
                title: context.s.reservationStatus,
                subtitle: context.s.chartReservationSubtitle,
                child: SupplierReservationStatusChart(
                  pending: stats.reservations.pending,
                  accepted: stats.reservations.accepted,
                  completed: stats.reservations.completed,
                ),
              );

              final materialsChart = SupplierDashboardChartCard(
                title: context.s.materialsStatus,
                subtitle: context.s.chartMaterialsSubtitle,
                child: SupplierMaterialsStatusChart(
                  available: stats.materials.available,
                  reservedOrPending:
                      stats.materials.reserved + stats.materials.pendingReservation,
                  reused: stats.materials.reused,
                  unavailable: stats.materials.unavailable,
                ),
              );

              if (wide) {
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
                  const SizedBox(height: AppSpacing.md),
                  materialsChart,
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.md),
          SupplierPerformanceSummary(dashboard: widget.dashboard),
          const SizedBox(height: AppSpacing.xl),
          LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 980;

              if (wide) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Expanded(
                      flex: 2,
                      child: SupplierDashboardQuickActionsPanel(),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      flex: 3,
                      child: SupplierDashboardRecentActivityPanel(
                        activity: widget.dashboard.recentActivity,
                        upcomingPickups: widget.dashboard.upcomingPickups,
                        stats: stats,
                      ),
                    ),
                  ],
                );
              }

              return Column(
                children: [
                  const SupplierDashboardQuickActionsPanel(),
                  const SizedBox(height: AppSpacing.md),
                  SupplierDashboardRecentActivityPanel(
                    activity: widget.dashboard.recentActivity,
                    upcomingPickups: widget.dashboard.upcomingPickups,
                    stats: stats,
                  ),
                ],
              );
            },
          ),
          if (widget.dashboard.hasSupplierProfile &&
              stats.materials.total == 0 &&
              widget.dashboard.recentMaterials.isEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            const SupplierEmptyDashboardState(),
          ],
        ],
      ),
    );
  }
}
