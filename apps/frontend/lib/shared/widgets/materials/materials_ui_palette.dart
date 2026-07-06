import 'package:flutter/material.dart';

import '../../../app/theme/app_color_tokens.dart';
import '../../../app/theme/app_theme_colors.dart';

// Premium Emerald Tech — Material Discovery palette (single source of truth).

// --- Base surfaces ---
const materialAppBackground = AppColorTokens.darkBackground;
const materialPageBackground = AppColorTokens.darkBackground;
const materialSectionBackground = AppColorTokens.darkBackgroundAlt;
const materialCardSurface = AppColorTokens.darkSurface;
const materialCardSurfaceAlt = AppColorTokens.darkCardAlt;
const materialPanelSurface = AppColorTokens.darkPanel;
const materialMutedSurface = AppColorTokens.darkSurfaceMuted;
const materialInputSurface = AppColorTokens.darkSurfaceMuted;

// --- Borders ---
const materialBorderSubtle = AppColorTokens.darkBorderAlt;
const materialBorderStrong = AppColorTokens.darkBorderCard;

// --- Text ---
const materialTextPrimary = AppColorTokens.darkTextPrimary;
const materialTextSecondary = AppColorTokens.darkTextSecondary;
const materialTextMuted = AppColorTokens.darkTextMuted;

// --- Accents (emerald / mint / lime) ---
const materialEmerald = AppColorTokens.success;
const materialEmeraldStrong = AppColorTokens.emerald;
const materialEmeraldDark = AppColorTokens.forest;
const materialMint = AppColorTokens.mintBright;
const materialMintDark = AppColorTokens.forest;
const materialLime = AppColorTokens.lime;
const materialLimeSoft = AppColorTokens.limeSoft;
const materialCtaForeground = AppColorTokens.emeraldDeep;

// --- Semantic ---
const materialWarning = AppColorTokens.warning;
const materialDanger = AppColorTokens.danger;
const materialInfo = AppColorTokens.info;

// --- Panels & overlays ---
const materialHintSurface = AppColorTokens.darkSurfaceSoft;
const materialHintBorder = AppColorTokens.darkBorderAlt;
const materialMapSurface = AppColorTokens.darkBackgroundAlt;
const materialMapGrid = AppColorTokens.darkSurfaceMuted;
const materialCardShadow = AppColorTokens.darkShadow;
const materialOverlayDark = AppColorTokens.darkOverlay;
const materialOverlaySoft = AppColorTokens.darkOverlay;

// --- Hero (neutral charcoal / navy; emerald glow only) ---
const materialHeroStart = AppColorTokens.darkHeroStart;
const materialHeroMid = AppColorTokens.darkHeroMid;
const materialHeroEnd = AppColorTokens.darkHeroEnd;
const materialHeroGlow = AppColorTokens.darkSurfaceSoft;

// --- Card media fallback (cool charcoal; distinct from card body) ---
const materialFallbackStart = AppColorTokens.darkFallbackStart;
const materialFallbackMid = AppColorTokens.darkFallbackMid;
const materialFallbackEnd = AppColorTokens.darkFallbackEnd;

// --- Status badges ---
const materialAvailableBackground = AppColorTokens.darkSurfaceSoft;
const materialAvailableForeground = AppColorTokens.success;
const materialAvailableBorder = AppColorTokens.emerald;

const materialReservedBackground = AppColorTokens.darkSurfaceSoft;
const materialReservedForeground = AppColorTokens.warningDarkText;
const materialReservedBorder = AppColorTokens.warningBorder;

const materialReusedBackground = AppColorTokens.darkSurfaceSoft;
const materialReusedForeground = AppColorTokens.darkTextMuted;
const materialReusedBorder = AppColorTokens.darkBorderAlt;

const materialDraftBackground = AppColorTokens.darkSurfaceMuted;
const materialDraftForeground = AppColorTokens.darkTextMuted;
const materialDraftBorder = AppColorTokens.darkBorderAlt;

