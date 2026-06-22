import 'package:flutter/material.dart';

import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_theme_colors.dart';

/// Supplier Portal semantic palette.
///
/// Values intentionally preserve the Supplier Portal visuals from the
/// supplier branch while keeping raw hex values centralized in AppColorTokens.
class SupplierUiPalette {
  const SupplierUiPalette({
    required this.background,
    required this.landingBackground,
    required this.backgroundElevated,
    required this.surface,
    required this.surfaceSolid,
    required this.navBar,
    required this.accent,
    required this.accentMuted,
    required this.accentSoft,
    required this.border,
    required this.borderFocused,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textDisabled,
    required this.textOnAccent,
    required this.chipSelected,
    required this.chipUnselected,
    required this.error,
    required this.link,
    required this.blueAccent,
    required this.amberAccent,
    required this.redAccent,
    required this.purpleAccent,
    required this.cardShadow,
    required this.isDark,
  });

  final Color background;
  final Color landingBackground;
  final Color backgroundElevated;
  final Color surface;
  final Color surfaceSolid;
  final Color navBar;
  final Color accent;
  final Color accentMuted;
  final Color accentSoft;
  final Color border;
  final Color borderFocused;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textDisabled;
  final Color textOnAccent;
  final Color chipSelected;
  final Color chipUnselected;
  final Color error;
  final Color link;
  final Color blueAccent;
  final Color amberAccent;
  final Color redAccent;
  final Color purpleAccent;
  final Color cardShadow;
  final bool isDark;

  static SupplierUiPalette of(BuildContext context) {
    final appColors = AppThemeColors.of(context);
    final isDark =
        Theme.of(context).brightness == Brightness.dark ||
        appColors.pageBackground == AppThemeColors.dark.pageBackground;
    return isDark ? dark : light;
  }

  static const SupplierUiPalette dark = SupplierUiPalette(
    background: AppColorTokens.legacyAuthBackground,
    landingBackground: AppColorTokens.legacyAuthLandingBackground,
    backgroundElevated: AppColorTokens.legacyAuthBackgroundElevated,
    surface: AppColorTokens.legacyAuthSurface,
    surfaceSolid: AppColorTokens.legacyAuthSurfaceSolid,
    navBar: AppColorTokens.legacyAuthNavBar,
    accent: AppColorTokens.legacyAuthAccent,
    accentMuted: AppColorTokens.legacyAuthAccentMuted,
    accentSoft: AppColorTokens.legacyAuthAccentSoft,
    border: AppColorTokens.legacyAuthBorder,
    borderFocused: AppColorTokens.legacyAuthAccent,
    textPrimary: AppColorTokens.darkTextPrimary,
    textSecondary: AppColorTokens.legacyAuthTextSecondary,
    textMuted: AppColorTokens.legacyAuthTextMuted,
    textDisabled: AppColorTokens.supplierDarkTextDisabled,
    textOnAccent: AppColorTokens.legacyAuthTextOnAccent,
    chipSelected: AppColorTokens.legacyAuthChipSelected,
    chipUnselected: AppColorTokens.legacyAuthChipUnselected,
    error: AppColorTokens.dangerDark,
    link: AppColorTokens.legacyAuthAccent,
    blueAccent: AppColorTokens.supplierDarkBlue,
    amberAccent: AppColorTokens.supplierDarkAmber,
    redAccent: AppColorTokens.dangerDark,
    purpleAccent: AppColorTokens.supplierDarkPurple,
    cardShadow: AppColorTokens.supplierDarkCardShadow,
    isDark: true,
  );

  static const SupplierUiPalette light = SupplierUiPalette(
    background: AppColorTokens.supplierLightBackground,
    landingBackground: AppColorTokens.supplierLightLandingBackground,
    backgroundElevated: AppColorTokens.supplierLightBackgroundElevated,
    surface: AppColorTokens.lightSurface,
    surfaceSolid: AppColorTokens.lightSurface,
    navBar: AppColorTokens.supplierLightNavBar,
    accent: AppColorTokens.supplierLightAccent,
    accentMuted: AppColorTokens.supplierLightAccentMuted,
    accentSoft: AppColorTokens.supplierLightAccentSoft,
    border: AppColorTokens.supplierLightBorder,
    borderFocused: AppColorTokens.supplierLightBorderFocused,
    textPrimary: AppColorTokens.supplierLightTextPrimary,
    textSecondary: AppColorTokens.supplierLightTextSecondary,
    textMuted: AppColorTokens.supplierLightTextMuted,
    textDisabled: AppColorTokens.supplierLightTextDisabled,
    textOnAccent: AppColorTokens.lightSurface,
    chipSelected: AppColorTokens.supplierLightChipSelected,
    chipUnselected: AppColorTokens.supplierLightChipUnselected,
    error: AppColorTokens.supplierLightError,
    link: AppColorTokens.supplierLightAccent,
    blueAccent: AppColorTokens.supplierLightBlue,
    amberAccent: AppColorTokens.supplierLightAmber,
    redAccent: AppColorTokens.supplierLightError,
    purpleAccent: AppColorTokens.supplierLightPurple,
    cardShadow: AppColorTokens.supplierLightCardShadow,
    isDark: false,
  );
}
