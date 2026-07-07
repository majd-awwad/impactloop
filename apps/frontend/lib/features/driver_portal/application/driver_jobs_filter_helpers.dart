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

  return const DriverAvailableJobsFilter();
}

bool hasUsableRadiusReference(DriverDeliveriesListMeta? meta) {
  return meta?.driverHasRecentLocation == true;
}

String driverLocationSummary(DriverDeliveriesListMeta? meta) {
  if (meta == null) {
    return 'Loading location…';
  }

  if (meta.driverHasRecentLocation) {
    return 'Using your current location';
  }

  final city = normalizeProfileField(meta.driverProfileCity);
  final area = distinctProfileArea(meta.driverProfileArea, city);

  if (area != null && city != null) {
    return 'Using profile area: $area, $city';
  }
  if (city != null) {
    return 'Using profile area: $city';
  }
  if (area != null) {
    return 'Using profile area: $area';
  }

  return 'Location unavailable — showing all available jobs';
}

String searchRadiusLabel({
  required bool anyDistance,
  required double radiusKm,
}) {
  if (anyDistance) {
    return 'Search radius: Any distance';
  }

  return 'Search radius: Within ${radiusKm.round()} km';
}

String distanceFromYouLabel(double? distanceKm) {
  if (distanceKm == null || !distanceKm.isFinite) {
    return 'Pickup distance unavailable';
  }

  final rounded = distanceKm < 10
      ? (distanceKm * 10).round() / 10
      : distanceKm.round().toDouble();

  final formatted = rounded == rounded.roundToDouble()
      ? rounded.toInt().toString()
      : rounded.toStringAsFixed(1);

  return '$formatted km to pickup';
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

String _jobsLabel(int count) => count == 1 ? '1 job is' : '$count jobs are';

AvailableJobsEmptyStateCopy availableJobsEmptyStateCopy({
  required DriverAvailableJobsFilter filter,
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
        title: 'No jobs within $label km.',
        subtitle:
            '${_jobsLabel(outside)} available outside your current radius. Try increasing the radius or choosing Any distance.',
        showIncreaseRadius: true,
        showAnyDistance: true,
        showReset: true,
      );
    }

    return AvailableJobsEmptyStateCopy(
      title: 'No jobs within $label km.',
      subtitle: 'Try increasing the radius or choosing Any distance.',
      showIncreaseRadius: true,
      showAnyDistance: true,
      showReset: true,
    );
  }

  if (filter.city != null || filter.area != null) {
    if (total > 0) {
      return AvailableJobsEmptyStateCopy(
        title: 'No jobs found in this area.',
        subtitle:
            '${_jobsLabel(total)} available with broader filters. Try all areas or reset filters.',
        showReset: true,
      );
    }

    return const AvailableJobsEmptyStateCopy(
      title: 'No jobs found in this area.',
      subtitle: 'Try all areas or reset filters.',
      showReset: true,
    );
  }

  return const AvailableJobsEmptyStateCopy(
    title: 'No available jobs near you right now.',
    subtitle: 'Try changing the city, area, or distance filter.',
    showReset: false,
  );
}

int radiusStepIndex(double? radiusKm) {
  if (radiusKm == null) {
    return DriverJobsFilterConstants.radiusStepsKm
        .indexOf(DriverJobsFilterConstants.defaultRadiusKm);
  }

  final index = DriverJobsFilterConstants.radiusStepsKm.indexOf(radiusKm);
  if (index >= 0) {
    return index;
  }

  return DriverJobsFilterConstants.radiusStepsKm
      .indexOf(DriverJobsFilterConstants.defaultRadiusKm);
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
