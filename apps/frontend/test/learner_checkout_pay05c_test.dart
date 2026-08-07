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
import 'package:frontend/features/payments/data/models/reservation_checkout_session.dart';
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

LearnerReservation _reservation({
  String fulfillmentMethod = 'PICKUP',
  double deliveryFee = 0,
  double totalAmount = 16,
}) {
  return LearnerReservation.fromJson({
    'id': 'res-1',
    'status': 'ACCEPTED',
    'quantityRequested': 1,
    'fulfillmentMethod': fulfillmentMethod,
    'createdAt': '2026-08-06T10:00:00.000Z',
    'updatedAt': '2026-08-06T10:00:00.000Z',
    'materialSubtotal': 16,
    'deliveryFee': deliveryFee,
    'totalAmount': totalAmount,
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
      'outstandingAmount': totalAmount.toStringAsFixed(2),
      'currency': 'NIS',
      'hasMaterialPaymentOutstanding': true,
      'hasDeliveryFeeOutstanding': deliveryFee > 0,
      'checkoutableOrderId': 'ord-1',
      'fulfillmentReady': false,
      'pickupCodeAvailable': false,
      'deliveryDispatchable': false,
    },
  });
}

ReservationPaymentRequirement _requirement({
  String overallStatus = 'REQUIRES_PAYMENT',
  String materialStatus = 'REQUIRES_PAYMENT',
  bool materialCanCheckout = true,
  Map<String, dynamic>? deliveryFee,
  List<Map<String, dynamic>>? orders,
  List<String>? outstanding,
  String fulfillmentMethod = 'PICKUP',
}) {
  return ReservationPaymentRequirement.fromJson({
    'reservationId': 'res-1',
    'reservationStatus': overallStatus == 'PAID' ? 'ACCEPTED' : 'ACCEPTED',
    'paymentEnforcementEnabled': true,
    'overallStatus': overallStatus,
    'fulfillmentMethod': fulfillmentMethod,
    'material': {
      'required': true,
      'status': materialStatus,
      'paymentOrderId': 'ord-1',
      'amount': '16.00',
      'currency': 'NIS',
      'cycleNumber': 1,
      'canStartCheckout': materialCanCheckout,
    },
    'deliveryFee': deliveryFee,
    'orders': orders ??
        [
          {
            'id': 'ord-1',
            'purpose': 'MATERIAL_SUBTOTAL',
            'amount': '16.00',
            'currency': 'NIS',
            'status': materialStatus,
            'cycleNumber': 1,
            'isCurrent': true,
            'canStartCheckout': materialCanCheckout,
          },
        ],
    'paymentReady': overallStatus == 'PAID',
    'fulfillmentReady': overallStatus == 'PAID',
    'pickupCodeAvailable': overallStatus == 'PAID',
    'outstandingPaymentOrderIds':
        outstanding ?? (overallStatus == 'PAID' ? <String>[] : ['ord-1']),
  });
}

