import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:go_router/go_router.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/core/network/api_response.dart';
import 'package:frontend/features/driver_portal/data/models/driver_deliveries_list_result.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery_detail_result.dart';
import 'package:frontend/features/driver_portal/data/driver_deliveries_api.dart';
import 'package:frontend/features/driver_portal/data/driver_deliveries_repository.dart';
import 'package:frontend/features/driver_portal/application/driver_deliveries_provider.dart';
import 'package:frontend/features/driver_portal/presentation/widgets/driver_active_delivery_card.dart';
import 'package:frontend/features/driver_portal/presentation/widgets/partial_pickup_selection_dialog.dart';
import 'package:frontend/features/driver_portal/presentation/shell/driver_portal_shell.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/shared/l10n/driver_ui_labels.dart';
import 'package:frontend/shared/widgets/bidi_text.dart';

DriverDelivery _activeDelivery({String status = 'ON_THE_WAY'}) {
  return DriverDelivery.fromJson({
    'id': 'delivery-1',
    'reservationId': 'reservation-1',
    'status': status,
    'requestedAt': '2026-08-01T08:00:00.000Z',
    'supplierPickupWindowStart': '2026-08-01T08:00:00.000Z',
    'supplierPickupWindowEnd': '2026-08-01T10:00:00.000Z',
    'material': {
      'id': 'material-1',
      'title': 'Arduino لوح تجارب',
      'quantityRequested': 2,
      'unit': 'قطعة pcs',
    },
    'supplier': {'displayName': 'مورد Supplier', 'phone': '+970599000000'},
    'learner': {'displayName': 'Learner متعلم'},
    'pickupLocation': {'city': 'الخليل Hebron'},
    'dropoffLocation': {'city': 'نابلس Nablus'},
    'canShareLocation': status == 'ON_THE_WAY',
  });
}

