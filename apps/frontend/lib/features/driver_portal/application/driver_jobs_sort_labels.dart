import '../../../../l10n/app_localizations.dart';

/// Localized label for Driver available-jobs sort chip values.
String driverJobsSortChipLabel(AppLocalizations l10n, String sortBy) {
  return switch (sortBy.trim()) {
    'nearest' => l10n.driverNearest,
    'newest' => l10n.driverNewest,
    _ => sortBy,
  };
}
