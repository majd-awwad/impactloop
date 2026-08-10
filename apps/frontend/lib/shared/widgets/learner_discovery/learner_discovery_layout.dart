import 'package:flutter/material.dart';

import '../../../app/theme/app_radius.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_theme_colors.dart';

/// Shared layout tokens for Learner Materials + Learning Hub discovery pages.
abstract final class LearnerDiscoveryLayout {
  static const double pageMaxWidth = 1440;
  static const double mobileBreakpoint = 600;
  static const double tabletBreakpoint = 900;
  static const double desktopBreakpoint = 1160;
  static const double largeDesktopBreakpoint = 1320;

  static const double chipMinHeight = 38;
  static const double searchMinHeight = 48;
  static const double filterControlHeight = 40;

  static const double sectionGapDesktop = AppSpacing.lg;
  static const double sectionGapMobile = AppSpacing.md;
  static const double pagePaddingDesktop = AppSpacing.lg;
  static const double pagePaddingMobile = AppSpacing.md;

  static bool isMobile(double width) => width < mobileBreakpoint;
  static bool isTablet(double width) =>
      width >= mobileBreakpoint && width < tabletBreakpoint;

  static EdgeInsetsDirectional pagePadding(double width) {
    final horizontal =
        isMobile(width) ? pagePaddingMobile : pagePaddingDesktop;
    final top = isMobile(width) ? AppSpacing.md : AppSpacing.lg;
    return EdgeInsetsDirectional.fromSTEB(horizontal, top, horizontal, 0);
  }

  static double sectionGap(double width) =>
      isMobile(width) ? sectionGapMobile : sectionGapDesktop;

  static int discoveryColumns(double width) {
    if (width >= largeDesktopBreakpoint) return 4;
    if (width >= tabletBreakpoint) return 3;
    if (width >= mobileBreakpoint) return 2;
    if (width >= 380) return 2;
    return 1;
  }
}

/// Shared surface/border/selection colors for discovery controls.
abstract final class LearnerDiscoveryStyle {
  static Color pageBackground(BuildContext context) =>
      AppThemeColors.of(context).pageBackground;

  static Color cardSurface(BuildContext context) =>
      AppThemeColors.of(context).cardSurface;

  static Color inputSurface(BuildContext context) =>
      AppThemeColors.of(context).surfaceElevated;

  static Color border(BuildContext context) =>
      AppThemeColors.of(context).borderSubtle;

  static Color borderStrong(BuildContext context) =>
      AppThemeColors.of(context).borderStrong;

  static Color primary(BuildContext context) =>
      AppThemeColors.of(context).primary;

  static Color primarySoft(BuildContext context) =>
      AppThemeColors.of(context).primarySoft;

  static Color textPrimary(BuildContext context) =>
      AppThemeColors.of(context).textPrimary;

  static Color textSecondary(BuildContext context) =>
      AppThemeColors.of(context).textSecondary;

  static Color textMuted(BuildContext context) =>
      AppThemeColors.of(context).textMuted;

  static Color textOnPrimary(BuildContext context) =>
      AppThemeColors.of(context).textOnPrimary;

  static Color ctaSurface(BuildContext context) =>
      AppThemeColors.of(context).primarySoft;

  static List<BoxShadow> cardShadow(BuildContext context) {
    final shadow = AppThemeColors.of(context).shadow;
    return [
      BoxShadow(
        color: shadow.withValues(alpha: 0.06),
        blurRadius: 16,
        offset: const Offset(0, 6),
      ),
    ];
  }

  static BoxDecoration cardDecoration(BuildContext context) {
    return BoxDecoration(
      color: cardSurface(context),
      borderRadius: AppRadius.lgAll,
      border: Border.all(color: border(context)),
      boxShadow: cardShadow(context),
    );
  }

  static BoxDecoration softPanelDecoration(BuildContext context) {
    return BoxDecoration(
      color: ctaSurface(context),
      borderRadius: AppRadius.lgAll,
      border: Border.all(color: border(context)),
    );
  }
}
