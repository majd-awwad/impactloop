import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/admin_portal/data/admin_no_show_reports_api.dart';
import 'package:frontend/features/admin_portal/presentation/pages/admin_no_show_report_detail_page.dart';

class _FakeNoShowReportsApi extends AdminNoShowReportsApi {
  _FakeNoShowReportsApi(this.detail) : super(Dio());

  final AdminNoShowReportDetail detail;

  @override
  Future<AdminNoShowReportDetail> fetchReportDetail(String id) async => detail;
}

AdminNoShowReportDetail _detail({
  List<String> actions = const ['VERIFY', 'REQUEST_SUPPLIER_RESCHEDULE'],
  String workflowType = 'ACCOUNTABILITY_AND_RECOVERY',
}) {
  return AdminNoShowReportDetail.fromJson({
    'id': 'IR-00023',
    'reservationId': 'RES-3012',
    'deliveryId': 'DLV-0827',
    'status': 'PENDING_REVIEW',
    'reasonCode': 'PICKUP_FAILED',
    'note': 'Supplier did not arrive during the pickup window.',
    'targetRole': 'SUPPLIER',
    'createdAt': '2026-07-14T08:15:00.000Z',
    'workflowType': workflowType,
    'availableActions': actions,
    'strikeImpact': 'STRIKE_IF_VERIFIED',
    'operationalState': 'REQUIRES_RESOLUTION',
    'pickupWindowStart': '2026-07-14T10:00:00.000Z',
    'pickupWindowEnd': '2026-07-14T12:00:00.000Z',
    'reporter': {'id': 'driver-1', 'displayName': 'Majd Driver'},
    'target': {'id': 'supplier-1', 'displayName': 'Creative Studio'},
    'reservation': {
      'status': 'AWAITING_RESOLUTION',
      'fulfillmentMethod': 'PICKUP',
      'material': {'title': 'Clean Glass Jars Set'},
      'requester': {'displayName': 'Learner'},
      'owner': {'displayName': 'Creative Studio'},
    },
    'quantityStatus': {
      'materialQuantity': 12,
      'heldQuantity': 5,
      'availableQuantity': 7,
    },
    'messages': <Map<String, dynamic>>[],
    'activityHistory': <Map<String, dynamic>>[],
    'deliveryTimeline': <Map<String, dynamic>>[],
  });
}

void main() {
  testWidgets('renders a full incident workspace from contract actions', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1600, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final detail = _detail();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          adminNoShowReportsApiProvider.overrideWithValue(
            _FakeNoShowReportsApi(detail),
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: AdminNoShowReportDetailPage(reportId: 'IR-00023'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Incident overview'), findsOneWidget);
    expect(find.text('What happened'), findsOneWidget);
    expect(find.text('Reservation status'), findsOneWidget);
    expect(find.text('Activity timeline'), findsOneWidget);
    expect(find.text('Linked delivery timeline'), findsOneWidget);
    expect(find.text('Verify responsibility'), findsOneWidget);
    expect(find.text('Ask supplier for new pickup window'), findsOneWidget);
    expect(find.text('Reject report'), findsNothing);
  });
}
