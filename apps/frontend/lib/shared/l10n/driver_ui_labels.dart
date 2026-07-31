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
}
