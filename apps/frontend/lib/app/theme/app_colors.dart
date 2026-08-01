import 'package:flutter/material.dart';

import 'app_color_tokens.dart';

/// Central color tokens for ImpactLoop. Do not hardcode colors in feature UI.
abstract final class AppColors {
  static const Color primary = AppColorTokens.forest;
  static const Color primaryContainer = AppColorTokens.lightSurfaceSoft;
  static const Color secondary = AppColorTokens.teal;
  static const Color secondaryContainer = AppColorTokens.lightFallbackMid;
  static const Color accent = AppColorTokens.emerald;
  static const Color accentSoft = AppColorTokens.lightSurfaceSoft;

  static const Color background = AppColorTokens.lightBackground;
  static const Color surface = AppColorTokens.lightSurface;
  static const Color surfaceElevated = AppColorTokens.lightSurface;
  static const Color surfaceContainer = AppColorTokens.lightSurfaceElevated;

  static const Color brandingGradientStart = AppColorTokens.forest;
  static const Color brandingGradientEnd = AppColorTokens.teal;
  static const Color brandingGradientMid = AppColorTokens.emerald;

  static const Color blobPrimary = AppColorTokens.lightBlobPrimary;
  static const Color blobSecondary = AppColorTokens.lightBlobSecondary;
  static const Color blobAccent = AppColorTokens.lightBlobAccent;

  static const Color textPrimary = AppColorTokens.textPrimary;
  static const Color textSecondary = AppColorTokens.textSecondary;
  static const Color textOnBrand = AppColorTokens.lightSurface;
  static const Color textOnBrandMuted = AppColorTokens.lightFallbackMid;

  static const Color border = AppColorTokens.lightBorderAlt;
  static const Color borderFocused = AppColorTokens.forest;

  static const Color error = AppColorTokens.dangerLight;
  static const Color errorSurface = AppColorTokens.lightWarmSurface;

  static const Color link = AppColorTokens.forest;
  static const Color shadow = AppColorTokens.shadow;

  static const Color darkPrimary = AppColorTokens.mintBright;
  static const Color darkSecondary = AppColorTokens.mintDark;
  static const Color darkBackground = AppColorTokens.darkBackground;
  static const Color darkSurface = AppColorTokens.darkSurface;
  static const Color darkSurfaceContainer = AppColorTokens.darkSurfaceSoft;
  static const Color darkSurfaceElevated = AppColorTokens.darkSurfaceElevated;
  static const Color darkTextPrimary = AppColorTokens.darkTextPrimary;
  static const Color darkTextSecondary = AppColorTokens.darkTextMuted;
  static const Color darkBorder = AppColorTokens.darkBorder;

  /// Legacy alias used by ColorScheme seed.
  static const Color seed = primary;
}
