import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../data/driver_deliveries_repository.dart';
import '../data/models/driver_archive.dart';

typedef DriverHistoryFetcher =
    Future<DriverArchivePage<DriverHistoricalDelivery>> Function({
      String? cursor,
      int limit,
    });
typedef DriverIncidentsFetcher =
    Future<DriverArchivePage<DriverIncident>> Function({
      String? cursor,
      int limit,
    });

final driverHistoryFetcherProvider = Provider<DriverHistoryFetcher>((ref) {
  final repository = ref.read(driverDeliveriesRepositoryProvider);
  return ({String? cursor, int limit = 20}) =>
      repository.fetchHistory(cursor: cursor, limit: limit);
});

final driverIncidentsFetcherProvider = Provider<DriverIncidentsFetcher>((ref) {
  final repository = ref.read(driverDeliveriesRepositoryProvider);
  return ({String? cursor, int limit = 20}) =>
      repository.fetchIncidents(cursor: cursor, limit: limit);
});

abstract class _ArchiveNotifier<T> extends AsyncNotifier<DriverArchivePage<T>> {
  bool _loadingMore = false;
  String? _knownInvalidCursor;

  Future<DriverArchivePage<T>> fetch({String? cursor, int limit = 20});
  String idOf(T item);
  String get invalidCursorCode;

  Future<void> loadMore() async {
    final current = state.value;
    final cursor = current?.pagination.nextCursor;
    if (_loadingMore ||
        current == null ||
        !current.pagination.hasMore ||
        cursor == null ||
        cursor == _knownInvalidCursor) {
      return;
    }
    _loadingMore = true;
    try {
      final next = await fetch(cursor: cursor, limit: current.pagination.limit);
      state = AsyncData(current.appendDeduplicated(next, idOf: idOf));
    } catch (error) {
      final invalid = error is ApiException && error.code == invalidCursorCode;
      if (invalid) _knownInvalidCursor = cursor;
      state = AsyncData(
        current.withLoadMoreError(error, invalidCursor: invalid),
      );
    } finally {
      _loadingMore = false;
    }
  }

  Future<void> restartFromFirstPage() async {
    final current = state.value;
    if (_loadingMore) return;
    _loadingMore = true;
    try {
      final restarted = await fetch();
      _knownInvalidCursor = null;
      state = AsyncData(restarted);
    } catch (error, stackTrace) {
      if (current == null) {
        state = AsyncError(error, stackTrace);
      } else {
        state = AsyncData(
          current.withLoadMoreError(error, invalidCursor: false),
        );
      }
    } finally {
      _loadingMore = false;
    }
  }
}

class DriverHistoryNotifier extends _ArchiveNotifier<DriverHistoricalDelivery> {
  @override
  Future<DriverArchivePage<DriverHistoricalDelivery>> build() => fetch();

  @override
  String get invalidCursorCode => 'DRIVER_HISTORY_CURSOR_INVALID';

  @override
  String idOf(DriverHistoricalDelivery item) => item.id;

  @override
  Future<DriverArchivePage<DriverHistoricalDelivery>> fetch({
    String? cursor,
    int limit = 20,
  }) => ref.read(driverHistoryFetcherProvider)(cursor: cursor, limit: limit);
}

class DriverIncidentsNotifier extends _ArchiveNotifier<DriverIncident> {
  @override
  Future<DriverArchivePage<DriverIncident>> build() => fetch();

  @override
  String get invalidCursorCode => 'DRIVER_INCIDENTS_CURSOR_INVALID';

  @override
  String idOf(DriverIncident item) => item.id;

  @override
  Future<DriverArchivePage<DriverIncident>> fetch({
    String? cursor,
    int limit = 20,
  }) => ref.read(driverIncidentsFetcherProvider)(cursor: cursor, limit: limit);
}

final driverHistoryProvider =
    AsyncNotifierProvider<
      DriverHistoryNotifier,
      DriverArchivePage<DriverHistoricalDelivery>
    >(DriverHistoryNotifier.new, retry: (retryCount, error) => null);
final driverIncidentsProvider =
    AsyncNotifierProvider<
      DriverIncidentsNotifier,
      DriverArchivePage<DriverIncident>
    >(DriverIncidentsNotifier.new, retry: (retryCount, error) => null);

final driverHistoricalDeliveryProvider =
    FutureProvider.family<DriverHistoricalDelivery, String>(
      (ref, id) => ref
          .read(driverDeliveriesRepositoryProvider)
          .fetchHistoricalDelivery(id),
      retry: (retryCount, error) => null,
    );
