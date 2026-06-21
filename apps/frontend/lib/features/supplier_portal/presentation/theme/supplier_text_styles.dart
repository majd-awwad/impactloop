import 'package:flutter/material.dart';

import 'supplier_color_scheme.dart';

abstract final class SupplierTextStyles {
  static TextStyle display(BuildContext context, SupplierColorScheme c) =>
      TextStyle(
        fontSize: 32,
        fontWeight: FontWeight.w700,
        height: 1.2,
        color: c.textPrimary,
      );

  static TextStyle title(BuildContext context, SupplierColorScheme c) =>
      TextStyle(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        height: 1.25,
        color: c.textPrimary,
      );

  static TextStyle subtitle(BuildContext context, SupplierColorScheme c) =>
      TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        height: 1.5,
        color: c.textSecondary,
      );

  static TextStyle body(BuildContext context, SupplierColorScheme c) =>
      TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 1.45,
        color: c.textSecondary,
      );

  static TextStyle label(BuildContext context, SupplierColorScheme c) =>
      TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: c.textSecondary,
      );

  static TextStyle link(BuildContext context, SupplierColorScheme c) =>
      TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: c.link,
      );

  static TextStyle chip(BuildContext context, SupplierColorScheme c) =>
      TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w500,
        color: c.textPrimary,
      );

  static TextStyle navBrand(BuildContext context, SupplierColorScheme c) =>
      TextStyle(
        fontSize: 18,
        fontWeight: FontWeight.w700,
        color: c.textPrimary,
      );

  static TextStyle sectionTitle(BuildContext context, SupplierColorScheme c) =>
      TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: c.isDark ? c.accent : c.textPrimary,
      );
}
