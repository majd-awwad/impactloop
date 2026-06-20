import 'package:flutter/material.dart';

/// Central color tokens for ImpactLoop. Do not hardcode colors in feature UI.
abstract final class AppColors {
  static const Color primary = Color(0xFF047857);
  static const Color primaryContainer = Color(0xFFD1FAE5);
  static const Color secondary = Color(0xFF0F766E);
  static const Color secondaryContainer = Color(0xFFCCFBF1);
  static const Color accent = Color(0xFF10B981);
  static const Color accentSoft = Color(0xFFCCFBF1);

  static const Color background = Color(0xFFFAFBF7);
  static const Color surface = Color(0xFFFFFEFC);
  static const Color surfaceElevated = Color(0xFFFFFFFF);
  static const Color surfaceContainer = Color(0xFFF1F5EF);

  static const Color brandingGradientStart = Color(0xFF047857);
  static const Color brandingGradientEnd = Color(0xFF0F766E);
  static const Color brandingGradientMid = Color(0xFF10B981);

  static const Color blobPrimary = Color(0x33047857);
  static const Color blobSecondary = Color(0x2610B981);
  static const Color blobAccent = Color(0x240F766E);

  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textOnBrand = Color(0xFFFFFFFF);
  static const Color textOnBrandMuted = Color(0xFFCFFAFE);

  static const Color border = Color(0xFFD9E2D7);
  static const Color borderFocused = Color(0xFF047857);

  static const Color error = Color(0xFFD32F2F);
  static const Color errorSurface = Color(0xFFFFEBEE);

  static const Color link = Color(0xFF047857);
  static const Color shadow = Color(0x140F172A);

  static const Color darkPrimary = Color(0xFF5EEAD4);
  static const Color darkSecondary = Color(0xFF2DD4BF);
  static const Color darkBackground = Color(0xFF0B0E0E);
  static const Color darkSurface = Color(0xFF132821);
  static const Color darkSurfaceContainer = Color(0xFF173029);
  static const Color darkSurfaceElevated = Color(0xFF142823);
  static const Color darkTextPrimary = Color(0xFFF0FDFA);
  static const Color darkTextSecondary = Color(0xFF94A3B8);
  static const Color darkBorder = Color(0x4D2DD4BF);

  /// Legacy alias used by ColorScheme seed.
  static const Color seed = primary;
}
