import 'package:flutter/material.dart';

import 'auth_dark_colors.dart';

abstract final class AuthDarkTextStyles {
  static TextStyle display(BuildContext context) => TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w700,
    height: 1.2,
    color: AuthDarkColors.textPrimary,
    letterSpacing: 0,
  );

  static TextStyle title(BuildContext context) => TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w600,
    height: 1.25,
    color: AuthDarkColors.textPrimary,
  );

  static TextStyle subtitle(BuildContext context) => TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w400,
    height: 1.5,
    color: AuthDarkColors.textSecondary,
  );

  static TextStyle body(BuildContext context) => TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    height: 1.45,
    color: AuthDarkColors.textSecondary,
  );

  static TextStyle label(BuildContext context) => TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: AuthDarkColors.textSecondary,
  );

  static TextStyle link(BuildContext context) => TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AuthDarkColors.link,
  );

  static TextStyle chip(BuildContext context) => TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w500,
    color: AuthDarkColors.textPrimary,
  );

  static TextStyle brandingHeadline(BuildContext context) => TextStyle(
    fontSize: 36,
    fontWeight: FontWeight.w700,
    height: 1.15,
    color: AuthDarkColors.textPrimary,
    letterSpacing: 0,
  );

  static TextStyle brandingSubtitle(BuildContext context) => TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    height: 1.55,
    color: AuthDarkColors.textSecondary,
  );

  static TextStyle navBrand(BuildContext context) => TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w700,
    color: AuthDarkColors.textPrimary,
  );

  static TextStyle sectionTitle(BuildContext context) => TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: AuthDarkColors.accent,
  );
}
