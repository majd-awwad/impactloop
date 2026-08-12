import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/reservations/application/handover_credential_controller.dart';
import 'package:frontend/features/reservations/data/models/handover_credential.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/data/reservations_repository.dart';
import 'package:frontend/features/reservations/presentation/detail/reservation_detail_pickup_code_card.dart';
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

Map<String, dynamic> _paidReadySummary() => {
      'enforcementEnabled': true,
      'overallStatus': 'PAID',
      'outstandingOrderCount': 0,
      'outstandingAmount': null,
      'currency': 'NIS',
      'hasMaterialPaymentOutstanding': false,
      'hasDeliveryFeeOutstanding': false,
      'checkoutableOrderId': null,
      'fulfillmentReady': true,
      'pickupCodeAvailable': true,
      'deliveryDispatchable': false,
    };

class _FakeReservationsRepository implements ReservationsRepository {
  _FakeReservationsRepository({
    this.onIssue,
    this.error,
  });

  final Future<HandoverCredential> Function(String id)? onIssue;
  final Object? error;
  int issueCalls = 0;

  @override
  Future<HandoverCredential> issueHandoverCredential(String reservationId) {
    issueCalls += 1;
    if (error != null) {
      return Future.error(error!);
    }
    return onIssue?.call(reservationId) ??
        Future.value(
          HandoverCredential(
            reservationId: reservationId,
            handoverToken: 'opaque-token-cccccccccccccccc',
            qrPayload: 'impactloop://handover/opaque-token-cccccccccccccccc',
            expiresAt: DateTime.now().add(const Duration(hours: 1)),
          ),
        );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

LearnerReservation _availableReservation() {
  return LearnerReservation.fromJson({
    ..._baseReservation(
      id: 'res-qr',
      status: 'ACCEPTED',
      paymentSummary: _paidReadySummary(),
    ),
    'selfPickupCode': '482913',
    'pickupHandoverPhase': 'DURING_ALLOWED',
  });
}

LearnerReservation _lockedReservation() {
  return LearnerReservation.fromJson(
    _baseReservation(
      id: 'res-locked',
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
    ),
  );
}

Future<void> _pumpCard(
  WidgetTester tester, {
  required LearnerReservation reservation,
  required _FakeReservationsRepository repo,
  Locale locale = const Locale('en'),
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        reservationsRepositoryProvider.overrideWithValue(repo),
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
        home: Scaffold(
          body: SingleChildScrollView(
            child: ReservationDetailPickupCodeCard(reservation: reservation),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('eligible pickup shows QR action and manual code', (tester) async {
    final repo = _FakeReservationsRepository();
    await _pumpCard(
      tester,
      reservation: _availableReservation(),
      repo: repo,
    );

    expect(find.byKey(const Key('reservation-detail-show-pickup-qr')), findsOneWidget);
    expect(find.text('Show Pickup QR'), findsOneWidget);
    expect(find.textContaining('482'), findsWidgets);
  });

  testWidgets('ineligible locked pickup hides QR action', (tester) async {
    final repo = _FakeReservationsRepository();
    await _pumpCard(
      tester,
      reservation: _lockedReservation(),
      repo: repo,
    );

    expect(find.byKey(const Key('reservation-detail-show-pickup-qr')), findsNothing);
    expect(find.text('Show Pickup QR'), findsNothing);
  });

  testWidgets('pressing QR issues once, shows payload QR, rebuild does not reissue', (
    tester,
  ) async {
    final repo = _FakeReservationsRepository();
    await _pumpCard(
      tester,
      reservation: _availableReservation(),
      repo: repo,
    );

    await tester.tap(find.byKey(const Key('reservation-detail-show-pickup-qr')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    await tester.pumpAndSettle();

    expect(repo.issueCalls, 1);
    expect(find.byKey(const Key('pickup-qr-dialog')), findsOneWidget);
    expect(find.byKey(const Key('pickup-qr-image')), findsOneWidget);
    expect(
      tester.getSemantics(find.byKey(const Key('pickup-qr-image'))),
      matchesSemantics(
        label: 'Pickup QR',
        isImage: true,
      ),
    );
    // Opaque token must not be exposed as readable semantics text.
    expect(find.textContaining('impactloop://handover/'), findsNothing);

    // Force rebuild of the underlying tree while dialog is open.
    await tester.pump();
    expect(repo.issueCalls, 1);

    // Close and reopen — still-valid credential must be reused.
    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('reservation-detail-show-pickup-qr')));
    await tester.pumpAndSettle();
    expect(repo.issueCalls, 1);
  });

  testWidgets('opening QR with slow issuance completes with a single POST', (
    tester,
  ) async {
    final repo = _FakeReservationsRepository(
      onIssue: (id) async {
        await Future<void>.delayed(const Duration(milliseconds: 80));
        return HandoverCredential(
          reservationId: id,
          handoverToken: 'opaque-token-dddddddddddddddd',
          qrPayload: 'impactloop://handover/opaque-token-dddddddddddddddd',
          expiresAt: DateTime.now().add(const Duration(hours: 1)),
        );
      },
    );
    await _pumpCard(
      tester,
      reservation: _availableReservation(),
      repo: repo,
    );

    await tester.tap(find.byKey(const Key('reservation-detail-show-pickup-qr')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 40));
    // While loading, controller guards overlapping ensureIssued calls.
    final element = tester.element(find.byType(ReservationDetailPickupCodeCard));
    final container = ProviderScope.containerOf(element);
    await container
        .read(handoverCredentialControllerProvider('res-qr').notifier)
        .ensureIssued();
    await tester.pumpAndSettle();

    expect(repo.issueCalls, 1);
    expect(find.byKey(const Key('pickup-qr-image')), findsOneWidget);
  });

  testWidgets('issuance error shows safe message and keeps card usable', (
    tester,
  ) async {
    final repo = _FakeReservationsRepository(
      error: const ApiException(
        message: 'Payment is required',
        code: 'PAYMENT_REQUIRED',
        statusCode: 409,
      ),
    );
    await _pumpCard(
      tester,
      reservation: _availableReservation(),
      repo: repo,
    );

    await tester.tap(find.byKey(const Key('reservation-detail-show-pickup-qr')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('pickup-qr-dialog')), findsOneWidget);
    expect(find.byKey(const Key('pickup-qr-retry')), findsOneWidget);
    expect(find.byKey(const Key('reservation-detail-show-pickup-qr')), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pumpAndSettle();
    expect(find.text('Show Pickup QR'), findsOneWidget);
  });

  testWidgets('Arabic localization covers QR action label', (tester) async {
    final repo = _FakeReservationsRepository();
    await _pumpCard(
      tester,
      reservation: _availableReservation(),
      repo: repo,
      locale: const Locale('ar'),
    );

    expect(find.text('إظهار رمز QR للاستلام'), findsOneWidget);
  });

  test('controller ensureIssued is idempotent for valid credential', () async {
    final repo = _FakeReservationsRepository();
    final container = ProviderContainer(
      overrides: [
        reservationsRepositoryProvider.overrideWithValue(repo),
      ],
    );
    addTearDown(container.dispose);

    final notifier =
        container.read(handoverCredentialControllerProvider('res-qr').notifier);
    await notifier.ensureIssued();
    await notifier.ensureIssued();
    expect(repo.issueCalls, 1);
    expect(
      container.read(handoverCredentialControllerProvider('res-qr')).credential?.qrPayload,
      'impactloop://handover/opaque-token-cccccccccccccccc',
    );
  });
}