ReservationCheckoutSession _session({
  String status = 'CREATED',
  String attemptStatus = 'CREATED',
  String totalAmount = '16.00',
  int totalAmountMinor = 1600,
  String? attemptId = 'att-1',
  List<Map<String, dynamic>>? items,
  List<Map<String, dynamic>>? orderStatuses,
}) {
  return ReservationCheckoutSession.fromJson({
    'checkoutSessionId': 'sess-1',
    'reservationId': 'res-1',
    'deliveryGroupId': null,
    'status': status,
    'currency': 'NIS',
    'totalAmount': totalAmount,
    'totalAmountMinor': totalAmountMinor,
    'items': items ??
        [
          {
            'paymentOrderId': 'ord-1',
            'purpose': 'MATERIAL_SUBTOTAL',
            'amount': '16.00',
            'amountMinor': 1600,
            'currency': 'NIS',
            'status': 'PENDING',
          },
        ],
    'attemptId': attemptId,
    'attemptStatus': attemptStatus,
    'checkoutUrl': 'https://example.test/mock/$attemptId',
    'expiresAt': '2026-08-06T11:00:00.000Z',
    'orderStatuses': orderStatuses ??
        [
          {'paymentOrderId': 'ord-1', 'status': 'CHECKOUT_PENDING'},
        ],
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
    ReservationPaymentRequirement? requirement,
    this.throwOnFetch,
  })  : order = initialOrder ?? PaymentOrder.fromJson(_orderJson(id: 'ord-1')),
        requirement = requirement ?? _requirement();

  PaymentOrder order;
  ReservationPaymentRequirement requirement;
  ReservationCheckoutSession? session;
  ApiException? throwOnFetch;
  int fetchOrderCount = 0;
  int fetchRequirementCount = 0;
  int fetchSessionCount = 0;
  int reservationCheckoutCount = 0;
  int legacyCheckoutCount = 0;
  int actCount = 0;
  String? lastActAction;
  String? lastIdempotencyKey;
  bool blockDuplicateCheckout = false;
  bool checkoutInFlight = false;

  @override
  Future<PaymentOrder> fetchPaymentOrder(String orderId) async {
    fetchOrderCount++;
    if (throwOnFetch != null) throw throwOnFetch!;
    return order;
  }

  @override
  Future<ReservationPaymentRequirement> fetchReservationPaymentRequirement(
    String reservationId,
  ) async {
    fetchRequirementCount++;
    if (throwOnFetch != null) throw throwOnFetch!;
    return requirement;
  }

  @override
  Future<ReservationCheckoutSession> startReservationCheckout({
    required String reservationId,
    required String idempotencyKey,
  }) async {
    reservationCheckoutCount++;
    lastIdempotencyKey = idempotencyKey;
    if (checkoutInFlight) {
      throw const ApiException(
        message: 'Request is already being processed.',
        code: 'IDEMPOTENCY_IN_PROGRESS',
        statusCode: 409,
      );
    }
    if (blockDuplicateCheckout && reservationCheckoutCount > 1) {
      throw const ApiException(
        message: 'Duplicate blocked',
        code: 'IDEMPOTENCY_IN_PROGRESS',
        statusCode: 409,
      );
    }
    final attemptId = 'att-$reservationCheckoutCount';
    order = PaymentOrder.fromJson(
      _orderJson(
        id: order.id,
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
    session = _session(
      attemptId: attemptId,
      totalAmount: requirement.orders
              .where((r) => r.isCurrent && r.canStartCheckout)
              .fold<double>(0, (sum, row) {
            try {
              return sum + double.parse(row.amount);
            } catch (_) {
              return sum;
            }
          }).toStringAsFixed(2),
      totalAmountMinor: requirement.orders
          .where((r) => r.isCurrent && r.canStartCheckout)
          .fold<int>(0, (sum, row) {
        try {
          return sum + (double.parse(row.amount) * 100).round();
        } catch (_) {
          return sum;
        }
      }),
      items: requirement.orders
          .where((r) => r.isCurrent && r.canStartCheckout)
          .map(
            (row) => {
              'paymentOrderId': row.id,
              'purpose': row.purpose,
              'amount': row.amount,
              'amountMinor': (double.tryParse(row.amount) != null)
                  ? (double.parse(row.amount) * 100).round()
                  : 0,
              'currency': row.currency,
              'status': 'PENDING',
            },
          )
          .toList(),
    );
    return session!;
  }

  @override
  Future<ReservationCheckoutSession> fetchCheckoutSession(String sessionId) async {
    fetchSessionCount++;
    return session ?? _session(status: 'CREATED');
  }

  @override
  Future<ReservationCheckoutSession?> fetchReservationCheckoutSession(
    String reservationId,
  ) async {
    fetchSessionCount++;
    return session;
  }

  @override
  Future<void> reconcileExpiredCheckoutSessions({String? reservationId}) async {}

  @override
  Future<ReservationCheckoutSession> cancelReservationCheckoutAttempt({
    required String sessionId,
    required String attemptId,
  }) async {
    session = _session(status: 'CANCELLED', attemptStatus: 'CANCELLED');
    order = PaymentOrder.fromJson(
      _orderJson(
        id: order.id,
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
    return session!;
  }

  @override
  Future<PaymentCheckoutSession> startCheckout({
    required String orderId,
    required String idempotencyKey,
  }) async {
    legacyCheckoutCount++;
    throw StateError(
      'Legacy startCheckout must not be used by reservation checkout',
    );
  }

  @override
  Future<MockCheckoutActResult> actOnMockCheckout({
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
              'amount': session?.totalAmount ?? '16.00',
              'amountMinor': session?.totalAmountMinor ?? 1600,
              'currency': 'NIS',
              'createdAt': '2026-08-06T10:05:00.000Z',
              'succeededAt': '2026-08-06T10:06:00.000Z',
            },
          ],
        ),
      );
      requirement = _requirement(
        overallStatus: 'PAID',
        materialStatus: 'PAID',
        materialCanCheckout: false,
        outstanding: const [],
        orders: [
          {
            'id': 'ord-1',
            'purpose': 'MATERIAL_SUBTOTAL',
            'amount': '16.00',
            'currency': 'NIS',
            'status': 'PAID',
            'cycleNumber': 1,
            'isCurrent': true,
            'canStartCheckout': false,
          },
          if (session != null && session!.items.length > 1)
            {
              'id': 'ord-fee',
              'purpose': 'DELIVERY_FEE',
              'amount': '5.00',
              'currency': 'NIS',
              'status': 'PAID',
              'cycleNumber': 1,
              'isCurrent': true,
              'canStartCheckout': false,
            },
        ],
      );
      session = _session(
        status: 'SUCCEEDED',
        attemptStatus: 'SUCCEEDED',
        attemptId: attemptId,
        totalAmount: session?.totalAmount ?? '16.00',
        totalAmountMinor: session?.totalAmountMinor ?? 1600,
        items: session?.items
                .map(
                  (item) => {
                    'paymentOrderId': item.paymentOrderId,
                    'purpose': item.purpose,
                    'amount': item.amount,
                    'amountMinor': item.amountMinor,
                    'currency': item.currency,
                    'status': 'SETTLED',
                  },
                )
                .toList() ??
            const [],
        orderStatuses: session?.items
                .map(
                  (item) => {
                    'paymentOrderId': item.paymentOrderId,
                    'status': 'PAID',
                  },
                )
                .toList() ??
            const [],
      );
      return MockCheckoutActResult(checkoutSession: session);
    }
    if (action == 'decline') {
      session = _session(
        status: 'FAILED',
        attemptStatus: 'FAILED',
        attemptId: attemptId,
      );
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
      return MockCheckoutActResult(checkoutSession: session);
    }
    if (action == 'pending') {
      session = _session(
        status: 'CHECKOUT_PENDING',
        attemptStatus: 'PENDING',
        attemptId: attemptId,
      );
      return MockCheckoutActResult(checkoutSession: session);
    }
    return MockCheckoutActResult(checkoutSession: session);
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
    throw StateError(
      'Legacy cancelAttempt must not be used by reservation checkout',
    );
  }
}

