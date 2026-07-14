import 'package:flutter/material.dart';

import '../../../../../app/theme/app_color_tokens.dart';
import '../../../../../app/theme/app_radius.dart';
import '../../../../../app/theme/app_spacing.dart';
import '../../../../../app/theme/app_theme_colors.dart';

/// Semantic colors for Supplier My Materials page only.
abstract final class SupplierMyMaterialsColors {
  // Compatibility for older Supplier preview widgets; active helpers below
  // derive from AppThemeColors at runtime.
  static const Color lightTeal = AppColorTokens.teal;

  static AppThemeColors _colors(BuildContext context) =>
      AppThemeColors.of(context);

  static Color statTotal(BuildContext context) => _colors(context).primary;

  static Color statAvailable(BuildContext context) => _colors(context).primary;

  static Color statPending(BuildContext context) => _colors(context).primary;

  static Color statReserved(BuildContext context) => _colors(context).primary;

  static Color statReused(BuildContext context) => _colors(context).primary;

  static Color statUnavailable(BuildContext context) => _colors(context).danger;

  static Color statBackground(BuildContext context, Color accent) {
    final colors = _colors(context);
    return accent == colors.danger
        ? colors.danger.withValues(alpha: 0.10)
        : colors.primarySoft;
  }

  static Color statBorder(BuildContext context, Color accent) {
    final colors = _colors(context);
    return accent == colors.danger
        ? colors.danger.withValues(alpha: 0.26)
        : colors.borderSubtle;
  }

  static Color chipUnselectedBackground(BuildContext context, Color accent) {
    return _colors(context).surfaceMuted;
  }

  static Color chipUnselectedBorder(BuildContext context, Color accent) {
    return _colors(context).borderSubtle;
  }

  static Color chipUnselectedText(BuildContext context, Color accent) {
    return _colors(context).textSecondary;
  }

  static Color chipSelectedBackground(BuildContext context, Color accent) {
    return _colors(context).primarySoft;
  }

  static Color chipSelectedBorder(BuildContext context, Color accent) {
    return _colors(context).primary.withValues(alpha: 0.34);
  }

  static Color chipSelectedText(BuildContext context, Color accent) {
    return _colors(context).primary;
  }

  static ButtonStyle manageButtonStyle(BuildContext context) {
    final colors = _colors(context);
    final textTheme = Theme.of(context).textTheme;

    return FilledButton.styleFrom(
      backgroundColor: colors.primary,
      foregroundColor: colors.textOnPrimary,
      minimumSize: const Size(0, 40),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      textStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
    );
  }

  static ButtonStyle editButtonStyle(BuildContext context, {bool enabled = true}) {
    final colors = _colors(context);
    final textTheme = Theme.of(context).textTheme;
    final accent = colors.primary;

    return OutlinedButton.styleFrom(
      foregroundColor: enabled ? accent : accent.withValues(alpha: 0.45),
      minimumSize: const Size(0, 40),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      side: BorderSide(
        color: enabled ? accent : accent.withValues(alpha: 0.35),
      ),
      shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      textStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
    );
  }

  static ButtonStyle deleteButtonStyle(BuildContext context, {bool enabled = true}) {
    final colors = _colors(context);
    final textTheme = Theme.of(context).textTheme;
    final accent = colors.danger;

    return OutlinedButton.styleFrom(
      foregroundColor: enabled ? accent : accent.withValues(alpha: 0.45),
      minimumSize: const Size(0, 40),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      side: BorderSide(
        color: enabled ? accent : accent.withValues(alpha: 0.35),
      ),
      shape: RoundedRectangleBorder(borderRadius: AppRadius.mdAll),
      textStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
    );
  }

  static Color darkenForLightMode(Color accent) {
    return accent;
  }

  static Color darkenForDarkMode(Color accent) {
    return accent;
  }
}
