import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/supplier_portal/data/mock_supplier_requests_repository.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_requests_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/pages/supplier_reservation_detail_page.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

class _DetailRepository extends MockSupplierRequestsRepository {
  _DetailRepository({Map<String, dynamic>? payload})
    : _payload = payload ?? _pendingPayload();

  final Map<String, dynamic> _payload;

  @override
  Future<SupplierReservationDetail> fetchReservationDetail(
    String requestId,
  ) async {
    return SupplierReservationDetail.fromJson({..._payload, 'id': requestId});
  }
}

Map<String, dynamic> _pendingPayload() => {
  'materialTitle': 'SG90 Micro Servo Motors',
  'learnerName': 'Majd Learner',
  'quantityRequested': 2,
  'unit': 'pieces',
  'status': 'PENDING',
  'requestedAt': '2026-07-12T18:22:00.000Z',
  'workflowPhase': 'INITIAL_DECISION',
  'attentionState': 'SUPPLIER_ACTION_REQUIRED',
  'nextActor': 'SUPPLIER',
  'availableActions': ['ACCEPT', 'DECLINE', 'SEND_MESSAGE'],
  'request': {
    'originalLearnerNote': 'I need them for my robotics project.',
    'fulfillmentMethod': 'PICKUP',
  },
  'messages': {
    'count': 1,
    'items': [
      {
        'id': 'message-1',
        'senderRole': 'LEARNER',
        'body': 'Can I pick them up tomorrow?',
        'createdAt': '2026-07-12T18:22:00.000Z',
      },
    ],
  },
  'history': [
    {
      'id': 'history-1',
      'newStatus': 'PENDING',
      'createdAt': '2026-07-12T18:22:00.000Z',
      'actor': {'displayName': 'Majd Learner', 'role': 'LEARNER'},
    },
  ],
};

Future<void> _pumpDetail(
  WidgetTester tester,
  SupplierReservationDetail detail, {
  Locale locale = const Locale('en'),
}) async {
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
          _DetailRepository(
            payload: {
              'materialTitle': detail.reservation.materialTitle,
              'learnerName': detail.reservation.learnerName,
              'quantityRequested': detail.reservation.quantityRequested,
              'unit': detail.reservation.unit,
              'status': detail.reservation.status.apiValue,
              'requestedAt': detail.reservation.requestedAt.toIso8601String(),
              'workflowPhase': detail.reservation.workflowPhase?.rawValue,
              'attentionState': detail.reservation.attentionState?.rawValue,
              'nextActor': detail.reservation.nextActor?.rawValue,
              'availableActions': detail.reservation.availableActions
                  .map((action) => action.rawValue)
                  .toList(),
              'request': {
                'fulfillmentMethod': detail.reservation.fulfillmentMethod,
              },
              if (detail.identity != null)
                'identity': {
                  'createdAt': detail.identity!.createdAt?.toIso8601String(),
                  'updatedAt': detail.identity!.updatedAt?.toIso8601String(),
                },
              if (detail.schedule != null)
                'schedule': {
                  if (detail.schedule!.confirmedPickupWindow != null)
                    'confirmedPickupWindow': _windowJson(
                      detail.schedule!.confirmedPickupWindow!,
                    ),
                  if (detail.schedule!.supplierDeliveryPickupWindow != null)
                    'supplierDeliveryPickupWindow': _windowJson(
                      detail.schedule!.supplierDeliveryPickupWindow!,
                    ),
                  if (detail.schedule!.confirmedDeliveryWindow != null)
                    'confirmedDeliveryWindow': _windowJson(
                      detail.schedule!.confirmedDeliveryWindow!,
                    ),
                },
            },
          ),
        ),
      ],
      child: MaterialApp.router(
        theme: AppTheme.light,
        locale: locale,
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

Map<String, dynamic> _windowJson(SupplierScheduleWindow window) => {
  'start': window.start?.toIso8601String(),
  'end': window.end?.toIso8601String(),
};

void main() {
  final en = AppLocalizationsEn();

  testWidgets('deep-linked route renders the supplier workspace', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });
    await _pumpDetail(
      tester,
      SupplierReservationDetail.fromJson(_pendingPayload()),
    );

    expect(find.text(en.supplierRequestDetails), findsOneWidget);
    expect(find.text('SG90 Micro Servo Motors'), findsWidgets);
    expect(find.text(en.supplierRequestSummary), findsOneWidget);
    expect(find.text(en.supplierScheduleNegotiation), findsOneWidget);
    expect(find.text(en.supplierReservationHistory), findsOneWidget);
    expect(find.textContaining(en.supplierMessagesTitle), findsOneWidget);
  });

  testWidgets(
    'terminal cancelled pickup uses adaptive facts and schedule history',
    (tester) async {
      tester.view.physicalSize = const Size(900, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final detail = SupplierReservationDetail.fromJson({
        ..._pendingPayload(),
        'status': 'CANCELLED',
        'workflowPhase': 'CLOSED',
        'attentionState': 'TERMINAL',
        'nextActor': 'NONE',
        'availableActions': const [],
        'identity': {
          'createdAt': '2026-07-12T18:22:00.000Z',
          'updatedAt': '2026-07-12T18:22:00.000Z',
        },
      });
      await _pumpDetail(tester, detail);

      expect(find.text(en.statusCompleted), findsOneWidget);
      expect(find.text(en.supplierCancelledBeforeFulfillment), findsOneWidget);
      expect(find.text(en.supplierScheduleHistory), findsOneWidget);
      expect(
        find.text(
          en.supplierNoWindowConfirmedBeforeTerminal(
            en.supplierTerminalVerbCancelled,
          ),
        ),
        findsOneWidget,
      );
      expect(find.text(en.supplierNotProposed), findsNothing);
    },
  );

  testWidgets('pickup requests suppress stale delivery schedule windows', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(900, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    final detail = SupplierReservationDetail.fromJson({
      ..._pendingPayload(),
      'workflowPhase': 'SCHEDULING',
      'attentionState': 'SUPPLIER_ACTION_REQUIRED',
      'schedule': {
        'supplierDeliveryPickupWindow': {
          'start': '2026-07-18T10:00:00.000Z',
          'end': '2026-07-18T12:00:00.000Z',
        },
      },
    });
    await _pumpDetail(tester, detail);

    expect(find.text(en.supplierSupplierDeliveryPickupWindow), findsNothing);
    expect(find.text(en.supplierNoWindowProposed), findsOneWidget);
  });
}