void main() {
  test('available-jobs metadata parses bounded pagination', () {
    final meta = DriverDeliveriesListMeta.fromJson(const {
      'activeDeliveryCount': 1,
      'maxActiveDeliveries': 3,
      'canAcceptMore': true,
      'pagination': {'limit': 20, 'hasMore': true, 'nextCursor': 'delivery-20'},
    });

    expect(meta.pagination?.limit, 20);
    expect(meta.pagination?.hasMore, isTrue);
    expect(meta.pagination?.nextCursor, 'delivery-20');
  });

  test('dedicated detail contract distinguishes active and inactive reads', () {
    final active = DriverDeliveryDetailResult.fromJson({
      'isActive': true,
      'delivery': {..._deliveryJson('ON_THE_WAY'), 'canShareLocation': true},
      'inactiveContext': null,
    });
    final inactive = DriverDeliveryDetailResult.fromJson({
      'isActive': false,
      'delivery': _deliveryJson('AWAITING_RESOLUTION'),
      'inactiveContext': const {'closureReason': 'MOVED_TO_ADMIN_REVIEW'},
    });

    expect(active.delivery.canShareLocation, isTrue);
    expect(inactive.isActive, isFalse);
    expect(inactive.closureReason, 'MOVED_TO_ADMIN_REVIEW');
    expect(inactive.delivery.canShareLocation, isFalse);
  });

  test('Driver conflicts use localized Arabic presentation', () {
    final ar = AppLocalizationsAr();
    const cases = [
      'DRIVER_ACTIVE_LIMIT_REACHED',
      'DELIVERY_NOT_AVAILABLE',
      'INVALID_DELIVERY_TRANSITION',
      'DELIVERY_LOCATION_PING_NOT_ALLOWED',
      'DRIVER_PICKUP_FAILURE_NOT_ALLOWED',
      'DRIVER_DELIVERY_FAILURE_NOT_ALLOWED',
      'DRIVER_ISSUE_NOT_ALLOWED',
      'INVALID_CONFIRMATION_CODE',
      'HANDOVER_WINDOW_NOT_STARTED',
      'HANDOVER_WINDOW_EXPIRED',
      'DRIVER_PARTIAL_PICKUP_SELECTION_INVALID',
      'DRIVER_GROUPED_DELIVERY_SPLIT_CONFLICT',
    ];

    for (final code in cases) {
      final message = localizedApiErrorMessage(
        ApiException(message: 'Legacy English backend text', code: code),
        ar,
      );
      expect(message, isNot(contains('Legacy English')));
      expect(message, isNotEmpty);
    }
  });

  test('canShareLocation respects explicit false and legacy absence', () {
    final explicitFalsePickedUp = DriverDelivery.fromJson({
      ..._deliveryJson('PICKED_UP'),
      'canShareLocation': false,
    });
    final explicitFalseOnTheWay = DriverDelivery.fromJson({
      ..._deliveryJson('ON_THE_WAY'),
      'canShareLocation': false,
    });
    final legacyMissing = DriverDelivery.fromJson(_deliveryJson('ON_THE_WAY'));
    final inactive = DriverDelivery.fromJson({
      ..._deliveryJson('AWAITING_RESOLUTION'),
      'canShareLocation': false,
    });

    expect(explicitFalsePickedUp.canShareLocation, isFalse);
    expect(explicitFalseOnTheWay.canShareLocation, isFalse);
    expect(legacyMissing.canShareLocation, isTrue);
    expect(inactive.canShareLocation, isFalse);
  });

  test(
    'non-transition conflicts are not presented as status-change refresh',
    () {
      final en = lookupAppLocalizations(const Locale('en'));
      const nonRefreshCodes = [
        'INVALID_CONFIRMATION_CODE',
        'HANDOVER_WINDOW_NOT_STARTED',
        'HANDOVER_WINDOW_EXPIRED',
        'DELIVERY_LOCATION_PING_NOT_ALLOWED',
        'DRIVER_PARTIAL_PICKUP_SELECTION_INVALID',
        'DRIVER_GROUPED_DELIVERY_SPLIT_CONFLICT',
        'DRIVER_PICKUP_FAILURE_NOT_ALLOWED',
        'DRIVER_DELIVERY_FAILURE_NOT_ALLOWED',
        'DRIVER_ISSUE_NOT_ALLOWED',
        'DELIVERY_TERMINAL',
      ];

      for (final code in nonRefreshCodes) {
        final message = localizedApiErrorMessage(
          ApiException(
            message: 'backend',
            code: code,
            statusCode:
                code.startsWith('HANDOVER') ||
                    code == 'INVALID_CONFIRMATION_CODE'
                ? 400
                : 409,
          ),
          en,
        );
        expect(message, isNot(en.driverStatusChangedRefresh));
      }

      expect(
        localizedApiErrorMessage(
          const ApiException(
            message: 'backend',
            code: 'INVALID_DELIVERY_TRANSITION',
            statusCode: 409,
          ),
          en,
        ),
        en.driverStatusChangedRefresh,
      );
    },
  );

  test('unknown Driver errors retain request-id diagnostics', () {
    final en = lookupAppLocalizations(const Locale('en'));
    final message = localizedApiErrorMessage(
      const ApiException(
        message: 'Unexpected Driver API conflict',
        code: 'UNKNOWN_DRIVER_CONFLICT',
        statusCode: 409,
        requestId: 'req-driver-123',
      ),
      en,
    );

    expect(message, contains('Unexpected Driver API conflict'));
    expect(message, contains('req-driver-123'));
  });

  test('nested backend request ID reaches the localized unknown fallback', () {
    final request = RequestOptions(path: '/api/driver/deliveries');
    final mapped = mapDioException(
      DioException(
        requestOptions: request,
        response: Response<Map<String, dynamic>>(
          requestOptions: request,
          statusCode: 500,
          data: const {
            'success': false,
            'message': 'Internal server error',
            'error': {
              'code': 'UNKNOWN_DRIVER_SERVER_ERROR',
              'requestId': 'req-nested-500',
              'details': {'operation': 'available-jobs'},
            },
          },
        ),
        type: DioExceptionType.badResponse,
      ),
    );

    final message = localizedApiErrorMessage(
      mapped,
      lookupAppLocalizations(const Locale('en')),
    );
    expect(mapped.requestId, 'req-nested-500');
    expect(message, contains('req-nested-500'));
  });

  test(
    'invalid load-more cursor preserves data, surfaces error, and restarts once',
    () async {
      final repository = _CursorErrorRepository();
      final container = ProviderContainer(
        overrides: [
          driverDeliveriesRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      final initial = await container.read(
        availableDriverDeliveriesProvider.future,
      );
      expect(initial.deliveries.single.id, 'delivery-1');

      final notifier = container.read(
        availableDriverDeliveriesProvider.notifier,
      );
      await notifier.loadMore();

      expect(
        container
            .read(availableDriverDeliveriesProvider)
            .requireValue
            .deliveries
            .single
            .id,
        'delivery-1',
      );
      expect(
        container.read(driverAvailableJobsPaginationErrorProvider)?.code,
        'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
      );

      await notifier.loadMore();
      expect(repository.calls, 2, reason: 'must not retry the stale cursor');

      await notifier.restartPagination();
      expect(repository.calls, 3);
      expect(
        container.read(driverAvailableJobsPaginationErrorProvider),
        isNull,
      );
    },
  );

  testWidgets('grouped pickup requires a reason and returns the exact split', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final en = lookupAppLocalizations(const Locale('en'));
    final labels = DriverUiLabels(en);
    final delivery = DriverDelivery.fromJson({
      ..._deliveryJson('ARRIVED_PICKUP'),
      'deliveryGroupId': 'group-1',
      'groupedDelivery': true,
      'itemCount': 2,
      'items': const [
        {
          'reservationId': 'reservation-1',
          'materialId': 'material-1',
          'title': 'Arduino board',
          'quantity': 1,
          'unit': 'piece',
        },
        {
          'reservationId': 'reservation-2',
          'materialId': 'material-2',
          'title': 'Sensor kit',
          'quantity': 2,
          'unit': 'piece',
        },
      ],
    });
    PartialPickupSelection? selection;

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: FilledButton(
                onPressed: () async {
                  selection = await showPartialPickupSelectionDialog(
                    context: context,
                    delivery: delivery,
                  );
                },
                child: const Text('Open pickup selection'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open pickup selection'));
    await tester.pumpAndSettle();
    expect(find.byType(Checkbox), findsNWidgets(2));
    expect(find.text(en.driverPartialPickupSummary(2, 0)), findsOneWidget);

    await tester.tap(find.byType(Checkbox).last);
    await tester.pumpAndSettle();
    expect(find.text(en.driverPartialPickupSummary(1, 1)), findsOneWidget);
    expect(find.text(en.driverPartialPickupReasonRequired), findsOneWidget);

    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(
      find.text(labels.partialPickupUnpickedReason('MATERIAL_NOT_READY')).last,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text(en.driverPartialPickupContinue));
    await tester.pumpAndSettle();

    expect(selection, isNotNull);
    expect(selection!.pickedReservationIds, ['reservation-1']);
    expect(selection!.unpicked, hasLength(1));
    expect(selection!.unpicked.single.reservationId, 'reservation-2');
    expect(selection!.unpicked.single.reason, 'MATERIAL_NOT_READY');
  });

  test('bidi isolation wraps mixed user and technical fragments', () {
    expect(bidiIsolate('Arduino لوح'), startsWith('\u2068'));
    expect(bidiIsolate('+970599000000'), endsWith('\u2069'));
  });

  testWidgets(
    'active card supports 320px Arabic RTL, large text, and semantics',
    (tester) async {
      tester.view.physicalSize = const Size(320, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ar'),
          supportedLocales: AppLocalizations.supportedLocales,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(1.8)),
            child: child!,
          ),
          home: Scaffold(
            body: SingleChildScrollView(
              child: DriverActiveDeliveryCard(delivery: _activeDelivery()),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(DriverActiveDeliveryCard), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp('في الطريق')), findsOneWidget);
    },
  );

  testWidgets(
    'Driver shell supports 320px Arabic RTL and large navigation text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final router = GoRouter(
        initialLocation: '/driver',
        routes: [
          GoRoute(
            path: '/driver',
            builder: (_, _) => const DriverPortalShell(
              child: Center(child: Text('Driver dashboard')),
            ),
          ),
          GoRoute(path: '/driver/jobs', builder: (_, _) => const SizedBox()),
          GoRoute(path: '/driver/active', builder: (_, _) => const SizedBox()),
          GoRoute(
            path: '/driver/notifications',
            builder: (_, _) => const SizedBox(),
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(_DriverTestAuthController.new),
            myNotificationUnreadCountProvider.overrideWith(
              _ZeroUnreadCountNotifier.new,
            ),
            supplierNotificationsUnreadCountProvider.overrideWith(
              _ZeroSupplierUnreadCountNotifier.new,
            ),
          ],
          child: MaterialApp.router(
            locale: const Locale('ar'),
            supportedLocales: AppLocalizations.supportedLocales,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: const TextScaler.linear(1.4)),
              child: child!,
            ),
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.byType(NavigationDestination), findsNWidgets(4));
    },
  );
}

