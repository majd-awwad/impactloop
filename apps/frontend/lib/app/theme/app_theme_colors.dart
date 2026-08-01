import 'package:flutter/material.dart';

import 'app_color_tokens.dart';

@immutable
final class AppThemeColors extends ThemeExtension<AppThemeColors> {
  const AppThemeColors({
    required this.pageBackground,
    required this.pageBackgroundAlt,
    required this.surface,
    required this.surfaceElevated,
    required this.surfaceMuted,
    required this.surfaceGlass,
    required this.panelSurface,
    required this.panelSurfaceAlt,
    required this.cardSurface,
    required this.cardSurfaceAlt,
    required this.primary,
    required this.primaryHover,
    required this.primarySoft,
    required this.accent,
    required this.accentSoft,
    required this.accentMint,
    required this.accentAmber,
    required this.accentBlue,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textOnPrimary,
    required this.borderSubtle,
    required this.borderStrong,
    required this.shadow,
    required this.overlay,
    required this.warning,
    required this.warningSoft,
    required this.warningText,
    required this.warningBorder,
    required this.danger,
    required this.dangerSoft,
    required this.success,
    required this.successSoft,
    required this.info,
    required this.heroStart,
    required this.heroMid,
    required this.heroEnd,
    required this.fallbackStart,
    required this.fallbackMid,
    required this.fallbackEnd,
    required this.purpleStart,
    required this.purpleEnd,
  });

  final Color pageBackground;
  final Color pageBackgroundAlt;
  final Color surface;
  final Color surfaceElevated;
  final Color surfaceMuted;
  final Color surfaceGlass;
  final Color panelSurface;
  final Color panelSurfaceAlt;
  final Color cardSurface;
  final Color cardSurfaceAlt;
  final Color primary;
  final Color primaryHover;
  final Color primarySoft;
  final Color accent;
  final Color accentSoft;
  final Color accentMint;
  final Color accentAmber;
  final Color accentBlue;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textOnPrimary;
  final Color borderSubtle;
  final Color borderStrong;
  final Color shadow;
  final Color overlay;
  final Color warning;
  final Color warningSoft;
  final Color warningText;
  final Color warningBorder;
  final Color danger;
  final Color dangerSoft;
  final Color success;
  final Color successSoft;
  final Color info;
  final Color heroStart;
  final Color heroMid;
  final Color heroEnd;
  final Color fallbackStart;
  final Color fallbackMid;
  final Color fallbackEnd;
  final Color purpleStart;
  final Color purpleEnd;

  static const light = AppThemeColors(
    pageBackground: AppColorTokens.lightBackground,
    pageBackgroundAlt: AppColorTokens.lightBackgroundAlt,
    surface: AppColorTokens.lightSurface,
    surfaceElevated: AppColorTokens.lightSurfaceElevated,
    surfaceMuted: AppColorTokens.lightSurfaceMuted,
    surfaceGlass: AppColorTokens.lightSurfaceGlass,
    panelSurface: AppColorTokens.lightSurface,
    panelSurfaceAlt: AppColorTokens.lightSurfaceElevated,
    cardSurface: AppColorTokens.lightSurface,
    cardSurfaceAlt: AppColorTokens.lightCardAlt,
    primary: AppColorTokens.emerald,
    primaryHover: AppColorTokens.emeraldHover,
    primarySoft: AppColorTokens.lightSurfaceSoft,
    accent: AppColorTokens.emerald,
    accentSoft: AppColorTokens.lightSurfaceSoft,
    accentMint: AppColorTokens.mint,
    accentAmber: AppColorTokens.amber,
    accentBlue: AppColorTokens.blue,
    textPrimary: AppColorTokens.textPrimary,
    textSecondary: AppColorTokens.textSecondary,
    textMuted: AppColorTokens.textMuted,
    textOnPrimary: AppColorTokens.lightSurface,
    borderSubtle: AppColorTokens.lightBorder,
    borderStrong: AppColorTokens.lightBorderStrong,
    shadow: AppColorTokens.shadowWarm,
    overlay: AppColorTokens.lightOverlay,
    warning: AppColorTokens.warning,
    warningSoft: AppColorTokens.lightWarmSurface,
    warningText: AppColorTokens.warningLightText,
    warningBorder: AppColorTokens.warningBorderLight,
    danger: AppColorTokens.dangerLight,
    dangerSoft: AppColorTokens.lightWarmSurface,
    success: AppColorTokens.emerald,
    successSoft: AppColorTokens.lightSurfaceSoft,
    info: AppColorTokens.blue,
    heroStart: AppColorTokens.lightHeroStart,
    heroMid: AppColorTokens.lightHeroMid,
    heroEnd: AppColorTokens.lightHeroEnd,
    fallbackStart: AppColorTokens.lightFallbackStart,
    fallbackMid: AppColorTokens.lightFallbackMid,
    fallbackEnd: AppColorTokens.lightFallbackEnd,
    purpleStart: AppColorTokens.lightPurpleStart,
    purpleEnd: AppColorTokens.lightPurpleEnd,
  );

