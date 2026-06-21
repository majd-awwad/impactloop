import 'package:flutter/material.dart';

/// Provides supplier language code to descendants for reliable l10n resolution.
class SupplierLocaleScope extends InheritedWidget {
  const SupplierLocaleScope({
    super.key,
    required this.languageCode,
    required super.child,
  });

  final String languageCode;

  static SupplierLocaleScope? maybeOf(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<SupplierLocaleScope>();
  }

  @override
  bool updateShouldNotify(SupplierLocaleScope oldWidget) {
    return oldWidget.languageCode != languageCode;
  }
}
