import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../auth/application/auth_controller.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_kpi_card.dart' show AdminTypography;

class AdminSidebar extends ConsumerWidget {
  const AdminSidebar({
    super.key,
    required this.currentLocation,
    this.compact = false,
    this.onNavigate,
    this.direction = TextDirection.ltr,
  });

  final String currentLocation;
  final bool compact;
  final VoidCallback? onNavigate;
  final TextDirection direction;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l = AdminL10n.of(context);
    final palette = context.adminPalette;
    final decorations = context.adminDecorations;
    final user = ref.watch(authControllerProvider).user;
    final displayName = user?.displayName.trim().isNotEmpty == true
        ? user!.displayName.trim()
        : 'Admin';

    final items = [
      _NavDef(l.navOverview, Icons.dashboard_outlined, '/admin'),
      _NavDef(l.navUsers, Icons.people_outline, '/admin/users'),
      _NavDef(
        l.navSupplierVerification,
        Icons.verified_outlined,
        '/admin/supplier-verification',
      ),
      _NavDef(l.navMaterials, Icons.inventory_2_outlined, '/admin/materials'),
      _NavDef(l.navApprovals, Icons.fact_check_outlined, '/admin/approvals'),
      _NavDef(l.navInvitations, Icons.mail_outline, '/admin/invitations'),
      _NavDef(
        l.navReservations,
        Icons.event_note_outlined,
        '/admin/reservations',
      ),
      _NavDef(
        'Incident Reports',
        Icons.report_outlined,
        '/admin/no-show-reports',
      ),
      _NavDef(
        l.navDeliveries,
        Icons.local_shipping_outlined,
        '/admin/deliveries',
      ),
      _NavDef(
        l.navLearningProjects,
        Icons.school_outlined,
        '/admin/learning-projects',
      ),
      _NavDef(l.navImpactAnalytics, Icons.insights_outlined, '/admin/impact'),
      _NavDef(l.navAuditLogs, Icons.receipt_long_outlined, '/admin/audit-logs'),
    ];

    return Container(
      width: compact ? null : AppSpacing.supplierSidebarWidth,
      decoration: decorations.sidebar(direction: direction),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.md,
              ),
              child: Text('ImpactLoop', style: AdminTypography.sidebarBrand(palette)),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Text(
                l.t('Admin Portal', 'بوابة الإدارة'),
                style: AdminTypography.sidebarSection(palette),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.sm,
                ),
                children: [
                  for (final item in items)
                    _NavItem(
                      label: item.label,
                      icon: item.icon,
                      path: item.path,
                      currentLocation: currentLocation,
                      onNavigate: onNavigate,
                    ),
                ],
              ),
            ),
            if (!compact)
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: _SidebarProfileCard(
                  name: displayName,
                  subtitle: user?.email ?? l.t('Administrator', 'مسؤول'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NavDef {
  const _NavDef(this.label, this.icon, this.path);
  final String label;
  final IconData icon;
  final String path;
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.label,
    required this.icon,
    required this.path,
    required this.currentLocation,
    this.onNavigate,
  });

  final String label;
  final IconData icon;
  final String path;
  final String currentLocation;
  final VoidCallback? onNavigate;

  bool get _selected {
    if (path == '/admin') return currentLocation == '/admin';
    return currentLocation == path || currentLocation.startsWith('$path/');
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final decorations = context.adminDecorations;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () {
            if (GoRouterState.of(context).matchedLocation != path) {
              context.go(path);
            }
            onNavigate?.call();
          },
          borderRadius: AppRadius.mdAll,
          hoverColor: palette.sidebarAccentSoft.withValues(alpha: 0.28),
          child: Ink(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            decoration: decorations.navItem(isActive: _selected),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: _selected
                      ? palette.sidebarActiveAccent
                      : palette.sidebarTextSecondary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    label,
                    style: AdminTypography.sidebarNav(
                      palette,
                      active: _selected,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SidebarProfileCard extends StatelessWidget {
  const _SidebarProfileCard({
    required this.name,
    required this.subtitle,
  });

  final String name;
  final String subtitle;

  String get _initial {
    final trimmed = name.trim();
    return trimmed.isEmpty ? 'A' : trimmed.characters.first.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final palette = context.adminPalette;
    final decorations = context.adminDecorations;

    return Ink(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: decorations.sidebarProfile,
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: decorations.avatarCircle,
            child: Text(
              _initial,
              style: AdminTypography.sidebarNav(palette, active: true).copyWith(
                color: palette.sidebarActiveAccent,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AdminTypography.sidebarNav(palette, active: true),
                ),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AdminTypography.kpiHelper(palette).copyWith(
                    color: palette.sidebarTextSecondary,
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
