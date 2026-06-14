import 'package:flutter/material.dart';

/// Central color tokens for ImpactLoop. Do not hardcode colors in feature UI.
abstract final class AppColors {
  static const Color primary = Color(0xFF8A2BE2);
  static const Color primaryContainer = Color(0xFFEDE0F9);
  static const Color secondary = Color(0xFF9D5AEA);
  static const Color secondaryContainer = Color(0xFFF3E8FF);
  static const Color accent = Color(0xFFFFB74D);
  static const Color accentSoft = Color(0xFFFFF3E0);

  static const Color background = Color(0xFFF6F3FA);
  static const Color surface = Color(0xFFFDFBFF);
  static const Color surfaceElevated = Color(0xFFFFFFFF);

  static const Color brandingGradientStart = Color(0xFF5E1899);
  static const Color brandingGradientEnd = Color(0xFF8A2BE2);
  static const Color brandingGradientMid = Color(0xFF7421C4);

  static const Color blobPrimary = Color(0x3D8A2BE2);
  static const Color blobSecondary = Color(0x33B388E6);
  static const Color blobAccent = Color(0x2EFFB74D);

  static const Color textPrimary = Color(0xFF241530);
  static const Color textSecondary = Color(0xFF655A75);
  static const Color textOnBrand = Color(0xFFFFFFFF);
  static const Color textOnBrandMuted = Color(0xFFEDE4F7);

  static const Color border = Color(0xFFE2D8EE);
  static const Color borderFocused = Color(0xFF8A2BE2);

  static const Color error = Color(0xFFD32F2F);
  static const Color errorSurface = Color(0xFFFFEBEE);

  static const Color link = Color(0xFF7421C4);
  static const Color shadow = Color(0x148A2BE2);

  /// Legacy alias used by ColorScheme seed.
  static const Color seed = primary;
}
