import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/deliveries/application/learner_deliveries_provider.dart';
import 'package:frontend/features/reservations/application/my_reservations_provider.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/presentation/pages/learner_reservations_page.dart';
import 'package:frontend/l10n/app_localizations.dart';

Map<String, dynamic> _baseReservation({
  required String id,
  required String status,
  String title = 'Small DC Gear Motors Pair',
  String fulfillmentMethod = 'PICKUP',
  Map<String, dynamic>? paymentSummary,
  Map<String, dynamic>? activeDelivery,
  double? materialSubtotal,
}) {
  return {
    'id': id,
    'status': status,
    'quantityRequested': 2,
    'fulfillmentMethod': fulfillmentMethod,
    'createdAt': '2026-07-26T10:00:00.000Z',
    'updatedAt': '2026-07-26T10:00:00.000Z',
    'materialSubtotal': materialSubtotal,
    'material': {
      'id': 'mat-1',
      'title': title,
      'materialType': 'Motors',
      'status': 'RESERVED',
      'unit': 'piece',
      'deliveryAllowed': true,
    },
    'supplier': {'id': 'sup-1', 'displayName': 'Majd Tech Reuse Workshop'},
    if (paymentSummary != null) 'paymentSummary': paymentSummary,
    if (activeDelivery != null) 'activeDelivery': activeDelivery,
  };
}

