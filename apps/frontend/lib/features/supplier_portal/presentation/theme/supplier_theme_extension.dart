import 'package:flutter/material.dart';

import 'supplier_decoration_set.dart';
import 'supplier_text_styles.dart';
import 'supplier_ui_palette.dart';
import '../l10n/supplier_l10n.dart';
import '../theme/supplier_locale_scope.dart';

export '../l10n/supplier_l10n.dart';
export 'supplier_color_scheme.dart';
export 'supplier_decoration_set.dart';
export 'supplier_ui_palette.dart';

extension SupplierThemeX on BuildContext {
  SupplierUiPalette get supplierColors => SupplierUiPalette.of(this);

  SupplierDecorationSet get supplierDecorations =>
      SupplierDecorationSet(supplierColors);

  bool get isSupplierArabic => supplierLanguageCode == 'ar';

  String get supplierLanguageCode {
    final scope = SupplierLocaleScope.maybeOf(this);
    if (scope != null) return scope.languageCode;
    return Localizations.localeOf(this).languageCode;
  }

  TextDirection get supplierTextDirection =>
      isSupplierArabic ? TextDirection.rtl : TextDirection.ltr;

  SupplierL10n get s => SupplierL10n.of(this, supplierLanguageCode);

  TextStyle supplierDisplay() =>
      SupplierTextStyles.display(this, supplierColors);

  TextStyle supplierTitle() => SupplierTextStyles.title(this, supplierColors);

  TextStyle supplierSubtitle() =>
      SupplierTextStyles.subtitle(this, supplierColors);

  TextStyle supplierBody() => SupplierTextStyles.body(this, supplierColors);

  TextStyle supplierLabel() => SupplierTextStyles.label(this, supplierColors);

  TextStyle supplierLink() => SupplierTextStyles.link(this, supplierColors);

  TextStyle supplierChip() => SupplierTextStyles.chip(this, supplierColors);

  TextStyle supplierNavBrand() =>
      SupplierTextStyles.navBrand(this, supplierColors);

  TextStyle supplierSectionTitle() =>
      SupplierTextStyles.sectionTitle(this, supplierColors);
}
