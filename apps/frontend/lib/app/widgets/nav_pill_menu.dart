import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/auth_dark_text_styles.dart';
import '../theme/app_theme_colors.dart';

class NavPillMenu<T> extends StatelessWidget {
  const NavPillMenu({
    super.key,
    required this.icon,
    required this.label,
    required this.items,
    required this.selectedValue,
    required this.onSelected,
    required this.itemLabel,
  });

  final IconData icon;
  final String label;
  final List<T> items;
  final T selectedValue;
  final ValueChanged<T> onSelected;
  final String Function(T value) itemLabel;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final surface = colors.surfaceElevated;
    final selectedSurface = colors.primarySoft;
    final hoverSurface = colors.surfaceMuted;
    final primaryText = colors.textPrimary;
    final secondaryText = colors.textSecondary;
    final border = colors.borderSubtle;

    return MenuAnchor(
      style: MenuStyle(
        backgroundColor: WidgetStatePropertyAll(surface),
        elevation: const WidgetStatePropertyAll(8),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(
            borderRadius: AppRadius.mdAll,
            side: BorderSide(color: border),
          ),
        ),
        padding: const WidgetStatePropertyAll(
          EdgeInsets.symmetric(vertical: AppSpacing.xs),
        ),
      ),
      builder: (context, controller, child) {
        return _NavPillButton(
          icon: icon,
          label: label,
          isOpen: controller.isOpen,
          onTap: () {
            if (controller.isOpen) {
              controller.close();
            } else {
              controller.open();
            }
          },
        );
      },
      menuChildren: [
        for (final item in items)
          MenuItemButton(
            style: ButtonStyle(
              foregroundColor: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.hovered)) {
                  return primaryText;
                }
                return secondaryText;
              }),
              backgroundColor: WidgetStateProperty.resolveWith((states) {
                if (item == selectedValue) {
                  return selectedSurface;
                }
                if (states.contains(WidgetState.hovered)) {
                  return hoverSurface;
                }
                return Colors.transparent;
              }),
              padding: const WidgetStatePropertyAll(
                EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
              ),
            ),
            onPressed: () => onSelected(item),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                itemLabel(item),
                style: AuthDarkTextStyles.body(context).copyWith(
                  color: item == selectedValue ? primaryText : secondaryText,
                  fontWeight: item == selectedValue
                      ? FontWeight.w600
                      : FontWeight.w400,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _NavPillButton extends StatelessWidget {
  const _NavPillButton({
    required this.icon,
    required this.label,
    required this.isOpen,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isOpen;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    final accent = colors.primary;
    final surface = colors.surfaceElevated;
    final primaryText = colors.textPrimary;
    final secondaryText = colors.textSecondary;
    final border = colors.borderSubtle;
    final focusedBorder = colors.primary;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: Ink(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          height: 42,
          decoration: BoxDecoration(
            color: surface,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: isOpen ? focusedBorder : border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: accent),
              const SizedBox(width: AppSpacing.sm),
              Text(
                label,
                style: AuthDarkTextStyles.body(
                  context,
                ).copyWith(color: primaryText, fontWeight: FontWeight.w500),
              ),
              const SizedBox(width: AppSpacing.xs),
              Icon(
                isOpen ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                size: 18,
                color: secondaryText,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
