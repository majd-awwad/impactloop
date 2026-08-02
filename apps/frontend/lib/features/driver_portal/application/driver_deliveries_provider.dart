import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../data/driver_deliveries_repository.dart';
import '../data/models/driver_deliveries_list_result.dart';
import '../data/models/driver_delivery_inactive_context.dart';
import '../data/models/driver_delivery.dart';
import '../data/models/driver_archive.dart';
import 'driver_jobs_filter_helpers.dart';

sealed class DriverDeliveryDetailState {
  const DriverDeliveryDetailState();
}

final class DriverDeliveryDetailActive extends DriverDeliveryDetailState {
  const DriverDeliveryDetailActive(this.delivery);

  final DriverDelivery delivery;
}

final class DriverDeliveryDetailInactive extends DriverDeliveryDetailState {
  const DriverDeliveryDetailInactive(this.context, this.delivery);

  final DriverDeliveryInactiveContext context;
  final DriverHistoricalDelivery delivery;
}

final class DriverDeliveryDetailNotFound extends DriverDeliveryDetailState {
  const DriverDeliveryDetailNotFound();
}

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
    if (_defaultsSeeded ||
        _userModified ||
        !isPristineDriverJobsFilter(state)) {
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
    _apply(openJobsFilter(meta), userInitiated: false);
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
    _apply(state.copyWith(city: normalized, clearCity: normalized == null));
  }

  void setArea(String? area) {
    final normalized = normalizeProfileField(area);
    _apply(state.copyWith(area: normalized, clearArea: normalized == null));
  }
}

final driverAvailableJobsFilterProvider =
    NotifierProvider<
      DriverAvailableJobsFilterNotifier,
      DriverAvailableJobsFilter
    >(DriverAvailableJobsFilterNotifier.new);

class DriverAvailableJobsPaginationErrorNotifier
    extends Notifier<ApiException?> {
  @override
  ApiException? build() => null;

  void show(ApiException error) => state = error;

  void clear() => state = null;
}

final driverAvailableJobsPaginationErrorProvider =
    NotifierProvider<DriverAvailableJobsPaginationErrorNotifier, ApiException?>(
      DriverAvailableJobsPaginationErrorNotifier.new,
    );

class AvailableDriverDeliveriesNotifier
    extends AsyncNotifier<DriverDeliveriesListResult> {
  bool _loadingMore = false;
  String? _failedCursor;

  @override
  Future<DriverDeliveriesListResult> build() async {
    final filter = ref.watch(driverAvailableJobsFilterProvider);
    final result = await ref
        .read(driverDeliveriesRepositoryProvider)
        .fetchAvailableDeliveries(filter: filter);
    _failedCursor = null;
    ref.read(driverAvailableJobsPaginationErrorProvider.notifier).clear();
    return result;
  }

  Future<void> loadMore() async {
    final current = state.value;
    final pagination = current?.meta.pagination;
    if (current == null ||
        pagination?.hasMore != true ||
        pagination?.nextCursor == null ||
        pagination?.nextCursor == _failedCursor ||
        _loadingMore) {
      return;
    }

    _loadingMore = true;
    final cursor = pagination!.nextCursor!;
    try {
      final next = await ref
          .read(driverDeliveriesRepositoryProvider)
          .fetchAvailableDeliveries(
            filter: ref.read(driverAvailableJobsFilterProvider),
            cursor: cursor,
            limit: pagination.limit,
          );
      state = AsyncData(current.append(next));
      _failedCursor = null;
      ref.read(driverAvailableJobsPaginationErrorProvider.notifier).clear();
    } on ApiException catch (error) {
      // Keep the already-rendered page as stale data when a later page fails.
      state = AsyncData(current);
      if (error.code == 'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID') {
        _failedCursor = cursor;
      }
      ref.read(driverAvailableJobsPaginationErrorProvider.notifier).show(error);
    } catch (error) {
      state = AsyncData(current);
      ref
          .read(driverAvailableJobsPaginationErrorProvider.notifier)
          .show(normalizeApiException(error));
    } finally {
      _loadingMore = false;
    }
  }

  Future<void> restartPagination() async {
    final current = state.value;
    if (current == null || _loadingMore) {
      return;
    }

    _failedCursor = null;
    ref.read(driverAvailableJobsPaginationErrorProvider.notifier).clear();
    _loadingMore = true;
    try {
      final restarted = await ref
          .read(driverDeliveriesRepositoryProvider)
          .fetchAvailableDeliveries(
            filter: ref.read(driverAvailableJobsFilterProvider),
          );
      state = AsyncData(restarted);
    } catch (error) {
      state = AsyncData(current);
      ref
          .read(driverAvailableJobsPaginationErrorProvider.notifier)
          .show(normalizeApiException(error));
    } finally {
      _loadingMore = false;
    }
  }
}

final availableDriverDeliveriesProvider =
    AsyncNotifierProvider<
      AvailableDriverDeliveriesNotifier,
      DriverDeliveriesListResult
    >(AvailableDriverDeliveriesNotifier.new);

final activeDriverDeliveriesProvider =
    FutureProvider<DriverDeliveriesListResult>((ref) {
      return ref
          .read(driverDeliveriesRepositoryProvider)
          .fetchActiveDeliveries();
    });

final driverDeliveryDetailProvider =
    FutureProvider.family<DriverDeliveryDetailState, String>((
      ref,
      deliveryId,
    ) async {
      try {
        final result = await ref
            .read(driverDeliveriesRepositoryProvider)
            .fetchDeliveryDetail(deliveryId);

        if (result.isActive) {
          return DriverDeliveryDetailActive(result.delivery);
        }

        return DriverDeliveryDetailInactive(
          DriverDeliveryInactiveContext(
            deliveryId: result.delivery.id,
            isActive: false,
            status: result.delivery.status,
            closureReason: result.closureReason,
          ),
          await ref
              .read(driverDeliveriesRepositoryProvider)
              .fetchHistoricalDelivery(deliveryId),
        );
      } on ApiException catch (error) {
        if (error.statusCode == 404) {
          return const DriverDeliveryDetailNotFound();
        }
        rethrow;
      }
    });

void refreshDriverJobs(WidgetRef ref) {
  ref.invalidate(activeDriverDeliveriesProvider);
  ref.invalidate(availableDriverDeliveriesProvider);
}

void refreshActiveDriverDelivery(WidgetRef ref, String deliveryId) {
  ref.invalidate(driverDeliveryDetailProvider(deliveryId));
}
