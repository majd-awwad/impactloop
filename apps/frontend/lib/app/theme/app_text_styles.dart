import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Typography tokens for ImpactLoop.
///
/// Mobile sizes stay compact so learner cards and headers do not dominate
/// the screen. Arabic uses the same tokens; optical size is corrected at the
/// theme / text-scaler layer because Noto Sans Arabic reads larger than Latin.
abstract final class AppTextStyles {
  static const double compactBreakpoint = 600;

  static bool isCompact(BuildContext context) =>
      MediaQuery.sizeOf(context).width < compactBreakpoint;

  static TextStyle display(BuildContext context) {
    final compact = isCompact(context);
    return Theme.of(context).textTheme.headlineMedium!.copyWith(
      color: AppColors.textPrimary,
      fontWeight: FontWeight.w800,
      letterSpacing: 0,
      fontSize: compact ? 24 : 28,
      height: 1.2,
    );
  }

  static TextStyle title(BuildContext context) {
    final compact = isCompact(context);
    return Theme.of(context).textTheme.titleLarge!.copyWith(
      color: AppColors.textPrimary,
      fontWeight: FontWeight.w700,
      letterSpacing: 0,
      fontSize: compact ? 20 : 22,
      height: 1.2,
    );
  }

  static TextStyle subtitle(BuildContext context) {
    final compact = isCompact(context);
    return Theme.of(context).textTheme.bodyLarge!.copyWith(
      color: AppColors.textSecondary,
      letterSpacing: 0,
      fontSize: compact ? 15 : 16,
      height: 1.3,
    );
  }

  static TextStyle body(BuildContext context) {
    return Theme.of(context).textTheme.bodyMedium!.copyWith(
      color: AppColors.textPrimary,
      letterSpacing: 0,
      fontSize: 14,
      height: 1.4,
    );
  }

  static TextStyle label(BuildContext context) {
    return Theme.of(context).textTheme.labelLarge!.copyWith(
      color: AppColors.textPrimary,
      fontWeight: FontWeight.w600,
      letterSpacing: 0,
      fontSize: 13,
      height: 1.25,
    );
  }

  static TextStyle link(BuildContext context) {
    return Theme.of(context).textTheme.labelLarge!.copyWith(
      color: AppColors.link,
      fontWeight: FontWeight.w600,
      letterSpacing: 0,
    );
  }

  static TextStyle brandingTitle(BuildContext context) {
    return Theme.of(context).textTheme.headlineLarge!.copyWith(
      color: AppColors.textOnBrand,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.8,
    );
  }

  static TextStyle brandingHeadline(BuildContext context) {
    return Theme.of(context).textTheme.headlineMedium!.copyWith(
      color: AppColors.textOnBrand,
      fontWeight: FontWeight.w700,
      height: 1.15,
    );
  }

  static TextStyle brandingSubtitle(BuildContext context) {
    return Theme.of(context).textTheme.titleMedium!.copyWith(
      color: AppColors.textOnBrandMuted,
      fontWeight: FontWeight.w400,
      height: 1.45,
    );
  }

  static TextStyle badgeLabel(BuildContext context) {
    return Theme.of(context).textTheme.labelLarge!.copyWith(
      color: AppColors.textOnBrand,
      fontWeight: FontWeight.w600,
      fontSize: 13,
      height: 1.2,
      letterSpacing: 0,
    );
  }

  static TextStyle mobileHeroTitle(BuildContext context) {
    return Theme.of(context).textTheme.titleLarge!.copyWith(
      color: AppColors.textOnBrand,
      fontWeight: FontWeight.w800,
      fontSize: 22,
      height: 1.2,
      letterSpacing: 0,
    );
  }

  static TextStyle mobileHeroSubtitle(BuildContext context) {
    return Theme.of(context).textTheme.bodyMedium!.copyWith(
      color: AppColors.textOnBrandMuted,
      fontSize: 14,
      height: 1.35,
      letterSpacing: 0,
    );
  }
}