  static const dark = AppThemeColors(
    pageBackground: AppColorTokens.darkBackground,
    pageBackgroundAlt: AppColorTokens.darkBackgroundAlt,
    surface: AppColorTokens.darkSurface,
    surfaceElevated: AppColorTokens.darkSurfaceElevated,
    surfaceMuted: AppColorTokens.darkSurfaceMuted,
    surfaceGlass: AppColorTokens.darkSurfaceGlass,
    panelSurface: AppColorTokens.darkPanel,
    panelSurfaceAlt: AppColorTokens.darkPanel2,
    cardSurface: AppColorTokens.darkSurface,
    cardSurfaceAlt: AppColorTokens.darkCardAlt,
    primary: AppColorTokens.mintDark,
    primaryHover: AppColorTokens.mintBright,
    primarySoft: AppColorTokens.darkSurfaceSoft,
    accent: AppColorTokens.mintDark,
    accentSoft: AppColorTokens.darkSurfaceSoft,
    accentMint: AppColorTokens.mintBright,
    accentAmber: AppColorTokens.amberDark,
    accentBlue: AppColorTokens.blueDark,
    textPrimary: AppColorTokens.darkTextPrimary,
    textSecondary: AppColorTokens.darkTextSecondary,
    textMuted: AppColorTokens.darkTextMuted,
    textOnPrimary: AppColorTokens.emeraldDeep,
    borderSubtle: AppColorTokens.darkBorder,
    borderStrong: AppColorTokens.darkBorderStrong,
    shadow: AppColorTokens.darkShadow,
    overlay: AppColorTokens.darkOverlay,
    warning: AppColorTokens.warning,
    warningSoft: AppColorTokens.darkSurfaceSoft,
    warningText: AppColorTokens.warningDarkText,
    warningBorder: AppColorTokens.warningBorder,
    danger: AppColorTokens.dangerDark,
    dangerSoft: AppColorTokens.darkSurfaceSoft,
    success: AppColorTokens.success,
    successSoft: AppColorTokens.darkSurfaceSoft,
    info: AppColorTokens.info,
    heroStart: AppColorTokens.darkHeroStart,
    heroMid: AppColorTokens.darkHeroMid,
    heroEnd: AppColorTokens.darkHeroEnd,
    fallbackStart: AppColorTokens.darkFallbackStart,
    fallbackMid: AppColorTokens.darkFallbackMid,
    fallbackEnd: AppColorTokens.darkFallbackEnd,
    purpleStart: AppColorTokens.darkPurpleStart,
    purpleEnd: AppColorTokens.darkPurpleEnd,
  );

  static AppThemeColors of(BuildContext context) {
    return Theme.of(context).extension<AppThemeColors>() ??
        (Theme.of(context).brightness == Brightness.dark ? dark : light);
  }

  @override
  AppThemeColors copyWith() => this;

  @override
  AppThemeColors lerp(ThemeExtension<AppThemeColors>? other, double t) {
    if (other is! AppThemeColors) {
      return this;
    }

    Color blend(Color begin, Color end) => Color.lerp(begin, end, t) ?? begin;

    return AppThemeColors(
      pageBackground: blend(pageBackground, other.pageBackground),
      pageBackgroundAlt: blend(pageBackgroundAlt, other.pageBackgroundAlt),
      surface: blend(surface, other.surface),
      surfaceElevated: blend(surfaceElevated, other.surfaceElevated),
      surfaceMuted: blend(surfaceMuted, other.surfaceMuted),
      surfaceGlass: blend(surfaceGlass, other.surfaceGlass),
      panelSurface: blend(panelSurface, other.panelSurface),
      panelSurfaceAlt: blend(panelSurfaceAlt, other.panelSurfaceAlt),
      cardSurface: blend(cardSurface, other.cardSurface),
      cardSurfaceAlt: blend(cardSurfaceAlt, other.cardSurfaceAlt),
      primary: blend(primary, other.primary),
      primaryHover: blend(primaryHover, other.primaryHover),
      primarySoft: blend(primarySoft, other.primarySoft),
      accent: blend(accent, other.accent),
      accentSoft: blend(accentSoft, other.accentSoft),
      accentMint: blend(accentMint, other.accentMint),
      accentAmber: blend(accentAmber, other.accentAmber),
      accentBlue: blend(accentBlue, other.accentBlue),
      textPrimary: blend(textPrimary, other.textPrimary),
      textSecondary: blend(textSecondary, other.textSecondary),
      textMuted: blend(textMuted, other.textMuted),
      textOnPrimary: blend(textOnPrimary, other.textOnPrimary),
      borderSubtle: blend(borderSubtle, other.borderSubtle),
      borderStrong: blend(borderStrong, other.borderStrong),
      shadow: blend(shadow, other.shadow),
      overlay: blend(overlay, other.overlay),
      warning: blend(warning, other.warning),
      warningSoft: blend(warningSoft, other.warningSoft),
      warningText: blend(warningText, other.warningText),
      warningBorder: blend(warningBorder, other.warningBorder),
      danger: blend(danger, other.danger),
      dangerSoft: blend(dangerSoft, other.dangerSoft),
      success: blend(success, other.success),
      successSoft: blend(successSoft, other.successSoft),
      info: blend(info, other.info),
      heroStart: blend(heroStart, other.heroStart),
      heroMid: blend(heroMid, other.heroMid),
      heroEnd: blend(heroEnd, other.heroEnd),
      fallbackStart: blend(fallbackStart, other.fallbackStart),
      fallbackMid: blend(fallbackMid, other.fallbackMid),
      fallbackEnd: blend(fallbackEnd, other.fallbackEnd),
      purpleStart: blend(purpleStart, other.purpleStart),
      purpleEnd: blend(purpleEnd, other.purpleEnd),
    );
  }
}
