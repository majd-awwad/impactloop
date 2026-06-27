import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../theme/supplier_theme_extension.dart';
import 'supplier_dashboard_colors.dart';

class _QuickActionSpec {
  const _QuickActionSpec({
    required this.label,
    required this.caption,
    required this.icon,
    required this.route,
    required this.accent,
  });

  final String label;
  final String caption;
  final IconData icon;
  final String route;
  final Color accent;
}

class SupplierDashboardQuickActionsPanel extends StatelessWidget {
  const SupplierDashboardQuickActionsPanel({super.key});

  List<_QuickActionSpec> _actions(BuildContext context) => [
        _QuickActionSpec(
          label: context.s.addMaterial,
          caption: context.s.quickActionListParts,
          icon: Icons.add_circle_outline,
          route: '/supplier/materials/new',
          accent: SupplierDashboardColors.available,
        ),
        _QuickActionSpec(
          label: context.s.reviewRequests,
          caption: context.s.quickActionRespondLearners,
          icon: Icons.inbox_outlined,
          route: '/supplier/reservations',
          accent: SupplierDashboardColors.pending,
        ),
        _QuickActionSpec(
          label: context.s.navPickupSchedule,
          caption: context.s.quickActionPickupCaption,
          icon: Icons.local_shipping_outlined,
          route: '/supplier/pickup-schedule',
          accent: SupplierDashboardColors.accepted,
        ),
        _QuickActionSpec(
          label: context.s.navNotifications,
          caption: context.s.quickActionUpdatesActions,
          icon: Icons.notifications_none_rounded,
          route: '/supplier/notifications',
          accent: SupplierDashboardColors.neutral,
        ),
      ];

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: context.supplierDecorations.dashboardCard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(context.s.quickActions, style: context.supplierSectionTitle()),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Common supplier tasks',
            style: context.supplierBody().copyWith(
              color: colors.textSecondary,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final columns = constraints.maxWidth >= 420 ? 2 : 1;
              const tileHeight = 92.0;
              const spacing = AppSpacing.sm;
              final tileWidth = columns == 2
                  ? (constraints.maxWidth - spacing) / 2
                  : constraints.maxWidth;

              return Wrap(
                spacing: spacing,
                runSpacing: spacing,
                children: _actions(context)
                    .map(
                      (action) => SizedBox(
                        width: tileWidth,
                        height: tileHeight,
                        child: _DashboardQuickActionTile(action: action),
                      ),
                    )
                    .toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _DashboardQuickActionTile extends StatelessWidget {
  const _DashboardQuickActionTile({required this.action});

  final _QuickActionSpec action;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.go(action.route),
        borderRadius: AppRadius.lgAll,
        hoverColor: action.accent.withValues(alpha: 0.08),
        splashColor: action.accent.withValues(alpha: 0.12),
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            borderRadius: AppRadius.lgAll,
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                action.accent.withValues(alpha: 0.1),
                colors.backgroundElevated.withValues(alpha: 0.35),
              ],
            ),
            border: Border.all(
              color: action.accent.withValues(alpha: 0.28),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: action.accent.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(action.icon, color: action.accent, size: 17),
                  ),
                  const Spacer(),
                  Icon(
                    Icons.arrow_forward_rounded,
                    size: 16,
                    color: colors.textMuted,
                  ),
                ],
              ),
              const Spacer(),
              Text(
                action.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.supplierLabel().copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                action.caption,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.supplierBody().copyWith(
                  fontSize: 11,
                  color: colors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
