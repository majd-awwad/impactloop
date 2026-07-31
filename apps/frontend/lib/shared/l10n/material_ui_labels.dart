import '../../l10n/app_localizations.dart';

/// Maps material condition, source, and lifecycle status enums to ARB keys.
class MaterialUiLabels {
  const MaterialUiLabels(this.l10n);

  final AppLocalizations l10n;

  String condition(String value) => switch (value.trim().toUpperCase()) {
    'NEW' => l10n.conditionNew,
    'LIKE_NEW' => l10n.conditionLikeNew,
    'GOOD' => l10n.conditionGood,
    'USED' => l10n.conditionUsed,
    'NEEDS_REPAIR' => l10n.conditionNeedsRepair,
    _ => l10n.unknownStatus,
  };

  String sourceType(String value) => switch (value.trim().toUpperCase()) {
    'STUDENT_LEFTOVER' => l10n.sourceTypeStudentLeftover,
    'WORKSHOP_SURPLUS' => l10n.sourceTypeWorkshopSurplus,
    'FACTORY_SURPLUS' => l10n.sourceTypeFactorySurplus,
    'EDUCATIONAL_INSTITUTION' => l10n.sourceTypeEducationalInstitution,
    _ => l10n.unknownStatus,
  };

  String materialStatus(String value) => switch (value.trim().toUpperCase()) {
    'AVAILABLE' => l10n.materialStatusAvailable,
    'PENDING_RESERVATION' => l10n.materialStatusPendingReservation,
    'RESERVED' => l10n.materialStatusReserved,
    'REUSED' => l10n.materialStatusReused,
    'UNAVAILABLE' => l10n.materialStatusUnavailable,
    _ => l10n.unknownStatus,
  };
}
