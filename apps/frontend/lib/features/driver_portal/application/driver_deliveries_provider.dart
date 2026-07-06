import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/driver_deliveries_repository.dart';
import '../data/models/driver_deliveries_list_result.dart';
import '../data/models/driver_delivery.dart';
import 'driver_jobs_filter_helpers.dart';

const kInitialDriverJobsFilter = DriverAvailableJobsFilter();

bool isPristineDriverJobsFilter(DriverAvailableJobsFilter filter) {
  return filter == kInitialDriverJobsFilter;
}

class DriverAvailableJobsFilterNotifier
    extends Notifier<DriverAvailableJobsFilter> {
  bool _defaultsSeeded = false;
  bool _userModified = false;

  @override
  DriverAvailableJobsFilter build() => kInitialDriverJobsFilter;

  bool get hasSeededDefaults => _defaultsSeeded;

  bool get userModified => _userModified;

  void _apply(DriverAvailableJobsFilter filter, {bool userInitiated = true}) {
    if (filter == state) {
      return;
    }

    if (userInitiated) {
      _userModified = true;
    }
    state = filter;
  }

  /// Seeds profile-based defaults once after the first successful jobs response.
  void seedDefaultsFromMeta(DriverDeliveriesListMeta meta) {
    if (_defaultsSeeded || _userModified || !isPristineDriverJobsFilter(state)) {
      _defaultsSeeded = true;
      return;
    }

    _defaultsSeeded = true;
    final defaults = profileDefaultFilter(meta);
    _apply(defaults, userInitiated: false);
  }

  void resetToProfileDefaults(DriverDeliveriesListMeta meta) {
    _userModified = false;
    _defaultsSeeded = true;
    _apply(profileDefaultFilter(meta), userInitiated: false);
  }

  void setRadiusKm(double? radiusKm) {
    _apply(
      state.copyWith(
        maxDistanceKm: radiusKm,
        clearMaxDistanceKm: radiusKm == null,
      ),
    );
  }

  void setAnyDistance() {
    setRadiusKm(null);
  }

  void increaseRadius() {
    final current = state.maxDistanceKm;
    final steps = DriverJobsFilterConstants.radiusStepsKm;

    if (current == null) {
      return;
    }

    final index = steps.indexOf(current);
    if (index >= 0 && index < steps.length - 1) {
      setRadiusKm(steps[index + 1]);
      return;
    }

    setAnyDistance();
  }

  void setSortBy(String sortBy) {
    if (sortBy == state.sortBy) {
      return;
    }
    _apply(state.copyWith(sortBy: sortBy));
  }

  void setCity(String? city) {
    final normalized = normalizeProfileField(city);
    _apply(
      state.copyWith(
        city: normalized,
        clearCity: normalized == null,
      ),
    );
  }

  void setArea(String? area) {
    final normalized = normalizeProfileField(area);
    _apply(
      state.copyWith(
        area: normalized,
        clearArea: normalized == null,
      ),
    );
  }
}

final driverAvailableJobsFilterProvider =
    NotifierProvider<DriverAvailableJobsFilterNotifier, DriverAvailableJobsFilter>(
      DriverAvailableJobsFilterNotifier.new,
    );

final availableDriverDeliveriesProvider =
    FutureProvider<DriverDeliveriesListResult>((ref) {
      final filter = ref.watch(driverAvailableJobsFilterProvider);
      return ref
          .read(driverDeliveriesRepositoryProvider)
          .fetchAvailableDeliveries(filter: filter);
    });

final activeDriverDeliveriesProvider =
    FutureProvider<DriverDeliveriesListResult>((ref) {
      return ref.read(driverDeliveriesRepositoryProvider).fetchActiveDeliveries();
    });

final activeDriverDeliveryProvider = FutureProvider.family<DriverDelivery?, String>(
  (ref, deliveryId) async {
    final result = await ref.watch(activeDriverDeliveriesProvider.future);

    for (final delivery in result.deliveries) {
      if (delivery.id == deliveryId) {
        return delivery;
      }
    }

    return null;
  },
);

void refreshDriverJobs(WidgetRef ref) {
  ref.invalidate(activeDriverDeliveriesProvider);
  ref.invalidate(availableDriverDeliveriesProvider);
}
