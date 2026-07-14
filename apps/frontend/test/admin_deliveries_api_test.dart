import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/admin_portal/data/models/admin_deliveries_models.dart';

void main() {
  test('legacy delivery payload remains parseable', () {
    final item = AdminDeliveryListItem.fromJson({
      'id': 'delivery-1',
      'status': 'DRIVER_ASSIGNED',
      'requestedAt': '2026-07-01T10:00:00Z',
      'reservation': {'id': 'reservation-1'},
      'material': {'id': 'material-1', 'title': 'Wood'},
      'learner': {
        'id': 'learner-1',
        'displayName': 'Learner',
        'email': 'learner@example.test',
      },
      'supplier': {
        'id': 'supplier-1',
        'displayName': 'Supplier',
        'email': 'supplier@example.test',
      },
      'driver': {
        'id': 'driver-1',
        'displayName': 'Legacy driver',
        'email': 'driver@example.test',
      },
    });
    expect(item.driver?.displayName, 'Legacy driver');
    expect(item.lifecyclePhase, LifecyclePhase.unknown);
    expect(item.availableMutations, isEmpty);
  });

  test('hardened detail preserves canonical state and independent drivers', () {
    final detail = AdminDeliveryDetail.fromJson({
      'id': 'delivery-2',
      'status': 'DELIVERED',
      'requestedAt': '2026-07-01T10:00:00Z',
      'reservation': {
        'id': 'reservation-2',
        'status': 'COMPLETED',
        'quantityRequested': 1,
        'unit': 'piece',
      },
      'material': {'id': 'material-2', 'title': 'Steel'},
      'learner': {
        'id': 'learner-2',
        'displayName': 'Learner',
        'email': 'learner@example.test',
      },
      'supplier': {
        'id': 'supplier-2',
        'displayName': 'Supplier',
        'email': 'supplier@example.test',
      },
      'pickup': {'location': <String, dynamic>{}},
      'dropoff': {'location': <String, dynamic>{}},
      'timeline': [],
      'locationHistory': {'count': 0, 'items': []},
      'canReopenDriverAssignment': false,
      'scope': 'SINGLE',
      'lifecyclePhase': 'COMPLETED',
      'adminAttentionState': 'NONE',
      'assignmentState': 'HISTORICAL',
      'kpiBucket': 'DELIVERED',
      'driver': {
        'id': 'driver-2',
        'displayName': 'Legacy driver',
        'email': 'legacy@example.test',
      },
      'currentDriver': null,
      'lastAssignedDriver': {
        'id': 'driver-2',
        'displayName': 'Last driver',
        'email': 'last@example.test',
      },
      'lastAssignment': {
        'id': 'assignment-1',
        'status': 'ACTIVE',
        'driver': {
          'id': 'driver-2',
          'displayName': 'Last driver',
          'email': 'last@example.test',
        },
      },
      'assignmentHistory': [],
      'availableMutations': [],
      'availableLinks': ['OPEN_RESERVATION'],
    });
    expect(detail.lifecyclePhase, LifecyclePhase.completed);
    expect(detail.assignmentState, AssignmentState.historical);
    expect(detail.driver, isNotNull);
    expect(detail.currentDriver, isNull);
    expect(detail.lastAssignment, isNotNull);
    expect(detail.availableLinks, [DeliveryLink.openReservation]);
  });

  test('grouped recovery and unknown values remain safe', () {
    final item = AdminDeliveryListItem.fromJson({
      'id': 'delivery-3',
      'status': 'DRIVER_NO_SHOW',
      'requestedAt': '2026-07-01T10:00:00Z',
      'reservation': {'id': 'reservation-3'},
      'material': {'id': 'material-3', 'title': 'Glass'},
      'learner': <String, dynamic>{},
      'supplier': <String, dynamic>{},
      'scope': 'GROUPED',
      'lifecyclePhase': 'RECOVERY_IN_PROGRESS',
      'adminAttentionState': 'WAITING_EXTERNAL_PARTY',
      'assignmentState': 'RELEASED',
      'kpiBucket': 'ACTIVE_IN_PROGRESS',
      'availableMutations': ['FUTURE_MUTATION'],
      'availableLinks': ['OPEN_GROUP'],
      'group': {
        'id': 'group-1',
        'status': 'OPEN',
        'reservationCount': 3,
        'reservations': [
          {'id': 'reservation-3', 'status': 'ACCEPTED'},
        ],
        'hasMoreReservations': true,
      },
    });
    expect(item.scope, DeliveryScope.grouped);
    expect(item.availableMutations, [DeliveryMutation.unknown]);
    expect(item.availableMutationRawValues, ['FUTURE_MUTATION']);
    expect(item.group?.hasMoreReservations, isTrue);
  });

  test('active single delivery uses server computed dimensions', () {
    final item = AdminDeliveryListItem.fromJson({
      'id': 'active',
      'status': 'DRIVER_ASSIGNED',
      'requestedAt': 'now',
      'reservation': {'id': 'reservation'},
      'material': {'id': 'material', 'title': 'Material'},
      'learner': <String, dynamic>{},
      'supplier': <String, dynamic>{},
      'scope': 'SINGLE',
      'lifecyclePhase': 'PRE_PICKUP',
      'adminAttentionState': 'NONE',
      'assignmentState': 'ACTIVE',
      'kpiBucket': 'ACTIVE_IN_PROGRESS',
      'driver': {
        'id': 'legacy',
        'displayName': 'Legacy',
        'email': 'legacy@test',
      },
      'availableMutations': [],
      'availableLinks': [],
    });
    expect(item.lifecyclePhase, LifecyclePhase.prePickup);
    expect(item.adminAttentionState, AdminAttentionState.none);
    expect(item.assignmentState, AssignmentState.active);
    expect(item.kpiBucket, DeliveryKpiBucket.activeInProgress);
  });

  test('recovery contracts preserve incident actions without inference', () {
    final item = AdminDeliveryListItem.fromJson({
      'id': 'recovery',
      'status': 'DRIVER_NO_SHOW',
      'requestedAt': 'now',
      'reservation': {'id': 'reservation'},
      'material': {'id': 'material', 'title': 'Material'},
      'learner': <String, dynamic>{},
      'supplier': <String, dynamic>{},
      'scope': 'SINGLE',
      'lifecyclePhase': 'RECOVERY_REQUIRED',
      'adminAttentionState': 'ACTION_REQUIRED',
      'assignmentState': 'RELEASED',
      'kpiBucket': 'NEEDS_ADMIN_REVIEW',
      'primaryIncidentSummary': {
        'id': 'report',
        'status': 'PENDING_REVIEW',
        'reasonCode': 'PICKUP_FAILED',
        'workflowType': 'ACCOUNTABILITY_AND_RECOVERY',
        'operationalState': 'REQUIRES_RESOLUTION',
        'availableActions': ['VERIFY'],
      },
      'availableMutations': [],
      'availableLinks': ['OPEN_INCIDENT'],
    });
    expect(item.lifecyclePhase, LifecyclePhase.recoveryRequired);
    expect(item.primaryIncidentSummary?.availableActions, ['VERIFY']);
    expect(item.availableLinks, [DeliveryLink.openIncident]);
  });

  test(
    'recovery in progress can retain accountability and linked incidents',
    () {
      final detail = AdminDeliveryDetail.fromJson({
        'id': 'in-progress',
        'status': 'DRIVER_NO_SHOW',
        'requestedAt': 'now',
        'reservation': {
          'id': 'reservation',
          'status': 'AWAITING_SUPPLIER_CONFIRMATION',
          'quantityRequested': 1,
          'unit': 'piece',
        },
        'material': {'id': 'material', 'title': 'Material'},
        'learner': <String, dynamic>{},
        'supplier': <String, dynamic>{},
        'pickup': {'location': <String, dynamic>{}},
        'dropoff': {'location': <String, dynamic>{}},
        'timeline': [],
        'locationHistory': {'count': 0, 'items': []},
        'canReopenDriverAssignment': false,
        'scope': 'SINGLE',
        'lifecyclePhase': 'RECOVERY_IN_PROGRESS',
        'adminAttentionState': 'ACTION_REQUIRED',
        'assignmentState': 'RELEASED',
        'kpiBucket': 'NEEDS_ADMIN_REVIEW',
        'availableMutations': [],
        'availableLinks': ['OPEN_INCIDENT'],
        'currentDriver': null,
        'incidentCount': 3,
        'hasMoreLinkedIncidents': true,
        'linkedIncidents': [
          {
            'id': 'report',
            'status': 'PENDING_REVIEW',
            'reasonCode': 'DRIVER_DID_NOT_ARRIVE',
            'workflowType': 'ACCOUNTABILITY_AND_RECOVERY',
            'operationalState': 'RESOLVED',
            'availableActions': ['VERIFY'],
          },
        ],
      });
      expect(detail.lifecyclePhase, LifecyclePhase.recoveryInProgress);
      expect(detail.adminAttentionState, AdminAttentionState.actionRequired);
      expect(detail.currentDriver, isNull);
      expect(detail.incidentCount, 3);
      expect(detail.hasMoreLinkedIncidents, isTrue);
      expect(detail.linkedIncidents.single.availableActions, ['VERIFY']);
    },
  );

  test('six-card summary parses and reconciles', () {
    final summary = AdminDeliveriesSummary.fromJson({
      'total': 10,
      'waitingForDriver': 1,
      'activeInProgress': 2,
      'needsAdminReview': 3,
      'delivered': 3,
      'failedCancelled': 1,
    });
    expect(
      summary.waitingForDriver +
          summary.activeInProgress +
          summary.needsAdminReview +
          summary.delivered +
          summary.failedCancelled,
      summary.total,
    );
    expect(summary.pendingUnassigned, 1);
  });
}
