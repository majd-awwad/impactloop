import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/payments/data/models/payment_order.dart';
import 'package:frontend/features/payments/data/models/reservation_payment_requirement.dart';
import 'package:frontend/features/payments/data/payments_repository.dart';
import 'package:frontend/features/payments/presentation/pages/learner_checkout_page.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/data/reservations_repository.dart';
import 'package:frontend/l10n/app_localizations.dart';

Map<String, dynamic> _orderJson({
  required String id,
  String status = 'REQUIRES_PAYMENT',
  List<Map<String, dynamic>> attempts = const [],
}) {
  return {
    'id': id,
    'purpose': 'MATERIAL_SUBTOTAL',
    'cycleNumber': 1,
    'status': status,
    'amount': '16.00',
    'amountMinor': 1600,
    'currency': 'NIS',
    'reservationId': 'res-1',
    'paidAt': status == 'PAID' ? '2026-08-06T11:00:00.000Z' : null,
    'createdAt': '2026-08-06T10:00:00.000Z',
    'updatedAt': '2026-08-06T10:00:00.000Z',
    'attempts': attempts,
  };
}

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

class _FakePaymentsRepository implements PaymentsRepository {
  _FakePaymentsRepository(this.order);

  PaymentOrder order;
  bool started = false;

  @override
  Future<PaymentOrder> fetchPaymentOrder(String orderId) async => order;

  @override
  Future<ReservationPaymentRequirement> fetchReservationPaymentRequirement(
    String reservationId,
  ) async {
    return ReservationPaymentRequirement.fromJson({
      'reservationId': 'res-1',
      'reservationStatus': 'ACCEPTED',
      'paymentEnforcementEnabled': true,
      'overallStatus': order.status == 'PAID' ? 'PAID' : 'REQUIRES_PAYMENT',
      'fulfillmentMethod': 'PICKUP',
      'material': {
        'required': true,
        'status': order.status,
        'paymentOrderId': order.id,
        'amount': '16.00',
        'currency': 'NIS',
        'cycleNumber': 1,
        'canStartCheckout': order.isPayable,
      },
      'deliveryFee': null,
      'orders': [],
      'paymentReady': order.isPaid,
      'fulfillmentReady': order.isPaid,
      'pickupCodeAvailable': order.isPaid,
      'outstandingPaymentOrderIds': order.isPayable ? [order.id] : [],
    });
  }

  @override
  Future<PaymentCheckoutSession> startCheckout({
    required String orderId,
    required String idempotencyKey,
  }) async {
    started = true;
    order = PaymentOrder.fromJson(
      _orderJson(
        id: orderId,
        status: 'CHECKOUT_PENDING',
        attempts: [
          {
            'id': 'att-1',
            'status': 'CREATED',
            'provider': 'MOCK',
            'providerMode': 'LOCAL',
            'amount': '16.00',
            'amountMinor': 1600,
            'currency': 'NIS',
            'createdAt': '2026-08-06T10:05:00.000Z',
          },
        ],
      ),
    );
    return PaymentCheckoutSession(
      orderId: orderId,
      orderStatus: 'CHECKOUT_PENDING',
      attemptId: 'att-1',
      attemptStatus: 'CREATED',
      checkoutUrl: 'https://example.test/mock/att-1',
    );
  }

  @override
  Future<PaymentOrder> actOnMockCheckout({
    required String attemptId,
    required String action,
    String? token,
  }) async {
    if (action == 'success') {
      order = PaymentOrder.fromJson(_orderJson(id: order.id, status: 'PAID'));
    } else if (action == 'decline') {
      order = PaymentOrder.fromJson(
        _orderJson(
          id: order.id,
          status: 'REQUIRES_PAYMENT',
          attempts: [
            {
              'id': attemptId,
              'status': 'FAILED',
              'provider': 'MOCK',
              'providerMode': 'LOCAL',
              'amount': '16.00',
              'amountMinor': 1600,
              'currency': 'NIS',
              'failureMessage': 'Declined',
              'createdAt': '2026-08-06T10:05:00.000Z',
            },
          ],
        ),
      );
    } else if (action == 'pending') {
      order = PaymentOrder.fromJson(
        _orderJson(
          id: order.id,
          status: 'CHECKOUT_PENDING',
          attempts: [
            {
              'id': attemptId,
              'status': 'PENDING',
              'provider': 'MOCK',
              'providerMode': 'LOCAL',
              'amount': '16.00',
              'amountMinor': 1600,
              'currency': 'NIS',
              'createdAt': '2026-08-06T10:05:00.000Z',
            },
          ],
        ),
      );
    }
    return order;
  }

  @override
  Future<
      ({
        String orderId,
        String attemptId,
        String attemptStatus,
        String orderStatus
      })> cancelAttempt({
    required String orderId,
    required String attemptId,
  }) async {
    return (
      orderId: orderId,
      attemptId: attemptId,
      attemptStatus: 'CANCELLED',
      orderStatus: 'REQUIRES_PAYMENT',
    );
  }
}

