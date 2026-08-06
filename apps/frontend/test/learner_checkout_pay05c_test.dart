import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/payments/application/learner_checkout_controller.dart';
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
  String purpose = 'MATERIAL_SUBTOTAL',
  String amount = '16.00',
  String? reservationId = 'res-1',
  List<Map<String, dynamic>> attempts = const [],
}) {
  return {
    'id': id,
    'purpose': purpose,
    'cycleNumber': 1,
    'status': status,
    'amount': amount,
    'amountMinor': 1600,
    'currency': 'NIS',
    'reservationId': reservationId,
    'deliveryGroupId': null,
    'paidAt': status == 'PAID' ? '2026-08-06T11:00:00.000Z' : null,
    'cancelledAt': status == 'CANCELLED' ? '2026-08-06T11:00:00.000Z' : null,
    'refundedAt': null,
    'createdAt': '2026-08-06T10:00:00.000Z',
    'updatedAt': '2026-08-06T10:00:00.000Z',
    'attempts': attempts,
    'refund': status == 'REFUND_PENDING'
        ? {
            'id': 'ref-1',
            'status': 'PENDING',
            'amount': amount,
            'currency': 'NIS',
            'requestedAt': '2026-08-06T11:00:00.000Z',
          }
        : null,
  };
}

LearnerReservation _reservation() {
  return LearnerReservation.fromJson({
    'id': 'res-1',
    'status': 'ACCEPTED',
    'quantityRequested': 1,
    'fulfillmentMethod': 'PICKUP',
    'createdAt': '2026-08-06T10:00:00.000Z',
    'updatedAt': '2026-08-06T10:00:00.000Z',
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
    },
    'supplier': {'id': 'sup-1', 'displayName': 'Majd Tech Reuse Workshop'},
    'pickupWindowStart': '2026-08-10T07:00:00.000Z',
    'pickupWindowEnd': '2026-08-10T09:00:00.000Z',
    'paymentSummary': {
      'enforcementEnabled': true,
      'overallStatus': 'REQUIRES_PAYMENT',
      'outstandingOrderCount': 1,
      'outstandingAmount': '16.00',
      'currency': 'NIS',
      'hasMaterialPaymentOutstanding': true,
      'hasDeliveryFeeOutstanding': false,
      'checkoutableOrderId': 'ord-1',
      'fulfillmentReady': false,
      'pickupCodeAvailable': false,
      'deliveryDispatchable': false,
    },
  });
}

