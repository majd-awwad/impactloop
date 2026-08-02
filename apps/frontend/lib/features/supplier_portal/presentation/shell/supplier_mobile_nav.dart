import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../theme/supplier_theme_extension.dart';
import 'supplier_nav_config.dart';
import '../../../../l10n/l10n.dart';

class SupplierMobileNav extends StatelessWidget {
  const SupplierMobileNav({super.key, required this.currentLocation});

  final String currentLocation;

  @override
  Widget build(BuildContext context) {
    final moreActive = isSupplierMoreNavActive(currentLocation);

    return Container(
      height: AppSpacing.supplierMobileNavHeight,
      decoration: context.supplierDecorations.mobileNavBar,
      child: SafeArea(
        top: false,
        child: FocusTraversalGroup(
          child: Row(
            children: [
              for (final item in supplierMobileNavItems)
                Expanded(
                  child: _MobileNavButton(
                    item: item,
                    isActive: isSupplierMobileNavActive(currentLocation, item),
                    onTap: () => context.go(item.route),
                  ),
                ),
              Expanded(
                child: _MobileMoreButton(
                  isActive: moreActive,
                  onTap: () => _showMoreSheet(context),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showMoreSheet(BuildContext context) {
    final colors = context.supplierColors;

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: colors.surfaceSolid,
      builder: (sheetContext) => SafeArea(
        top: false,
        child: FocusTraversalGroup(
          child: Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              AppSpacing.xs,
              AppSpacing.md,
              AppSpacing.sm,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsetsDirectional.only(
                    start: AppSpacing.sm,
                    bottom: AppSpacing.xs,
                  ),
                  child: Text(
                    context.l10n.supplierMore,
                    style: context.supplierSectionTitle(),
                  ),
                ),
                for (final item in supplierMobileMoreNavItems)
                  _MoreDestinationTile(
                    item: item,
                    label: item.label(context),
                    isActive: isSupplierNavActive(currentLocation, item.route),
                    onTap: () {
                      Navigator.of(sheetContext).pop();
                      context.go(item.route);
                    },
                  ),
              ],
            ),
          ),
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

    return Semantics(
      button: true,
      selected: isActive,
      label: label,
      child: InkWell(
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
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MobileMoreButton extends StatelessWidget {
  const _MobileMoreButton({required this.isActive, required this.onTap});

  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;
    final label = context.l10n.supplierMore;

    return Semantics(
      button: true,
      selected: isActive,
      label: label,
      child: InkWell(
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
                Icons.more_horiz_rounded,
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
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MoreDestinationTile extends StatelessWidget {
  const _MoreDestinationTile({
    required this.item,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  final SupplierNavItem item;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.supplierColors;

    return Semantics(
      button: true,
      selected: isActive,
      label: label,
      child: ListTile(
        onTap: onTap,
        leading: Icon(
          item.icon,
          color: isActive ? colors.accent : colors.textSecondary,
        ),
        title: Text(label),
        selected: isActive,
        selectedTileColor: colors.chipSelected.withValues(alpha: 0.22),
        shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
        contentPadding: const EdgeInsetsDirectional.symmetric(
          horizontal: AppSpacing.sm,
        ),
      ),
    );
  }
}
