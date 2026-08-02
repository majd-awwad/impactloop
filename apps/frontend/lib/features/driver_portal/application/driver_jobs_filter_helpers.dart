import '../../../core/format/localized_formatters.dart';
import '../../../l10n/app_localizations.dart';
import '../data/models/driver_deliveries_list_result.dart';

class DriverJobsFilterConstants {
  const DriverJobsFilterConstants._();

  static const radiusStepsKm = [2.0, 5.0, 10.0, 20.0, 30.0];
  static const defaultRadiusKm = 10.0;
}

String? normalizeProfileField(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) {
    return null;
  }
  return trimmed;
}

/// Returns profile area only when it differs from the city (avoids "nablus" / "nablus").
String? distinctProfileArea(String? area, String? city) {
  final normalizedArea = normalizeProfileField(area);
  if (normalizedArea == null) {
    return null;
  }

  final normalizedCity = normalizeProfileField(city);
  if (normalizedCity != null &&
      normalizedArea.toLowerCase() == normalizedCity.toLowerCase()) {
    return null;
  }

  return normalizedArea;
}

bool hasProfileLocation(DriverDeliveriesListMeta? meta) {
  if (meta == null) {
    return false;
  }

  return normalizeProfileField(meta.driverProfileCity) != null ||
      distinctProfileArea(meta.driverProfileArea, meta.driverProfileCity) !=
          null;
}

DriverAvailableJobsFilter profileDefaultFilter(DriverDeliveriesListMeta meta) {
  final hasCoordinates = meta.driverHasRecentLocation;

  // Default load shows all eligible jobs; only seed sort preference.
  return DriverAvailableJobsFilter(
    sortBy: hasCoordinates ? 'nearest' : 'newest',
  );
}

DriverAvailableJobsFilter openJobsFilter(DriverDeliveriesListMeta? meta) {
  if (meta?.driverHasRecentLocation == true) {
    return const DriverAvailableJobsFilter(sortBy: 'nearest');
  }

  return const DriverAvailableJobsFilter(sortBy: 'newest');
}

/// Whether two filters produce the same Available Jobs API query semantics.
///
/// An omitted sortBy is equivalent to the backend default implied by [meta]:
/// nearest when a recent location exists, otherwise newest.
bool availableJobsFiltersApiEquivalent({
  required DriverAvailableJobsFilter previous,
  required DriverAvailableJobsFilter next,
  required DriverDeliveriesListMeta meta,
}) {
  if (previous.city != next.city ||
      previous.area != next.area ||
      previous.maxDistanceKm != next.maxDistanceKm) {
    return false;
  }

  String effectiveSort(DriverAvailableJobsFilter filter) {
    if (filter.sortBy.isNotEmpty) {
      return filter.sortBy;
    }
    return meta.driverHasRecentLocation ? 'nearest' : 'newest';
  }

  return effectiveSort(previous) == effectiveSort(next);
}

bool hasUsableRadiusReference(DriverDeliveriesListMeta? meta) {
  return meta?.driverHasRecentLocation == true;
}

String driverLocationSummary(
  DriverDeliveriesListMeta? meta, {
  required AppLocalizations l10n,
}) {
  if (meta == null) {
    return l10n.driverLoadingLocation;
  }

  if (meta.driverHasRecentLocation) {
    return l10n.driverUsingCurrentLocation;
  }

  final city = normalizeProfileField(meta.driverProfileCity);
  final area = distinctProfileArea(meta.driverProfileArea, city);

  if (area != null && city != null) {
    return l10n.driverUsingProfileArea('$area, $city');
  }
  if (city != null) {
    return l10n.driverUsingProfileArea(city);
  }
  if (area != null) {
    return l10n.driverUsingProfileArea(area);
  }

  return l10n.driverLocationUnavailable;
}

String searchRadiusLabel({
  required bool anyDistance,
  required double radiusKm,
  required AppLocalizations l10n,
}) {
  if (anyDistance) {
    return l10n.driverSearchRadiusAny;
  }

  return l10n.driverSearchRadiusWithin(radiusKm.round());
}

String distanceFromYouLabel(
  double? distanceKm, {
  required AppLocalizations l10n,
}) {
  if (distanceKm == null || !distanceKm.isFinite) {
    return l10n.driverPickupDistanceUnavailable;
  }

  final rounded = distanceKm < 10
      ? (distanceKm * 10).round() / 10
      : distanceKm.round().toDouble();

  final formatters = LocalizedFormatters(l10n);
  final formatted = formatters.number(
    rounded,
    decimalDigits: rounded == rounded.roundToDouble() ? 0 : 1,
  );

  return l10n.driverKmToPickup(formatted);
}

class AvailableJobsEmptyStateCopy {
  const AvailableJobsEmptyStateCopy({
    required this.title,
    required this.subtitle,
    this.showIncreaseRadius = false,
    this.showAnyDistance = false,
    this.showReset = false,
  });

  final String title;
  final String subtitle;
  final bool showIncreaseRadius;
  final bool showAnyDistance;
  final bool showReset;
}

AvailableJobsEmptyStateCopy availableJobsEmptyStateCopy({
  required DriverAvailableJobsFilter filter,
  required AppLocalizations l10n,
  int? nearbyCount,
  int? totalAvailableCount,
}) {
  final nearby = nearbyCount ?? 0;
  final total = totalAvailableCount ?? nearby;

  if (filter.maxDistanceKm != null) {
    final radius = filter.maxDistanceKm!;
    final label = radius == radius.roundToDouble()
        ? radius.toInt().toString()
        : radius.toStringAsFixed(1);

    if (total > nearby) {
      final outside = total - nearby;
      return AvailableJobsEmptyStateCopy(
        title: l10n.driverNoJobsWithinRadius(label),
        subtitle: l10n.driverJobsAvailableOutsideRadius(outside),
        showIncreaseRadius: true,
        showAnyDistance: true,
        showReset: true,
      );
    }

    return AvailableJobsEmptyStateCopy(
      title: l10n.driverNoJobsWithinRadius(label),
      subtitle: l10n.driverTryIncreaseRadius,
      showIncreaseRadius: true,
      showAnyDistance: true,
      showReset: true,
    );
  }

  if (filter.city != null || filter.area != null) {
    if (total > 0) {
      return AvailableJobsEmptyStateCopy(
        title: l10n.driverNoJobsInArea,
        subtitle: l10n.driverJobsAvailableBroaderFilters(total),
        showReset: true,
      );
    }

    return AvailableJobsEmptyStateCopy(
      title: l10n.driverNoJobsInArea,
      subtitle: l10n.driverTryAllAreasOrReset,
      showReset: true,
    );
  }

  return AvailableJobsEmptyStateCopy(
    title: l10n.driverNoJobsNearby,
    subtitle: l10n.driverTryChangeFilters,
    showReset: false,
  );
}

int radiusStepIndex(double? radiusKm) {
  if (radiusKm == null) {
    return DriverJobsFilterConstants.radiusStepsKm.indexOf(
      DriverJobsFilterConstants.defaultRadiusKm,
    );
  }

  final index = DriverJobsFilterConstants.radiusStepsKm.indexOf(radiusKm);
  if (index >= 0) {
    return index;
  }

  return DriverJobsFilterConstants.radiusStepsKm.indexOf(
    DriverJobsFilterConstants.defaultRadiusKm,
  );
}

double radiusKmForStepIndex(int index) {
  final steps = DriverJobsFilterConstants.radiusStepsKm;
  if (index < 0) {
    return steps.first;
  }
  if (index >= steps.length) {
    return steps.last;
  }
  return steps[index];
}
