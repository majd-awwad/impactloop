import '../../l10n/app_localizations.dart';
import '../location/current_location_service.dart';

/// Maps driver portal enum codes (failure reasons, transport, closure) to ARB keys.
class DriverUiLabels {
  const DriverUiLabels(this.l10n);

  final AppLocalizations l10n;

  String failurePickupReason(String code) =>
      switch (code.trim().toUpperCase()) {
        'SUPPLIER_UNAVAILABLE' => l10n.driverFailureSupplierUnavailable,
        'MATERIAL_NOT_READY' => l10n.driverFailureMaterialNotReady,
        'LOCATION_ISSUE' => l10n.driverFailureLocationIssue,
        'OTHER' => l10n.other,
        _ => l10n.unknownStatus,
      };

  String partialPickupUnpickedReason(String code) =>
      switch (code.trim().toUpperCase()) {
        'MATERIAL_NOT_READY' => l10n.driverPartialPickupReasonMaterialNotReady,
        'MATERIAL_MISSING' => l10n.driverPartialPickupReasonMaterialMissing,
        'WRONG_ITEM' => l10n.driverPartialPickupReasonWrongItem,
        'QUANTITY_MISMATCH' => l10n.driverPartialPickupReasonQuantityMismatch,
        'DAMAGED_ITEM' => l10n.driverPartialPickupReasonDamagedItem,
        'SUPPLIER_REFUSED_HANDOVER' =>
          l10n.driverPartialPickupReasonSupplierRefused,
        'OTHER' => l10n.driverPartialPickupReasonOther,
        _ => l10n.unknownStatus,
      };

  String failureDeliveryReason(String code) =>
      switch (code.trim().toUpperCase()) {
        'LEARNER_UNAVAILABLE' => l10n.driverFailureLearnerUnavailable,
        'ADDRESS_ISSUE' => l10n.driverFailureAddressIssue,
        'ACCESS_ISSUE' => l10n.driverFailureAccessIssue,
        'OTHER' => l10n.other,
        _ => l10n.unknownStatus,
      };

  String inactiveClosureReason(String? code) {
    if (code == null || code.trim().isEmpty) {
      return l10n.unknownStatus;
    }

    return switch (code.trim().toUpperCase()) {
      'MOVED_TO_ADMIN_REVIEW' => l10n.driverInactiveMovedToAdminReview,
      'NO_LONGER_ACTIVE' => l10n.driverInactiveNoLongerActive,
      _ => l10n.unknownStatus,
    };
  }

  String transportType(String code) => switch (code.trim().toUpperCase()) {
    'CAR' => l10n.driverTransportCar,
    'MOTORCYCLE' => l10n.driverTransportMotorcycle,
    'BICYCLE' => l10n.driverTransportBicycle,
    'WALKING' => l10n.driverTransportWalking,
    _ => l10n.unknownStatus,
  };

  String locationFailure(CurrentLocationFailure failure) => switch (failure) {
    CurrentLocationFailure.permissionDenied ||
    CurrentLocationFailure.permissionDeniedForever =>
      l10n.driverLocationPermissionDenied,
    CurrentLocationFailure.serviceDisabled =>
      l10n.driverLocationServicesDisabled,
    CurrentLocationFailure.timeout ||
    CurrentLocationFailure.unsupported ||
    CurrentLocationFailure.unavailable => l10n.driverCurrentLocationFailed,
  };

  String locationError(Object error) {
    if (error is CurrentLocationException) {
      return locationFailure(error.failure);
    }
    return l10n.driverCouldNotShareLocation;
  }

  String partyDisplayName(String? raw) {
    final value = raw?.trim() ?? '';
    return value.isEmpty ? l10n.driverUnknownParty : value;
  }

  String locationSummary(String rawSummary) {
    final value = rawSummary.trim();
    return value.isEmpty ? l10n.driverLocationUnavailableShort : value;
  }

  String groupedItemsCount(int count) => l10n.driverGroupedItemsCount(count);

  String materialTitle(String? raw) {
    final value = raw?.trim() ?? '';
    return value.isEmpty ? l10n.material : value;
  }

  String assignmentOutcome(String code) => switch (code.toUpperCase()) {
    'MOVED_TO_ADMIN_REVIEW' => l10n.driverOutcomeAdminReview,
    'REASSIGNED' => l10n.driverOutcomeReassigned,
    'RELEASED_TO_POOL' => l10n.driverOutcomeReleased,
    _ => l10n.driverOutcomeClosed,
  };

  String incidentReviewStatus(String code) => switch (code.toUpperCase()) {
    'PENDING_REVIEW' => l10n.driverReviewPending,
    'VERIFIED' => l10n.driverReviewVerified,
    'REJECTED' => l10n.driverReviewRejected,
    'RESOLVED_NO_STRIKE' => l10n.driverReviewResolvedNoStrike,
    _ => l10n.unknownStatus,
  };

  String incidentType(String code) => switch (code.toUpperCase()) {
    'PICKUP_FAILED' => l10n.driverIncidentPickupFailed,
    'DELIVERY_FAILED' => l10n.driverIncidentDeliveryFailed,
    'DRIVER_ISSUE' => l10n.driverIncidentDriverIssue,
    _ => l10n.unknownStatus,
  };

  String incidentReason(String code) {
    final normalized = code.toUpperCase();
    if (normalized == 'LEARNER_UNAVAILABLE' ||
        normalized == 'ADDRESS_ISSUE' ||
        normalized == 'ACCESS_ISSUE') {
      return failureDeliveryReason(normalized);
    }
    if (partialPickupUnpickedReasons.contains(normalized)) {
      return partialPickupUnpickedReason(normalized);
    }
    return failurePickupReason(normalized);
  }

  String incidentOutcome(String code) => switch (code.toUpperCase()) {
    'SUPPLIER_RESCHEDULE_REQUESTED' => l10n.driverOutcomeSupplierReschedule,
    'REPLACEMENT_WINDOW_SUBMITTED' => l10n.driverOutcomeReplacementSubmitted,
    'RESERVATION_REGROUPED' => l10n.driverOutcomeRegrouped,
    'RESERVATION_CANCELLED_OR_EXPIRED' => l10n.driverOutcomeCancelledExpired,
    'PENDING_RECOVERY' => l10n.driverOutcomePendingRecovery,
    _ => l10n.driverOutcomeNoUpdate,
  };
}

const partialPickupUnpickedReasons = {
  'MATERIAL_NOT_READY',
  'MATERIAL_MISSING',
  'WRONG_ITEM',
  'QUANTITY_MISMATCH',
  'DAMAGED_ITEM',
  'SUPPLIER_REFUSED_HANDOVER',
};