// --- Condition badges (neutral; fair uses amber) ---
const materialConditionLikeNewBackground = AppColorTokens.darkSurfaceSoft;
const materialConditionLikeNewForeground = AppColorTokens.darkTextPrimary;
const materialConditionGoodBackground = AppColorTokens.darkSurfaceMuted;
const materialConditionGoodForeground = AppColorTokens.darkTextSecondary;
const materialConditionFairBackground = AppColorTokens.darkSurfaceSoft;
const materialConditionFairForeground = AppColorTokens.warningDarkText;
const materialConditionMixedBackground = AppColorTokens.darkSurfaceSoft;
const materialConditionMixedForeground = AppColorTokens.darkTextSecondary;

// --- Price badges ---
const materialPriceFreeBackground = AppColorTokens.darkSurfaceSoft;
const materialPriceFreeBorder = AppColorTokens.emerald;
const materialPriceFreeForeground = AppColorTokens.mintBright;
const materialPricePaidBackground = AppColorTokens.darkSurfaceSoft;
const materialPricePaidBorder = AppColorTokens.darkBorderCard;
const materialPricePaidForeground = AppColorTokens.darkTextSecondary;

// --- Badge sizing ---
const materialBadgeFontSize = 12.5;
const materialBadgeHorizontalPadding = 12.0;
const materialBadgeVerticalPadding = 7.0;
const materialMetaChipHorizontalPadding = 12.0;
const materialMetaChipVerticalPadding = 8.0;
const materialStandardCardHeight = 468.0;
const materialCompactCardHeight = 452.0;

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
    if (Theme.of(context).brightness == Brightness.dark) {
      return dark;
    }

    return light;
  }

  static const dark = MaterialsUiPalette(
    pageBackground: materialPageBackground,
    cardSurface: materialCardSurface,
    cardSurfaceAlt: materialCardSurfaceAlt,
    panelSurface: materialPanelSurface,
    mutedSurface: materialMutedSurface,
    inputSurface: materialInputSurface,
    borderSubtle: materialBorderSubtle,
    borderStrong: materialBorderStrong,
    textPrimary: materialTextPrimary,
    textSecondary: materialTextSecondary,
    textMuted: materialTextMuted,
    mint: materialMint,
    ctaForeground: materialCtaForeground,
    hintSurface: materialHintSurface,
    hintBorder: materialHintBorder,
    cardShadow: materialCardShadow,
    overlayDark: materialOverlayDark,
    heroStart: materialHeroStart,
    heroMid: materialHeroMid,
    heroEnd: materialHeroEnd,
    fallbackStart: materialFallbackStart,
    fallbackMid: materialFallbackMid,
    fallbackEnd: materialFallbackEnd,
  );

  static final light = MaterialsUiPalette(
    pageBackground: AppThemeColors.light.pageBackground,
    cardSurface: AppThemeColors.light.cardSurface,
    cardSurfaceAlt: AppThemeColors.light.cardSurfaceAlt,
    panelSurface: AppThemeColors.light.panelSurface,
    mutedSurface: AppThemeColors.light.surfaceMuted,
    inputSurface: AppThemeColors.light.surface,
    borderSubtle: AppThemeColors.light.borderSubtle,
    borderStrong: AppThemeColors.light.borderStrong,
    textPrimary: AppColorTokens.textPrimaryForest,
    textSecondary: AppColorTokens.textSecondaryForest,
    textMuted: AppColorTokens.textMutedForest,
    mint: AppColorTokens.forest,
    ctaForeground: AppThemeColors.light.textOnPrimary,
    hintSurface: AppThemeColors.light.surface,
    hintBorder: AppThemeColors.light.borderSubtle,
    cardShadow: AppThemeColors.light.shadow,
    overlayDark: AppThemeColors.light.overlay,
    heroStart: AppThemeColors.light.heroStart,
    heroMid: AppThemeColors.light.heroMid,
    heroEnd: AppThemeColors.light.heroEnd,
    fallbackStart: AppThemeColors.light.fallbackStart,
    fallbackMid: AppThemeColors.light.fallbackMid,
    fallbackEnd: AppThemeColors.light.fallbackEnd,
  );
}
