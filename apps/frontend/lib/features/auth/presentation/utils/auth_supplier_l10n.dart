import '../../../../l10n/app_localizations.dart';

String localizedSupplierType(AppLocalizations l10n, String supplierType) {
  return switch (supplierType) {
    'Student supplier' => l10n.supplierStudentSupplier,
    'Individual supplier' => l10n.supplierIndividualSupplier,
    'Workshop' => l10n.supplierWorkshop,
    'Factory' => l10n.supplierFactory,
    'Educational institution' => l10n.supplierEducationalInstitution,
    _ => supplierType,
  };
}

String localizedSupplierTypeDescription(
  AppLocalizations l10n,
  String supplierType,
) {
  return switch (supplierType) {
    'Student supplier' => l10n.supplierStudentSupplierDescription,
    'Individual supplier' => l10n.supplierIndividualSupplierDescription,
    'Workshop' => l10n.supplierWorkshopSupplierDescription,
    'Factory' => l10n.supplierFactorySupplierDescription,
    'Educational institution' =>
      l10n.supplierEducationalInstitutionSupplierDescription,
    _ => l10n.supplierChooseSupplierTypeFallback,
  };
}
