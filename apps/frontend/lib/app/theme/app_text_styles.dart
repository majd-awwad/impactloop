import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Typography tokens for ImpactLoop.
abstract final class AppTextStyles {
  static TextStyle display(BuildContext context) {
    return Theme.of(context).textTheme.headlineMedium!.copyWith(
      color: AppColors.textPrimary,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.5,
    );
  }

  static TextStyle title(BuildContext context) {
    return Theme.of(context).textTheme.titleLarge!.copyWith(
      color: AppColors.textPrimary,
      fontWeight: FontWeight.w700,
    );
  }

  static TextStyle subtitle(BuildContext context) {
    return Theme.of(context).textTheme.bodyLarge!.copyWith(
      color: AppColors.textSecondary,
      height: 1.5,
    );
  }

  static TextStyle body(BuildContext context) {
    return Theme.of(context).textTheme.bodyMedium!.copyWith(
      color: AppColors.textPrimary,
      fontSize: 15,
    );
  }

  static TextStyle label(BuildContext context) {
    return Theme.of(context).textTheme.labelLarge!.copyWith(
      color: AppColors.textPrimary,
      fontWeight: FontWeight.w600,
      fontSize: 14,
    );
  }

  static TextStyle link(BuildContext context) {
    return Theme.of(context).textTheme.labelLarge!.copyWith(
      color: AppColors.link,
      fontWeight: FontWeight.w600,
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
    );
  }

  static TextStyle mobileHeroTitle(BuildContext context) {
    return Theme.of(context).textTheme.titleLarge!.copyWith(
      color: AppColors.textOnBrand,
      fontWeight: FontWeight.w800,
    );
  }

  static TextStyle mobileHeroSubtitle(BuildContext context) {
    return Theme.of(context).textTheme.bodyMedium!.copyWith(
      color: AppColors.textOnBrandMuted,
    );
  }
}
