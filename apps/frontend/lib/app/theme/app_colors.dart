import 'package:flutter/material.dart';

/// Central color tokens for ImpactLoop. Do not hardcode colors in feature UI.
abstract final class AppColors {
  static const Color primary = Color(0xFF0891B2);
  static const Color primaryContainer = Color(0xFFCFFAFE);
  static const Color secondary = Color(0xFF38BDF8);
  static const Color secondaryContainer = Color(0xFFE0F2FE);
  static const Color accent = Color(0xFF2DD4BF);
  static const Color accentSoft = Color(0xFFCCFBF1);

  static const Color background = Color(0xFFF0F9FF);
  static const Color surface = Color(0xFFF8FDFF);
  static const Color surfaceElevated = Color(0xFFFFFFFF);

  static const Color brandingGradientStart = Color(0xFF0E7490);
  static const Color brandingGradientEnd = Color(0xFF0891B2);
  static const Color brandingGradientMid = Color(0xFF22D3EE);

  static const Color blobPrimary = Color(0x3D0891B2);
  static const Color blobSecondary = Color(0x3338BDF8);
  static const Color blobAccent = Color(0x2D2DD4BF);

  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF475569);
  static const Color textOnBrand = Color(0xFFFFFFFF);
  static const Color textOnBrandMuted = Color(0xFFCFFAFE);

  static const Color border = Color(0xFFBAE6FD);
  static const Color borderFocused = Color(0xFF0891B2);

  static const Color error = Color(0xFFD32F2F);
  static const Color errorSurface = Color(0xFFFFEBEE);

  static const Color link = Color(0xFF0E7490);
  static const Color shadow = Color(0x140891B2);

  /// Legacy alias used by ColorScheme seed.
  static const Color seed = primary;
}
