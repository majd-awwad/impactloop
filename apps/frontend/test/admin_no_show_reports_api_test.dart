import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/admin_portal/data/admin_no_show_reports_api.dart';

void main() {
  test('parses additive incident-report contract and detail fields', () {
    final detail = AdminNoShowReportDetail.fromJson({
      'id': 'report-1',
      'reservationId': 'reservation-1',
      'deliveryId': 'delivery-1',
      'status': 'PENDING_REVIEW',
      'reasonCode': 'PICKUP_FAILED',
      'targetRole': 'SUPPLIER',
      'createdAt': '2026-07-14T10:00:00.000Z',
      'pickupWindowStart': '2026-07-14T09:00:00.000Z',
      'pickupWindowEnd': '2026-07-14T10:00:00.000Z',
      'reviewedAt': '2026-07-14T11:00:00.000Z',
      'reviewNote': 'Reviewed context',
      'reviewedBy': {'id': 'admin-1', 'displayName': 'Admin'},
      'workflowType': 'ACCOUNTABILITY_AND_RECOVERY',
      'availableActions': ['VERIFY', 'REQUEST_SUPPLIER_RESCHEDULE'],
      'strikeImpact': 'STRIKE_IF_VERIFIED',
      'operationalState': 'REQUIRES_RESOLUTION',
      'reservation': {
        'status': 'AWAITING_RESOLUTION',
        'material': {'title': 'PVC pipe'},
        'requester': {'displayName': 'Learner'},
        'owner': {'displayName': 'Supplier'},
        'pendingReschedule': {
          'requestedBy': 'SUPPLIER',
          'reason': 'STALE_PICKUP_ADMIN_REQUEST',
          'note': 'Choose a new pickup window',
          'proposedPickupWindowStart': '2026-07-16T09:00:00.000Z',
          'proposedPickupWindowEnd': '2026-07-16T10:00:00.000Z',
        },
      },
      'reporter': {'displayName': 'Driver'},
      'target': {'displayName': 'Supplier'},
      'quantityStatus': {
        'materialQuantity': 12,
        'heldQuantity': 4,
        'availableQuantity': 8,
      },
      'deliveryTimeline': [
        {
          'id': 'delivery-history-1',
          'oldStatus': 'DRIVER_ASSIGNED',
          'newStatus': 'FAILED_PICKUP',
          'createdAt': '2026-07-14T10:30:00.000Z',
          'changedBy': {'id': 'driver-1', 'displayName': 'Driver'},
        },
      ],
    });

    expect(detail.deliveryId, 'delivery-1');
    expect(detail.workflowType, 'ACCOUNTABILITY_AND_RECOVERY');
    expect(detail.availableActions, contains('VERIFY'));
    expect(detail.strikeImpact, 'STRIKE_IF_VERIFIED');
    expect(detail.operationalState, 'REQUIRES_RESOLUTION');
    expect(detail.reviewedByName, 'Admin');
    expect(detail.reviewedBy?.id, isNotEmpty);
    expect(detail.pickupWindowStart, isNotNull);
    expect(detail.pendingReschedule?.reason, 'STALE_PICKUP_ADMIN_REQUEST');
    expect(detail.pendingReschedule?.proposedPickupWindowEnd, isNotNull);
    expect(detail.deliveryTimeline, hasLength(1));
    expect(detail.deliveryTimeline.single.id, 'delivery-history-1');
    expect(detail.quantityStatus?.heldQuantity, 4);
  });
}
