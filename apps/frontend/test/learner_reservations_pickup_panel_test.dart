import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/deliveries/application/learner_deliveries_provider.dart';
import 'package:frontend/features/deliveries/data/models/learner_delivery.dart';
import 'package:frontend/features/reservations/application/my_reservations_provider.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/presentation/pages/learner_reservations_page.dart';

void main() {
  const reservationId = 'res-accepted-1';
  const deliveryId = 'delivery-1';
  final acceptedReservation = LearnerReservation.fromJson({
    'id': reservationId,
    'status': 'ACCEPTED',
    'quantityRequested': 1,
    'createdAt': '2026-01-01T00:00:00.000Z',
    'updatedAt': '2026-01-01T00:00:00.000Z',
    'pickupWindowStart': '2026-06-27T10:00:00.000Z',
    'pickupWindowEnd': '2026-06-27T16:00:00.000Z',
    'pickupLocationFull': {
      'country': 'Palestine',
      'city': 'Nablus',
      'area': 'Old City',
      'addressLine': '12 Supplier Street',
      'latitude': 32.2211,
      'longitude': 35.2544,
      'isApproximate': false,
    },
    'canLearnerRequestDelivery': true,
    'material': {
      'id': 'mat-1',
      'title': 'Wood panels',
      'materialType': 'Wood',
      'status': 'RESERVED',
      'unit': 'sheet',
      'deliveryAllowed': true,
    },
    'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    'paymentSummary': {
      'enforcementEnabled': false,
      'overallStatus': 'PAYMENT_DISABLED',
      'outstandingOrderCount': 0,
      'outstandingAmount': null,
      'currency': 'NIS',
      'hasMaterialPaymentOutstanding': false,
      'hasDeliveryFeeOutstanding': false,
      'checkoutableOrderId': null,
      'fulfillmentReady': true,
      'pickupCodeAvailable': true,
      'deliveryDispatchable': false,
    },
  });

  final deliveryReservation = LearnerReservation.fromJson({
    'id': reservationId,
    'status': 'ACCEPTED',
    'quantityRequested': 1,
    'fulfillmentMethod': 'DELIVERY',
    'activeDelivery': {'id': 'del-1', 'status': 'WAITING_FOR_DRIVER'},
    'createdAt': '2026-01-01T00:00:00.000Z',
    'updatedAt': '2026-01-01T00:00:00.000Z',
    'material': {
      'id': 'mat-1',
      'title': 'Wood panels',
      'materialType': 'Wood',
      'status': 'RESERVED',
      'unit': 'sheet',
      'deliveryAllowed': true,
    },
    'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
    'paymentSummary': {
      'enforcementEnabled': false,
      'overallStatus': 'PAYMENT_DISABLED',
      'outstandingOrderCount': 0,
      'outstandingAmount': null,
      'currency': 'NIS',
      'hasMaterialPaymentOutstanding': false,
      'hasDeliveryFeeOutstanding': false,
      'checkoutableOrderId': null,
      'fulfillmentReady': true,
      'pickupCodeAvailable': false,
      'deliveryDispatchable': true,
    },
  });

  LearnerDelivery buildDelivery() {
    return LearnerDelivery(
      id: deliveryId,
      reservationId: reservationId,
      status: 'WAITING_FOR_DRIVER',
      requestedAt: DateTime.parse('2026-01-02T00:00:00.000Z'),
      reservation: const LearnerDeliveryReservation(
        id: reservationId,
        status: 'ACCEPTED',
        material: LearnerDeliveryMaterial(
          id: 'mat-1',
          title: 'Wood panels',
          status: 'RESERVED',
        ),
        supplier: LearnerDeliverySupplier(id: 'sup-1', displayName: 'Supplier'),
      ),
      pickupLocation: const LearnerDeliveryLocation(
        id: 'pickup-1',
        country: 'Palestine',
        city: 'Nablus',
      ),
      dropoffLocation: const LearnerDeliveryLocation(
        id: 'dropoff-1',
        country: 'Palestine',
        city: 'Ramallah',
        addressLine: 'Campus gate',
      ),
    );
  }

  Future<void> pumpPage(
    WidgetTester tester, {
    required List<LearnerReservation> reservations,
    List<LearnerDelivery> deliveries = const [],
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_LearnerAuthController.new),
          myReservationsProvider.overrideWith((ref) async => reservations),
          learnerDeliveriesProvider.overrideWith((ref) async => deliveries),
        ],
        child: const MaterialApp(home: LearnerReservationsPage()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('accepted reservation shows redesigned list card without map', (
    tester,
  ) async {
    await pumpPage(tester, reservations: [acceptedReservation]);

    expect(find.text('Wood panels'), findsOneWidget);
    expect(find.text('View pickup code'), findsOneWidget);
    expect(find.bySemanticsLabel('Pickup location map'), findsNothing);
    expect(find.textContaining('Confirmed pickup:'), findsNothing);
  });

  testWidgets(
    'accepted reservation with delivery shows Track delivery action',
    (tester) async {
      await pumpPage(
        tester,
        reservations: [acceptedReservation],
        deliveries: [buildDelivery()],
      );

      expect(find.text('Track delivery'), findsOneWidget);
    },
  );

  testWidgets(
    'accepted reservation with active delivery shows track delivery CTA',
    (tester) async {
      await pumpPage(
        tester,
        reservations: [deliveryReservation],
        deliveries: const [],
      );

      expect(find.text('Request delivery'), findsNothing);
      expect(find.text('Track delivery'), findsOneWidget);
      expect(find.text('Wood panels'), findsOneWidget);
    },
  );
}

class _LearnerAuthController extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'learner-1',
        displayName: 'Learner',
        email: 'learner@impactloop.test',
        accountStatus: 'ACTIVE',
        roles: const ['LEARNER'],
        createdAt: DateTime(2026, 1, 1),
      ),
      accessToken: 'test-token',
      hasBootstrapped: true,
    );
  }
}