class _CursorErrorRepository extends DriverDeliveriesRepository {
  _CursorErrorRepository() : super(DriverDeliveriesApi(Dio()));

  int calls = 0;

  @override
  Future<DriverDeliveriesListResult> fetchAvailableDeliveries({
    DriverAvailableJobsFilter? filter,
    String? cursor,
    int limit = 20,
  }) async {
    calls += 1;
    if (cursor != null) {
      throw const ApiException(
        message: 'Cursor stale',
        code: 'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
        statusCode: 409,
      );
    }

    return DriverDeliveriesListResult(
      deliveries: [_activeDelivery()],
      meta: const DriverDeliveriesListMeta(
        activeDeliveryCount: 0,
        maxActiveDeliveries: 3,
        canAcceptMore: true,
        pagination: DriverDeliveriesPagination(
          limit: 20,
          hasMore: true,
          nextCursor: 'stale-cursor',
        ),
      ),
    );
  }
}

Map<String, dynamic> _deliveryJson(String status) => {
  'id': 'delivery-1',
  'reservationId': 'reservation-1',
  'status': status,
  'requestedAt': '2026-08-01T08:00:00.000Z',
  'material': {
    'id': 'material-1',
    'title': 'Arduino',
    'quantityRequested': 1,
    'unit': 'piece',
  },
  'supplier': {'displayName': 'Supplier'},
  'pickupLocation': {'city': 'Hebron'},
  'dropoffLocation': {'city': 'Nablus'},
};

class _DriverTestAuthController extends AuthController {
  @override
  AuthState build() => AuthState(
    user: User(
      id: 'driver-1',
      displayName: 'السائق Driver',
      email: 'driver@example.com',
      accountStatus: 'ACTIVE',
      roles: const ['DRIVER'],
      activeRole: 'DRIVER',
      createdAt: DateTime(2026),
    ),
    accessToken: 'test-access',
    hasBootstrapped: true,
  );
}

class _ZeroUnreadCountNotifier extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

class _ZeroSupplierUnreadCountNotifier
    extends SupplierNotificationsUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}
