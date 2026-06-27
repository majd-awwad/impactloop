import 'package:flutter/material.dart';

import '../../../../app/theme/app_theme_colors.dart';

@immutable
class AuthUiPalette {
  const AuthUiPalette({
    required this.background,
    required this.surface,
    required this.surfaceElevated,
    required this.panelDark,
    required this.panelDark2,
    required this.primary,
    required this.primarySoft,
    required this.accentMint,
    required this.accentAmber,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textOnPrimary,
    required this.border,
    required this.borderStrong,
  });

  final Color background;
  final Color surface;
  final Color surfaceElevated;
  final Color panelDark;
  final Color panelDark2;
  final Color primary;
  final Color primarySoft;
  final Color accentMint;
  final Color accentAmber;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textOnPrimary;
  final Color border;
  final Color borderStrong;

  static final AuthUiPalette light = AuthUiPalette(
    background: AppThemeColors.light.pageBackground,
    surface: AppThemeColors.light.surface,
    surfaceElevated: AppThemeColors.light.surfaceElevated,
    panelDark: AppThemeColors.dark.panelSurface,
    panelDark2: AppThemeColors.dark.panelSurfaceAlt,
    primary: AppThemeColors.light.primary,
    primarySoft: AppThemeColors.light.primarySoft,
    accentMint: AppThemeColors.light.accentMint,
    accentAmber: AppThemeColors.light.accentAmber,
    textPrimary: AppThemeColors.light.textPrimary,
    textSecondary: AppThemeColors.light.textSecondary,
    textMuted: AppThemeColors.light.textMuted,
    textOnPrimary: AppThemeColors.light.textOnPrimary,
    border: AppThemeColors.light.borderSubtle,
    borderStrong: AppThemeColors.light.borderStrong,
  );

  static final AuthUiPalette dark = AuthUiPalette(
    background: AppThemeColors.dark.pageBackground,
    surface: AppThemeColors.dark.surface,
    surfaceElevated: AppThemeColors.dark.surfaceElevated,
    panelDark: AppThemeColors.dark.panelSurface,
    panelDark2: AppThemeColors.dark.panelSurfaceAlt,
    primary: AppThemeColors.dark.primary,
    primarySoft: AppThemeColors.dark.primarySoft,
    accentMint: AppThemeColors.dark.accentMint,
    accentAmber: AppThemeColors.dark.accentAmber,
    textPrimary: AppThemeColors.dark.textPrimary,
    textSecondary: AppThemeColors.dark.textSecondary,
    textMuted: AppThemeColors.dark.textMuted,
    textOnPrimary: AppThemeColors.dark.textOnPrimary,
    border: AppThemeColors.dark.borderSubtle,
    borderStrong: AppThemeColors.dark.borderStrong,
  );

  static AuthUiPalette of(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark ? dark : light;
  }
}