class _FakeReservationsRepository implements ReservationsRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) {
    if (invocation.memberName == #fetchReservation) {
      return Future.value(
        LearnerReservation.fromJson({
          'id': 'res-1',
          'status': 'ACCEPTED',
          'quantityRequested': 1,
          'fulfillmentMethod': 'PICKUP',
          'createdAt': '2026-08-06T10:00:00.000Z',
          'updatedAt': '2026-08-06T10:00:00.000Z',
          'materialSubtotal': 16,
          'totalAmount': 16,
          'currency': 'NIS',
          'material': {
            'id': 'mat-1',
            'title': 'HC-SR04 Ultrasonic Sensors',
            'materialType': 'Electronics',
            'status': 'RESERVED',
            'unit': 'piece',
            'deliveryAllowed': true,
          },
          'supplier': {
            'id': 'sup-1',
            'displayName': 'Majd Tech Reuse Workshop',
          },
          'pickupWindowStart': '2026-08-10T07:00:00.000Z',
          'pickupWindowEnd': '2026-08-10T09:00:00.000Z',
        }),
      );
    }
    return super.noSuchMethod(invocation);
  }
}

Future<void> _capture({
  required WidgetTester tester,
  required PaymentOrder order,
  required Size size,
  required String filename,
  Locale locale = const Locale('ar'),
  Future<void> Function(WidgetTester tester)? interact,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() async {
    await tester.binding.setSurfaceSize(null);
  });

  final payments = _FakePaymentsRepository(order);
  final router = GoRouter(
    initialLocation: '/learner/checkout/${order.id}',
    routes: [
      GoRoute(
        path: '/learner/checkout/:orderId',
        builder: (context, state) =>
            LearnerCheckoutPage(orderId: state.pathParameters['orderId']!),
      ),
    ],
  );

  await tester.pumpWidget(
    MediaQuery(
      data: MediaQueryData(size: size),
      child: ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_LearnerAuthController.new),
          paymentsRepositoryProvider.overrideWithValue(payments),
          reservationsRepositoryProvider
              .overrideWithValue(_FakeReservationsRepository()),
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
    ),
  );

  // Processing uses an indeterminate spinner + poll timer; settle would hang.
  if (order.isCheckoutPending &&
      order.activeAttempt?.status == 'PENDING') {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  } else {
    await tester.pumpAndSettle();
  }

  if (interact != null) {
    await interact(tester);
    await tester.pumpAndSettle();
  }

  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile('goldens/$filename'),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final goldensDir = Directory('test/goldens');
  if (!goldensDir.existsSync()) {
    goldensDir.createSync(recursive: true);
  }

  testWidgets('pay05c desktop arabic checkout', (tester) async {
    await _capture(
      tester: tester,
      order: PaymentOrder.fromJson(_orderJson(id: 'ord-1')),
      size: const Size(1440, 900),
      filename: 'pay05c_desktop_ar.png',
      locale: const Locale('ar'),
    );
  });

  testWidgets('pay05c mobile arabic 390', (tester) async {
    await _capture(
      tester: tester,
      order: PaymentOrder.fromJson(_orderJson(id: 'ord-1')),
      size: const Size(390, 844),
      filename: 'pay05c_mobile_390_ar.png',
    );
  });

  testWidgets('pay05c mobile arabic 412', (tester) async {
    await _capture(
      tester: tester,
      order: PaymentOrder.fromJson(_orderJson(id: 'ord-1')),
      size: const Size(412, 915),
      filename: 'pay05c_mobile_412_ar.png',
    );
  });

  testWidgets('pay05c processing', (tester) async {
    await _capture(
      tester: tester,
      order: PaymentOrder.fromJson(
        _orderJson(
          id: 'ord-proc',
          status: 'CHECKOUT_PENDING',
          attempts: [
            {
              'id': 'att-p',
              'status': 'PENDING',
              'provider': 'MOCK',
              'providerMode': 'LOCAL',
              'amount': '16.00',
              'amountMinor': 1600,
              'currency': 'NIS',
              'createdAt': '2026-08-06T10:05:00.000Z',
            },
          ],
        ),
      ),
      size: const Size(390, 844),
      filename: 'pay05c_processing_ar.png',
    );
  });

  testWidgets('pay05c success', (tester) async {
    await _capture(
      tester: tester,
      order: PaymentOrder.fromJson(_orderJson(id: 'ord-paid', status: 'PAID')),
      size: const Size(390, 844),
      filename: 'pay05c_success_ar.png',
    );
  });

  testWidgets('pay05c failure', (tester) async {
    await _capture(
      tester: tester,
      order: PaymentOrder.fromJson(
        _orderJson(
          id: 'ord-fail',
          status: 'REQUIRES_PAYMENT',
          attempts: [
            {
              'id': 'att-f',
              'status': 'FAILED',
              'provider': 'MOCK',
              'providerMode': 'LOCAL',
              'amount': '16.00',
              'amountMinor': 1600,
              'currency': 'NIS',
              'failureMessage': 'Declined',
              'createdAt': '2026-08-06T10:05:00.000Z',
            },
          ],
        ),
      ),
      size: const Size(390, 844),
      filename: 'pay05c_failure_ar.png',
    );
  });

  testWidgets('pay05c already paid', (tester) async {
    await _capture(
      tester: tester,
      order: PaymentOrder.fromJson(_orderJson(id: 'ord-paid2', status: 'PAID')),
      size: const Size(1440, 900),
      filename: 'pay05c_already_paid_ar.png',
    );
  });

  testWidgets('pay05c english desktop', (tester) async {
    await _capture(
      tester: tester,
      order: PaymentOrder.fromJson(_orderJson(id: 'ord-en')),
      size: const Size(1440, 900),
      filename: 'pay05c_desktop_en.png',
      locale: const Locale('en'),
    );
  });
}
