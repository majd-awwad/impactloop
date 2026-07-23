import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_pickup_schedule_item.dart';
import 'package:frontend/features/supplier_portal/data/pickup_schedule_filters.dart';

const _todayStart = '2026-07-15T10:00:00.000Z';
const _todayEnd = '2026-07-15T12:00:00.000Z';

SupplierIncomingRequest _request({
  String id = 'reservation-1',
  String status = 'ACCEPTED',
  String fulfillmentMethod = 'PICKUP',
  String? activeWindowType = 'CONFIRMED_PICKUP',
  String? windowStart = _todayStart,
  String? windowEnd = _todayEnd,
  List<String> actions = const ['COMPLETE_SELF_PICKUP'],
  String? attentionState,
  String? completedAt,
  String? groupId,
  bool grouped = false,
  String? deliveryStatus,
  String? pickedUpAt,
  String? deliveredAt,
}) {
  return SupplierIncomingRequest.fromJson({
    'id': id,
    'status': status,
    'createdAt': '2026-07-01T08:00:00.000Z',
    'completedAt': completedAt,
    'quantityRequested': 2,
    'fulfillmentMethod': fulfillmentMethod,
    'material': {'title': 'Wood scraps', 'unit': 'kg'},
    'learner': {'displayName': 'Lina'},
    'scheduleSummary': activeWindowType == null
        ? null
        : {
            'activeWindowType': activeWindowType,
            'effectiveWindowStart': windowStart,
            'effectiveWindowEnd': windowEnd,
          },
    'availableActions': actions,
    'attentionState': attentionState,
    'deliverySummary': deliveryStatus == null
        ? null
        : {
            'deliveryId': 'delivery-$id',
            'status': deliveryStatus,
            'pickedUpAt': pickedUpAt,
            'deliveredAt': deliveredAt,
          },
    'groupSummary': groupId == null
        ? null
        : {'groupId': groupId, 'grouped': grouped, 'itemCount': 2},
  });
}