ReservationPaymentRequirement _requirement() {
  return ReservationPaymentRequirement.fromJson({
    'reservationId': 'res-1',
    'reservationStatus': 'ACCEPTED',
    'paymentEnforcementEnabled': true,
    'overallStatus': 'REQUIRES_PAYMENT',
    'fulfillmentMethod': 'PICKUP',
    'material': {
      'required': true,
      'status': 'REQUIRES_PAYMENT',
      'paymentOrderId': 'ord-1',
      'amount': '16.00',
      'currency': 'NIS',
      'cycleNumber': 1,
      'canStartCheckout': true,
    },
    'deliveryFee': null,
    'orders': [
      {
        'id': 'ord-1',
        'purpose': 'MATERIAL_SUBTOTAL',
        'amount': '16.00',
        'currency': 'NIS',
        'status': 'REQUIRES_PAYMENT',
        'cycleNumber': 1,
        'isCurrent': true,
        'canStartCheckout': true,
      },
    ],
    'paymentReady': false,
    'fulfillmentReady': false,
    'pickupCodeAvailable': false,
    'outstandingPaymentOrderIds': ['ord-1'],
  });
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
  _FakePaymentsRepository({
    PaymentOrder? initialOrder,
    this.throwOnFetch,
  }) : order = initialOrder ??
            PaymentOrder.fromJson(_orderJson(id: 'ord-1'));

  PaymentOrder order;
  ApiException? throwOnFetch;
  int fetchCount = 0;
  int checkoutCount = 0;
  int actCount = 0;
  String? lastActAction;
  String? lastIdempotencyKey;
  bool blockDuplicateCheckout = false;
  bool checkoutInFlight = false;

  @override
  Future<PaymentOrder> fetchPaymentOrder(String orderId) async {
    fetchCount++;
    if (throwOnFetch != null) throw throwOnFetch!;
    return order;
  }

  @override
  Future<ReservationPaymentRequirement> fetchReservationPaymentRequirement(
    String reservationId,
  ) async {
    return _requirement();
  }

  @override
  Future<PaymentCheckoutSession> startCheckout({
    required String orderId,
    required String idempotencyKey,
  }) async {
    checkoutCount++;
    lastIdempotencyKey = idempotencyKey;
    if (checkoutInFlight) {
      throw const ApiException(
        message: 'Request is already being processed.',
        code: 'IDEMPOTENCY_IN_PROGRESS',
        statusCode: 409,
      );
    }
    if (blockDuplicateCheckout && checkoutCount > 1) {
      throw const ApiException(
        message: 'Duplicate blocked',
        code: 'IDEMPOTENCY_IN_PROGRESS',
        statusCode: 409,
      );
    }
    final attemptId = 'att-$checkoutCount';
    order = PaymentOrder.fromJson(
      _orderJson(
        id: orderId,
        status: 'CHECKOUT_PENDING',
        attempts: [
          {
            'id': attemptId,
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
      attemptId: attemptId,
      attemptStatus: 'CREATED',
      checkoutUrl: 'https://example.test/mock/$attemptId',
      expiresAt: DateTime.utc(2026, 8, 6, 11),
    );
  }

  @override
  Future<PaymentOrder> actOnMockCheckout({
    required String attemptId,
    required String action,
    String? token,
  }) async {
    actCount++;
    lastActAction = action;
    if (action == 'success') {
      order = PaymentOrder.fromJson(
        _orderJson(
          id: order.id,
          status: 'PAID',
          attempts: [
            {
              'id': attemptId,
              'status': 'SUCCEEDED',
              'provider': 'MOCK',
              'providerMode': 'LOCAL',
              'amount': '16.00',
              'amountMinor': 1600,
              'currency': 'NIS',
              'createdAt': '2026-08-06T10:05:00.000Z',
              'succeededAt': '2026-08-06T10:06:00.000Z',
            },
          ],
        ),
      );
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
              'failureCode': 'DECLINED',
              'failureMessage': 'Mock decline',
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
    order = PaymentOrder.fromJson(
      _orderJson(
        id: orderId,
        status: 'REQUIRES_PAYMENT',
        attempts: [
          {
            'id': attemptId,
            'status': 'CANCELLED',
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
      return Future.value(_reservation());
    }
    return super.noSuchMethod(invocation);
  }
}

Future<void> _pumpCheckout(
  WidgetTester tester, {
  required _FakePaymentsRepository payments,
  Size size = const Size(390, 844),
  Locale locale = const Locale('en'),
  String orderId = 'ord-1',
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() async {
    await tester.binding.setSurfaceSize(null);
  });

  final router = GoRouter(
    initialLocation: '/learner/checkout/$orderId',
    routes: [
      GoRoute(
        path: '/learner/checkout/:orderId',
        builder: (context, state) => LearnerCheckoutPage(
          orderId: state.pathParameters['orderId']!,
        ),
      ),
      GoRoute(
        path: '/learner/reservations',
        builder: (context, state) => const Scaffold(body: Text('reservations')),
      ),
      GoRoute(
        path: '/learner/reservations/:id',
        builder: (context, state) =>
            Scaffold(body: Text('details:${state.pathParameters['id']}')),
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
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PAY-05C learner checkout', () {
    testWidgets('valid checkout summary renders amount and purpose',
        (tester) async {
      final payments = _FakePaymentsRepository();
      await _pumpCheckout(tester, payments: payments);

      expect(find.textContaining('16.00'), findsWidgets);
      expect(find.textContaining('HC-SR04'), findsOneWidget);
      expect(find.byKey(const Key('checkout_sticky_primary')), findsOneWidget);
    });

    testWidgets('duplicate submission is blocked while submitting',
        (tester) async {
      final payments = _FakePaymentsRepository()..checkoutInFlight = true;
      await _pumpCheckout(tester, payments: payments);

      final container = ProviderScope.containerOf(
        tester.element(find.byType(LearnerCheckoutPage)),
      );
      final notifier =
          container.read(learnerCheckoutControllerProvider('ord-1').notifier);

      final first = notifier.continueToPayment();
      final second = notifier.continueToPayment();
      await Future.wait([first, second]);
      await tester.pumpAndSettle();

      expect(payments.checkoutCount, lessThanOrEqualTo(1));
    });

    testWidgets('processing then verified success from backend truth',
        (tester) async {
      final payments = _FakePaymentsRepository();
      await _pumpCheckout(
        tester,
        payments: payments,
        size: const Size(1440, 1600),
      );

      final container = ProviderScope.containerOf(
        tester.element(find.byType(LearnerCheckoutPage)),
      );
      final notifier =
          container.read(learnerCheckoutControllerProvider('ord-1').notifier);

      await notifier.continueToPayment();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('checkout_mock_review')), findsOneWidget);

      notifier.openReview();
      await tester.pumpAndSettle();
      await notifier.confirmMockPayment();
      await tester.pumpAndSettle();

      expect(payments.lastActAction, 'success');
      expect(find.textContaining('successful'), findsOneWidget);
      expect(find.byKey(const Key('checkout_result_primary')), findsOneWidget);
    });

    testWidgets('failure and retry recover to summary', (tester) async {
      final payments = _FakePaymentsRepository();
      await _pumpCheckout(
        tester,
        payments: payments,
        size: const Size(1440, 1600),
      );

      final container = ProviderScope.containerOf(
        tester.element(find.byType(LearnerCheckoutPage)),
      );
      final notifier =
          container.read(learnerCheckoutControllerProvider('ord-1').notifier);

      await notifier.continueToPayment();
      await tester.pumpAndSettle();
      await notifier.simulateDecline();
      await tester.pumpAndSettle();

      expect(find.textContaining('failed'), findsOneWidget);
      await notifier.retryFromFailure();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('checkout_desktop_primary')), findsOneWidget);
    });

    testWidgets('already paid shows non-checkoutable success state',
        (tester) async {
      final payments = _FakePaymentsRepository(
        initialOrder: PaymentOrder.fromJson(
          _orderJson(id: 'ord-paid', status: 'PAID'),
        ),
      );
      await _pumpCheckout(
        tester,
        payments: payments,
        orderId: 'ord-paid',
        size: const Size(1440, 900),
      );

      expect(find.textContaining('successful'), findsOneWidget);
      expect(find.byKey(const Key('checkout_desktop_primary')), findsNothing);
    });

    testWidgets('cancelled order is non-checkoutable', (tester) async {
      final payments = _FakePaymentsRepository(
        initialOrder: PaymentOrder.fromJson(
          _orderJson(id: 'ord-c', status: 'CANCELLED'),
        ),
      );
      await _pumpCheckout(
        tester,
        payments: payments,
        orderId: 'ord-c',
        locale: const Locale('en'),
      );
      expect(find.textContaining('cancelled'), findsWidgets);
    });

    testWidgets('expired attempt surfaces expired state', (tester) async {
      final payments = _FakePaymentsRepository(
        initialOrder: PaymentOrder.fromJson(
          _orderJson(
            id: 'ord-e',
            status: 'REQUIRES_PAYMENT',
            attempts: [
              {
                'id': 'att-e',
                'status': 'EXPIRED',
                'provider': 'MOCK',
                'providerMode': 'LOCAL',
                'amount': '16.00',
                'amountMinor': 1600,
                'currency': 'NIS',
                'createdAt': '2026-08-06T09:00:00.000Z',
              },
            ],
          ),
        ),
      );
      await _pumpCheckout(tester, payments: payments, orderId: 'ord-e');
      expect(find.textContaining('expired'), findsWidgets);
    });

    testWidgets('refund pending is non-checkoutable', (tester) async {
      final payments = _FakePaymentsRepository(
        initialOrder: PaymentOrder.fromJson(
          _orderJson(id: 'ord-r', status: 'REFUND_PENDING'),
        ),
      );
      await _pumpCheckout(tester, payments: payments, orderId: 'ord-r');
      expect(find.textContaining('Refund'), findsWidgets);
    });

    testWidgets('invalid or unauthorized order shows missing/error',
        (tester) async {
      final payments = _FakePaymentsRepository(
        throwOnFetch: const ApiException(
          message: 'Payment order not found.',
          code: 'NOT_FOUND',
          statusCode: 404,
        ),
      );
      await _pumpCheckout(tester, payments: payments);
      expect(find.textContaining('unavailable'), findsWidgets);
    });

    testWidgets('refresh/reconcile reloads backend order', (tester) async {
      final payments = _FakePaymentsRepository();
      await _pumpCheckout(tester, payments: payments);
      final before = payments.fetchCount;

      final context = tester.element(find.byType(LearnerCheckoutPage));
      final container = ProviderScope.containerOf(context);
      await container
          .read(learnerCheckoutControllerProvider('ord-1').notifier)
          .reconcile();
      await tester.pumpAndSettle();

      expect(payments.fetchCount, greaterThan(before));
    });

    testWidgets('Arabic RTL checkout summary', (tester) async {
      final payments = _FakePaymentsRepository();
      await _pumpCheckout(
        tester,
        payments: payments,
        locale: const Locale('ar'),
        size: const Size(390, 844),
      );

      expect(find.textContaining('إتمام الدفع'), findsWidgets);
      expect(find.textContaining('16.00'), findsWidgets);
      expect(
        Directionality.of(tester.element(find.byType(LearnerCheckoutPage))),
        TextDirection.rtl,
      );
    });

    testWidgets('responsive sticky action at 320 and 430', (tester) async {
      for (final width in [320.0, 360.0, 390.0, 412.0, 430.0]) {
        final payments = _FakePaymentsRepository();
        await _pumpCheckout(
          tester,
          payments: payments,
          size: Size(width, 844),
          locale: const Locale('ar'),
        );
        expect(
          find.byKey(const Key('checkout_sticky_primary')),
          findsOneWidget,
          reason: 'sticky missing at $width',
        );
        await tester.pumpWidget(const SizedBox.shrink());
      }
    });

    testWidgets('English desktop layout uses desktop primary CTA',
        (tester) async {
      final payments = _FakePaymentsRepository();
      await _pumpCheckout(
        tester,
        payments: payments,
        size: const Size(1440, 900),
        locale: const Locale('en'),
      );
      expect(find.byKey(const Key('checkout_desktop_primary')), findsOneWidget);
      expect(find.byKey(const Key('checkout_sticky_primary')), findsNothing);
      expect(find.text('Complete payment'), findsWidgets);
    });
  });
}
