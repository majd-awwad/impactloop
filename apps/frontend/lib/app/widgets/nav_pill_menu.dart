import 'package:flutter/material.dart';

import '../theme/app_radius.dart';
import '../theme/app_spacing.dart';
import '../theme/auth_dark_colors.dart';
import '../theme/auth_dark_text_styles.dart';

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
    return MenuAnchor(
      style: MenuStyle(
        backgroundColor: WidgetStatePropertyAll(AuthDarkColors.surfaceSolid),
        elevation: const WidgetStatePropertyAll(8),
        shape: WidgetStatePropertyAll(
          RoundedRectangleBorder(
            borderRadius: AppRadius.mdAll,
            side: const BorderSide(color: AuthDarkColors.border),
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
                  return AuthDarkColors.textPrimary;
                }
                return AuthDarkColors.textSecondary;
              }),
              backgroundColor: WidgetStateProperty.resolveWith((states) {
                if (item == selectedValue) {
                  return AuthDarkColors.chipSelected;
                }
                if (states.contains(WidgetState.hovered)) {
                  return AuthDarkColors.chipUnselected;
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
                  color: item == selectedValue
                      ? AuthDarkColors.textPrimary
                      : AuthDarkColors.textSecondary,
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
          decoration: BoxDecoration(
            color: AuthDarkColors.chipUnselected,
            borderRadius: AppRadius.pillAll,
            border: Border.all(
              color: isOpen
                  ? AuthDarkColors.borderFocused
                  : AuthDarkColors.border,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: AuthDarkColors.accent),
              const SizedBox(width: AppSpacing.sm),
              Text(
                label,
                style: AuthDarkTextStyles.body(context).copyWith(
                  color: AuthDarkColors.textPrimary,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Icon(
                isOpen ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                size: 18,
                color: AuthDarkColors.textSecondary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