Map<String, dynamic> _paymentSummary({
  String overallStatus = 'REQUIRES_PAYMENT',
  bool enforcementEnabled = true,
  bool hasMaterialPaymentOutstanding = true,
  bool hasDeliveryFeeOutstanding = false,
  String? checkoutableOrderId,
  String? outstandingAmount = '16.00',
  bool pickupCodeAvailable = false,
  bool fulfillmentReady = false,
  bool? dueAtHandover,
}) {
  final resolvedDueAtHandover = dueAtHandover ??
      (overallStatus == 'REQUIRES_PAYMENT' &&
          (hasMaterialPaymentOutstanding || hasDeliveryFeeOutstanding));
  return {
    'enforcementEnabled': enforcementEnabled,
    'paymentMethod': 'CASH',
    'dueAtHandover': resolvedDueAtHandover,
    'overallStatus': overallStatus,
    'outstandingOrderCount':
        (hasMaterialPaymentOutstanding ? 1 : 0) +
        (hasDeliveryFeeOutstanding ? 1 : 0),
    'outstandingAmount': outstandingAmount,
    'currency': 'NIS',
    'hasMaterialPaymentOutstanding': hasMaterialPaymentOutstanding,
    'hasDeliveryFeeOutstanding': hasDeliveryFeeOutstanding,
    'checkoutableOrderId': checkoutableOrderId,
    'fulfillmentReady': fulfillmentReady,
    'pickupCodeAvailable': pickupCodeAvailable,
    'deliveryDispatchable': false,
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

dynamic _overrides(List<LearnerReservation> reservations) => [
  authControllerProvider.overrideWith(_LearnerAuthController.new),
  myReservationsProvider.overrideWith((ref) async => reservations),
  learnerDeliveriesProvider.overrideWith((ref) async => const []),
];

Future<void> _pumpPage(
  WidgetTester tester, {
  required List<LearnerReservation> reservations,
  Locale locale = const Locale('en'),
  Size size = const Size(800, 600),
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() async {
    await tester.binding.setSurfaceSize(null);
  });

  await tester.pumpWidget(
    ProviderScope(
      overrides: _overrides(reservations),
      child: MaterialApp(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const LearnerReservationsPage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _pumpRoutedPage(
  WidgetTester tester, {
  required List<LearnerReservation> reservations,
  Size size = const Size(800, 600),
}) async {
  final router = GoRouter(
    initialLocation: '/learner/reservations',
    routes: [
      GoRoute(
        path: '/learner/reservations',
        builder: (context, state) => const LearnerReservationsPage(),
      ),
      GoRoute(
        path: '/learner/reservations/:id',
        builder: (context, state) {
          final focus = state.uri.queryParameters['focus'];
          final orderId = state.uri.queryParameters['orderId'];
          return Scaffold(
            body: Text(
              'details:${state.pathParameters['id']}:focus=$focus:order=$orderId',
            ),
          );
        },
      ),
      GoRoute(
        path: '/learner/checkout/reservation/:reservationId',
        builder: (context, state) => Scaffold(
          body: Text(
            'checkout-reservation:${state.pathParameters['reservationId']}',
          ),
        ),
      ),
      GoRoute(
        path: '/learner/checkout/:orderId',
        builder: (context, state) =>
            Scaffold(body: Text('checkout:${state.pathParameters['orderId']}')),
      ),
      GoRoute(
        path: '/learner/deliveries/:id',
        builder: (context, state) =>
            Scaffold(body: Text('delivery:${state.pathParameters['id']}')),
      ),
      GoRoute(
        path: '/learner/deliveries/:id/track',
        builder: (context, state) =>
            Scaffold(body: Text('track:${state.pathParameters['id']}')),
      ),
    ],
  );

  await tester.binding.setSurfaceSize(size);
  addTearDown(() async {
    await tester.binding.setSurfaceSize(null);
  });

  await tester.pumpWidget(
    ProviderScope(
      overrides: _overrides(reservations),
      child: MaterialApp.router(
        locale: const Locale('en'),
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
}

void main() {
  testWidgets('payment-required pickup card shows cash due at handover', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-pay',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpPage(tester, reservations: [reservation]);

    expect(find.text('View details'), findsOneWidget);
    expect(find.text('Due at handover'), findsOneWidget);
    expect(find.text('Pay now'), findsNothing);
    expect(find.byKey(const Key('reservation-next-step-panel')), findsOneWidget);
    expect(find.text('PICKUP-CODE-SECRET'), findsNothing);
  });

  testWidgets('partial delivery payment card shows cash due at handover', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-partial',
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        paymentSummary: _paymentSummary(
          hasMaterialPaymentOutstanding: false,
          hasDeliveryFeeOutstanding: true,
          outstandingAmount: '12.00',
        ),
      ),
    );

    await _pumpPage(tester, reservations: [reservation]);

    expect(find.text('Due at handover'), findsOneWidget);
    expect(find.text('Remaining'), findsOneWidget);
    expect(find.textContaining('12.00'), findsOneWidget);
    expect(find.text('Complete payment'), findsNothing);
  });

  testWidgets('paid and ready pickup shows view pickup code action', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-ready',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(
          overallStatus: 'PAID',
          hasMaterialPaymentOutstanding: false,
          checkoutableOrderId: null,
          outstandingAmount: null,
          pickupCodeAvailable: true,
          fulfillmentReady: true,
        ),
      ),
    );

    await _pumpPage(tester, reservations: [reservation]);

    expect(find.text('View pickup code'), findsOneWidget);
    expect(find.text('Pay now'), findsNothing);
    expect(find.text('CODE-1234'), findsNothing);
  });

  testWidgets('refund-pending card has no payment CTA', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-refund',
        status: 'CANCELLED',
        paymentSummary: _paymentSummary(
          overallStatus: 'REFUND_PENDING',
          hasMaterialPaymentOutstanding: false,
          checkoutableOrderId: null,
          outstandingAmount: null,
        ),
      ),
    );

    await _pumpPage(tester, reservations: [reservation]);

    expect(find.text('Refund pending'), findsOneWidget);
    expect(find.text('Pay now'), findsNothing);
    expect(find.text('Complete payment'), findsNothing);
  });

  testWidgets('completed card is compact and shows view details', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-done',
        status: 'COMPLETED',
        paymentSummary: _paymentSummary(
          overallStatus: 'PAID',
          hasMaterialPaymentOutstanding: false,
          checkoutableOrderId: null,
          outstandingAmount: null,
          fulfillmentReady: true,
        ),
      ),
    );

    await _pumpPage(tester, reservations: [reservation]);

    expect(find.text('Completed'), findsWidgets);
    expect(find.text('View details'), findsWidgets);
    expect(find.text('Pay now'), findsNothing);
  });

  testWidgets('payments-disabled card hides pay CTA', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-off',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(
          enforcementEnabled: false,
          overallStatus: 'PAYMENT_DISABLED',
          hasMaterialPaymentOutstanding: false,
          checkoutableOrderId: null,
          outstandingAmount: null,
          pickupCodeAvailable: true,
          fulfillmentReady: true,
        ),
      ),
    );

    await _pumpPage(tester, reservations: [reservation]);

    expect(find.text('Pay now'), findsNothing);
    expect(find.text('Payment required'), findsNothing);
  });

  testWidgets('empty list state', (tester) async {
    await _pumpPage(tester, reservations: const []);
    expect(find.text('No reservations yet'), findsOneWidget);
    expect(find.text('Browse materials'), findsOneWidget);
  });

  testWidgets('empty filter state', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(id: 'res-pending', status: 'PENDING'),
    );
    await _pumpPage(tester, reservations: [reservation]);

    await tester.ensureVisible(find.widgetWithText(InkWell, 'Completed'));
    await tester.tap(find.widgetWithText(InkWell, 'Completed'));
    await tester.pumpAndSettle();

    expect(find.text('No matching reservations'), findsOneWidget);
  });

  testWidgets('Arabic RTL labels for payment required card', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-ar',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpPage(
      tester,
      reservations: [reservation],
      locale: const Locale('ar'),
    );

    expect(find.text('حجوزاتي'), findsWidgets);
    expect(find.text('مستحق عند التسليم'), findsWidgets);
    expect(find.text('ادفع الآن'), findsNothing);
    expect(find.text('Pay now'), findsNothing);
  });

  testWidgets('English LTR page remains readable', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-en',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpPage(tester, reservations: [reservation]);

    expect(find.text('My reservations'), findsWidgets);
    expect(find.text('Due at handover'), findsOneWidget);
    expect(find.text('Pay now'), findsNothing);
  });

  testWidgets('cash due at handover opens reservation details, not checkout', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-checkout',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpRoutedPage(tester, reservations: [reservation]);
    final primaryButton = find.byKey(const Key('reservation-primary-action'));
    await tester.ensureVisible(primaryButton);
    await tester.tap(primaryButton);
    await tester.pumpAndSettle();

    expect(find.text('checkout:ord-77'), findsNothing);
    expect(find.text('checkout-reservation:res-checkout'), findsNothing);
    expect(
      find.text('details:res-checkout:focus=null:order=null'),
      findsOneWidget,
    );
  });

  testWidgets('opens details from secondary action', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-details',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpRoutedPage(tester, reservations: [reservation]);
    final detailsButton = find.byKey(const Key('reservation-primary-action'));
    expect(detailsButton, findsOneWidget);
    await tester.ensureVisible(detailsButton);
    await tester.tap(detailsButton);
    await tester.pumpAndSettle();

    expect(
      find.text('details:res-details:focus=null:order=null'),
      findsOneWidget,
    );
  });

  testWidgets('track delivery primary action', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-del',
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        activeDelivery: {'id': 'del-9', 'status': 'ON_THE_WAY'},
        paymentSummary: _paymentSummary(
          overallStatus: 'PAID',
          hasMaterialPaymentOutstanding: false,
          checkoutableOrderId: null,
          outstandingAmount: null,
          fulfillmentReady: true,
        ),
      ),
    );

    await _pumpRoutedPage(tester, reservations: [reservation]);
    final trackButton = find.byKey(const Key('reservation-primary-action'));
    expect(find.text('Track delivery'), findsOneWidget);
    await tester.ensureVisible(trackButton);
    await tester.tap(trackButton);
    await tester.pumpAndSettle();
    expect(find.text('delivery:del-9'), findsOneWidget);
  });

  testWidgets('no overflow at supported sizes', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-size',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    const sizes = [
      Size(390, 844),
      Size(430, 932),
      Size(768, 1024),
      Size(1024, 768),
      Size(1440, 900),
    ];

    for (final size in sizes) {
      await _pumpPage(tester, reservations: [reservation], size: size);
      expect(tester.takeException(), isNull);
      expect(find.text('Due at handover'), findsOneWidget, reason: 'status at $size');
      expect(find.text('All'), findsOneWidget);
    }
  });

  testWidgets('filter selection updates list', (tester) async {
    final pending = LearnerReservation.fromJson(
      _baseReservation(id: 'res-p', status: 'PENDING', title: 'Pending item'),
    );
    final completed = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-c',
        status: 'COMPLETED',
        title: 'Completed item',
      ),
    );

    await _pumpPage(tester, reservations: [pending, completed]);
    expect(find.text('Pending item'), findsOneWidget);
    expect(find.text('Completed item'), findsOneWidget);

    await tester.ensureVisible(find.widgetWithText(InkWell, 'Completed'));
    await tester.tap(find.widgetWithText(InkWell, 'Completed'));
    await tester.pumpAndSettle();

    expect(find.text('Pending item'), findsNothing);
    expect(find.text('Completed item'), findsOneWidget);
  });

  testWidgets('loading skeleton appears on first load', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() async {
      await tester.binding.setSurfaceSize(null);
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_LearnerAuthController.new),
          myReservationsProvider.overrideWith((ref) async {
            await Future<void>.delayed(const Duration(milliseconds: 80));
            return const <LearnerReservation>[];
          }),
          learnerDeliveriesProvider.overrideWith((ref) async => const []),
        ],
        child: MaterialApp(
          locale: const Locale('en'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: const LearnerReservationsPage(),
        ),
      ),
    );

    await tester.pump();
    expect(find.bySemanticsLabel('Loading your reservations'), findsOneWidget);
    await tester.pumpAndSettle();
  });

  testWidgets('error state offers retry', (tester) async {
    final router = GoRouter(
      initialLocation: '/learner/reservations',
      routes: [
        GoRoute(
          path: '/learner/reservations',
          builder: (context, state) => const LearnerReservationsPage(),
        ),
      ],
    );

    await tester.binding.setSurfaceSize(const Size(800, 600));
    addTearDown(() async {
      await tester.binding.setSurfaceSize(null);
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_LearnerAuthController.new),
          myReservationsProvider.overrideWith((ref) {
            return Future<List<LearnerReservation>>.error(Exception('network'));
          }),
          learnerDeliveriesProvider.overrideWith((ref) async => const []),
        ],
        child: MaterialApp.router(
          locale: const Locale('en'),
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
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();

    expect(find.text('My reservations'), findsWidgets);
    expect(find.textContaining('Could not load'), findsOneWidget);
    expect(find.textContaining('Try again'), findsWidgets);
  });
}
