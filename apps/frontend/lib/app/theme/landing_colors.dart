import 'package:flutter/material.dart';

import 'app_theme_colors.dart';

/// Landing page color tokens for light and dark themes.
final class LandingColors {
  const LandingColors({
    required this.background,
    required this.backgroundAlt,
    required this.surface,
    required this.surfaceElevated,
    required this.surfaceGlass,
    required this.surfaceSoft,
    required this.primary,
    required this.primarySoft,
    required this.accentMint,
    required this.accentAmber,
    required this.accentBlue,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textOnPrimary,
    required this.border,
    required this.borderStrong,
  });

  final Color background;
  final Color backgroundAlt;
  final Color surface;
  final Color surfaceElevated;
  final Color surfaceGlass;
  final Color surfaceSoft;
  final Color primary;
  final Color primarySoft;
  final Color accentMint;
  final Color accentAmber;
  final Color accentBlue;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textOnPrimary;
  final Color border;
  final Color borderStrong;

  static final LandingColors dark = LandingColors(
    background: AppThemeColors.dark.pageBackground,
    backgroundAlt: AppThemeColors.dark.pageBackgroundAlt,
    surface: AppThemeColors.dark.surface,
    surfaceElevated: AppThemeColors.dark.surfaceElevated,
    surfaceGlass: AppThemeColors.dark.surfaceGlass,
    surfaceSoft: AppThemeColors.dark.primarySoft,
    primary: AppThemeColors.dark.primary,
    primarySoft: AppThemeColors.dark.primarySoft,
    accentMint: AppThemeColors.dark.accentMint,
    accentAmber: AppThemeColors.dark.accentAmber,
    accentBlue: AppThemeColors.dark.accentBlue,
    textPrimary: AppThemeColors.dark.textPrimary,
    textSecondary: AppThemeColors.dark.textSecondary,
    textMuted: AppThemeColors.dark.textMuted,
    textOnPrimary: AppThemeColors.dark.textOnPrimary,
    border: AppThemeColors.dark.borderSubtle,
    borderStrong: AppThemeColors.dark.borderStrong,
  );

  static final LandingColors light = LandingColors(
    background: AppThemeColors.light.pageBackground,
    backgroundAlt: AppThemeColors.light.pageBackgroundAlt,
    surface: AppThemeColors.light.surface,
    surfaceElevated: AppThemeColors.light.surfaceElevated,
    surfaceGlass: AppThemeColors.light.surfaceGlass,
    surfaceSoft: AppThemeColors.light.primarySoft,
    primary: AppThemeColors.light.primary,
    primarySoft: AppThemeColors.light.primarySoft,
    accentMint: AppThemeColors.light.accentMint,
    accentAmber: AppThemeColors.light.accentAmber,
    accentBlue: AppThemeColors.light.accentBlue,
    textPrimary: AppThemeColors.light.textPrimary,
    textSecondary: AppThemeColors.light.textSecondary,
    textMuted: AppThemeColors.light.textMuted,
    textOnPrimary: AppThemeColors.light.textOnPrimary,
    border: AppThemeColors.light.borderSubtle,
    borderStrong: AppThemeColors.light.borderStrong,
  );

  static LandingColors of(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark ? dark : light;
  }
}
