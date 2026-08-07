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
import 'package:frontend/features/reservations/presentation/pages/learner_reservations_page.dart';
import 'package:frontend/features/reservations/presentation/widgets/learner_reservation_list_card.dart';
import 'package:frontend/features/reservations/presentation/widgets/learner_reservation_details_body.dart';
import 'package:frontend/l10n/app_localizations.dart';

Map<String, dynamic> _baseReservation({
  required String id,
  required String status,
  String title = 'Arduino Uno R3 Boards',
  String fulfillmentMethod = 'PICKUP',
  String unit = 'piece',
  Map<String, dynamic>? paymentSummary,
  Map<String, dynamic>? activeDelivery,
}) {
  return {
    'id': id,
    'status': status,
    'quantityRequested': 1,
    'fulfillmentMethod': fulfillmentMethod,
    'createdAt': '2026-08-06T10:00:00.000Z',
    'updatedAt': '2026-08-06T10:00:00.000Z',
    'materialSubtotal': 16,
    'material': {
      'id': 'mat-1',
      'title': title,
      'materialType': 'Electronics',
      'status': 'RESERVED',
      'unit': unit,
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
  String? checkoutableOrderId = 'ord-1',
  String? outstandingAmount = '16.00',
  bool pickupCodeAvailable = false,
  bool fulfillmentReady = false,
}) {
  return {
    'enforcementEnabled': enforcementEnabled,
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

dynamic _overrides({
  required List<LearnerReservation> reservations,
  LearnerReservation? detail,
}) {
  final detailReservation =
      detail ?? (reservations.isNotEmpty ? reservations.first : null);

  return [
    authControllerProvider.overrideWith(_LearnerAuthController.new),
    myReservationsProvider.overrideWith((ref) async => reservations),
    learnerDeliveriesProvider.overrideWith((ref) async => const []),
    if (detailReservation != null)
      learnerReservationProvider(detailReservation.id).overrideWith(
        (ref) async => detailReservation,
      ),
  ];
}

Future<void> _pumpList(
  WidgetTester tester, {
  required List<LearnerReservation> reservations,
  Locale locale = const Locale('en'),
  Size size = const Size(800, 900),
  double textScale = 1.0,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() async {
    await tester.binding.setSurfaceSize(null);
  });

  await tester.pumpWidget(
    ProviderScope(
      overrides: _overrides(reservations: reservations),
      child: MediaQuery(
        data: MediaQueryData(size: size, textScaler: TextScaler.linear(textScale)),
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
    ),
  );
  await tester.pumpAndSettle();
}

Future<GoRouter> _pumpRouted(
  WidgetTester tester, {
  required List<LearnerReservation> reservations,
  String initialLocation = '/learner/reservations',
  Locale locale = const Locale('en'),
  Size size = const Size(800, 900),
}) async {
  final detail = reservations.first;
  final router = GoRouter(
    initialLocation: initialLocation,
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
          return LearnerReservationDetailPage(
            reservationId: state.pathParameters['id']!,
            focusPayment: focus == 'payment',
            focusPaymentOrderId: orderId,
          );
        },
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
    ],
  );

  await tester.binding.setSurfaceSize(size);
  addTearDown(() async {
    await tester.binding.setSurfaceSize(null);
  });

  await tester.pumpWidget(
    ProviderScope(
      overrides: _overrides(reservations: reservations, detail: detail),
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
  return router;
}

void main() {
  testWidgets('details route uses details body and has no recursive View details', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-1',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpRouted(
      tester,
      reservations: [reservation],
      initialLocation: '/learner/reservations/res-1?focus=payment&orderId=ord-1',
    );

    expect(find.byKey(const Key('reservation-details-layout')), findsOneWidget);
    expect(find.byKey(const Key('reservation-details-body')), findsOneWidget);
    expect(find.byType(LearnerReservationDetailsBody), findsOneWidget);
    expect(find.byType(LearnerReservationListCard), findsNothing);
    expect(find.byKey(const Key('reservation-view-details')), findsNothing);
    expect(find.text('View details'), findsNothing);
    expect(find.byKey(const Key('checkoutable-order-ord-1')), findsOneWidget);
  });

  testWidgets('list View details opens distinct details layout', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-2',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpRouted(tester, reservations: [reservation]);

    expect(find.byType(LearnerReservationListCard), findsOneWidget);
    await tester.tap(find.byKey(const Key('reservation-view-details')));
    await tester.pumpAndSettle();

    expect(find.byType(LearnerReservationDetailsBody), findsOneWidget);
    expect(find.byKey(const Key('reservation-view-details')), findsNothing);
  });

  testWidgets('Pay CTA opens details payment focus with checkoutable order', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-pay',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(checkoutableOrderId: 'ord-99'),
      ),
    );

    await _pumpRouted(tester, reservations: [reservation]);
    final payButton = find.byKey(const Key('reservation-primary-action'));
    await tester.ensureVisible(payButton);
    await tester.tap(payButton);
    await tester.pumpAndSettle();

    expect(find.textContaining('checkout:'), findsNothing);
    expect(find.byType(LearnerReservationDetailsBody), findsOneWidget);
    expect(find.byKey(const Key('checkoutable-order-ord-99')), findsOneWidget);
  });

  testWidgets('closed card has no error accent and no pay CTA', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-closed',
        status: 'CANCELLED',
        paymentSummary: _paymentSummary(
          overallStatus: 'CANCELLED',
          hasMaterialPaymentOutstanding: false,
          checkoutableOrderId: null,
          outstandingAmount: null,
        ),
      ),
    );

    await _pumpList(tester, reservations: [reservation]);

    expect(find.text('Pay now'), findsNothing);
    expect(find.text('Closed'), findsWidgets);
    final card = tester.widget<Container>(
      find.byKey(const Key('reservation-list-card-res-closed')),
    );
    final decoration = card.decoration! as BoxDecoration;
    expect(decoration.border, isA<Border>());
  });

  testWidgets('payment-required card exposes next-step panel and separated qty', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-pay2',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpList(tester, reservations: [reservation], size: const Size(1200, 900));

    expect(find.byKey(const Key('reservation-next-step-panel')), findsOneWidget);
    expect(find.text('1 piece'), findsOneWidget);
    expect(find.textContaining('piece ·'), findsNothing);
    expect(find.text('Majd Tech Reuse Workshop'), findsOneWidget);
    // Supplier should not be duplicated inside a combined metadata line.
    expect(find.textContaining('Majd Tech Reuse Workshop ·'), findsNothing);
  });

  testWidgets('Arabic list chrome has no English page strings', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-ar',
        status: 'ACCEPTED',
        unit: 'piece',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpList(
      tester,
      reservations: [reservation],
      locale: const Locale('ar'),
      size: const Size(390, 844),
    );

    expect(find.text('حجوزاتي'), findsOneWidget);
    expect(find.byTooltip('تحديث'), findsOneWidget);
    expect(find.text('يتطلب إجراء'), findsWidgets);
    expect(find.text('1 قطعة'), findsNothing);
    expect(find.text('قطعة واحدة'), findsOneWidget);
    expect(find.text('My reservations'), findsNothing);
    expect(find.text('Refresh'), findsNothing);
    expect(find.text('All reservations'), findsNothing);
    expect(find.textContaining('pieces'), findsNothing);
  });

  testWidgets('Arabic details chrome is localized', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-ar-d',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpRouted(
      tester,
      reservations: [reservation],
      locale: const Locale('ar'),
      initialLocation: '/learner/reservations/res-ar-d',
    );

    expect(find.text('تفاصيل الحجز'), findsOneWidget);
    expect(find.text('جميع الحجوزات'), findsOneWidget);
    expect(find.text('تحديث'), findsWidgets);
    expect(find.text('Reservation details'), findsNothing);
    expect(find.text('All reservations'), findsNothing);
    expect(find.text('Refresh'), findsNothing);
  });

  testWidgets('mobile sizes have no overflow and keep primary CTA', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-m',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    const sizes = [
      Size(320, 700),
      Size(360, 800),
      Size(390, 844),
      Size(412, 915),
      Size(430, 932),
    ];

    for (final size in sizes) {
      await _pumpList(tester, reservations: [reservation], size: size);
      expect(tester.takeException(), isNull, reason: 'overflow at $size');
      expect(find.text('Pay now'), findsOneWidget, reason: 'CTA at $size');
      expect(
        find.byKey(const Key('reservation-primary-action')),
        findsOneWidget,
      );
    }
  });

  testWidgets('text scale 1.4 does not overflow on mobile', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-scale',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpList(
      tester,
      reservations: [reservation],
      size: const Size(390, 844),
      textScale: 1.4,
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Pay now'), findsOneWidget);
  });

  testWidgets('details still exposes operational controls for accepted pickup', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson({
      ..._baseReservation(
        id: 'res-ops',
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
      'pickupWindowStart': '2026-08-06T08:00:00.000Z',
      'pickupWindowEnd': '2026-08-06T12:00:00.000Z',
      'pickupLocationFull': {
        'city': 'Nablus',
        'addressLine': 'Workshop Street 12',
        'latitude': 32.22,
        'longitude': 35.25,
        'isApproximate': false,
      },
    });

    await _pumpRouted(
      tester,
      reservations: [reservation],
      initialLocation: '/learner/reservations/res-ops',
    );

    expect(find.byType(LearnerReservationDetailsBody), findsOneWidget);
    expect(find.text('View details'), findsNothing);
    expect(find.textContaining('Nablus'), findsWidgets);
    expect(find.textContaining('Workshop Street 12'), findsWidgets);
  });
}
