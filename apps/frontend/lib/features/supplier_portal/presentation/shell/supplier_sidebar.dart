import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import '../../../auth/application/auth_controller.dart';
import '../controllers/supplier_dashboard_providers.dart';
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
    final displayName = supplier?.publicName.isNotEmpty == true
        ? supplier!.publicName
        : user?.displayName ?? 'Supplier';

    return Container(
      width: AppSpacing.supplierSidebarWidth,
      decoration: SupplierDecorations.sidebar,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.lg,
                AppSpacing.md,
              ),
              child: Text(
                'ImpactLoop',
                style: AuthDarkTextStyles.navBrand(context),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Text(
                'Supplier',
                style: AuthDarkTextStyles.sectionTitle(context),
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
                subtitle: user?.email ?? 'Supplier role',
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
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => context.go(item.route),
          borderRadius: AppRadius.mdAll,
          hoverColor: AuthDarkColors.chipSelected.withValues(alpha: 0.28),
          child: Ink(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.sm,
            ),
            decoration: SupplierDecorations.navItem(isActive: isActive),
            child: Row(
              children: [
                Icon(
                  item.icon,
                  size: 20,
                  color: isActive
                      ? AuthDarkColors.accent
                      : AuthDarkColors.textSecondary,
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    item.label,
                    style: AuthDarkTextStyles.label(context).copyWith(
                      color: isActive
                          ? AuthDarkColors.textPrimary
                          : AuthDarkColors.textSecondary,
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
    return InkWell(
      onTap: () => context.go('/supplier/profile'),
      borderRadius: AppRadius.lgAll,
      child: Ink(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: SupplierDecorations.sidebarProfile,
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              alignment: Alignment.center,
              decoration: SupplierDecorations.avatarCircle,
              child: Text(
                _initial,
                style: AuthDarkTextStyles.label(context).copyWith(
                  color: AuthDarkColors.accent,
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
                    style: AuthDarkTextStyles.label(context).copyWith(
                      color: AuthDarkColors.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AuthDarkTextStyles.body(
                      context,
                    ).copyWith(fontSize: 12),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: AuthDarkColors.textSecondary,
            ),
          ],
        ),
      ),
    );
  }
}
