import 'package:flutter/material.dart';

import '../../../../app/theme/app_color_tokens.dart';

/// Light-first admin dashboard palette aligned with Supplier Portal tokens.
class AdminPalette {
  const AdminPalette._({
    required this.isDark,
    required this.pageBackground,
    required this.cardBackground,
    required this.cardBorder,
    required this.cardShadow,
    required this.primaryTeal,
    required this.brightTeal,
    required this.green,
    required this.amber,
    required this.red,
    required this.blue,
    required this.purple,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.bannerBackground,
    required this.bannerBorder,
    required this.sidebarBackground,
    required this.sidebarBorder,
    required this.sidebarTextPrimary,
    required this.sidebarTextSecondary,
    required this.sidebarActiveBackground,
    required this.sidebarActiveAccent,
    required this.sidebarAccentSoft,
    required this.topBarBackground,
    required this.chartGrid,
  });

  final bool isDark;
  final Color pageBackground;
  final Color cardBackground;
  final Color cardBorder;
  final Color cardShadow;
  final Color primaryTeal;
  final Color brightTeal;
  final Color green;
  final Color amber;
  final Color red;
  final Color blue;
  final Color purple;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color bannerBackground;
  final Color bannerBorder;
  final Color sidebarBackground;
  final Color sidebarBorder;
  final Color sidebarTextPrimary;
  final Color sidebarTextSecondary;
  final Color sidebarActiveBackground;
  final Color sidebarActiveAccent;
  final Color sidebarAccentSoft;
  final Color topBarBackground;
  final Color chartGrid;

  List<Color> get categoryBarColors => [
        primaryTeal,
        green,
        blue,
        amber,
        purple,
        brightTeal,
        const Color(0xFFEC4899),
        red,
      ];

  // Compatibility aliases for shared admin shell widgets.
  Color get border => cardBorder;
  Color get surface => cardBackground;
  Color get surfaceElevated => cardBackground;
  Color get strongTeal => primaryTeal;
  Color get heroGradientStart => bannerBackground;
  Color get heroGradientEnd => bannerBackground;
  Color get glow => primaryTeal.withValues(alpha: isDark ? 0.16 : 0.1);

  BoxDecoration cardDecoration({Color? accent}) => dashboardCard();
  BoxDecoration accentStripeCard(Color accent, {bool dense = false}) =>
      kpiCard(accent);

  static AdminPalette of(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (isDark) {
      return AdminPalette._(
        isDark: true,
        pageBackground: AppColorTokens.darkBackground,
        cardBackground: AppColorTokens.darkSurfaceElevated,
        cardBorder: AppColorTokens.darkBorderCard.withValues(alpha: 0.72),
        cardShadow: AppColorTokens.supplierDarkCardShadow,
        primaryTeal: AppColorTokens.mintBright,
        brightTeal: AppColorTokens.mint,
        green: AppColorTokens.mint,
        amber: AppColorTokens.amberDark,
        red: AppColorTokens.dangerDark,
        blue: AppColorTokens.blueDark,
        purple: AppColorTokens.supplierDarkPurple,
        textPrimary: AppColorTokens.darkTextPrimary,
        textSecondary: AppColorTokens.darkTextSecondary,
        textMuted: AppColorTokens.darkTextMuted,
        bannerBackground: AppColorTokens.darkPanel,
        bannerBorder: AppColorTokens.darkBorderCard,
        sidebarBackground: AppColorTokens.legacyAuthNavBar,
        sidebarBorder: AppColorTokens.darkBorderCard.withValues(alpha: 0.5),
        sidebarTextPrimary: AppColorTokens.darkTextPrimary,
        sidebarTextSecondary: AppColorTokens.darkTextSecondary,
        sidebarActiveBackground:
            AppColorTokens.legacyAuthAccentSoft.withValues(alpha: 0.16),
        sidebarActiveAccent: AppColorTokens.mintBright,
        sidebarAccentSoft: AppColorTokens.legacyAuthAccentSoft,
        topBarBackground: AppColorTokens.darkSurface,
        chartGrid: AppColorTokens.darkBorderCard.withValues(alpha: 0.55),
      );
    }

    return AdminPalette._(
      isDark: false,
      pageBackground: const Color(0xFFF5F7F3),
      cardBackground: const Color(0xFFFFFFFF),
      cardBorder: const Color(0xFFE5E7EB),
      cardShadow: const Color(0x14000000),
      primaryTeal: const Color(0xFF0F766E),
      brightTeal: const Color(0xFF14B8A6),
      green: const Color(0xFF16A34A),
      amber: const Color(0xFFF59E0B),
      red: const Color(0xFFEF4444),
      blue: const Color(0xFF2563EB),
      purple: const Color(0xFF7C3AED),
      textPrimary: const Color(0xFF111827),
      textSecondary: const Color(0xFF4B5563),
      textMuted: const Color(0xFF9CA3AF),
      bannerBackground: const Color(0xFFFFF7D6),
      bannerBorder: const Color(0xFFFDE68A),
      sidebarBackground: AppColorTokens.legacyAuthNavBar,
      sidebarBorder: AppColorTokens.darkBorderCard.withValues(alpha: 0.45),
      sidebarTextPrimary: AppColorTokens.darkTextPrimary,
      sidebarTextSecondary: AppColorTokens.darkTextSecondary,
      sidebarActiveBackground:
          AppColorTokens.legacyAuthAccentSoft.withValues(alpha: 0.22),
      sidebarActiveAccent: AppColorTokens.mintBright,
      sidebarAccentSoft: AppColorTokens.legacyAuthAccentSoft,
      topBarBackground: const Color(0xFFFFFFFF),
      chartGrid: const Color(0xFFE5E7EB),
    );
  }

  Color statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING':
        return amber;
      case 'ACCEPTED':
        return blue;
      case 'COMPLETED':
        return green;
      case 'REJECTED':
      case 'CANCELLED':
        return red;
      default:
        return textMuted;
    }
  }

  BoxDecoration dashboardCard({Color? accent}) {
    return BoxDecoration(
      color: cardBackground,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: cardBorder),
      boxShadow: [
        BoxShadow(
          color: cardShadow,
          blurRadius: isDark ? 14 : 16,
          offset: Offset(0, isDark ? 5 : 3),
        ),
      ],
    );
  }

  BoxDecoration kpiCard(Color accent) {
    return BoxDecoration(
      color: cardBackground,
      borderRadius: BorderRadius.circular(20),
      border: Border.all(color: cardBorder),
    );
  }
}
