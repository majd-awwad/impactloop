import 'package:flutter/material.dart';

import '../../../../app/theme/app_color_tokens.dart';
import '../../../../app/theme/app_theme_colors.dart';

const learningHintSurface = AppColorTokens.learningHintSurface;
const learningHintBorder = AppColorTokens.learningHintBorder;
const learningPageBackground = AppColorTokens.learningPageBackground;
const learningSectionBackground = AppColorTokens.learningSectionBackground;
const learningDarkSurface = AppColorTokens.learningDarkSurface;
const learningDarkSurfaceSoft = AppColorTokens.learningDarkSurfaceSoft;
const learningCardSurface = AppColorTokens.learningCardSurface;
const learningCardSurfaceAlt = AppColorTokens.learningCardSurfaceAlt;
const learningHeroStart = AppColorTokens.learningHeroStart;
const learningHeroEnd = AppColorTokens.learningHeroEnd;
const learningHeroAccent = AppColorTokens.learningHeroAccent;
const learningLime = AppColorTokens.lime;
const learningLimeSoft = AppColorTokens.limeSoft;
const learningMutedChip = AppColorTokens.learningMutedChip;
const learningTimelineLine = AppColorTokens.learningTimelineLine;
const learningDisabledPanel = AppColorTokens.learningDisabledPanel;
const learningDisabledPanelBorder = AppColorTokens.learningDisabledPanelBorder;
const learningPurpleStart = AppColorTokens.darkPurpleStart;
const learningPurpleEnd = AppColorTokens.darkPurpleEnd;
const learningBeigeBackground = learningPageBackground;
const learningTextPrimary = AppColorTokens.learningTextPrimary;
const learningTextSecondary = AppColorTokens.learningTextSecondary;
const learningBorderSubtle = AppColorTokens.learningBorderSubtle;
const learningOverlayDark = AppColorTokens.learningOverlayDark;
const learningCardShadow = AppColorTokens.shadow;

class LearningUiPalette {
  const LearningUiPalette({
    required this.pageBackground,
    required this.hintSurface,
    required this.hintBorder,
    required this.cardSurface,
    required this.cardSurfaceAlt,
    required this.darkSurface,
    required this.darkSurfaceSoft,
    required this.heroStart,
    required this.heroAccent,
    required this.heroEnd,
    required this.lime,
    required this.limeSoft,
    required this.mutedChip,
    required this.timelineLine,
    required this.disabledPanel,
    required this.disabledPanelBorder,
    required this.textPrimary,
    required this.textSecondary,
    required this.borderSubtle,
    required this.overlayDark,
    required this.cardShadow,
  });

  final Color pageBackground;
  final Color hintSurface;
  final Color hintBorder;
  final Color cardSurface;
  final Color cardSurfaceAlt;
  final Color darkSurface;
  final Color darkSurfaceSoft;
  final Color heroStart;
  final Color heroAccent;
  final Color heroEnd;
  final Color lime;
  final Color limeSoft;
  final Color mutedChip;
  final Color timelineLine;
  final Color disabledPanel;
  final Color disabledPanelBorder;
  final Color textPrimary;
  final Color textSecondary;
  final Color borderSubtle;
  final Color overlayDark;
  final Color cardShadow;

  static LearningUiPalette of(BuildContext context) {
    if (Theme.of(context).brightness == Brightness.dark) {
      return dark;
    }

    return light;
  }

  static const dark = LearningUiPalette(
    pageBackground: learningPageBackground,
    hintSurface: learningHintSurface,
    hintBorder: learningHintBorder,
    cardSurface: learningCardSurface,
    cardSurfaceAlt: learningCardSurfaceAlt,
    darkSurface: learningDarkSurface,
    darkSurfaceSoft: learningDarkSurfaceSoft,
    heroStart: learningHeroStart,
    heroAccent: learningHeroAccent,
    heroEnd: learningHeroEnd,
    lime: learningLime,
    limeSoft: learningLimeSoft,
    mutedChip: learningMutedChip,
    timelineLine: learningTimelineLine,
    disabledPanel: learningDisabledPanel,
    disabledPanelBorder: learningDisabledPanelBorder,
    textPrimary: learningTextPrimary,
    textSecondary: learningTextSecondary,
    borderSubtle: learningBorderSubtle,
    overlayDark: learningOverlayDark,
    cardShadow: learningCardShadow,
  );

  static final light = LearningUiPalette(
    pageBackground: AppThemeColors.light.pageBackground,
    hintSurface: AppThemeColors.light.surface,
    hintBorder: AppThemeColors.light.borderSubtle,
    cardSurface: AppThemeColors.light.cardSurface,
    cardSurfaceAlt: AppThemeColors.light.surfaceElevated,
    darkSurface: AppThemeColors.light.surfaceMuted,
    darkSurfaceSoft: AppThemeColors.light.surfaceMuted,
    heroStart: AppThemeColors.light.heroStart,
    heroAccent: AppThemeColors.light.heroMid,
    heroEnd: AppThemeColors.light.heroEnd,
    lime: AppColorTokens.lime,
    limeSoft: AppColorTokens.limeSoft,
    mutedChip: AppThemeColors.light.surfaceElevated,
    timelineLine: AppThemeColors.light.borderStrong,
    disabledPanel: AppThemeColors.light.surface,
    disabledPanelBorder: AppThemeColors.light.borderSubtle,
    textPrimary: AppColorTokens.textPrimaryForest,
    textSecondary: AppColorTokens.textSecondaryForest,
    borderSubtle: AppThemeColors.light.borderSubtle,
    overlayDark: AppThemeColors.light.overlay,
    cardShadow: AppThemeColors.light.shadow,
  );
}
