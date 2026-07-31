import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../auth/application/auth_controller.dart';
import '../l10n/admin_l10n.dart';
import '../theme/admin_decoration_set.dart';
import 'admin_kpi_card.dart' show AdminTypography;
import 'admin_profile_button.dart';
import 'admin_settings_controls.dart';

class AdminTopBar extends ConsumerWidget {
  const AdminTopBar({
    super.key,
    required this.currentLocation,
    required this.title,
    required this.subtitle,
    this.onOpenMenu,
  });

  final String currentLocation;
  final String title;
  final String subtitle;
  final VoidCallback? onOpenMenu;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = context.adminPalette;
    final decorations = context.adminDecorations;
    final compact = MediaQuery.sizeOf(context).width < 920;
    final user = ref.watch(authControllerProvider).user;
    final displayName = user?.displayName.trim().isNotEmpty == true
        ? user!.displayName.trim()
        : 'Admin';

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.md,
      ),
      decoration: decorations.topBar,
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            if (onOpenMenu != null) ...[
              IconButton(
                onPressed: onOpenMenu,
                icon: Icon(Icons.menu_rounded, color: palette.textPrimary),
                tooltip: 'Menu',
              ),
              const SizedBox(width: 4),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AdminTypography.pageTitle(palette)),
                  const SizedBox(height: 2),
                  Text(subtitle, style: AdminTypography.pageSubtitle(palette)),
                ],
              ),
            ),
            if (!compact) ...[
              const AdminSettingsControls(),
              const SizedBox(width: AppSpacing.sm),
            ],
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () {},
                borderRadius: AppRadius.pillAll,
                child: Ink(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  decoration: decorations.topBarPill,
                  child: Icon(
                    Icons.notifications_none_rounded,
                    color: palette.textPrimary,
                  ),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            AdminProfileButton(
              displayName: displayName,
              email: user?.email,
              showSettingsControls: compact,
            ),
          ],
        ),
      ),
    );
  }
}

String adminPageTitle(AdminL10n l, String location) {
  if (location == '/admin') return l.overviewPageTitle;
  if (location.startsWith('/admin/users')) return l.navUsers;
  if (location.startsWith('/admin/supplier-verification')) {
    return l.navSupplierVerification;
  }
  if (location.startsWith('/admin/materials')) return l.navMaterials;
  if (location.startsWith('/admin/approvals')) return l.navApprovals;
  if (location.startsWith('/admin/invitations')) return l.navInvitations;
  if (location.startsWith('/admin/reservations')) return l.navReservations;
  if (location.startsWith('/admin/no-show-reports')) {
    return 'Incident Reports';
  }
  if (location.startsWith('/admin/deliveries')) return l.navDeliveries;
  if (location.startsWith('/admin/learning-projects')) {
    return l.navLearningProjects;
  }
  if (location.startsWith('/admin/exports')) return l.navExportCenter;
  if (location.startsWith('/admin/impact')) return l.navImpactAnalytics;
  if (location.startsWith('/admin/audit-logs')) return l.navAuditLogs;
  return l.overviewPageTitle;
}

String adminPageSubtitle(AdminL10n l, String location) {
  if (location == '/admin') return l.overviewPageSubtitle;
  return l.t('ImpactLoop Admin Portal', 'بوابة إدارة ImpactLoop');
}
