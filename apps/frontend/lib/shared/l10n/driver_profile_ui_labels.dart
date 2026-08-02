import '../../features/driver_portal/data/models/driver_operational_profile.dart';
import '../../l10n/app_localizations.dart';

String driverProfileStatusLabel(
  AppLocalizations l10n,
  DriverProfileStatus status,
) {
  return switch (status) {
    DriverProfileStatus.active => l10n.driverProfileStatusActive,
    DriverProfileStatus.inactive => l10n.driverProfileStatusInactive,
    DriverProfileStatus.suspended => l10n.driverProfileStatusSuspended,
    DriverProfileStatus.unknown => l10n.driverProfileStatusUnknown,
  };
}

String driverProfileStatusExplanation(
  AppLocalizations l10n,
  DriverProfileStatus status,
) {
  return switch (status) {
    DriverProfileStatus.active => l10n.driverProfileActiveExplanation,
    DriverProfileStatus.inactive => l10n.driverProfileInactiveExplanation,
    DriverProfileStatus.suspended => l10n.driverProfileSuspendedExplanation,
    DriverProfileStatus.unknown => l10n.driverProfileUnknownExplanation,
  };
}

String driverAvailabilityLabel(
  AppLocalizations l10n,
  DriverOperationalAvailability availability,
) {
  return switch (availability) {
    DriverOperationalAvailability.available => l10n.driverAvailabilityAvailable,
    DriverOperationalAvailability.offline => l10n.driverAvailabilityOffline,
    DriverOperationalAvailability.onDelivery =>
      l10n.driverAvailabilityOnDelivery,
    DriverOperationalAvailability.unknown => l10n.driverAvailabilityUnknown,
  };
}

String driverAvailabilityExplanation(
  AppLocalizations l10n,
  DriverOperationalProfile profile,
) {
  if (!profile.isAdministrativelyActive) {
    return driverProfileStatusExplanation(l10n, profile.status);
  }
  if (profile.availability == DriverOperationalAvailability.onDelivery &&
      profile.acceptingNewJobs == false) {
    return l10n.driverActiveDeliveriesContinueNoOffers;
  }
  if (profile.availability == DriverOperationalAvailability.onDelivery) {
    return l10n.driverOnDeliveryAcceptingExplanation;
  }
  if (profile.availability == DriverOperationalAvailability.available) {
    return l10n.driverAvailableExplanation;
  }
  if (profile.availability == DriverOperationalAvailability.offline) {
    return l10n.driverOfflineExplanation;
  }
  return l10n.driverAvailabilityUnknownExplanation;
}

String driverTransportationLabel(
  AppLocalizations l10n,
  DriverTransportationType transportationType,
) {
  return switch (transportationType) {
    DriverTransportationType.car => l10n.driverTransportationCar,
    DriverTransportationType.motorcycle => l10n.driverTransportationMotorcycle,
    DriverTransportationType.bicycle => l10n.driverTransportationBicycle,
    DriverTransportationType.walking => l10n.driverTransportationWalking,
    DriverTransportationType.unknown => l10n.driverTransportationUnknown,
  };
}
