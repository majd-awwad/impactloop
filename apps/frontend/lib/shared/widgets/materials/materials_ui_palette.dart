import 'package:flutter/material.dart';

import '../../../app/theme/app_color_tokens.dart';
import '../../../app/theme/app_theme_colors.dart';

// Legacy exported constants retained for existing const call sites.
const materialWarning = AppColorTokens.warning;
const materialDanger = AppColorTokens.danger;
const materialFallbackStart = AppColorTokens.darkFallbackStart;
const materialFallbackMid = AppColorTokens.darkFallbackMid;
const materialFallbackEnd = AppColorTokens.darkFallbackEnd;

const materialStandardCardHeight = 456.0;
const materialCompactCardHeight = 136.0;

class MaterialsUiPalette {
  const MaterialsUiPalette({
    required this.pageBackground,
    required this.cardSurface,
    required this.cardSurfaceAlt,
    required this.panelSurface,
    required this.mutedSurface,
    required this.inputSurface,
    required this.borderSubtle,
    required this.borderStrong,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.mint,
    required this.ctaForeground,
    required this.hintSurface,
    required this.hintBorder,
    required this.cardShadow,
    required this.overlayDark,
    required this.heroStart,
    required this.heroMid,
    required this.heroEnd,
    required this.fallbackStart,
    required this.fallbackMid,
    required this.fallbackEnd,
  });

  final Color pageBackground;
  final Color cardSurface;
  final Color cardSurfaceAlt;
  final Color panelSurface;
  final Color mutedSurface;
  final Color inputSurface;
  final Color borderSubtle;
  final Color borderStrong;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color mint;
  final Color ctaForeground;
  final Color hintSurface;
  final Color hintBorder;
  final Color cardShadow;
  final Color overlayDark;
  final Color heroStart;
  final Color heroMid;
  final Color heroEnd;
  final Color fallbackStart;
  final Color fallbackMid;
  final Color fallbackEnd;

  static MaterialsUiPalette of(BuildContext context) {
    final colors = AppThemeColors.of(context);

    return MaterialsUiPalette(
      pageBackground: colors.pageBackground,
      cardSurface: colors.cardSurface,
      cardSurfaceAlt: colors.cardSurfaceAlt,
      panelSurface: colors.panelSurface,
      mutedSurface: colors.surfaceMuted,
      inputSurface: colors.surfaceElevated,
      borderSubtle: colors.borderSubtle,
      borderStrong: colors.borderStrong,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      textMuted: colors.textMuted,
      mint: colors.primary,
      ctaForeground: colors.textOnPrimary,
      hintSurface: colors.surfaceMuted,
      hintBorder: colors.borderSubtle,
      cardShadow: colors.shadow,
      overlayDark: colors.overlay,
      heroStart: colors.heroStart,
      heroMid: colors.heroMid,
      heroEnd: colors.heroEnd,
      fallbackStart: colors.fallbackStart,
      fallbackMid: colors.fallbackMid,
      fallbackEnd: colors.fallbackEnd,
    );
  }
}