void main() {
  test('self pickup uses only confirmed canonical effective window', () {
    final entry = SupplierScheduleEntry.fromReservations([_request()])!;

    expect(entry.entryKind, SupplierScheduleEntryKind.selfPickupAppointment);
    expect(entry.effectiveWindow!.start.toUtc().toIso8601String(), _todayStart);
    expect(
      entry.primaryAction!.value,
      SupplierReservationAction.completeSelfPickup,
    );
  });

  test(
    'delivery uses supplier delivery pickup window, not learner dropoff',
    () {
      final entry = SupplierScheduleEntry.fromReservations([
        _request(
          fulfillmentMethod: 'DELIVERY',
          activeWindowType: 'SUPPLIER_DELIVERY_PICKUP',
          actions: const ['REPORT_NO_DRIVER'],
        ),
      ])!;

      expect(
        entry.entryKind,
        SupplierScheduleEntryKind.driverPickupAppointment,
      );
      expect(entry.fulfillmentKind, SupplierScheduleFulfillmentKind.delivery);
      expect(
        entry.primaryAction!.value,
        SupplierReservationAction.reportNoDriver,
      );
    },
  );

  test('learner dropoff and missing delivery window are excluded', () {
    final request = _request(
      fulfillmentMethod: 'DELIVERY',
      activeWindowType: 'LEARNER_DROPOFF',
    );
    expect(SupplierScheduleEntry.fromReservations([request]), isNull);

    final missing = _request(
      fulfillmentMethod: 'DELIVERY',
      activeWindowType: 'SUPPLIER_DELIVERY_PICKUP',
      windowStart: null,
      windowEnd: null,
    );
    expect(SupplierScheduleEntry.fromReservations([missing]), isNull);
  });

  test('pending proposals without an effective window are excluded', () {
    final entry = SupplierScheduleEntry.fromReservations([
      _request(
        status: 'AWAITING_LEARNER_CONFIRMATION',
        activeWindowType: null,
        actions: const ['PROPOSE_RESCHEDULE'],
      ),
    ]);
    expect(entry, isNull);
  });

  test('supplier attention is retained only with a backend action', () {
    final entry = SupplierScheduleEntry.fromReservations([
      _request(
        activeWindowType: null,
        windowStart: null,
        windowEnd: null,
        attentionState: 'SUPPLIER_ACTION_REQUIRED',
        actions: const ['PROPOSE_RESCHEDULE'],
      ),
    ])!;

    expect(entry.entryKind, SupplierScheduleEntryKind.supplierAttention);
    expect(entry.isActionable, isTrue);
  });

  test('recovery is classified separately and remains non-appointment', () {
    final entry = SupplierScheduleEntry.fromReservations([
      _request(
        status: 'AWAITING_RESOLUTION',
        activeWindowType: null,
        windowStart: null,
        windowEnd: null,
        actions: const ['SUBMIT_RECOVERY_PICKUP_WINDOW'],
      ),
    ])!;

    expect(entry.entryKind, SupplierScheduleEntryKind.deliveryRecovery);
    expect(entry.effectiveWindow, isNull);
    expect(
      entry.primaryAction!.value,
      SupplierReservationAction.submitRecoveryPickupWindow,
    );
  });

  test('completed self pickup uses completedAt as terminal timestamp', () {
    final entry = SupplierScheduleEntry.fromReservations([
      _request(status: 'COMPLETED', completedAt: '2026-07-15T13:00:00.000Z'),
    ])!;

    expect(entry.entryKind, SupplierScheduleEntryKind.completedHandover);
    expect(entry.terminalAt!.toUtc().hour, 13);
  });

  test('completed delivery uses pickedUpAt, never deliveredAt', () {
    final entry = SupplierScheduleEntry.fromReservations([
      _request(
        status: 'COMPLETED',
        fulfillmentMethod: 'DELIVERY',
        activeWindowType: null,
        windowStart: null,
        windowEnd: null,
        deliveryStatus: 'DELIVERED',
        pickedUpAt: '2026-07-15T14:00:00.000Z',
        deliveredAt: '2026-07-15T16:00:00.000Z',
      ),
    ])!;

    expect(entry.terminalAt!.toUtc().hour, 14);
  });

  test('terminal non-completed statuses become closed history', () {
    final entry = SupplierScheduleEntry.fromReservations([
      _request(status: 'CANCELLED', activeWindowType: null),
    ])!;
    expect(entry.entryKind, SupplierScheduleEntryKind.closedHistory);
  });

  test('unknown status is preserved and fails closed', () {
    final entry = SupplierScheduleEntry.fromReservations([
      _request(status: 'NEW_BACKEND_STATE'),
    ])!;
    expect(entry.entryKind, SupplierScheduleEntryKind.unknown);
    expect(entry.isActionable, isFalse);
    expect(entry.toCompatibilityItem(), isNull);
  });

  test('unknown action cannot become the primary action', () {
    final entry = SupplierScheduleEntry.fromReservations([
      _request(actions: const ['NEW_BACKEND_ACTION']),
    ])!;
    expect(entry.primaryAction, isNull);
    expect(entry.isActionable, isFalse);
  });

  test('grouped reservations deduplicate by real group id', () {
    final result = projectSupplierReservations(
      SupplierReservationListResponse(
        items: [
          _request(id: 'a', groupId: 'group-1', grouped: true),
          _request(id: 'b', groupId: 'group-1', grouped: true),
        ],
      ),
    );

    expect(result.entries, hasLength(1));
    expect(result.entries.single.sourceReservationIds, containsAll(['a', 'b']));
  });

  test('grouped reservations with different windows fail safely', () {
    final result = projectSupplierReservations(
      SupplierReservationListResponse(
        items: [
          _request(id: 'a', groupId: 'group-1', grouped: true),
          _request(
            id: 'b',
            groupId: 'group-1',
            grouped: true,
            windowStart: '2026-07-15T11:00:00.000Z',
            windowEnd: '2026-07-15T13:00:00.000Z',
          ),
        ],
      ),
    );

    expect(result.entries.single.entryKind, SupplierScheduleEntryKind.unknown);
    expect(result.entries.single.effectiveWindow, isNull);
  });

  test('pagination and operational summary survive projection', () {
    final response = SupplierReservationListResponse(
      items: [_request()],
      pagination: const SupplierReservationPagination(
        page: 2,
        limit: 100,
        total: 121,
        totalPages: 2,
      ),
      summary: const SupplierReservationSummary(
        total: 121,
        needsSupplierResponse: 4,
        waitingForLearner: 5,
        fulfillmentInProgress: 6,
        adminReview: 2,
        completed: 80,
        closed: 24,
      ),
    );
    final result = projectSupplierReservations(response);

    expect(result.pagination!.total, 121);
    expect(result.summary!.adminReview, 2);
    expect(result.summary!.isReconciled, isTrue);
  });

  test('calendar filters accept an injected local now', () {
    final item = SupplierScheduleEntry.fromReservations([
      _request(),
    ])!.toCompatibilityItem()!;
    final items = [item];

    expect(
      filterPickupScheduleItems(
        items,
        SupplierPickupScheduleFilter.today,
        now: DateTime.utc(2026, 7, 15, 8),
      ),
      hasLength(1),
    );
    expect(
      filterPickupScheduleItems(
        items,
        SupplierPickupScheduleFilter.upcoming,
        now: DateTime.utc(2026, 7, 14, 8),
      ),
      hasLength(1),
    );
  });

  test('canonical schedule response parses categories, types, and summary', () {
    final page = SupplierSchedulePage.fromJson({
      'items': [
        {
          'id': 'schedule-1',
          'type': 'GROUPED_DRIVER_PICKUP',
          'category': 'TODAY',
          'needsAttention': true,
          'representativeReservationId': 'reservation-1',
          'reservationIds': ['reservation-1', 'reservation-2'],
          'group': {
            'groupId': 'group-1',
            'grouped': true,
            'itemCount': 2,
            'status': 'ASSIGNED',
            'hasMoreItems': false,
          },
          'material': {'id': 'material-1', 'title': 'Wood'},
          'learner': {'id': 'learner-1', 'displayName': 'Lina'},
          'quantity': {'value': 2, 'unit': 'kg'},
          'fulfillmentMethod': 'DELIVERY',
          'effectiveWindow': {
            'start': _todayStart,
            'end': _todayEnd,
            'type': 'SUPPLIER_DELIVERY_PICKUP',
          },
          'workflowPhase': 'DELIVERY',
          'attentionState': 'SUPPLIER_ACTION_REQUIRED',
          'nextActor': 'SUPPLIER',
          'reservationStatus': 'ACCEPTED',
          'availableActions': ['REPORT_NO_DRIVER', 'UNKNOWN_ACTION'],
          'projectionInconsistent': false,
        },
      ],
      'pagination': {'page': 1, 'limit': 20, 'total': 1, 'totalPages': 1},
      'summary': {
        'total': 1,
        'unscheduledAction': 0,
        'adminReview': 0,
        'overdue': 0,
        'inProgress': 0,
        'today': 1,
        'upcoming': 0,
        'completed': 0,
        'closed': 0,
        'needsAttention': 1,
      },
    });

    final entry = page.items.single;
    expect(entry.type.value, SupplierScheduleEntryType.groupedDriverPickup);
    expect(entry.category.value, SupplierScheduleCategory.today);
    expect(entry.category.rawValue, 'TODAY');
    expect(entry.group?.itemCount, 2);
    expect(entry.reservationIds, hasLength(2));
    expect(entry.effectiveWindow?.type, 'SUPPLIER_DELIVERY_PICKUP');
    expect(entry.availableActions.first.isExecutable, isTrue);
    expect(entry.availableActions.last.isExecutable, isFalse);
    expect(page.summary.isReconciled, isTrue);
    expect(page.compatibilityItems.single.grouped, isTrue);
  });

  test('future enum values remain raw and non-actionable', () {
    final type = SupplierScheduleEntryTypeValue.fromJson('FUTURE_TYPE');
    final category = SupplierScheduleCategoryValue.fromJson('FUTURE_CATEGORY');
    final action = SupplierAvailableAction.fromJson('FUTURE_ACTION');

    expect(type.value, SupplierScheduleEntryType.unknown);
    expect(type.rawValue, 'FUTURE_TYPE');
    expect(category.value, SupplierScheduleCategory.unknown);
    expect(category.rawValue, 'FUTURE_CATEGORY');
    expect(action.isExecutable, isFalse);
  });

  test(
    'filter queries use server categories and absolute local boundaries',
    () {
      final selected = DateTime(2026, 7, 15, 9);
      final today = SupplierScheduleQuery.forFilter(
        SupplierPickupScheduleFilter.today,
        selectedDay: selected,
      );
      final params = today.toQueryParameters();

      expect(params['scope'], 'ACTIVE');
      expect(params['category'], 'TODAY');
      expect(params['dayStart'], isA<String>());
      expect(params['dayEnd'], isA<String>());
      expect(
        DateTime.parse(
          params['dayEnd'] as String,
        ).isAfter(DateTime.parse(params['dayStart'] as String)),
        isTrue,
      );

      final changed = today.copyWith(
        page: 4,
        filter: SupplierPickupScheduleFilter.upcoming,
      );
      expect(changed.page, 1);
      expect(changed.filter, SupplierPickupScheduleFilter.upcoming);
      expect(
        SupplierScheduleQuery.forFilter(
          SupplierPickupScheduleFilter.completed,
        ).scope,
        'HISTORY',
      );
    },
  );

  test('invalid effective windows are not fabricated', () {
    expect(
      SupplierScheduleEffectiveWindow.tryFromJson({
        'start': null,
        'end': null,
        'type': 'CONFIRMED_PICKUP',
      }),
      isNull,
    );
  });
}
