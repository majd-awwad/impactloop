import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/driver_portal/application/driver_archive_provider.dart';
import 'package:frontend/features/driver_portal/data/models/driver_archive.dart';
import 'package:frontend/features/driver_portal/data/models/driver_deliveries_list_result.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';

void main() {
  test('history append deduplicates IDs while preserving stable order', () async {
    var calls = 0;
    final container = ProviderContainer(
      overrides: [
        driverHistoryFetcherProvider.overrideWithValue(
          ({String? cursor, int limit = 20}) async {
            calls += 1;
            return cursor == null
                ? page([delivery('a'), delivery('b')], next: 'cursor-1')
                : page([delivery('b'), delivery('c')]);
          },
        ),
      ],
    );
    addTearDown(container.dispose);

    await container.read(driverHistoryProvider.future);
    await container.read(driverHistoryProvider.notifier).loadMore();
    expect(calls, 2);
    expect(
      container.read(driverHistoryProvider).requireValue.items.map((e) => e.id),
      ['a', 'b', 'c'],
    );
  });

  test('temporary later-page failure preserves data and permits retry', () async {
    var calls = 0;
    final container = ProviderContainer(
      overrides: [
        driverHistoryFetcherProvider.overrideWithValue(
          ({String? cursor, int limit = 20}) async {
            calls += 1;
            if (cursor == null) return page([delivery('a')], next: 'cursor-1');
            if (calls == 2) {
              throw const ApiException(message: 'offline', code: 'NETWORK_ERROR');
            }
            return page([delivery('b')]);
          },
        ),
      ],
    );
    addTearDown(container.dispose);

    await container.read(driverHistoryProvider.future);
    await container.read(driverHistoryProvider.notifier).loadMore();
    var current = container.read(driverHistoryProvider).requireValue;
    expect(current.items.single.id, 'a');
    expect(current.loadMoreError, isA<ApiException>());
    expect(current.invalidCursor, isFalse);

    await container.read(driverHistoryProvider.notifier).loadMore();
    current = container.read(driverHistoryProvider).requireValue;
    expect(calls, 3);
    expect(current.items.map((e) => e.id), ['a', 'b']);
  });

  test('invalid cursor is never reused and restart loads page one', () async {
    var calls = 0;
    final cursors = <String?>[];
    final container = ProviderContainer(
      overrides: [
        driverHistoryFetcherProvider.overrideWithValue(
          ({String? cursor, int limit = 20}) async {
            calls += 1;
            cursors.add(cursor);
            if (cursor != null) {
              throw const ApiException(
                message: 'invalid',
                code: 'DRIVER_HISTORY_CURSOR_INVALID',
              );
            }
            return calls == 1
                ? page([delivery('old')], next: 'invalid-cursor')
                : page([delivery('new')]);
          },
        ),
      ],
    );
    addTearDown(container.dispose);

    await container.read(driverHistoryProvider.future);
    await container.read(driverHistoryProvider.notifier).loadMore();
    await container.read(driverHistoryProvider.notifier).loadMore();
    expect(calls, 2);
    expect(cursors, [null, 'invalid-cursor']);
    expect(
      container.read(driverHistoryProvider).requireValue.invalidCursor,
      isTrue,
    );

    await container
        .read(driverHistoryProvider.notifier)
        .restartFromFirstPage();
    expect(calls, 3);
    expect(cursors, [null, 'invalid-cursor', null]);
    expect(
      container.read(driverHistoryProvider).requireValue.items.single.id,
      'new',
    );
  });
}

DriverArchivePage<DriverHistoricalDelivery> page(
  List<DriverHistoricalDelivery> items, {
  String? next,
}) => DriverArchivePage(
  items: items,
  pagination: DriverDeliveriesPagination(
    limit: 20,
    hasMore: next != null,
    nextCursor: next,
  ),
);

DriverHistoricalDelivery delivery(String id) => DriverHistoricalDelivery(
  id: id,
  status: 'DELIVERED',
  historicalAt: DateTime.utc(2026, 8, 2),
  assignmentOutcome: 'CLOSED',
  supplier: const DriverDeliveryParty(displayName: 'Supplier'),
  pickupLocation: const DriverSafeLocation(city: 'Hebron'),
  dropoffLocation: const DriverSafeLocation(city: 'Nablus'),
  carriedItems: const [],
  unpickedItems: const [],
  partialPickupOccurred: false,
  itemAuditComplete: true,
  timeline: const [],
);
