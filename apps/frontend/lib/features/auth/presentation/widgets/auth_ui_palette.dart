import 'package:flutter/material.dart';

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

  static const AuthUiPalette light = AuthUiPalette(
    background: Color(0xFFF7F8F3),
    surface: Color(0xFFFFFFFF),
    surfaceElevated: Color(0xFFF1F6F2),
    panelDark: Color(0xFF0B2D26),
    panelDark2: Color(0xFF103B32),
    primary: Color(0xFF0F7A5A),
    primarySoft: Color(0xFFE4F4EC),
    accentMint: Color(0xFF20B996),
    accentAmber: Color(0xFFD9A441),
    textPrimary: Color(0xFF111827),
    textSecondary: Color(0xFF4B5B6B),
    textMuted: Color(0xFF728095),
    textOnPrimary: Color(0xFFFFFFFF),
    border: Color(0xFFDCE7DD),
    borderStrong: Color(0xFFB8D2C3),
  );

  static const AuthUiPalette dark = AuthUiPalette(
    background: Color(0xFF06110F),
    surface: Color(0xFF0B1512),
    surfaceElevated: Color(0xFF10231E),
    panelDark: Color(0xFF082A24),
    panelDark2: Color(0xFF103B32),
    primary: Color(0xFF2DD4A3),
    primarySoft: Color(0x332DD4A3),
    accentMint: Color(0xFF64F4D2),
    accentAmber: Color(0xFFEAB75F),
    textPrimary: Color(0xFFF4FBF8),
    textSecondary: Color(0xFFB8C8C1),
    textMuted: Color(0xFF8EA19A),
    textOnPrimary: Color(0xFF052016),
    border: Color(0xFF244E43),
    borderStrong: Color(0xFF2F6F5F),
  );

  static AuthUiPalette of(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark ? dark : light;
  }
}
