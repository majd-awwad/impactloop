import 'package:flutter/material.dart';

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

  static const LandingColors dark = LandingColors(
    background: Color(0xFF06110F),
    backgroundAlt: Color(0xFF081B17),
    surface: Color(0xFF0C241F),
    surfaceElevated: Color(0xFF102C26),
    surfaceGlass: Color(0xCC102C26),
    surfaceSoft: Color(0xFF173A32),
    primary: Color(0xFF2DD4A3),
    primarySoft: Color(0x332DD4A3),
    accentMint: Color(0xFF64F4D2),
    accentAmber: Color(0xFFEAB75F),
    accentBlue: Color(0xFF4FA3FF),
    textPrimary: Color(0xFFF4FBF8),
    textSecondary: Color(0xFFB8C8C1),
    textMuted: Color(0xFF8EA19A),
    textOnPrimary: Color(0xFF052016),
    border: Color(0xFF244E43),
    borderStrong: Color(0xFF2F6F5F),
  );

  static const LandingColors light = LandingColors(
    background: Color(0xFFF7F8F3),
    backgroundAlt: Color(0xFFEFF5EE),
    surface: Color(0xFFFFFFFF),
    surfaceElevated: Color(0xFFF1F5EE),
    surfaceGlass: Color(0xF7FFFFFF),
    surfaceSoft: Color(0xFFE4F4EC),
    primary: Color(0xFF0F7A5A),
    primarySoft: Color(0xFFE4F4EC),
    accentMint: Color(0xFF20B996),
    accentAmber: Color(0xFFD9A441),
    accentBlue: Color(0xFF2F6F8F),
    textPrimary: Color(0xFF111827),
    textSecondary: Color(0xFF4B5B6B),
    textMuted: Color(0xFF728095),
    textOnPrimary: Color(0xFFFFFFFF),
    border: Color(0xFFDCE7DD),
    borderStrong: Color(0xFFB8D2C3),
  );

  static LandingColors of(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark ? dark : light;
  }
}
