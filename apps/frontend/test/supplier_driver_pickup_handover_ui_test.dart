import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/reservations/data/models/handover_credential.dart';
import 'package:frontend/features/supplier_portal/data/supplier_requests_api_repository.dart';
import 'package:frontend/features/supplier_portal/data/supplier_requests_repository.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_requests_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/pages/supplier_reservation_detail_page.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

class _HandoverDetailRepository implements SupplierRequestsRepository {
  int issueCalls = 0;

  @override
  Future<HandoverCredential> issueDriverPickupHandoverCredential(
    String reservationId,
  ) async {
    issueCalls += 1;
    return HandoverCredential(
      reservationId: reservationId,
      handoverToken: 'opaque-token-aaaaaaaaaaaaaaaa',
      qrPayload:
          'impactloop://supplier-pickup-handover/opaque-token-aaaaaaaaaaaaaaaa',
      expiresAt: DateTime.now().add(const Duration(hours: 1)),
    );
  }

  @override
  Future<SupplierReservationDetail> fetchReservationDetail(
    String requestId,
  ) async {
    return SupplierReservationDetail.fromJson({
      'id': requestId,
      'materialTitle': 'SG90 Micro Servo Motors',
      'learnerName': 'Majd Learner',
      'quantityRequested': 2,
      'unit': 'pieces',
      'status': 'ACCEPTED',
      'fulfillmentMethod': 'DELIVERY',
      'requestedAt': '2026-07-12T18:22:00.000Z',
      'supplierHandoverCode': '482917',
      'activeDelivery': {
        'id': 'delivery-1',
        'status': 'ARRIVED_PICKUP',
        'statusLabel': 'At pickup location',
      },
      'workflowPhase': 'FULFILLMENT_IN_PROGRESS',
      'attentionState': 'FULFILLMENT_IN_PROGRESS',
      'nextActor': 'DRIVER',
      'availableActions': ['SEND_MESSAGE'],
      'request': {
        'fulfillmentMethod': 'DELIVERY',
      },
      'messages': {'count': 0, 'items': []},
      'history': [],
    });
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

Future<void> _pumpDetail(WidgetTester tester) async {
  final router = GoRouter(
    initialLocation: '/supplier/reservations/reservation-1',
    routes: [
      GoRoute(
        path: '/supplier/reservations/:reservationId',
        builder: (context, state) => SupplierReservationDetailPage(
          reservationId: state.pathParameters['reservationId']!,
        ),
      ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        supplierRequestsRepositoryProvider.overrideWithValue(
          _HandoverDetailRepository(),
        ),
      ],
      child: MaterialApp.router(
        theme: AppTheme.light,
        locale: const Locale('en'),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('reservation detail shows manual supplier handover code', (
    tester,
  ) async {
    await _pumpDetail(tester);

    expect(find.text('Driver pickup verification'), findsOneWidget);
    expect(find.text('482 917'), findsOneWidget);
    expect(find.text('Show Pickup QR'), findsOneWidget);
  });

  testWidgets('opening pickup QR dialog issues credential once', (tester) async {
    final repo = _HandoverDetailRepository();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          supplierRequestsRepositoryProvider.overrideWithValue(repo),
        ],
        child: MaterialApp.router(
          theme: AppTheme.light,
          locale: const Locale('en'),
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          routerConfig: GoRouter(
            initialLocation: '/supplier/reservations/reservation-1',
            routes: [
              GoRoute(
                path: '/supplier/reservations/:reservationId',
                builder: (context, state) => SupplierReservationDetailPage(
                  reservationId: state.pathParameters['reservationId']!,
                ),
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Show Pickup QR'));
    await tester.tap(find.text('Show Pickup QR'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    expect(repo.issueCalls, 1);
    expect(find.byKey(const Key('supplier-driver-pickup-handover-qr-image')), findsOneWidget);
  });
}
