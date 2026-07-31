import 'package:flutter/widgets.dart';

import 'app_localizations.dart';
import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

export 'app_localizations.dart';

extension AppLocalizationsContext on BuildContext {
  AppLocalizations get l10n {
    final localized = Localizations.of<AppLocalizations>(
      this,
      AppLocalizations,
    );
    if (localized != null) return localized;

    return isArabic ? AppLocalizationsAr() : AppLocalizationsEn();
  }

  bool get isArabic => Localizations.maybeLocaleOf(this)?.languageCode == 'ar';
}
