import 'package:flutter/material.dart';

import 'app_color_tokens.dart';

/// Dark eco-tech tokens for auth entry screens only.
///
/// Legacy compatibility layer. New theme-aware UI should use AppThemeColors or
/// feature palettes derived from it.
abstract final class AuthDarkColors {
  static const Color background = AppColorTokens.legacyAuthBackground;
  static const Color landingBackground =
      AppColorTokens.legacyAuthLandingBackground;
  static const Color backgroundElevated =
      AppColorTokens.legacyAuthBackgroundElevated;
  static const Color surface = AppColorTokens.legacyAuthSurface;
  static const Color surfaceSolid = AppColorTokens.legacyAuthSurfaceSolid;
  static const Color navBar = AppColorTokens.legacyAuthNavBar;

  static const Color accent = AppColorTokens.legacyAuthAccent;
  static const Color accentMuted = AppColorTokens.legacyAuthAccentMuted;
  static const Color accentSoft = AppColorTokens.legacyAuthAccentSoft;

  static const Color border = AppColorTokens.legacyAuthBorder;
  static const Color borderFocused = AppColorTokens.legacyAuthAccent;

  static const Color textPrimary = AppColorTokens.darkTextPrimary;
  static const Color textSecondary = AppColorTokens.legacyAuthTextSecondary;
  static const Color textMuted = AppColorTokens.legacyAuthTextMuted;
  static const Color textOnAccent = AppColorTokens.legacyAuthTextOnAccent;

  static const Color chipSelected = AppColorTokens.legacyAuthChipSelected;
  static const Color chipUnselected = AppColorTokens.legacyAuthChipUnselected;

  static const Color blobPrimary = AppColorTokens.legacyAuthBlobPrimary;
  static const Color blobSecondary = AppColorTokens.legacyAuthBlobSecondary;
  static const Color blobAccent = AppColorTokens.legacyAuthBlobAccent;

  static const Color gradientStart = AppColorTokens.legacyAuthGradientStart;
  static const Color gradientEnd = AppColorTokens.legacyAuthGradientEnd;
  static const Color gradientMid = AppColorTokens.legacyAuthGradientMid;

  static const Color error = AppColorTokens.dangerDark;
  static const Color link = AppColorTokens.legacyAuthAccent;
}
