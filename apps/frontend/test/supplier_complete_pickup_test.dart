import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_pickup_schedule_item.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_requests_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/incoming_request_card.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/pickup_schedule_card.dart';

void main() {
  test('complete response maps to completed incoming request', () {
    final request = SupplierIncomingRequest.fromJson({
      'id': 'res-complete-1',
      'status': 'COMPLETED',
      'quantityRequested': 1,
      'message': 'Need this for class.',
      'pickupType': 'SELF_PICKUP',
      'deliveryRequested': false,
      'completedAt': '2026-06-17T14:00:00.000Z',
      'createdAt': '2026-06-17T10:30:00.000Z',
      'material': {'title': 'Arduino Uno', 'unit': 'piece'},
      'learner': {'displayName': 'Ahmad'},
    });

    expect(request.status, SupplierIncomingRequestStatus.completed);
    expect(request.id, 'res-complete-1');
  });

  testWidgets('accepted pickup card shows Mark completed', (tester) async {
    final item = SupplierPickupScheduleItem(
      id: 'pickup-1',
      materialTitle: 'Wood scraps',
      learnerName: 'Sara',
      quantity: 2,
      unit: 'kg',
      status: SupplierPickupScheduleStatus.accepted,
      pickupType: 'Self pickup',
      canSupplierComplete: true,
      pickupWindow: SupplierPickupWindow(
        start: DateTime(2026, 6, 17, 10),
        end: DateTime(2026, 6, 17, 12),
      ),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PickupScheduleCard(
            item: item,
            groupKind: PickupScheduleGroupKind.today,
            onMarkCompleted: () {},
          ),
        ),
      ),
    );

    expect(find.text('Mark completed'), findsOneWidget);
  });

  testWidgets(
    'accepted delivery request hides Mark completed on incoming card',
    (tester) async {
      final request = SupplierIncomingRequest(
        id: 'delivery-1',
        materialTitle: 'Wood scraps',
        learnerName: 'Sara',
        quantityRequested: 2,
        unit: 'kg',
        status: SupplierIncomingRequestStatus.accepted,
        requestedAt: DateTime(2026, 6, 17, 9),
        deliveryRequested: true,
        activeDelivery: const SupplierReservationDeliverySummary(
          id: 'del-1',
          status: 'WAITING_FOR_DRIVER',
        ),
        canSupplierComplete: false,
        pickupPreference: 'Delivery requested',
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: IncomingRequestCard(request: request, onMarkCompleted: () {}),
          ),
        ),
      );

      expect(find.text('Mark completed'), findsNothing);
      expect(find.text('Waiting for driver delivery'), findsOneWidget);
      expect(
        find.text('The driver will complete this reservation after delivery.'),
        findsOneWidget,
      );
    },
  );

  testWidgets('delivery pickup schedule card shows delivery copy only', (
    tester,
  ) async {
    const item = SupplierPickupScheduleItem(
      id: 'pickup-delivery-1',
      materialTitle: 'Wood scraps',
      learnerName: 'Sara',
      quantity: 2,
      unit: 'kg',
      status: SupplierPickupScheduleStatus.accepted,
      pickupType: 'Delivery requested',
      deliveryRequested: true,
      activeDelivery: SupplierReservationDeliverySummary(
        id: 'del-2',
        status: 'ON_THE_WAY',
      ),
      canSupplierComplete: false,
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PickupScheduleCard(
            item: item,
            groupKind: PickupScheduleGroupKind.today,
            onMarkCompleted: () {},
          ),
        ),
      ),
    );

    expect(find.text('Mark completed'), findsNothing);
    expect(find.text('On the way'), findsOneWidget);
  });

  testWidgets('completed pickup card does not show Mark completed', (
    tester,
  ) async {
    final item = SupplierPickupScheduleItem(
      id: 'pickup-2',
      materialTitle: 'Cardboard boxes',
      learnerName: 'Omar',
      quantity: 1,
      unit: 'boxes',
      status: SupplierPickupScheduleStatus.completed,
      pickupType: 'Self pickup',
      completedAt: DateTime(2026, 6, 16, 15),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PickupScheduleCard(
            item: item,
            groupKind: PickupScheduleGroupKind.completed,
          ),
        ),
      ),
    );

    expect(find.text('Mark completed'), findsNothing);
  });

  test('completing reservation id provider clears loading state', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);

    expect(container.read(completingReservationIdProvider), isNull);

    container.read(completingReservationIdProvider.notifier).setCompleting('a');
    expect(container.read(completingReservationIdProvider), 'a');

    container
        .read(completingReservationIdProvider.notifier)
        .setCompleting(null);
    expect(container.read(completingReservationIdProvider), isNull);
  });
}
