import 'package:flutter/material.dart';

import '../../../../app/theme/auth_dark_colors.dart';

/// Supplier Portal color tokens for dark and light modes.
class SupplierColorScheme {
  const SupplierColorScheme({
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

  static SupplierColorScheme of(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark ? dark : light;
  }

  static const SupplierColorScheme dark = SupplierColorScheme(
    background: AuthDarkColors.background,
    landingBackground: AuthDarkColors.landingBackground,
    backgroundElevated: AuthDarkColors.backgroundElevated,
    surface: AuthDarkColors.surface,
    surfaceSolid: AuthDarkColors.surfaceSolid,
    navBar: AuthDarkColors.navBar,
    accent: AuthDarkColors.accent,
    accentMuted: AuthDarkColors.accentMuted,
    accentSoft: AuthDarkColors.accentSoft,
    border: AuthDarkColors.border,
    borderFocused: AuthDarkColors.borderFocused,
    textPrimary: AuthDarkColors.textPrimary,
    textSecondary: AuthDarkColors.textSecondary,
    textMuted: AuthDarkColors.textMuted,
    textDisabled: Color(0xFF64748B),
    textOnAccent: AuthDarkColors.textOnAccent,
    chipSelected: AuthDarkColors.chipSelected,
    chipUnselected: AuthDarkColors.chipUnselected,
    error: AuthDarkColors.error,
    link: AuthDarkColors.link,
    blueAccent: Color(0xFF60A5FA),
    amberAccent: Color(0xFFF59E0B),
    redAccent: AuthDarkColors.error,
    purpleAccent: Color(0xFFA78BFA),
    cardShadow: Color(0x38000000),
    isDark: true,
  );

  static const SupplierColorScheme light = SupplierColorScheme(
    background: Color(0xFFEEF2EC),
    landingBackground: Color(0xFFF3F5F0),
    backgroundElevated: Color(0xFFFAFBF8),
    surface: Color(0xFFFFFFFF),
    surfaceSolid: Color(0xFFFFFFFF),
    navBar: Color(0xF5FFFFFF),
    accent: Color(0xFF0F766E),
    accentMuted: Color(0xFF0D9488),
    accentSoft: Color(0x260D9488),
    border: Color(0xFF9EAD9A),
    borderFocused: Color(0xFF115E59),
    textPrimary: Color(0xFF102018),
    textSecondary: Color(0xFF3B4D42),
    textMuted: Color(0xFF5A6B60),
    textDisabled: Color(0xFF7A887E),
    textOnAccent: Color(0xFFFFFFFF),
    chipSelected: Color(0x330D9488),
    chipUnselected: Color(0xFFE8EDE5),
    error: Color(0xFFB91C1C),
    link: Color(0xFF0F766E),
    blueAccent: Color(0xFF2563EB),
    amberAccent: Color(0xFFB45309),
    redAccent: Color(0xFFB91C1C),
    purpleAccent: Color(0xFF6D28D9),
    cardShadow: Color(0x24102018),
    isDark: false,
  );
}
