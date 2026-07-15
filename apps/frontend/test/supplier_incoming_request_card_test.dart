import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/incoming_request_card.dart';

void main() {
  testWidgets('renders canonical inbox fields without a duplicated learner note', (
    tester,
  ) async {
    final request = SupplierIncomingRequest(
      id: '24a91f00',
      materialTitle: 'Small DC Gear Motors Pair',
      learnerName: 'Majd Learner',
      quantityRequested: 2,
      unit: 'pieces',
      status: SupplierIncomingRequestStatus.pending,
      requestedAt: DateTime(2026, 7, 12),
      workflowPhase: const SupplierEnumValue(
        SupplierWorkflowPhase.initialDecision,
        'INITIAL_DECISION',
      ),
      attentionState: const SupplierEnumValue(
        SupplierAttentionState.supplierActionRequired,
        'SUPPLIER_ACTION_REQUIRED',
      ),
      nextActor: const SupplierEnumValue(
        SupplierNextActor.supplier,
        'SUPPLIER',
      ),
      fulfillmentContract: const SupplierFulfillmentSummary(label: 'Pickup'),
      scheduleSummary: SupplierScheduleSummary(
        activeWindowType: 'LEARNER_PREFERRED',
        effectiveWindow: SupplierScheduleWindow(
          start: DateTime(2026, 7, 18, 10),
          end: DateTime(2026, 7, 18, 12),
        ),
      ),
      learnerNote: 'Please use the north entrance.',
      messageSummary: const SupplierMessageSummary(
        matchesOriginalLearnerNote: true,
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 1280,
            child: IncomingRequestCard(
              request: request,
              primaryLabel: 'Review request',
              onPrimaryAction: () {},
              onView: () {},
            ),
          ),
        ),
      ),
    );

    expect(find.text('Small DC Gear Motors Pair'), findsOneWidget);
    expect(find.text('Pending'), findsOneWidget);
    expect(find.text('Needs your response · Next: Supplier'), findsOneWidget);
    expect(find.text('Please use the north entrance.'), findsNothing);
  });
}
