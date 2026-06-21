import 'package:flutter/material.dart';

/// Raw ImpactLoop color tokens.
///
/// Keep hexadecimal color values centralized here. Presentation widgets and
/// feature palettes should consume semantic colors instead of defining hex
/// values locally.
abstract final class AppColorTokens {
  static const Color emerald = Color(0xFF0F7A5A);
  static const Color emeraldHover = Color(0xFF0A654A);
  static const Color emeraldDeep = Color(0xFF052016);
  static const Color forest = Color(0xFF047857);
  static const Color teal = Color(0xFF0F766E);
  static const Color mint = Color(0xFF20B996);
  static const Color mintBright = Color(0xFF64F4D2);
  static const Color mintDark = Color(0xFF2DD4A3);
  static const Color amber = Color(0xFFD9A441);
  static const Color amberDark = Color(0xFFEAB75F);
  static const Color blue = Color(0xFF2F6F8F);
  static const Color blueDark = Color(0xFF4FA3FF);
  static const Color lime = Color(0xFFA6D94C);
  static const Color limeSoft = Color(0xFFE3F4BE);

  static const Color lightBackground = Color(0xFFF7F8F3);
  static const Color lightBackgroundAlt = Color(0xFFEFF5EE);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightSurfaceElevated = Color(0xFFF1F5EE);
  static const Color lightSurfaceMuted = Color(0xFFEAF3EC);
  static const Color lightSurfaceSoft = Color(0xFFE4F4EC);
  static const Color lightSurfaceGlass = Color(0xF7FFFFFF);
  static const Color lightWarmSurface = Color(0xFFFFF4DB);
  static const Color lightCardAlt = Color(0xFFF3F8F4);
  static const Color lightHeroStart = Color(0xFFE8F7EF);
  static const Color lightHeroMid = Color(0xFFF6FAF4);
  static const Color lightHeroEnd = Color(0xFFE6F2EF);
  static const Color lightFallbackStart = Color(0xFFEAF7F0);
  static const Color lightFallbackMid = Color(0xFFDDF0E6);
  static const Color lightFallbackEnd = Color(0xFFF8FBF7);
  static const Color lightPurpleStart = Color(0xFFEFE7FF);
  static const Color lightPurpleEnd = Color(0xFFE8EEF8);

  static const Color darkBackground = Color(0xFF06110F);
  static const Color darkBackgroundAlt = Color(0xFF081B17);
  static const Color darkSurface = Color(0xFF0B1512);
  static const Color darkSurfaceElevated = Color(0xFF10231E);
  static const Color darkSurfaceMuted = Color(0xFF202A25);
  static const Color darkSurfaceSoft = Color(0xFF173A32);
  static const Color darkSurfaceGlass = Color(0xCC102C26);
  static const Color darkPanel = Color(0xFF0B2D26);
  static const Color darkPanel2 = Color(0xFF103B32);
  static const Color darkCardAlt = Color(0xFF101F1A);
  static const Color darkHeroStart = Color(0xFF050807);
  static const Color darkHeroMid = Color(0xFF0A1018);
  static const Color darkHeroEnd = Color(0xFF0E1520);
  static const Color darkFallbackStart = Color(0xFF122A22);
  static const Color darkFallbackMid = Color(0xFF17382E);
  static const Color darkFallbackEnd = Color(0xFF0E1E19);
  static const Color darkPurpleStart = Color(0xFF4C1D95);
  static const Color darkPurpleEnd = Color(0xFF2A2A4A);

  static const Color textPrimary = Color(0xFF111827);
  static const Color textPrimaryForest = Color(0xFF102019);
  static const Color textSecondary = Color(0xFF4B5B6B);
  static const Color textSecondaryForest = Color(0xFF526158);
  static const Color textMuted = Color(0xFF728095);
  static const Color textMutedForest = Color(0xFF738075);
  static const Color darkTextPrimary = Color(0xFFF4FBF8);
  static const Color darkTextSecondary = Color(0xFFB8C8C1);
  static const Color darkTextMuted = Color(0xFF8EA19A);

  static const Color lightBorder = Color(0xFFDCE7DD);
  static const Color lightBorderAlt = Color(0xFFD9E2D7);
  static const Color lightBorderStrong = Color(0xFFB8D2C3);
  static const Color lightBorderCard = Color(0xFFC8DCCF);
  static const Color darkBorder = Color(0xFF244E43);
  static const Color darkBorderStrong = Color(0xFF2F6F5F);
  static const Color darkBorderAlt = Color(0xFF28352F);
  static const Color darkBorderCard = Color(0xFF284C40);

  static const Color shadow = Color(0x140F172A);
  static const Color shadowWarm = Color(0x120F1F17);
  static const Color darkShadow = Color(0x1F000000);
  static const Color lightOverlay = Color(0x24050807);
  static const Color darkOverlay = Color(0x66050807);
  static const Color learningOverlayDark = Color(0x9908110F);
  static const Color lightBlobPrimary = Color(0x33047857);
  static const Color lightBlobSecondary = Color(0x2610B981);
  static const Color lightBlobAccent = Color(0x240F766E);

  static const Color warning = Color(0xFFF59E0B);
  static const Color warningDarkText = Color(0xFFFFD89A);
  static const Color warningLightText = Color(0xFF8A5A00);
  static const Color warningBorder = Color(0xFFB45309);
  static const Color warningBorderLight = Color(0xFFE5C574);
  static const Color danger = Color(0xFFEF4444);
  static const Color dangerLight = Color(0xFFD32F2F);
  static const Color dangerDark = Color(0xFFF87171);
  static const Color info = Color(0xFF60A5FA);
  static const Color success = Color(0xFF34D399);

  // Legacy dark auth/supplier compatibility tokens. New UI should prefer
  // AppThemeColors semantics, but these keep existing compatibility wrappers
  // from defining raw hex values independently.
  static const Color legacyAuthBackground = Color(0xFF0A1612);
  static const Color legacyAuthLandingBackground = Color(0xFF0B0E0E);
  static const Color legacyAuthBackgroundElevated = Color(0xFF10201B);
  static const Color legacyAuthSurface = Color(0xD9142823);
  static const Color legacyAuthSurfaceSolid = Color(0xFF13241F);
  static const Color legacyAuthNavBar = Color(0xE60F1D19);
  static const Color legacyAuthAccent = Color(0xFF5EEAD4);
  static const Color legacyAuthAccentMuted = Color(0xFF2DD4BF);
  static const Color legacyAuthAccentSoft = Color(0x262DD4BF);
  static const Color legacyAuthBorder = Color(0x4D2DD4BF);
  static const Color legacyAuthTextSecondary = Color(0xFF94A3B8);
  static const Color legacyAuthTextMuted = Color(0xFF64748B);
  static const Color legacyAuthTextOnAccent = Color(0xFF042F2E);
  static const Color legacyAuthChipSelected = Color(0x332DD4BF);
  static const Color legacyAuthChipUnselected = Color(0xCC173029);
  static const Color legacyAuthBlobPrimary = Color(0x1F2DD4BF);
  static const Color legacyAuthBlobSecondary = Color(0x1714B8A6);
  static const Color legacyAuthBlobAccent = Color(0x195EEAD4);
  static const Color legacyAuthGradientStart = Color(0xFF0D3128);
  static const Color legacyAuthGradientMid = Color(0xFF164F47);
  static const Color legacyAuthGradientEnd = Color(0xFF0A1612);
  static const Color legacyAuthDecorationMid = Color(0xFF10362E);
}
