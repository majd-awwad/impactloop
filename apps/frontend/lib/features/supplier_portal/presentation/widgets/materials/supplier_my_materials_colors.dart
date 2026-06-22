import 'package:flutter/material.dart';

import '../../../../../app/theme/app_color_tokens.dart';
import '../../theme/supplier_theme_extension.dart';

/// Semantic colors for Supplier My Materials page only.
abstract final class SupplierMyMaterialsColors {
  static const Color lightTeal = AppColorTokens.teal;
  static const Color lightTealStrong = AppColorTokens.supplierLightAccentMuted;
  static const Color lightTealDark = AppColorTokens.supplierLightBorderFocused;
  static const Color lightBlue = AppColorTokens.supplierLightBlue;
  static const Color lightBlueDark = AppColorTokens.supplierLightBlueDark;
  static const Color lightAmber = AppColorTokens.supplierLightAmber;
  static const Color lightAmberDark = AppColorTokens.supplierLightAmberDark;
  static const Color lightRed = AppColorTokens.supplierLightError;
  static const Color lightRedDark = AppColorTokens.supplierLightRedDark;
  static const Color lightGreen = AppColorTokens.forest;
  static const Color lightGreenDark = AppColorTokens.supplierLightGreenDark;

  static Color statTotal(BuildContext context) =>
      context.supplierColors.isDark
          ? AppColorTokens.supplierDashboardAvailable
          : lightTealDark;

  static Color statAvailable(BuildContext context) =>
      context.supplierColors.isDark
          ? AppColorTokens.supplierDashboardCompleted
          : lightGreen;

  static Color statPending(BuildContext context) =>
      context.supplierColors.isDark
          ? AppColorTokens.supplierDashboardPending
          : lightAmber;

  static Color statReserved(BuildContext context) =>
      context.supplierColors.isDark
          ? AppColorTokens.supplierDashboardReserved
          : lightBlue;

  static Color statReused(BuildContext context) =>
      context.supplierColors.isDark
          ? AppColorTokens.supplierDashboardReserved
          : lightBlue;

  static Color statUnavailable(BuildContext context) =>
      context.supplierColors.isDark
          ? AppColorTokens.supplierDashboardUnavailable
          : lightRed;

  static Color statBackground(BuildContext context, Color accent) {
    return accent.withValues(alpha: context.supplierColors.isDark ? 0.14 : 0.12);
  }

  static Color statBorder(BuildContext context, Color accent) {
    return accent.withValues(alpha: context.supplierColors.isDark ? 0.4 : 0.32);
  }

  static Color chipUnselectedBackground(BuildContext context, Color accent) {
    return accent.withValues(alpha: context.supplierColors.isDark ? 0.12 : 0.1);
  }

  static Color chipUnselectedBorder(BuildContext context, Color accent) {
    return accent.withValues(alpha: context.supplierColors.isDark ? 0.45 : 0.55);
  }

  static Color chipUnselectedText(BuildContext context, Color accent) {
    return context.supplierColors.isDark ? accent : darkenForLightMode(accent);
  }

  static Color chipSelectedBackground(BuildContext context, Color accent) {
    return context.supplierColors.isDark
        ? darkenForDarkMode(accent)
        : darkenForLightMode(accent);
  }

  static Color chipSelectedBorder(BuildContext context, Color accent) {
    return chipSelectedBackground(context, accent);
  }

  static Color chipSelectedText(BuildContext context, Color accent) {
    return context.supplierColors.textOnAccent;
  }

  static ButtonStyle manageButtonStyle(BuildContext context) {
    final accent =
        context.supplierColors.isDark ? context.supplierColors.accent : lightTealDark;

    return FilledButton.styleFrom(
      backgroundColor: accent,
      foregroundColor: context.supplierColors.textOnAccent,
      minimumSize: const Size(0, 40),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
    );
  }

  static ButtonStyle editButtonStyle(BuildContext context) {
    final accent =
        context.supplierColors.isDark ? context.supplierColors.accent : lightTeal;

    return OutlinedButton.styleFrom(
      foregroundColor: accent,
      minimumSize: const Size(0, 40),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      side: BorderSide(color: accent, width: 1.5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
    );
  }

  static ButtonStyle deleteButtonStyle(BuildContext context, {bool enabled = true}) {
    final accent =
        context.supplierColors.isDark ? lightRed : lightRedDark;

    return OutlinedButton.styleFrom(
      foregroundColor: enabled ? accent : accent.withValues(alpha: 0.45),
      minimumSize: const Size(0, 40),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      side: BorderSide(
        color: enabled ? accent : accent.withValues(alpha: 0.35),
        width: 1.5,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
    );
  }

  static Color darkenForLightMode(Color accent) {
    if (accent == lightBlue || accent == AppColorTokens.supplierDashboardReserved) {
      return lightBlueDark;
    }
    if (accent == lightAmber || accent == AppColorTokens.supplierDashboardPending) {
      return lightAmberDark;
    }
    if (accent == lightRed || accent == AppColorTokens.supplierDashboardUnavailable) {
      return lightRedDark;
    }
    if (accent == lightGreen || accent == AppColorTokens.supplierDashboardCompleted) {
      return lightGreenDark;
    }
    if (accent == lightTealStrong) {
      return lightTealDark;
    }
    return lightTealDark;
  }

  static Color darkenForDarkMode(Color accent) {
    if (accent == AppColorTokens.supplierDashboardPending) {
      return AppColorTokens.supplierDarkenAmber;
    }
    if (accent == AppColorTokens.supplierDashboardCompleted) {
      return AppColorTokens.supplierDarkenGreen;
    }
    if (accent == AppColorTokens.supplierDashboardReserved) {
      return AppColorTokens.supplierLightBlue;
    }
    if (accent == AppColorTokens.supplierDashboardUnavailable) {
      return AppColorTokens.supplierDarkenRed;
    }
    if (accent == AppColorTokens.supplierDashboardAvailable) {
      return AppColorTokens.teal;
    }
    if (accent == AppColorTokens.supplierDashboardReused) {
      return AppColorTokens.supplierLightAccentMuted;
    }
    return AppColorTokens.teal;
  }
}
