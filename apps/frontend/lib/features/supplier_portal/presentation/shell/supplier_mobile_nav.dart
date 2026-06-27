import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_spacing.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_nav_config.dart';

class SupplierMobileNav extends StatelessWidget {
  const SupplierMobileNav({super.key, required this.currentLocation});

  final String currentLocation;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: AppSpacing.supplierMobileNavHeight,
      decoration: context.supplierDecorations.mobileNavBar,
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
    final colors = context.supplierColors;
    final label = item.mobileLabel(context) ?? item.label(context);

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
              color: isActive ? colors.accent : colors.textMuted,
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: context.supplierChip().copyWith(
                fontSize: 11,
                color: isActive ? colors.accent : colors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
