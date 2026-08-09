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
import 'package:frontend/features/reservations/presentation/learner_reservation_payment_presentation.dart';
import 'package:frontend/features/reservations/presentation/pages/learner_reservations_page.dart';
import 'package:frontend/features/reservations/presentation/widgets/learner_reservation_list_card.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/widgets/app_status_badge.dart';

Map<String, dynamic> _baseReservation({
  required String id,
  required String status,
  String title = 'HC-SR04 Ultrasonic Sensors',
  String unit = 'piece',
  String fulfillmentMethod = 'PICKUP',
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
  int outstandingOrderCount = 1,
  bool pickupCodeAvailable = false,
  bool fulfillmentReady = false,
}) {
  return {
    'enforcementEnabled': enforcementEnabled,
    'overallStatus': overallStatus,
    'outstandingOrderCount': outstandingOrderCount,
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
  Size size = const Size(1200, 900),
  double textScale = 1.0,
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() async {
    await tester.binding.setSurfaceSize(null);
  });

  await tester.pumpWidget(
    ProviderScope(
      overrides: _overrides(reservations),
      child: MediaQuery(
        data: MediaQueryData(
          size: size,
          textScaler: TextScaler.linear(textScale),
          padding: size.width < 600
              ? const EdgeInsets.only(bottom: 20)
              : EdgeInsets.zero,
        ),
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

void main() {
  testWidgets('money visible when outstandingAmount exists', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-pay',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpPage(tester, reservations: [reservation]);

    expect(find.byKey(const Key('reservation-money-section')), findsOneWidget);
    expect(find.text('Amount due'), findsOneWidget);
    expect(find.textContaining('16.00'), findsOneWidget);
    expect(find.text('Pay now'), findsOneWidget);
  });

  testWidgets('partial payment shows remaining without inventing totals', (
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
          checkoutableOrderId: 'fee-1',
          outstandingAmount: '20.00',
        ),
      ),
    );

    await _pumpPage(tester, reservations: [reservation]);

    expect(find.text('Remaining'), findsOneWidget);
    expect(find.textContaining('20.00'), findsOneWidget);
    expect(find.textContaining('من أصل'), findsNothing);
    expect(find.textContaining('of'), findsNothing);
    expect(find.text('Complete payment'), findsOneWidget);
  });

  testWidgets('closed card has no danger rail and no pay CTA', (tester) async {
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

    await _pumpPage(tester, reservations: [reservation]);

    expect(find.text('Pay now'), findsNothing);
    expect(find.byType(LearnerReservationListCard), findsOneWidget);
    final presentation = buildReservationCardPresentation(
      reservation,
      l10n: lookupAppLocalizations(const Locale('en')),
    );
    expect(presentation.showActionAccent, isFalse);
    expect(presentation.isHistoricalCompact, isTrue);
  });

  testWidgets('action-required uses list card with money and next-step panel', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-action',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpPage(tester, reservations: [reservation]);

    expect(find.byKey(const Key('reservation-next-step-panel')), findsOneWidget);
    expect(find.byKey(const Key('reservation-primary-action')), findsOneWidget);
    expect(find.byKey(const Key('reservation-view-details')), findsOneWidget);
  });

  testWidgets('empty filter action says View all reservations', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(id: 'res-pending', status: 'PENDING'),
    );
    await _pumpPage(tester, reservations: [reservation]);

    await tester.ensureVisible(find.widgetWithText(InkWell, 'Completed'));
    await tester.tap(find.widgetWithText(InkWell, 'Completed'));
    await tester.pumpAndSettle();

    expect(find.text('No matching reservations'), findsOneWidget);
    expect(find.text('View all reservations'), findsOneWidget);
    expect(find.text('All'), findsWidgets); // filter chip may still exist
  });

  testWidgets('Arabic money and units are localized', (tester) async {
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
      size: const Size(390, 844),
    );

    expect(find.text('حجوزاتي'), findsNWidgets(2));
    expect(
      find.byKey(const ValueKey('app-back-breadcrumb-current')),
      findsOneWidget,
    );
    expect(find.text('المبلغ المطلوب'), findsOneWidget);
    expect(find.textContaining('16.00'), findsOneWidget);
    expect(find.text('قطعة واحدة'), findsOneWidget);
    expect(find.text('ادفع الآن'), findsOneWidget);
    expect(find.text('pieces'), findsNothing);
    expect(find.text('Pay now'), findsNothing);
  });

  testWidgets('Arabic empty filter uses view all label', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(id: 'res-p', status: 'PENDING'),
    );
    await _pumpPage(
      tester,
      reservations: [reservation],
      locale: const Locale('ar'),
      size: const Size(800, 900),
    );

    final completedChip = find.widgetWithText(InkWell, 'مكتمل');
    await tester.scrollUntilVisible(
      completedChip,
      200,
      scrollable: find
          .descendant(
            of: find.byType(SingleChildScrollView),
            matching: find.byType(Scrollable),
          )
          .last,
    );
    await tester.pumpAndSettle();
    await tester.tap(completedChip);
    await tester.pumpAndSettle();

    expect(find.text('لا توجد حجوزات مطابقة'), findsOneWidget);
    expect(find.text('عرض كل الحجوزات'), findsOneWidget);
  });

  testWidgets('mobile sizes have no overflow and keep CTAs', (tester) async {
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
      await _pumpPage(tester, reservations: [reservation], size: size);
      expect(tester.takeException(), isNull, reason: 'overflow at $size');
      expect(find.text('Pay now'), findsOneWidget, reason: 'CTA at $size');
      expect(
        find.byKey(const Key('reservations-summary-carousel')),
        findsOneWidget,
        reason: 'summary carousel at $size',
      );
    }
  });

  testWidgets('text scale 1.4 does not overflow', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-scale',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpPage(
      tester,
      reservations: [reservation],
      size: const Size(390, 844),
      textScale: 1.4,
    );

    expect(tester.takeException(), isNull);
    expect(find.text('Pay now'), findsOneWidget);
  });

  testWidgets('Pay CTA opens details with payment focus', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-nav',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(checkoutableOrderId: 'ord-55'),
      ),
    );

    final router = GoRouter(
      initialLocation: '/learner/reservations',
      routes: [
        GoRoute(
          path: '/learner/reservations',
          builder: (_, _) => const LearnerReservationsPage(),
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
          path: '/learner/checkout/:orderId',
          builder: (context, state) =>
              Scaffold(body: Text('checkout:${state.pathParameters['orderId']}')),
        ),
      ],
    );

    await tester.binding.setSurfaceSize(const Size(1200, 900));
    addTearDown(() async {
      await tester.binding.setSurfaceSize(null);
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: _overrides([reservation]),
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

    final pay = find.byKey(const Key('reservation-primary-action'));
    await tester.ensureVisible(pay);
    await tester.tap(pay);
    await tester.pumpAndSettle();

    expect(find.text('checkout:ord-55'), findsNothing);
    expect(
      find.text('details:res-nav:focus=payment:order=ord-55'),
      findsOneWidget,
    );
  });

  testWidgets('money presentation does not double-count shared fees', (
    tester,
  ) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-fee',
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        paymentSummary: _paymentSummary(
          hasMaterialPaymentOutstanding: false,
          hasDeliveryFeeOutstanding: true,
          outstandingAmount: '12.00',
          outstandingOrderCount: 1,
        ),
      ),
    );

    final money = buildReservationMoneyPresentation(
      reservation,
      l10n: lookupAppLocalizations(const Locale('en')),
    );

    expect(money, isNotNull);
    expect(money!.amountLine, contains('12.00'));
    expect(money.supportingLine, isNotNull);
    // Server already attributed shared fee once; UI must not invent another.
    expect(money.amountLine!.contains('24'), isFalse);
  });

  testWidgets('desktop uses three-zone list card', (tester) async {
    final reservation = LearnerReservation.fromJson(
      _baseReservation(
        id: 'res-desk',
        status: 'ACCEPTED',
        paymentSummary: _paymentSummary(),
      ),
    );

    await _pumpPage(tester, reservations: [reservation], size: const Size(1280, 900));

    expect(find.byType(LearnerReservationListCard), findsOneWidget);
    expect(find.text('Majd Tech Reuse Workshop'), findsOneWidget);
    expect(find.text('1 piece'), findsOneWidget);
    expect(find.textContaining('Majd Tech Reuse Workshop ·'), findsNothing);
  });
}
