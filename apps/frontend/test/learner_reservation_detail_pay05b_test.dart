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
import 'package:frontend/features/reservations/presentation/detail/reservation_detail_pickup_code_presentation.dart';
import 'package:frontend/features/reservations/presentation/detail/reservation_detail_timeline.dart';
import 'package:frontend/features/reservations/presentation/pages/learner_reservation_detail_page.dart';
import 'package:frontend/features/reservations/presentation/widgets/learner_reservation_details_body.dart';
import 'package:frontend/l10n/app_localizations.dart';

Map<String, dynamic> _baseReservation({
  required String id,
  required String status,
  String fulfillmentMethod = 'PICKUP',
  Map<String, dynamic>? paymentSummary,
  Map<String, dynamic>? extra,
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
      'title': 'Arduino Uno R3 Boards',
      'materialType': 'Electronics',
      'status': 'RESERVED',
      'unit': 'piece',
      'deliveryAllowed': true,
    },
    'supplier': {'id': 'sup-1', 'displayName': 'Majd Tech Reuse Workshop'},
    if (paymentSummary != null) 'paymentSummary': paymentSummary,
    ...?extra,
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

Future<void> _pumpDetail(
  WidgetTester tester, {
  required LearnerReservation reservation,
  Size size = const Size(390, 844),
  Locale locale = const Locale('en'),
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
    MediaQuery(
      data: MediaQueryData(size: size),
      child: ProviderScope(
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
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('pickup code presentation', () {
    test('available when server marks pickupCodeAvailable with code', () {
      final reservation = LearnerReservation.fromJson({
        ..._baseReservation(
          id: 'res-code',
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
        'selfPickupCode': '123456',
        'pickupHandoverPhase': 'DURING_ALLOWED',
      });

      final presentation = resolvePickupCodePresentation(reservation);
      expect(presentation.state, ReservationDetailPickupCodeState.available);
      expect(presentation.code, '123456');
    });

    test('locked when payment outstanding', () {
      final reservation = LearnerReservation.fromJson(
        _baseReservation(
          id: 'res-lock',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(),
        ),
      );

      expect(
        resolvePickupCodePresentation(reservation).state,
        ReservationDetailPickupCodeState.lockedByPayment,
      );
    });

    test('waiting when paid but window not started', () {
      final reservation = LearnerReservation.fromJson({
        ..._baseReservation(
          id: 'res-wait',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(
            overallStatus: 'PAID',
            hasMaterialPaymentOutstanding: false,
            checkoutableOrderId: null,
            outstandingAmount: null,
            pickupCodeAvailable: false,
            fulfillmentReady: true,
          ),
        ),
        'pickupHandoverPhase': 'BEFORE_ALLOWED',
      });

      expect(
        resolvePickupCodePresentation(reservation).state,
        ReservationDetailPickupCodeState.waitingForWindow,
      );
    });

    test('payment unavailable when summary missing on paid material', () {
      final reservation = LearnerReservation.fromJson(
        _baseReservation(
          id: 'res-missing-summary',
          status: 'ACCEPTED',
        ),
      );

      expect(
        resolvePickupCodePresentation(reservation).state,
        ReservationDetailPickupCodeState.paymentUnavailable,
      );
    });
  });

  group('timeline', () {
    test('omits ready-for-pickup while payment is still required', () {
      final reservation = LearnerReservation.fromJson(
        _baseReservation(
          id: 'res-timeline-pay',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(),
        ),
      );

      final entries = buildReservationDetailTimeline(
        reservation,
        l10n: lookupAppLocalizations(const Locale('en')),
      );

      expect(
        entries.any((e) => e.label.contains('Ready for pickup')),
        isFalse,
      );
      expect(
        entries.any((e) => e.label.contains('Payment required')),
        isFalse,
      );
      expect(reservation.paymentSummary?.dueAtHandover, isTrue);
    });

    test('includes ready-for-pickup once fulfillment is ready', () {
      final reservation = LearnerReservation.fromJson(
        _baseReservation(
          id: 'res-timeline-ready',
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

      final entries = buildReservationDetailTimeline(
        reservation,
        l10n: lookupAppLocalizations(const Locale('en')),
      );

      expect(
        entries.any((e) => e.label.contains('Ready for pickup')),
        isTrue,
      );
    });
  });

  group('detail page layout', () {
    testWidgets('shows cash due at handover and locked pickup code', (
      tester,
    ) async {
      final reservation = LearnerReservation.fromJson(
        _baseReservation(
          id: 'res-pay',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(),
        ),
      );

      await _pumpDetail(tester, reservation: reservation);

      expect(find.byKey(const Key('reservation-details-layout')), findsOneWidget);
      expect(find.byKey(const Key('reservation-details-body')), findsOneWidget);
      expect(find.text('Due at handover'), findsWidgets);
      expect(find.text('Pay now'), findsNothing);
      expect(
        find.text('Complete payment to unlock your pickup code.'),
        findsOneWidget,
      );
      expect(find.text('View details'), findsNothing);
    });

    testWidgets('shows available pickup code when server provides it', (
      tester,
    ) async {
      final reservation = LearnerReservation.fromJson({
        ..._baseReservation(
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
        'selfPickupCode': '654321',
        'pickupHandoverPhase': 'DURING_ALLOWED',
        'pickupWindowStart': '2026-08-06T08:00:00.000Z',
        'pickupWindowEnd': '2026-08-06T12:00:00.000Z',
      });

      await _pumpDetail(tester, reservation: reservation);

      expect(find.byKey(const Key('reservation-detail-pickup-code')), findsOneWidget);
      expect(find.textContaining('654'), findsWidgets);
      expect(find.text('Available now'), findsOneWidget);
    });

    testWidgets('quick actions include view material', (tester) async {
      final reservation = LearnerReservation.fromJson(
        _baseReservation(
          id: 'res-actions',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(
            overallStatus: 'PAID',
            hasMaterialPaymentOutstanding: false,
            checkoutableOrderId: null,
            outstandingAmount: null,
          ),
        ),
      );

      await _pumpDetail(tester, reservation: reservation, size: const Size(1440, 900));

      expect(find.text('View material'), findsWidgets);
      expect(find.text('Reservation summary'), findsOneWidget);
    });

    testWidgets('responsive sizes avoid overflow', (tester) async {
      final reservation = LearnerReservation.fromJson(
        _baseReservation(
          id: 'res-size',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(),
        ),
      );

      for (final size in const [
        Size(320, 700),
        Size(390, 844),
        Size(1440, 900),
      ]) {
        await _pumpDetail(tester, reservation: reservation, size: size);
        expect(tester.takeException(), isNull, reason: 'overflow at $size');
        expect(find.byType(LearnerReservationDetailsBody), findsOneWidget);
      }
    });

    testWidgets('Arabic detail strings are localized', (tester) async {
      final reservation = LearnerReservation.fromJson(
        _baseReservation(
          id: 'res-ar',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(),
        ),
      );

      await _pumpDetail(
        tester,
        reservation: reservation,
        locale: const Locale('ar'),
        size: const Size(1440, 900),
      );

      expect(find.text('تفاصيل الحجز'), findsNWidgets(2));
      expect(
        find.byKey(const ValueKey('app-back-breadcrumb-current')),
        findsOneWidget,
      );
      expect(find.text('ملخص الحجز'), findsOneWidget);
      expect(find.text('أكمل الدفع لفتح رمز الاستلام.'), findsOneWidget);
      expect(find.text('Complete payment to unlock your pickup code.'), findsNothing);
    });
    testWidgets('cash due at handover does not show checkout sticky action', (
      tester,
    ) async {
      final reservation = LearnerReservation.fromJson(
        _baseReservation(
          id: 'res-sticky',
          status: 'ACCEPTED',
          paymentSummary: _paymentSummary(),
        ),
      );

      await _pumpDetail(
        tester,
        reservation: reservation,
        size: const Size(390, 844),
      );

      expect(
        find.byKey(const Key('reservation-detail-sticky-action')),
        findsNothing,
      );
    });
  });
}
