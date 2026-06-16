import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/auth_dark_colors.dart';
import '../../../../app/theme/auth_dark_text_styles.dart';
import '../../../../app/theme/supplier_decorations.dart';
import 'supplier_nav_config.dart';

class SupplierMobileNav extends StatelessWidget {
  const SupplierMobileNav({super.key, required this.currentLocation});

  final String currentLocation;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: AppSpacing.supplierMobileNavHeight,
      decoration: SupplierDecorations.mobileNavBar,
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            for (final item in supplierMobileNavItems)
              _MobileNavButton(
                item: item,
                isActive: isSupplierNavActive(currentLocation, item.route),
                onTap: () => context.go(item.route),
              ),
          ],
        ),
      ),
    );
  }
}

class _MobileNavButton extends StatelessWidget {
  const _MobileNavButton({
    required this.item,
    required this.isActive,
    required this.onTap,
  });

  final SupplierNavItem item;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final label = item.mobileLabel ?? item.label;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              item.icon,
              size: 22,
              color: isActive
                  ? AuthDarkColors.accent
                  : AuthDarkColors.textMuted,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: AuthDarkTextStyles.chip(context).copyWith(
                fontSize: 11,
                color: isActive
                    ? AuthDarkColors.accent
                    : AuthDarkColors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
