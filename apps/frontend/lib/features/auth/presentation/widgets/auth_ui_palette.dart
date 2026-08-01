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

  static AuthUiPalette of(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return AuthUiPalette(
      background: colors.pageBackground,
      surface: colors.cardSurface,
      surfaceElevated: colors.surfaceElevated,
      panelDark: colors.panelSurface,
      panelDark2: colors.panelSurfaceAlt,
      primary: colors.primary,
      primarySoft: colors.primarySoft,
      accentMint: colors.primary,
      accentAmber: colors.primaryHover,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
      textOnPrimary: colors.textOnPrimary,
      border: colors.borderSubtle,
      borderStrong: colors.borderStrong,
    );
  }
}
