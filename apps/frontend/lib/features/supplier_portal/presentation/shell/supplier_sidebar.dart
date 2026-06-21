import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../auth/application/auth_controller.dart';
import '../controllers/supplier_dashboard_providers.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_nav_config.dart';

class SupplierSidebar extends ConsumerWidget {
  const SupplierSidebar({super.key, required this.currentLocation});

  final String currentLocation;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    final supplier = ref
        .watch(supplierDashboardProvider)
        .maybeWhen(data: (dashboard) => dashboard.supplier, orElse: () => null);
    final l = context.s;
    final displayName = supplier?.publicName.isNotEmpty == true
        ? supplier!.publicName
        : user?.displayName ?? l.supplierFallbackName;

    return Container(
      width: AppSpacing.supplierSidebarWidth,
      decoration: context.supplierDecorations.sidebar(
        direction: context.supplierTextDirection,
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.md,
              ),
              child: Text(
                l.brandName,
                style: context.supplierNavBrand(),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Text(
                l.supplierRole,
                style: context.supplierSectionTitle(),
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
                  for (final item in supplierNavItems)
                    _SidebarNavItem(
                      item: item,
                      isActive: isSupplierNavActive(
                        currentLocation,
                        item.route,
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: _SidebarProfileCard(
                name: displayName,
                subtitle: user?.email ?? l.supplierRoleSubtitle,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SidebarNavItem extends StatelessWidget {
  const _SidebarNavItem({required this.item, required this.isActive});

  final SupplierNavItem item;
  final bool isActive;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => context.go(item.route),
          borderRadius: AppRadius.mdAll,
          hoverColor: colors.chipSelected.withValues(alpha: 0.28),
          child: Ink(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            decoration: context.supplierDecorations.navItem(isActive: isActive),
            child: Row(
              children: [
                Icon(
                  item.icon,
                  size: 20,
                  color: isActive ? colors.accent : colors.textSecondary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    item.label(context),
                    style: context.supplierLabel().copyWith(
                      color: isActive
                          ? colors.textPrimary
                          : colors.textSecondary,
                      fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
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
  const _SidebarProfileCard({required this.name, required this.subtitle});

  final String name;
  final String subtitle;

  String get _initial {
    final trimmed = name.trim();
    return trimmed.isEmpty ? 'S' : trimmed.characters.first.toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return InkWell(
      onTap: () => context.go('/supplier/profile'),
      borderRadius: AppRadius.lgAll,
      child: Ink(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: context.supplierDecorations.sidebarProfile,
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: context.supplierDecorations.avatarCircle,
              child: Text(
                _initial,
                style: context.supplierLabel().copyWith(
                  color: colors.accent,
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
                    style: context.supplierLabel().copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.supplierBody().copyWith(fontSize: 12),
                  ),
                ],
              ),
            ),
            Icon(
              context.isSupplierArabic
                  ? Icons.chevron_left_rounded
                  : Icons.chevron_right_rounded,
              color: colors.textSecondary,
            ),
          ],
        ),
      ),
    );
  }
}
