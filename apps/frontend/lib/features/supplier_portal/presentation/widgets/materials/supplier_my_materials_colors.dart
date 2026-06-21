import 'package:flutter/material.dart';

import '../../theme/supplier_theme_extension.dart';

/// Semantic colors for Supplier My Materials page only.
abstract final class SupplierMyMaterialsColors {
  static const Color lightTeal = Color(0xFF0F766E);
  static const Color lightTealStrong = Color(0xFF0D9488);
  static const Color lightTealDark = Color(0xFF115E59);
  static const Color lightBlue = Color(0xFF2563EB);
  static const Color lightBlueDark = Color(0xFF1D4ED8);
  static const Color lightAmber = Color(0xFFB45309);
  static const Color lightAmberDark = Color(0xFF92400E);
  static const Color lightRed = Color(0xFFB91C1C);
  static const Color lightRedDark = Color(0xFF991B1B);
  static const Color lightGreen = Color(0xFF047857);
  static const Color lightGreenDark = Color(0xFF065F46);

  static Color statTotal(BuildContext context) =>
      context.supplierColors.isDark ? const Color(0xFF5EEAD4) : lightTealDark;

  static Color statAvailable(BuildContext context) =>
      context.supplierColors.isDark ? const Color(0xFF34D399) : lightGreen;

  static Color statPending(BuildContext context) =>
      context.supplierColors.isDark ? const Color(0xFFFBBF24) : lightAmber;

  static Color statReserved(BuildContext context) =>
      context.supplierColors.isDark ? const Color(0xFF60A5FA) : lightBlue;

  static Color statReused(BuildContext context) =>
      context.supplierColors.isDark ? const Color(0xFF60A5FA) : lightBlue;

  static Color statUnavailable(BuildContext context) =>
      context.supplierColors.isDark ? const Color(0xFFF87171) : lightRed;

  static Color statBackground(BuildContext context, Color accent) {
    if (context.supplierColors.isDark) {
      return accent.withValues(alpha: 0.14);
    }
    return accent.withValues(alpha: 0.12);
  }

  static Color statBorder(BuildContext context, Color accent) {
    if (context.supplierColors.isDark) {
      return accent.withValues(alpha: 0.4);
    }
    return accent.withValues(alpha: 0.32);
  }

  static Color chipUnselectedBackground(BuildContext context, Color accent) {
    if (context.supplierColors.isDark) {
      return accent.withValues(alpha: 0.12);
    }
    return accent.withValues(alpha: 0.1);
  }

  static Color chipUnselectedBorder(BuildContext context, Color accent) {
    if (context.supplierColors.isDark) {
      return accent.withValues(alpha: 0.45);
    }
    return accent.withValues(alpha: 0.55);
  }

  static Color chipUnselectedText(BuildContext context, Color accent) {
    if (context.supplierColors.isDark) {
      return accent;
    }
    return darkenForLightMode(accent);
  }

  static Color chipSelectedBackground(BuildContext context, Color accent) {
    if (context.supplierColors.isDark) {
      return darkenForDarkMode(accent);
    }
    return darkenForLightMode(accent);
  }

  static Color chipSelectedBorder(BuildContext context, Color accent) {
    return chipSelectedBackground(context, accent);
  }

  static Color chipSelectedText(BuildContext context, Color accent) {
    return Colors.white;
  }

  static ButtonStyle manageButtonStyle(BuildContext context) {
    final accent = context.supplierColors.isDark
        ? context.supplierColors.accent
        : lightTealDark;

    return FilledButton.styleFrom(
      backgroundColor: accent,
      foregroundColor: Colors.white,
      minimumSize: const Size(0, 40),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
    );
  }

  static ButtonStyle editButtonStyle(BuildContext context) {
    final accent = context.supplierColors.isDark
        ? context.supplierColors.accent
        : lightTeal;

    return OutlinedButton.styleFrom(
      foregroundColor: accent,
      minimumSize: const Size(0, 40),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      side: BorderSide(color: accent, width: 1.5),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
    );
  }

  static Color darkenForLightMode(Color accent) {
    if (accent == lightBlue || accent == const Color(0xFF60A5FA)) {
      return lightBlueDark;
    }
    if (accent == lightAmber || accent == const Color(0xFFFBBF24)) {
      return lightAmberDark;
    }
    if (accent == lightRed || accent == const Color(0xFFF87171)) {
      return lightRedDark;
    }
    if (accent == lightGreen || accent == const Color(0xFF34D399)) {
      return lightGreenDark;
    }
    if (accent == lightTealStrong) {
      return lightTealDark;
    }
    return lightTealDark;
  }

  static Color darkenForDarkMode(Color accent) {
    if (accent == const Color(0xFFFBBF24)) {
      return const Color(0xFFD97706);
    }
    if (accent == const Color(0xFF34D399)) {
      return const Color(0xFF059669);
    }
    if (accent == const Color(0xFF60A5FA)) {
      return const Color(0xFF2563EB);
    }
    if (accent == const Color(0xFFF87171)) {
      return const Color(0xFFDC2626);
    }
    if (accent == const Color(0xFF5EEAD4)) {
      return const Color(0xFF0F766E);
    }
    if (accent == const Color(0xFF2DD4BF)) {
      return const Color(0xFF0D9488);
    }
    return const Color(0xFF0F766E);
  }
}
