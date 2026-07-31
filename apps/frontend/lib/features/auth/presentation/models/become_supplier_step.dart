import '../../../../l10n/app_localizations.dart';

enum BecomeSupplierStep {
  supplierType,
  profile,
  location,
  pickupDetails,
  verification,
  review,
}

extension BecomeSupplierStepLabels on BecomeSupplierStep {
  String title(AppLocalizations l10n) => switch (this) {
    BecomeSupplierStep.supplierType => l10n.supplierSupplierType,
    BecomeSupplierStep.profile => l10n.supplierProfile,
    BecomeSupplierStep.location => l10n.pickupArea,
    BecomeSupplierStep.pickupDetails => l10n.supplierPickupDetails,
    BecomeSupplierStep.verification => l10n.supplierVerification,
    BecomeSupplierStep.review => l10n.review,
  };

  String subtitle(AppLocalizations l10n) => switch (this) {
    BecomeSupplierStep.supplierType =>
      l10n.becomeSupplierStepSupplierTypeSubtitle,
    BecomeSupplierStep.profile => l10n.becomeSupplierStepProfileSubtitle,
    BecomeSupplierStep.location => l10n.becomeSupplierStepLocationSubtitle,
    BecomeSupplierStep.pickupDetails =>
      l10n.becomeSupplierStepPickupDetailsSubtitle,
    BecomeSupplierStep.verification =>
      l10n.becomeSupplierStepVerificationSubtitle,
    BecomeSupplierStep.review => l10n.becomeSupplierStepReviewSubtitle,
  };
}

const becomeSupplierSteps = [
  BecomeSupplierStep.supplierType,
  BecomeSupplierStep.profile,
  BecomeSupplierStep.location,
  BecomeSupplierStep.pickupDetails,
  BecomeSupplierStep.verification,
  BecomeSupplierStep.review,
];
