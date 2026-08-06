import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/deliveries/application/learner_deliveries_provider.dart';
import 'package:frontend/features/reservations/application/learner_reservation_provider.dart';
import 'package:frontend/features/reservations/application/my_reservations_provider.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/presentation/pages/learner_reservation_detail_page.dart';
import 'package:frontend/l10n/app_localizations.dart';

class _LearnerAuthController extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'learner-1',
        email: 'learner@test.com',
        displayName: 'Majd Learner',
        roles: const ['LEARNER'],
        accountStatus: 'ACTIVE',
        createdAt: DateTime(2026, 1, 1),
      ),
      accessToken: 'test-token',
      hasBootstrapped: true,
    );
  }
}

Map<String, dynamic> _paymentSummary({
  String overallStatus = 'REQUIRES_PAYMENT',
  bool hasMaterialPaymentOutstanding = true,
  String? checkoutableOrderId = 'ord-1',
  String? outstandingAmount = '16.00',
  bool pickupCodeAvailable = false,
}) {
  return {
    'enforcementEnabled': true,
    'overallStatus': overallStatus,
    'outstandingOrderCount': hasMaterialPaymentOutstanding ? 1 : 0,
    'outstandingAmount': outstandingAmount,
    'currency': 'NIS',
    'hasMaterialPaymentOutstanding': hasMaterialPaymentOutstanding,
    'hasDeliveryFeeOutstanding': false,
    'checkoutableOrderId': checkoutableOrderId,
    'fulfillmentReady': overallStatus == 'PAID',
    'pickupCodeAvailable': pickupCodeAvailable,
    'deliveryDispatchable': false,
  };
}

LearnerReservation _reservation({
  required String id,
  required String status,
  required Map<String, dynamic> paymentSummary,
  String fulfillmentMethod = 'PICKUP',
  Map<String, dynamic>? extra,
}) {
  return LearnerReservation.fromJson({
    'id': id,
    'status': status,
    'quantityRequested': 2,
    'fulfillmentMethod': fulfillmentMethod,
    'createdAt': '2026-07-20T10:00:00.000Z',
    'updatedAt': '2026-07-20T10:00:00.000Z',
    'materialSubtotal': 16,
    'deliveryFee': 0,
    'totalAmount': 16,
    'currency': 'NIS',
    'material': {
      'id': 'mat-1',
      'title': 'HC-SR04 Ultrasonic Sensors',
      'materialType': 'Electronics',
      'status': 'RESERVED',
      'unit': 'piece',
      'deliveryAllowed': true,
      'city': 'Nablus',
      'area': 'Old City',
    },
    'supplier': {'id': 'sup-1', 'displayName': 'Majd Tech Reuse Workshop'},
    'paymentSummary': paymentSummary,
    'pickupWindowStart': '2026-07-27T07:00:00.000Z',
    'pickupWindowEnd': '2026-07-27T09:00:00.000Z',
    ...?extra,
  });
}

Future<void> _pumpAndCapture({
  required WidgetTester tester,
  required LearnerReservation reservation,
  required Size size,
  required String filename,
  Locale locale = const Locale('ar'),
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() async {
    await tester.binding.setSurfaceSize(null);
  });

  final router = GoRouter(
    initialLocation: '/learner/reservations/${reservation.id}',
    routes: [
      GoRoute(
        path: '/learner/reservations/:id',
        builder: (context, state) => LearnerReservationDetailPage(
          reservationId: state.pathParameters['id']!,
        ),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(_LearnerAuthController.new),
        myReservationsProvider.overrideWith((ref) async => [reservation]),
        learnerDeliveriesProvider.overrideWith((ref) async => const []),
        learnerReservationProvider(reservation.id).overrideWith(
          (ref) async => reservation,
        ),
      ],
      child: MaterialApp.router(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();

  final directory = Directory('test/goldens');
  if (!directory.existsSync()) {
    directory.createSync(recursive: true);
  }

  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile('goldens/$filename'),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PAY-05B live screenshot goldens', () {
    testWidgets('desktop arabic payment required', (tester) async {
      await _pumpAndCapture(
        tester: tester,
        reservation: _reservation(
          id: 'pay05b-desktop-pay',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(),
          extra: {'pickupHandoverPhase': 'BEFORE_ALLOWED'},
        ),
        size: const Size(1440, 900),
        filename: 'pay05b_desktop_payment_required_ar.png',
      );
    });

    testWidgets('desktop arabic paid pickup code', (tester) async {
      await _pumpAndCapture(
        tester: tester,
        reservation: _reservation(
          id: 'pay05b-desktop-code',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(
            overallStatus: 'PAID',
            hasMaterialPaymentOutstanding: false,
            checkoutableOrderId: null,
            outstandingAmount: null,
            pickupCodeAvailable: true,
          ),
          extra: {
            'selfPickupCode': '482913',
            'pickupHandoverPhase': 'DURING_ALLOWED',
          },
        ),
        size: const Size(1440, 900),
        filename: 'pay05b_desktop_paid_pickup_ar.png',
      );
    });

    testWidgets('desktop arabic refund pending', (tester) async {
      await _pumpAndCapture(
        tester: tester,
        reservation: _reservation(
          id: 'pay05b-desktop-refund',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(
            overallStatus: 'REFUND_PENDING',
            hasMaterialPaymentOutstanding: false,
            checkoutableOrderId: null,
            outstandingAmount: null,
          ),
        ),
        size: const Size(1440, 900),
        filename: 'pay05b_desktop_refund_pending_ar.png',
      );
    });

    testWidgets('desktop delivery reservation', (tester) async {
      await _pumpAndCapture(
        tester: tester,
        reservation: _reservation(
          id: 'pay05b-desktop-delivery',
          status: 'ACCEPTED',
          fulfillmentMethod: 'DELIVERY',
          paymentSummary: _paymentSummary(
            overallStatus: 'PAID',
            hasMaterialPaymentOutstanding: false,
            checkoutableOrderId: null,
            outstandingAmount: null,
          ),
          extra: {
            'deliveryAddressText': '12 Learner Street, Ramallah',
            'activeDelivery': {
              'id': 'del-1',
              'status': 'WAITING_FOR_DRIVER',
            },
          },
        ),
        size: const Size(1440, 900),
        filename: 'pay05b_desktop_delivery_ar.png',
      );
    });

    testWidgets('mobile 390 payment required', (tester) async {
      await _pumpAndCapture(
        tester: tester,
        reservation: _reservation(
          id: 'pay05b-mobile-pay',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(),
        ),
        size: const Size(390, 844),
        filename: 'pay05b_mobile_390_payment_required_ar.png',
      );
    });

    testWidgets('mobile 412 pickup code available', (tester) async {
      await _pumpAndCapture(
        tester: tester,
        reservation: _reservation(
          id: 'pay05b-mobile-code',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(
            overallStatus: 'PAID',
            hasMaterialPaymentOutstanding: false,
            checkoutableOrderId: null,
            outstandingAmount: null,
            pickupCodeAvailable: true,
          ),
          extra: {
            'selfPickupCode': '482913',
            'pickupHandoverPhase': 'DURING_ALLOWED',
          },
        ),
        size: const Size(412, 915),
        filename: 'pay05b_mobile_412_pickup_code_ar.png',
      );
    });

    testWidgets('english desktop payment required', (tester) async {
      await _pumpAndCapture(
        tester: tester,
        reservation: _reservation(
          id: 'pay05b-desktop-en',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(),
        ),
        size: const Size(1440, 900),
        filename: 'pay05b_desktop_payment_required_en.png',
        locale: const Locale('en'),
      );
    });
  });
}
