import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/presentation/learner_reservation_ui_helpers.dart';

void main() {
  LearnerReservation reservationWithStatus(String status) {
    return LearnerReservation.fromJson({
      'id': 'res-$status',
      'status': status,
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });
  }

  test('reservationMatchesStatusFilter includes overdue accepted in needs action', () {
    final overdueAccepted = LearnerReservation.fromJson({
      'id': 'res-overdue',
      'status': 'ACCEPTED',
      'quantityRequested': 1,
      'isOverdue': true,
      'needsFollowUp': true,
      'pickupWindowStart': '2026-01-01T08:00:00.000Z',
      'pickupWindowEnd': '2026-01-01T10:00:00.000Z',
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'RESERVED',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(
      reservationMatchesStatusFilter(
        overdueAccepted,
        LearnerReservationStatusFilter.needsAction,
      ),
      isTrue,
    );
    expect(
      reservationMatchesStatusFilter(
        overdueAccepted,
        LearnerReservationStatusFilter.accepted,
      ),
      isTrue,
    );
  });

  test('formatPickupWindow renders readable same-day window', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-1',
      'status': 'ACCEPTED',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'pickupWindowStart': '2026-06-27T07:00:00.000Z',
      'pickupWindowEnd': '2026-06-27T13:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'RESERVED',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    final text = formatPickupWindow(reservation);

    expect(text, isNotNull);
    expect(text, contains('Confirmed pickup:'));
    expect(text, contains('Jun 27'));
    expect(text, contains('–'));
  });

  test('formatDeliveryAvailability reflects reserve-time delivery choice', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-1',
      'status': 'PENDING',
      'quantityRequested': 1,
      'fulfillmentMethod': 'DELIVERY',
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
        'deliveryAllowed': true,
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(
      formatDeliveryAvailability(reservation),
      'Delivery selected at reservation',
    );
  });

  test('formatPreferredWindowsSummary renders pickup windows', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-1',
      'status': 'PENDING',
      'quantityRequested': 1,
      'fulfillmentMethod': 'PICKUP',
      'learnerPreferredPickupWindows': [
        {
          'start': '2026-06-27T07:00:00.000Z',
          'end': '2026-06-27T13:00:00.000Z',
        },
      ],
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    final summary = formatPreferredWindowsSummary(reservation);

    expect(summary, isNotNull);
    expect(summary, contains('Requested pickup'));
  });

  test('reservation filters cover active and closed lifecycle statuses', () {
    for (final status in const [
      'PENDING',
      'AWAITING_LEARNER_CONFIRMATION',
      'AWAITING_SUPPLIER_CONFIRMATION',
      'ACCEPTED',
      'AWAITING_RESOLUTION',
    ]) {
      expect(
        reservationMatchesStatusFilter(
          reservationWithStatus(status),
          LearnerReservationStatusFilter.active,
        ),
        isTrue,
        reason: '$status should be active.',
      );
    }

    for (final status in const [
      'CANCELLED',
      'REJECTED',
      'EXPIRED',
      'NO_SHOW',
      'FULFILLMENT_FAILED',
    ]) {
      final reservation = reservationWithStatus(status);
      expect(
        reservationMatchesStatusFilter(
          reservation,
          LearnerReservationStatusFilter.closed,
        ),
        isTrue,
        reason: '$status should be closed.',
      );
      expect(
        reservationMatchesStatusFilter(
          reservation,
          LearnerReservationStatusFilter.active,
        ),
        isFalse,
        reason: '$status should not be active.',
      );
    }
  });

  test('each status has the expected tab coverage', () {
    const activeStatuses = {
      'PENDING',
      'AWAITING_LEARNER_CONFIRMATION',
      'AWAITING_SUPPLIER_CONFIRMATION',
      'ACCEPTED',
      'AWAITING_RESOLUTION',
    };
    const closedStatuses = {
      'CANCELLED',
      'REJECTED',
      'EXPIRED',
      'NO_SHOW',
      'FULFILLMENT_FAILED',
    };
    const statuses = {...activeStatuses, ...closedStatuses, 'COMPLETED'};

    for (final status in statuses) {
      final reservation = reservationWithStatus(status);
      expect(
        reservationMatchesStatusFilter(
          reservation,
          LearnerReservationStatusFilter.all,
        ),
        isTrue,
        reason: 'All should include $status.',
      );
      expect(
        reservationMatchesStatusFilter(
          reservation,
          LearnerReservationStatusFilter.active,
        ),
        activeStatuses.contains(status),
      );
      expect(
        reservationMatchesStatusFilter(
          reservation,
          LearnerReservationStatusFilter.pending,
        ),
        status == 'PENDING' || status == 'AWAITING_SUPPLIER_CONFIRMATION',
      );
      expect(
        reservationMatchesStatusFilter(
          reservation,
          LearnerReservationStatusFilter.accepted,
        ),
        status == 'ACCEPTED',
      );
      expect(
        reservationMatchesStatusFilter(
          reservation,
          LearnerReservationStatusFilter.completed,
        ),
        status == 'COMPLETED',
      );
      expect(
        reservationMatchesStatusFilter(
          reservation,
          LearnerReservationStatusFilter.closed,
        ),
        closedStatuses.contains(status),
      );
    }
  });

  test('reservationStatusLabel maps missed pickup expiry', () {
    expect(
      reservationStatusLabel(
        'EXPIRED',
        rejectionReason: missedPickupExpiryReason,
      ),
      'Pickup missed',
    );
    expect(
      reservationStatusLabel('EXPIRED', rejectionReason: 'OTHER'),
      'Expired',
    );
    expect(
      reservationStatusLabel('EXPIRED'),
      'Expired — no response',
    );
    expect(reservationStatusLabel('REJECTED'), 'Rejected');
    expect(
      reservationStatusLabel(
        'EXPIRED',
        rejectionReason: noDriverCancelReason,
      ),
      'Cancelled — no driver available',
    );
  });

  test('reservationStatusLabel maps overdue accepted pickup', () {
    expect(
      reservationStatusLabel(
        'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        isOverdue: true,
      ),
      'Pickup window passed',
    );
    expect(
      reservationStatusLabel(
        'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        needsFollowUp: true,
      ),
      'Pickup window passed',
    );
    expect(
      reservationStatusLabel('ACCEPTED', fulfillmentMethod: 'PICKUP'),
      'Accepted / Ready for pickup',
    );
  });

  test('reservationStatusLabel maps verified incident review', () {
    expect(
      reservationStatusLabel(
        'AWAITING_RESOLUTION',
        incidentReviewStatus: 'VERIFIED',
      ),
      'Report verified',
    );
    expect(
      reservationStatusLabel(
        'AWAITING_RESOLUTION',
        incidentReviewStatus: 'PENDING_REVIEW',
      ),
      'Pending admin review',
    );
  });

  test('reservationStatusLabel maps awaiting confirmation', () {
    expect(
      reservationStatusLabel('AWAITING_LEARNER_CONFIRMATION'),
      'Needs your confirmation',
    );
  });

  test('reservationStatusLabel maps accepted delivery fulfillment', () {
    expect(
      reservationStatusLabel('ACCEPTED', fulfillmentMethod: 'DELIVERY'),
      'Accepted',
    );
    expect(
      learnerDeliverySecondaryStatusLabel(
        reservationStatus: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        deliveryStatus: 'WAITING_FOR_DRIVER',
        noDriverOverdue: true,
      ),
      'Driver not assigned in time',
    );
    expect(
      learnerDeliverySecondaryStatusLabel(
        reservationStatus: 'AWAITING_RESOLUTION',
        fulfillmentMethod: 'DELIVERY',
        deliveryStatus: 'AWAITING_RESOLUTION',
        incidentReviewStatus: 'PENDING_REVIEW',
        pendingIncidentReasonCode: 'NO_DRIVER_AVAILABLE',
      ),
      'No driver available',
    );
    expect(
      learnerDeliverySecondaryStatusLabel(
        reservationStatus: 'AWAITING_RESOLUTION',
        fulfillmentMethod: 'DELIVERY',
        activeDeliveryStatus: 'AWAITING_RESOLUTION',
        incidentReviewStatus: 'PENDING_REVIEW',
        pendingIncidentReasonCode: 'NO_RESPONSE_AFTER_PICKUP_WINDOW',
      ),
      'Driver pickup overdue',
    );
    expect(
      learnerDeliverySecondaryStatusLabel(
        reservationStatus: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        deliveryStatus: 'DRIVER_ASSIGNED',
        assignedDriverPickupOverdue: true,
      ),
      'Driver pickup overdue',
    );
    expect(
      learnerDeliverySecondaryStatusLabel(
        reservationStatus: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        deliveryStatus: 'ARRIVED_PICKUP',
        assignedDriverPickupOverdue: true,
      ),
      'Pickup not completed',
    );
  });

  test('reservationStatusLabel maps stale pickup admin reconfirm and cancel', () {
    expect(
      reservationStatusLabel(
        'AWAITING_SUPPLIER_CONFIRMATION',
        fulfillmentMethod: 'DELIVERY',
        pendingRescheduleReason: 'STALE_PICKUP_ADMIN_REQUEST',
      ),
      'Waiting for supplier to choose a new pickup window',
    );
    expect(
      reservationStatusLabel(
        'EXPIRED',
        fulfillmentMethod: 'DELIVERY',
        rejectionReason: 'PICKUP_NOT_COMPLETED',
      ),
      'Admin cancelled due to unresolved pickup',
    );
  });

  test('learnerReservationStatusChipLabels avoids duplicate admin review chips', () {
    final reservation = LearnerReservation.fromJson({
      'id': 'res-no-driver',
      'status': 'AWAITING_RESOLUTION',
      'fulfillmentMethod': 'DELIVERY',
      'incidentReviewStatus': 'PENDING_REVIEW',
      'pendingIncidentReasonCode': 'NO_DRIVER_AVAILABLE',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'activeDelivery': {'id': 'del-1', 'status': 'AWAITING_RESOLUTION'},
      'material': {
        'id': 'mat-1',
        'title': 'Panels',
        'materialType': 'Wood',
        'status': 'RESERVED',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    final chips = learnerReservationStatusChipLabels(reservation);
    expect(chips.primary, 'Pending admin review');
    expect(chips.secondary, 'No driver available');
  });

  test('reservationMatchesStatusFilter includes awaiting confirmation in active', () {
    final awaiting = LearnerReservation.fromJson({
      'id': 'res-awaiting',
      'status': 'AWAITING_LEARNER_CONFIRMATION',
      'quantityRequested': 1,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
      'material': {
        'id': 'mat-1',
        'title': 'Wood panels',
        'materialType': 'Wood',
        'status': 'AVAILABLE',
      },
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    });

    expect(
      reservationMatchesStatusFilter(
        awaiting,
        LearnerReservationStatusFilter.active,
      ),
      isTrue,
    );
    expect(
      reservationMatchesStatusFilter(
        awaiting,
        LearnerReservationStatusFilter.needsAction,
      ),
      isTrue,
    );
    expect(
      reservationMatchesStatusFilter(
        awaiting,
        LearnerReservationStatusFilter.all,
      ),
      isTrue,
    );
  });
}
