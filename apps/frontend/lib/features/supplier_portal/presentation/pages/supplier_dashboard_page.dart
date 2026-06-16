import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../data/models/supplier_dashboard.dart';
import '../controllers/supplier_dashboard_providers.dart';
import '../widgets/supplier_empty_dashboard_state.dart';
import '../widgets/supplier_hero_panel.dart';
import '../widgets/supplier_quick_action_card.dart';
import '../widgets/supplier_recent_activity_section.dart';
import '../widgets/supplier_recent_materials_section.dart';
import '../widgets/supplier_stat_card.dart';
import '../widgets/supplier_upcoming_pickups_section.dart';

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

class _DashboardContent extends StatelessWidget {
  const _DashboardContent({required this.dashboard});

  final SupplierDashboard dashboard;

  @override
  Widget build(BuildContext context) {
    final compact =
        MediaQuery.sizeOf(context).width < AppSpacing.supplierLayoutBreakpoint;
    final stats = dashboard.stats;
    final totalMaterials = stats.materials.total;
    double ratio(int value) => totalMaterials == 0 ? 0 : value / totalMaterials;

    return SingleChildScrollView(
      padding: SupplierDecorations.pagePadding(compact: compact),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!dashboard.hasSupplierProfile)
            const SupplierMissingProfileCard()
          else if (dashboard.supplier != null)
            SupplierHeroPanel(supplier: dashboard.supplier!, compact: compact),
          const SizedBox(height: AppSpacing.lg),
          Text('Overview', style: AuthDarkTextStyles.sectionTitle(context)),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = _columnsForWidth(constraints.maxWidth);
              final cardWidth =
                  (constraints.maxWidth - (AppSpacing.md * (columns - 1))) /
                  columns;
              final cardHeight = compact ? 156.0 : 164.0;
              final wideWidth = columns == 1
                  ? constraints.maxWidth
                  : (cardWidth * 2) + AppSpacing.md;

              return Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.md,
                children: [
                  SizedBox(
                    width: cardWidth,
                    height: cardHeight,
                    child: SupplierStatCard(
                      label: 'Listed materials',
                      value: '${stats.materials.total}',
                      icon: Icons.inventory_2_outlined,
                      subtitle: totalMaterials == 0
                          ? 'Ready for your first listing'
                          : 'All supplier listings',
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    height: cardHeight,
                    child: SupplierStatCard(
                      label: 'Available now',
                      value: '${stats.materials.available}',
                      icon: Icons.check_circle_outline,
                      progress: ratio(stats.materials.available),
                      subtitle: 'Shareable inventory',
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    height: cardHeight,
                    child: SupplierStatCard(
                      label: 'Pending requests',
                      value: '${stats.reservations.pending}',
                      icon: Icons.inbox_outlined,
                      highlight: stats.reservations.pending > 0,
                      badge: stats.reservations.pending > 0 ? 'Action' : null,
                      subtitle: stats.reservations.pending > 0
                          ? 'Needs your review'
                          : 'No open requests',
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    height: cardHeight,
                    child: SupplierImpactCard(
                      reusedMaterials: stats.impact.reusedMaterials,
                      reusedQuantity: stats.impact.reusedQuantity,
                      totalMaterials: totalMaterials,
                    ),
                  ),
                  SizedBox(
                    width: wideWidth,
                    height: cardHeight,
                    child: SupplierLifecycleCard(
                      total: totalMaterials,
                      available: stats.materials.available,
                      reserved: stats.materials.reserved,
                      reused: stats.materials.reused,
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    height: cardHeight,
                    child: SupplierStatCard(
                      label: 'Upcoming pickups',
                      value: '${dashboard.upcomingPickups.length}',
                      icon: Icons.local_shipping_outlined,
                      subtitle: 'Accepted reservations',
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    height: cardHeight,
                    child: SupplierRatingCard(
                      averageRating: stats.reviews.averageRating,
                      totalReviews: stats.reviews.totalReviews,
                    ),
                  ),
                  SizedBox(
                    width: cardWidth,
                    height: cardHeight,
                    child: SupplierStatCard(
                      label: 'Unread notifications',
                      value: '${stats.notifications.unread}',
                      icon: Icons.notifications_none_rounded,
                      highlight: stats.notifications.unread > 0,
                      badge: stats.notifications.unread > 0 ? 'New' : null,
                      subtitle: stats.notifications.unread > 0
                          ? 'Open updates'
                          : 'All caught up',
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Quick actions',
            style: AuthDarkTextStyles.sectionTitle(context),
          ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = compact
                  ? 1
                  : constraints.maxWidth >= 1100
                  ? 3
                  : 2;
              final actionWidth =
                  (constraints.maxWidth - (AppSpacing.md * (columns - 1))) /
                  columns;

              return Wrap(
                spacing: AppSpacing.md,
                runSpacing: AppSpacing.md,
                children:
                    const [
                          SupplierQuickActionCard(
                            label: 'Add material',
                            caption: 'List reusable parts',
                            icon: Icons.add_circle_outline,
                            route: '/supplier/materials/new',
                          ),
                          SupplierQuickActionCard(
                            label: 'Manage materials',
                            caption: 'Review your inventory',
                            icon: Icons.inventory_2_outlined,
                            route: '/supplier/materials',
                          ),
                          SupplierQuickActionCard(
                            label: 'Incoming requests',
                            caption: 'Check learner interest',
                            icon: Icons.inbox_outlined,
                            route: '/supplier/reservations',
                          ),
                          SupplierQuickActionCard(
                            label: 'Edit supplier profile',
                            caption: 'Update public details',
                            icon: Icons.person_outline,
                            route: '/supplier/profile',
                          ),
                          SupplierQuickActionCard(
                            label: 'Browse materials',
                            caption: 'Explore shared discovery',
                            icon: Icons.search,
                            route: '/materials',
                          ),
                        ]
                        .map(
                          (child) => SizedBox(
                            width: actionWidth,
                            height: 96,
                            child: child,
                          ),
                        )
                        .toList(),
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
          if (dashboard.hasSupplierProfile &&
              stats.materials.total == 0 &&
              dashboard.recentMaterials.isEmpty)
            const SupplierEmptyDashboardState(),
          if (dashboard.recentMaterials.isNotEmpty) ...[
            SupplierRecentMaterialsSection(
              materials: dashboard.recentMaterials,
            ),
            const SizedBox(height: AppSpacing.lg),
          ],
          SupplierUpcomingPickupsSection(pickups: dashboard.upcomingPickups),
          const SizedBox(height: AppSpacing.lg),
          SupplierRecentActivitySection(activity: dashboard.recentActivity),
        ],
      ),
    );
  }

  int _columnsForWidth(double width) {
    if (width >= 1180) {
      return 4;
    }

    if (width >= 820) {
      return 3;
    }

    if (width >= 420) {
      return 2;
    }

    return 1;
  }
}
