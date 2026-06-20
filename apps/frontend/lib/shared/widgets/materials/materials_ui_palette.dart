import 'package:flutter/material.dart';

// Premium Emerald Tech — Material Discovery palette (single source of truth).

// --- Base surfaces ---
const materialAppBackground = Color(0xFF050807);
const materialPageBackground = Color(0xFF050807);
const materialSectionBackground = Color(0xFF080D0B);
const materialCardSurface = Color(0xFF101614);
const materialCardSurfaceAlt = Color(0xFF171F1B);
const materialPanelSurface = Color(0xFF101614);
const materialMutedSurface = Color(0xFF202A25);
const materialInputSurface = Color(0xFF202A25);

// --- Borders ---
const materialBorderSubtle = Color(0xFF28352F);
const materialBorderStrong = Color(0xFF3A4F45);

// --- Text ---
const materialTextPrimary = Color(0xFFF4F7F2);
const materialTextSecondary = Color(0xFFC5CEC8);
const materialTextMuted = Color(0xFF8B9891);

// --- Accents (emerald / mint / lime) ---
const materialEmerald = Color(0xFF34D399);
const materialEmeraldStrong = Color(0xFF10B981);
const materialEmeraldDark = Color(0xFF065F46);
const materialMint = Color(0xFF5EEAD4);
const materialMintDark = Color(0xFF065F46);
const materialLime = Color(0xFFA3E635);
const materialLimeSoft = Color(0xFFD9F99D);
const materialCtaForeground = Color(0xFF04231D);

// --- Semantic ---
const materialWarning = Color(0xFFF59E0B);
const materialDanger = Color(0xFFEF4444);
const materialInfo = Color(0xFF60A5FA);

// --- Panels & overlays ---
const materialHintSurface = Color(0xFF171F1B);
const materialHintBorder = Color(0xFF28352F);
const materialMapSurface = Color(0xFF080D0B);
const materialMapGrid = Color(0xFF1E2622);
const materialCardShadow = Color(0x24000000);
const materialOverlayDark = Color(0x55050807);
const materialOverlaySoft = Color(0x66050807);

// --- Hero (neutral charcoal / navy; emerald glow only) ---
const materialHeroStart = Color(0xFF050807);
const materialHeroMid = Color(0xFF0A1018);
const materialHeroEnd = Color(0xFF0E1520);
const materialHeroGlow = Color(0x1434D399);

// --- Card media fallback (cool charcoal; distinct from card body) ---
const materialFallbackStart = Color(0xFF0A0E14);
const materialFallbackMid = Color(0xFF121A22);
const materialFallbackEnd = Color(0xFF182028);

// --- Status badges ---
const materialAvailableBackground = Color(0x1A34D399);
const materialAvailableForeground = Color(0xFF34D399);
const materialAvailableBorder = Color(0xFF10B981);

const materialReservedBackground = Color(0x1AF59E0B);
const materialReservedForeground = Color(0xFFFFD89A);
const materialReservedBorder = Color(0xFFB45309);

const materialReusedBackground = Color(0xFF171F1B);
const materialReusedForeground = Color(0xFF8B9891);
const materialReusedBorder = Color(0xFF28352F);

const materialDraftBackground = Color(0xFF202A25);
const materialDraftForeground = Color(0xFF8B9891);
const materialDraftBorder = Color(0xFF28352F);

// --- Condition badges (neutral; fair uses amber) ---
const materialConditionLikeNewBackground = Color(0xFF171F1B);
const materialConditionLikeNewForeground = Color(0xFFF4F7F2);
const materialConditionGoodBackground = Color(0xFF202A25);
const materialConditionGoodForeground = Color(0xFFC5CEC8);
const materialConditionFairBackground = Color(0x1AF59E0B);
const materialConditionFairForeground = Color(0xFFFFD89A);
const materialConditionMixedBackground = Color(0xFF171F1B);
const materialConditionMixedForeground = Color(0xFFC5CEC8);

// --- Price badges ---
const materialPriceFreeBackground = Color(0x1A34D399);
const materialPriceFreeBorder = Color(0xFF10B981);
const materialPriceFreeForeground = Color(0xFF5EEAD4);
const materialPricePaidBackground = Color(0xFF171F1B);
const materialPricePaidBorder = Color(0xFF2A4A42);
const materialPricePaidForeground = Color(0xFFC5CEC8);

// --- Badge sizing ---
const materialBadgeFontSize = 12.5;
const materialBadgeHorizontalPadding = 12.0;
const materialBadgeVerticalPadding = 7.0;
const materialMetaChipHorizontalPadding = 12.0;
const materialMetaChipVerticalPadding = 8.0;
const materialStandardCardHeight = 530.0;
const materialCompactCardHeight = 432.0;

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

  static const light = MaterialsUiPalette(
    pageBackground: Color(0xFFFAFBF7),
    cardSurface: Color(0xFFFFFFFF),
    cardSurfaceAlt: Color(0xFFF1F5EF),
    panelSurface: Color(0xFFFFFFFF),
    mutedSurface: Color(0xFFEAF3EC),
    inputSurface: Color(0xFFFFFFFF),
    borderSubtle: Color(0xFFD9E2D7),
    borderStrong: Color(0xFFC7D4C5),
    textPrimary: Color(0xFF102019),
    textSecondary: Color(0xFF526158),
    textMuted: Color(0xFF738075),
    mint: Color(0xFF047857),
    ctaForeground: Color(0xFFFFFFFF),
    hintSurface: Color(0xFFFFFFFF),
    hintBorder: Color(0xFFD9E2D7),
    cardShadow: Color(0x140F172A),
    overlayDark: Color(0x33050807),
    heroStart: Color(0xFFE8F7EF),
    heroMid: Color(0xFFF6FAF4),
    heroEnd: Color(0xFFE6F2EF),
    fallbackStart: Color(0xFFEAF3EC),
    fallbackMid: Color(0xFFDDF0E8),
    fallbackEnd: Color(0xFFD8E6E0),
  );
}
