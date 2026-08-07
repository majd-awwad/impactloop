import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/deliveries/application/learner_deliveries_provider.dart';
import 'package:frontend/features/reservations/application/my_reservations_provider.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/presentation/pages/learner_reservations_page.dart';
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

LearnerReservation _card({
  required String id,
  required String status,
  required Map<String, dynamic> paymentSummary,
  String title = 'Small DC Gear Motors Pair',
}) {
  return LearnerReservation.fromJson({
    'id': id,
    'status': status,
    'quantityRequested': 2,
    'fulfillmentMethod': 'PICKUP',
    'createdAt': '2026-07-26T10:00:00.000Z',
    'updatedAt': '2026-07-26T10:00:00.000Z',
    'material': {
      'id': 'mat-1',
      'title': title,
      'materialType': 'Motors',
      'status': 'RESERVED',
      'unit': 'piece',
      'deliveryAllowed': true,
    },
    'supplier': {'id': 'sup-1', 'displayName': 'Majd Tech Reuse Workshop'},
    'paymentSummary': paymentSummary,
  });
}

Future<void> _pump({
  required WidgetTester tester,
  required List<LearnerReservation> reservations,
  required Size size,
  Locale locale = const Locale('ar'),
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() async {
    await tester.binding.setSurfaceSize(null);
  });

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(_LearnerAuthController.new),
        myReservationsProvider.overrideWith((ref) async => reservations),
        learnerDeliveriesProvider.overrideWith((ref) async => const []),
      ],
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

void main() {
  final actionRequired = _card(
    id: 'res-action',
    status: 'ACCEPTED',
    paymentSummary: {
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
  );

  final completed = _card(
    id: 'res-done',
    status: 'COMPLETED',
    title: 'Completed motors',
    paymentSummary: {
      'enforcementEnabled': true,
      'overallStatus': 'PAID',
      'outstandingOrderCount': 0,
      'outstandingAmount': null,
      'currency': 'NIS',
      'hasMaterialPaymentOutstanding': false,
      'hasDeliveryFeeOutstanding': false,
      'checkoutableOrderId': null,
      'fulfillmentReady': true,
      'pickupCodeAvailable': false,
      'deliveryDispatchable': false,
    },
  );

  testWidgets('golden desktop 1440 arabic', (tester) async {
    await _pump(
      tester: tester,
      reservations: [actionRequired, completed],
      size: const Size(1440, 900),
    );
    await expectLater(
      find.byType(LearnerReservationsPage),
      matchesGoldenFile('goldens/pay05a_desktop_1440_ar.png'),
    );
  });

  testWidgets('golden mobile 390 arabic', (tester) async {
    await _pump(
      tester: tester,
      reservations: [actionRequired, completed],
      size: const Size(390, 844),
    );
    await expectLater(
      find.byType(LearnerReservationsPage),
      matchesGoldenFile('goldens/pay05a_mobile_390_ar.png'),
    );
  });

  testWidgets('golden mobile 430 arabic', (tester) async {
    await _pump(
      tester: tester,
      reservations: [actionRequired, completed],
      size: const Size(430, 932),
    );
    await expectLater(
      find.byType(LearnerReservationsPage),
      matchesGoldenFile('goldens/pay05a_mobile_430_ar.png'),
    );
  });

  testWidgets('golden desktop english', (tester) async {
    await _pump(
      tester: tester,
      reservations: [actionRequired, completed],
      size: const Size(1440, 900),
      locale: const Locale('en'),
    );
    await expectLater(
      find.byType(LearnerReservationsPage),
      matchesGoldenFile('goldens/pay05a_desktop_1440_en.png'),
    );
  });

  testWidgets('golden action required card', (tester) async {
    await _pump(
      tester: tester,
      reservations: [actionRequired],
      size: const Size(390, 844),
    );
    await expectLater(
      find.byType(LearnerReservationsPage),
      matchesGoldenFile('goldens/pay05a_action_required_ar.png'),
    );
  });

  testWidgets('golden completed card', (tester) async {
    await _pump(
      tester: tester,
      reservations: [completed],
      size: const Size(390, 844),
    );
    await expectLater(
      find.byType(LearnerReservationsPage),
      matchesGoldenFile('goldens/pay05a_completed_ar.png'),
    );
  });

  testWidgets('golden empty state', (tester) async {
    await _pump(
      tester: tester,
      reservations: const [],
      size: const Size(390, 844),
    );
    await expectLater(
      find.byType(LearnerReservationsPage),
      matchesGoldenFile('goldens/pay05a_empty_ar.png'),
    );
  });
}