class _FakeReservationsRepository implements ReservationsRepository {
  _FakeReservationsRepository({this.reservation});

  final LearnerReservation? reservation;

  @override
  dynamic noSuchMethod(Invocation invocation) {
    if (invocation.memberName == #fetchReservation) {
      return Future.value(reservation ?? _reservation());
    }
    return super.noSuchMethod(invocation);
  }
}

Future<void> _pumpCheckout(
  WidgetTester tester, {
  required _FakePaymentsRepository payments,
  Size size = const Size(390, 844),
  Locale locale = const Locale('en'),
  String reservationId = 'res-1',
  LearnerReservation? reservation,
  bool settle = true,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() async {
    await tester.binding.setSurfaceSize(null);
  });

  final router = GoRouter(
    initialLocation: '/learner/checkout/reservation/$reservationId',
    routes: [
      GoRoute(
        path: '/learner/checkout/reservation/:reservationId',
        builder: (context, state) => LearnerCheckoutPage(
          reservationId: state.pathParameters['reservationId']!,
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
          reservationsRepositoryProvider.overrideWithValue(
            _FakeReservationsRepository(reservation: reservation),
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
    ),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PAY-05C/D learner checkout', () {
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
      final notifier = container
          .read(learnerCheckoutControllerProvider('res-1').notifier);

      final first = notifier.continueToPayment();
      final second = notifier.continueToPayment();
      await Future.wait([first, second]);
      await tester.pumpAndSettle();

      expect(payments.reservationCheckoutCount, lessThanOrEqualTo(1));
      expect(payments.legacyCheckoutCount, 0);
    });

    testWidgets('processing then verified success from backend session truth',
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
      final notifier = container
          .read(learnerCheckoutControllerProvider('res-1').notifier);

      await notifier.continueToPayment();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('checkout_mock_review')), findsOneWidget);

      notifier.openReview();
      await tester.pumpAndSettle();
      await notifier.confirmMockPayment();
      await tester.pumpAndSettle();

      expect(payments.lastActAction, 'success');
      expect(payments.actCount, 1);
      expect(payments.legacyCheckoutCount, 0);
      expect(find.textContaining('successful'), findsOneWidget);
      expect(find.byKey(const Key('checkout_result_primary')), findsOneWidget);
    });

    testWidgets('does not auto-chain sibling order checkouts', (tester) async {
      final payments = _FakePaymentsRepository(
        requirement: _requirement(
          orders: [
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
            {
              'id': 'ord-fee',
              'purpose': 'DELIVERY_FEE',
              'amount': '5.00',
              'currency': 'NIS',
              'status': 'REQUIRES_PAYMENT',
              'cycleNumber': 1,
              'isCurrent': true,
              'canStartCheckout': true,
            },
          ],
          outstanding: ['ord-1', 'ord-fee'],
          deliveryFee: {
            'required': true,
            'status': 'REQUIRES_PAYMENT',
            'paymentOrderId': 'ord-fee',
            'amount': '5.00',
            'currency': 'NIS',
            'cycleNumber': 1,
            'canStartCheckout': true,
            'applicable': true,
          },
        ),
      );
      await _pumpCheckout(
        tester,
        payments: payments,
        size: const Size(1440, 1600),
        reservation: _reservation(
          fulfillmentMethod: 'DELIVERY',
          deliveryFee: 5,
          totalAmount: 21,
        ),
      );

      expect(find.textContaining('21.00'), findsWidgets);
      expect(find.textContaining('two payments'), findsNothing);
      expect(find.textContaining('after this'), findsNothing);

      final container = ProviderScope.containerOf(
        tester.element(find.byType(LearnerCheckoutPage)),
      );
      final notifier = container
          .read(learnerCheckoutControllerProvider('res-1').notifier);

      await notifier.continueToPayment();
      await tester.pumpAndSettle();
      expect(find.textContaining('21.00'), findsWidgets);

      await notifier.confirmMockPayment();
      await tester.pumpAndSettle();

      expect(payments.reservationCheckoutCount, 1);
      expect(payments.actCount, 1);
      expect(payments.legacyCheckoutCount, 0);
      expect(find.textContaining('successful'), findsOneWidget);
    });

    testWidgets('material paid fee-only shows Paid material and remaining fee',
        (tester) async {
      final payments = _FakePaymentsRepository(
        initialOrder: PaymentOrder.fromJson(
          _orderJson(
            id: 'ord-fee',
            purpose: 'DELIVERY_FEE',
            amount: '5.00',
          ),
        ),
        requirement: _requirement(
          materialStatus: 'PAID',
          materialCanCheckout: false,
          overallStatus: 'REQUIRES_PAYMENT',
          outstanding: ['ord-fee'],
          deliveryFee: {
            'required': true,
            'status': 'REQUIRES_PAYMENT',
            'paymentOrderId': 'ord-fee',
            'amount': '5.00',
            'currency': 'NIS',
            'cycleNumber': 1,
            'canStartCheckout': true,
            'applicable': true,
          },
          orders: [
            {
              'id': 'ord-1',
              'purpose': 'MATERIAL_SUBTOTAL',
              'amount': '16.00',
              'currency': 'NIS',
              'status': 'PAID',
              'cycleNumber': 1,
              'isCurrent': true,
              'canStartCheckout': false,
            },
            {
              'id': 'ord-fee',
              'purpose': 'DELIVERY_FEE',
              'amount': '5.00',
              'currency': 'NIS',
              'status': 'REQUIRES_PAYMENT',
              'cycleNumber': 1,
              'isCurrent': true,
              'canStartCheckout': true,
            },
          ],
        ),
      );
      await _pumpCheckout(
        tester,
        payments: payments,
        size: const Size(1440, 900),
        reservation: _reservation(
          fulfillmentMethod: 'DELIVERY',
          deliveryFee: 5,
          totalAmount: 21,
        ),
      );

      expect(find.text('Paid'), findsWidgets);
      expect(find.textContaining('5.00'), findsWidgets);
      expect(find.textContaining('pickup code'), findsNothing);
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
      final notifier = container
          .read(learnerCheckoutControllerProvider('res-1').notifier);

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
        requirement: _requirement(
          overallStatus: 'PAID',
          materialStatus: 'PAID',
          materialCanCheckout: false,
          outstanding: const [],
        ),
      );
      await _pumpCheckout(
        tester,
        payments: payments,
        size: const Size(1440, 900),
      );

      expect(find.textContaining('Already paid'), findsOneWidget);
      expect(find.byKey(const Key('checkout_desktop_primary')), findsNothing);
    });

    testWidgets('cancelled reservation is non-checkoutable', (tester) async {
      final payments = _FakePaymentsRepository(
        requirement: ReservationPaymentRequirement.fromJson({
          'reservationId': 'res-1',
          'reservationStatus': 'CANCELLED',
          'paymentEnforcementEnabled': true,
          'overallStatus': 'NOT_REQUIRED',
          'fulfillmentMethod': 'PICKUP',
          'material': {
            'required': true,
            'status': 'CANCELLED',
            'paymentOrderId': 'ord-c',
            'amount': '16.00',
            'currency': 'NIS',
            'cycleNumber': 1,
            'canStartCheckout': false,
          },
          'deliveryFee': null,
          'orders': [],
          'paymentReady': false,
          'fulfillmentReady': false,
          'pickupCodeAvailable': false,
          'outstandingPaymentOrderIds': [],
        }),
      );
      await _pumpCheckout(tester, payments: payments);
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
      )..session = _session(status: 'EXPIRED', attemptStatus: 'EXPIRED');
      // Seed session via continuing would overwrite; inject by starting with
      // active expired session through continue path after manual state is hard.
      // Instead load then set session through start+fetch path:
      await _pumpCheckout(tester, payments: payments);

      final container = ProviderScope.containerOf(
        tester.element(find.byType(LearnerCheckoutPage)),
      );
      final notifier = container
          .read(learnerCheckoutControllerProvider('res-1').notifier);
      // Force expired session into controller via reconcile after assigning.
      await notifier.continueToPayment();
      payments.session =
          _session(status: 'EXPIRED', attemptStatus: 'EXPIRED');
      await notifier.reconcile(soft: true);
      await tester.pumpAndSettle();

      expect(find.textContaining('expired'), findsWidgets);
    });

    testWidgets('partially refunded is non-checkoutable', (tester) async {
      final payments = _FakePaymentsRepository(
        requirement: _requirement(
          overallStatus: 'PARTIALLY_REFUNDED',
          materialStatus: 'PAID',
          materialCanCheckout: false,
          outstanding: const [],
        ),
      );
      await _pumpCheckout(tester, payments: payments);
      expect(find.textContaining('Partial refund'), findsWidgets);
    });

    testWidgets('invalid or unauthorized reservation shows missing/error',
        (tester) async {
      final payments = _FakePaymentsRepository(
        throwOnFetch: const ApiException(
          message: 'Reservation not found.',
          code: 'NOT_FOUND',
          statusCode: 404,
        ),
      );
      await _pumpCheckout(tester, payments: payments);
      expect(find.textContaining('unavailable'), findsWidgets);
    });

    testWidgets('refresh/reconcile reloads requirement truth', (tester) async {
      final payments = _FakePaymentsRepository();
      await _pumpCheckout(tester, payments: payments);
      final before = payments.fetchRequirementCount;

      final context = tester.element(find.byType(LearnerCheckoutPage));
      final container = ProviderScope.containerOf(context);
      await container
          .read(learnerCheckoutControllerProvider('res-1').notifier)
          .reconcile();
      await tester.pumpAndSettle();

      expect(payments.fetchRequirementCount, greaterThan(before));
    });

    testWidgets(
      '8: browser/page reload restores active processing session without in-memory id',
      (tester) async {
        final payments = _FakePaymentsRepository()
          ..session = _session(
            status: 'CHECKOUT_PENDING',
            attemptStatus: 'PENDING',
          );
        await _pumpCheckout(tester, payments: payments, settle: false);
        final state = ProviderScope.containerOf(
          tester.element(find.byType(LearnerCheckoutPage)),
        ).read(learnerCheckoutControllerProvider('res-1'));
        expect(state.phase, CheckoutPhase.processing);
        expect(state.session?.checkoutSessionId, 'sess-1');
        expect(state.session?.attemptStatus, 'PENDING');
        // Stop polling timer so the test binding can tear down cleanly.
        ProviderScope.containerOf(
          tester.element(find.byType(LearnerCheckoutPage)),
        ).invalidate(learnerCheckoutControllerProvider('res-1'));
        await tester.pump();
      },
    );

    testWidgets(
      '9: app restart restores succeeded/failed session from reservation endpoint',
      (tester) async {
        final payments = _FakePaymentsRepository(
          requirement: _requirement(
            overallStatus: 'PAID',
            materialStatus: 'PAID',
            materialCanCheckout: false,
            outstanding: const [],
          ),
        )..session = _session(
            status: 'SUCCEEDED',
            attemptStatus: 'SUCCEEDED',
            orderStatuses: [
              {'paymentOrderId': 'ord-1', 'status': 'PAID'},
            ],
          );
        await _pumpCheckout(tester, payments: payments);
        final state = ProviderScope.containerOf(
          tester.element(find.byType(LearnerCheckoutPage)),
        ).read(learnerCheckoutControllerProvider('res-1'));
        expect(state.phase, CheckoutPhase.succeeded);
        expect(state.session?.status, 'SUCCEEDED');
      },
    );

    testWidgets(
      '13/14: shared-group review lists every line and total equals session charge',
      (tester) async {
        final payments = _FakePaymentsRepository()
          ..session = _session(
            totalAmount: '113.00',
            totalAmountMinor: 11300,
            items: [
              {
                'paymentOrderId': 'ord-a',
                'purpose': 'MATERIAL_SUBTOTAL',
                'amount': '70.00',
                'amountMinor': 7000,
                'currency': 'NIS',
                'status': 'PENDING',
                'reservationId': 'res-a',
                'materialTitle': 'Shared Material A',
              },
              {
                'paymentOrderId': 'ord-b',
                'purpose': 'MATERIAL_SUBTOTAL',
                'amount': '25.00',
                'amountMinor': 2500,
                'currency': 'NIS',
                'status': 'PENDING',
                'reservationId': 'res-b',
                'materialTitle': 'Shared Material B',
              },
              {
                'paymentOrderId': 'ord-fee',
                'purpose': 'DELIVERY_FEE',
                'amount': '18.00',
                'amountMinor': 1800,
                'currency': 'NIS',
                'status': 'PENDING',
                'reservationId': null,
                'materialTitle': null,
              },
            ],
          );
        await _pumpCheckout(tester, payments: payments);
        final container = ProviderScope.containerOf(
          tester.element(find.byType(LearnerCheckoutPage)),
        );
        await container
            .read(learnerCheckoutControllerProvider('res-1').notifier)
            .continueToPayment();
        await tester.pumpAndSettle();
        container
            .read(learnerCheckoutControllerProvider('res-1').notifier)
            .openReview();
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('checkout_review_line_ord-a')), findsOneWidget);
        expect(find.byKey(const Key('checkout_review_line_ord-b')), findsOneWidget);
        expect(find.byKey(const Key('checkout_review_line_ord-fee')), findsOneWidget);
        expect(find.textContaining('Shared Material A'), findsOneWidget);
        expect(find.textContaining('Shared Material B'), findsOneWidget);
        expect(find.byKey(const Key('checkout_review_total')), findsOneWidget);
        expect(find.textContaining('113.00'), findsWidgets);

        final session = payments.session!;
        expect(session.itemsAmountMinorSum, session.totalAmountMinor);
      },
    );

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
