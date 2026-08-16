import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/deliveries/application/learner_deliveries_provider.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/notifications/application/payment_notification_presentation.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/notifications/presentation/pages/user_notifications_page.dart';
import 'package:frontend/features/reservations/application/my_reservations_provider.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/l10n/app_localizations.dart';

AppNotification _payment({
  required String id,
  required String type,
  bool isRead = false,
  String reservationId = 'res-1024',
  String paymentStatus = 'REQUIRES_PAYMENT',
  String? amount = '42.00',
  String? fulfillmentMethod,
}) {
  return AppNotification(
    id: id,
    notificationType: type,
    title: 'Server',
    body: 'Server body',
    relatedEntityType: 'RESERVATION',
    relatedEntityId: reservationId,
    actionType: 'OPEN_RESERVATION',
    isRead: isRead,
    createdAt: DateTime.utc(2026, 8, 7, 10, 5),
    metadata: {
      'paymentOrderId': 'ord-1',
      'paymentPurpose': 'MATERIAL_SUBTOTAL',
      'paymentStatus': paymentStatus,
      if (amount != null) 'amount': amount,
      'currency': 'NIS',
      'cycleNumber': 1,
      'reservationId': reservationId,
      'materialTitle': '50kg Cement',
      if (fulfillmentMethod != null) 'fulfillmentMethod': fulfillmentMethod,
    },
  );
}

class _LearnerAuth extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'learner-1',
        email: 'learner@test.com',
        displayName: 'Learner',
        roles: const ['LEARNER'],
        accountStatus: 'ACTIVE',
        createdAt: DateTime(2026, 1, 1),
      ),
      accessToken: 'token',
      hasBootstrapped: true,
    );
  }
}

class _PaymentListNotifier extends NotificationsListNotifier {
  _PaymentListNotifier(this.seedItems);

  final List<AppNotification> seedItems;

  @override
  Future<NotificationsListState> build() async {
    return NotificationsListState(
      items: dedupeNotificationsById(seedItems),
      page: 1,
      totalPages: 1,
      total: seedItems.length,
      unreadCount: seedItems.where((n) => !n.isRead).length,
      isLoadingMore: false,
      filter: NotificationReadFilter.all,
    );
  }

  @override
  Future<void> markReadLocal(String notificationId) async {
    applyReadLocal(notificationId);
    ref.read(myNotificationUnreadCountProvider.notifier).adjustBy(-1);
  }

  @override
  Future<void> refreshInBackground() async {
    // Keep optimistic local list state in widget tests.
    final current = state.value;
    if (current != null) {
      state = AsyncData(current.copyWith(isBackgroundRefreshing: false));
    }
  }
}

class _FailingListNotifier extends NotificationsListNotifier {
  @override
  Future<NotificationsListState> build() async {
    throw Exception('network down');
  }
}

class _EmptyListNotifier extends NotificationsListNotifier {
  @override
  Future<NotificationsListState> build() async {
    return const NotificationsListState(
      items: [],
      page: 1,
      totalPages: 1,
      total: 0,
      unreadCount: 0,
      isLoadingMore: false,
      filter: NotificationReadFilter.all,
    );
  }
}

class _UnreadCount extends NotificationUnreadCountNotifier {
  _UnreadCount(this.value);
  final int value;

  @override
  Future<int> build() async => value;
}

Future<ProviderContainer> _pumpPage(
  WidgetTester tester, {
  required List<dynamic> overrides,
  Size size = const Size(390, 844),
  Locale locale = const Locale('ar'),
  double textScale = 1.0,
  String initialLocation = '/notifications',
  List<GoRoute> extraRoutes = const [],
  bool includeDefaultReservationOverrides = true,
}) async {
  // Dispose any prior page (cancels poll timers) before pumping a new tree.
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump();

  await tester.binding.setSurfaceSize(size);
  addTearDown(() async {
    await tester.binding.setSurfaceSize(null);
  });

  final router = GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const UserNotificationsPage(),
      ),
      GoRoute(
        path: '/learner/checkout/reservation/:reservationId',
        builder: (context, state) => Scaffold(
          body: Text(
            'checkout:${state.pathParameters['reservationId']}',
          ),
        ),
      ),
      GoRoute(
        path: '/learner/reservations/:id',
        builder: (context, state) {
          final focus = state.uri.queryParameters['focus'];
          return Scaffold(
            body: Text('details:${state.pathParameters['id']}:focus=$focus'),
          );
        },
      ),
      ...extraRoutes,
    ],
  );

  final container = ProviderContainer(
    overrides: [
      authControllerProvider.overrideWith(_LearnerAuth.new),
      if (includeDefaultReservationOverrides) ...[
        myReservationsProvider.overrideWith(
          (ref) async => <LearnerReservation>[],
        ),
        learnerDeliveriesProvider.overrideWith((ref) async => const []),
      ],
      ...overrides.cast(),
    ],
  );
  addTearDown(container.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MediaQuery(
        data: MediaQueryData(
          size: size,
          textScaler: TextScaler.linear(textScale),
        ),
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
  return container;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final paymentItems = [
    _payment(id: 'pay-required', type: 'PAYMENT_REQUIRED'),
    _payment(
      id: 'pay-completed',
      type: 'PAYMENT_COMPLETED',
      paymentStatus: 'PAID',
      isRead: true,
    ),
    _payment(
      id: 'pay-ready',
      type: 'PAYMENT_FULFILLMENT_READY',
      paymentStatus: 'PAID',
      fulfillmentMethod: 'DELIVERY',
    ),
    _payment(
      id: 'pay-refund',
      type: 'PAYMENT_REFUND_REQUESTED',
      paymentStatus: 'REFUND_PENDING',
    ),
    _payment(
      id: 'pay-refunded',
      type: 'PAYMENT_REFUNDED',
      paymentStatus: 'REFUNDED',
      isRead: true,
    ),
    _payment(
      id: 'pay-failed',
      type: 'PAYMENT_REFUND_FAILED',
      paymentStatus: 'REFUND_FAILED',
    ),
  ];

  group('PAY-05E notifications UX', () {
    testWidgets('renders payment cards with unread markers and amounts', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier(paymentItems),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(4),
          ),
        ],
      );

      expect(find.text('الدفع مطلوب'), findsOneWidget);
      expect(find.text('اكتمل الدفع'), findsOneWidget);
      expect(find.textContaining('42.00'), findsWidgets);
      expect(find.byKey(const Key('notification-unread-dot-pay-required')), findsOneWidget);
      expect(find.byKey(const Key('notification-unread-dot-pay-completed')), findsNothing);
    });

    testWidgets('payment required opens reservation payment details', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        size: const Size(390, 844),
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier([
              _payment(id: 'pay-required', type: 'PAYMENT_REQUIRED'),
            ]),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(1),
          ),
        ],
      );

      await tester.tap(find.text('الدفع مطلوب'));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('payment-notification-detail-primary-pay-required')),
        findsOneWidget,
      );
      await tester.tap(
        find.byKey(const Key('payment-notification-detail-primary-pay-required')),
      );
      await tester.pumpAndSettle();

      expect(find.text('details:res-1024:focus=payment'), findsOneWidget);
    });

    testWidgets('completed payment opens details payment section', (
      tester,
    ) async {
      await _pumpPage(
        tester,
        locale: const Locale('en'),
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier([
              _payment(
                id: 'pay-completed',
                type: 'PAYMENT_COMPLETED',
                paymentStatus: 'PAID',
              ),
            ]),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(1),
          ),
        ],
      );

      await tester.tap(find.text('Payment completed'));
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(
          const Key('payment-notification-detail-primary-pay-completed'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('details:res-1024:focus=payment'), findsOneWidget);
    });

    testWidgets('marks only the opened notification as read', (tester) async {
      await _pumpPage(
        tester,
        locale: const Locale('en'),
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier([
              _payment(id: 'a', type: 'PAYMENT_REQUIRED'),
              _payment(
                id: 'b',
                type: 'PAYMENT_COMPLETED',
                paymentStatus: 'PAID',
              ),
            ]),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(2),
          ),
        ],
      );

      await tester.tap(find.text('Payment required'));
      await tester.pumpAndSettle();

      // Close the detail sheet so list unread markers are visible again.
      await tester.tapAt(const Offset(8, 8));
      await tester.pumpAndSettle();

      expect(
        find.byKey(const Key('notification-unread-dot-a')),
        findsNothing,
      );
      expect(
        find.byKey(const Key('notification-unread-dot-b')),
        findsOneWidget,
      );
    });

    testWidgets('empty and error states are recoverable', (tester) async {
      await _pumpPage(
        tester,
        overrides: [
          notificationsListProvider.overrideWith(_EmptyListNotifier.new),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(0),
          ),
        ],
      );
      expect(find.textContaining('لا توجد إشعارات'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();

      await _pumpPage(
        tester,
        overrides: [
          notificationsListProvider.overrideWith(_FailingListNotifier.new),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(0),
          ),
        ],
      );
      expect(find.textContaining('تعذّر تحميل'), findsOneWidget);
      expect(find.text('إعادة المحاولة'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('mobile widths and text scale 1.4 do not overflow', (
      tester,
    ) async {
      final widths = [320.0, 360.0, 390.0, 412.0, 430.0];
      for (final width in widths) {
        await _pumpPage(
          tester,
          size: Size(width, 800),
          textScale: 1.4,
          overrides: [
            notificationsListProvider.overrideWith(
              () => _PaymentListNotifier(paymentItems),
            ),
            myNotificationUnreadCountProvider.overrideWith(
              () => _UnreadCount(3),
            ),
          ],
        );
        expect(tester.takeException(), isNull);
        expect(find.text('الدفع مطلوب'), findsOneWidget);
        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
      }
    });

    testWidgets('english desktop list renders LTR payment copy', (tester) async {
      await _pumpPage(
        tester,
        size: const Size(1440, 900),
        locale: const Locale('en'),
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier(paymentItems),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(4),
          ),
        ],
      );

      expect(find.text('Payment required'), findsOneWidget);
      expect(find.text('Payments'), findsOneWidget);
      expect(find.text('Delivery'), findsOneWidget);
      expect(find.text('Refunds'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('opening payment notification invalidates reservation caches', (
      tester,
    ) async {
      var reservationsBuilds = 0;
      var deliveriesBuilds = 0;

      final container = await _pumpPage(
        tester,
        locale: const Locale('en'),
        includeDefaultReservationOverrides: false,
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier([
              _payment(id: 'pay-required', type: 'PAYMENT_REQUIRED'),
            ]),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(1),
          ),
          myReservationsProvider.overrideWith((ref) async {
            reservationsBuilds += 1;
            return <LearnerReservation>[];
          }),
          learnerDeliveriesProvider.overrideWith((ref) async {
            deliveriesBuilds += 1;
            return const [];
          }),
        ],
      );

      container.listen(myReservationsProvider, (_, __) {}, fireImmediately: true);
      container.listen(
        learnerDeliveriesProvider,
        (_, __) {},
        fireImmediately: true,
      );
      await tester.pumpAndSettle();

      final beforeReservations = reservationsBuilds;
      final beforeDeliveries = deliveriesBuilds;

      await tester.tap(find.text('Payment required'));
      await tester.pumpAndSettle();

      expect(reservationsBuilds, greaterThan(beforeReservations));
      expect(deliveriesBuilds, greaterThan(beforeDeliveries));

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    });

    testWidgets('duplicate ids render once', (tester) async {
      final dupes = [
        _payment(id: 'dup', type: 'PAYMENT_REQUIRED'),
        _payment(id: 'dup', type: 'PAYMENT_REQUIRED'),
      ];
      await _pumpPage(
        tester,
        locale: const Locale('en'),
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier(dupes),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(1),
          ),
        ],
      );
      expect(find.text('Payment required'), findsOneWidget);
    });
  });

  group('PAY-05E goldens', () {
    Future<void> _golden(
      WidgetTester tester, {
      required String name,
      required Size size,
      required Locale locale,
      required List<AppNotification> items,
    }) async {
      await _pumpPage(
        tester,
        size: size,
        locale: locale,
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier(items),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(items.where((n) => !n.isRead).length),
          ),
        ],
      );
      await expectLater(
        find.byType(UserNotificationsPage),
        matchesGoldenFile('goldens/$name.png'),
      );
    }

    testWidgets('desktop arabic list', (tester) async {
      await _golden(
        tester,
        name: 'pay05e_desktop_1440_ar',
        size: const Size(1440, 900),
        locale: const Locale('ar'),
        items: paymentItems,
      );
    }, tags: ['golden']);

    testWidgets('mobile arabic 390', (tester) async {
      await _golden(
        tester,
        name: 'pay05e_mobile_390_ar',
        size: const Size(390, 844),
        locale: const Locale('ar'),
        items: paymentItems,
      );
    }, tags: ['golden']);

    testWidgets('mobile arabic 412', (tester) async {
      await _golden(
        tester,
        name: 'pay05e_mobile_412_ar',
        size: const Size(412, 915),
        locale: const Locale('ar'),
        items: paymentItems,
      );
    }, tags: ['golden']);

    testWidgets('english desktop', (tester) async {
      await _golden(
        tester,
        name: 'pay05e_desktop_1440_en',
        size: const Size(1440, 900),
        locale: const Locale('en'),
        items: paymentItems,
      );
    }, tags: ['golden']);

    testWidgets('empty arabic', (tester) async {
      await _golden(
        tester,
        name: 'pay05e_empty_ar',
        size: const Size(390, 844),
        locale: const Locale('ar'),
        items: const [],
      );
    }, tags: ['golden']);

    testWidgets('payment required detail sheet', (tester) async {
      await _pumpPage(
        tester,
        size: const Size(390, 844),
        locale: const Locale('ar'),
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier([
              _payment(id: 'pay-required', type: 'PAYMENT_REQUIRED'),
            ]),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(1),
          ),
        ],
      );
      await tester.tap(find.text('الدفع مطلوب'));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/pay05e_detail_required_ar.png'),
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    }, tags: ['golden']);

    testWidgets('payment completed detail sheet', (tester) async {
      await _pumpPage(
        tester,
        size: const Size(390, 844),
        locale: const Locale('ar'),
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier([
              _payment(
                id: 'pay-completed',
                type: 'PAYMENT_COMPLETED',
                paymentStatus: 'PAID',
              ),
            ]),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(1),
          ),
        ],
      );
      await tester.tap(find.text('اكتمل الدفع'));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/pay05e_detail_completed_ar.png'),
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    }, tags: ['golden']);

    testWidgets('fulfillment ready detail sheet', (tester) async {
      await _pumpPage(
        tester,
        size: const Size(390, 844),
        locale: const Locale('ar'),
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier([
              _payment(
                id: 'pay-ready',
                type: 'PAYMENT_FULFILLMENT_READY',
                paymentStatus: 'PAID',
                fulfillmentMethod: 'DELIVERY',
              ),
            ]),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(1),
          ),
        ],
      );
      await tester.tap(find.text('جاهز للتوصيل'));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/pay05e_detail_fulfillment_ar.png'),
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    }, tags: ['golden']);

    testWidgets('refund processing detail sheet', (tester) async {
      await _pumpPage(
        tester,
        size: const Size(390, 844),
        locale: const Locale('ar'),
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier([
              _payment(
                id: 'pay-refund',
                type: 'PAYMENT_REFUND_REQUESTED',
                paymentStatus: 'REFUND_PENDING',
              ),
            ]),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(1),
          ),
        ],
      );
      await tester.tap(find.text('جاري معالجة الاسترداد'));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/pay05e_detail_refund_processing_ar.png'),
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    }, tags: ['golden']);

    testWidgets('refunded detail sheet', (tester) async {
      await _pumpPage(
        tester,
        size: const Size(390, 844),
        locale: const Locale('ar'),
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier([
              _payment(
                id: 'pay-refunded',
                type: 'PAYMENT_REFUNDED',
                paymentStatus: 'REFUNDED',
              ),
            ]),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(1),
          ),
        ],
      );
      await tester.tap(find.text('تم الاسترداد'));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/pay05e_detail_refunded_ar.png'),
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    }, tags: ['golden']);

    testWidgets('refund failed detail sheet', (tester) async {
      await _pumpPage(
        tester,
        size: const Size(390, 844),
        locale: const Locale('ar'),
        overrides: [
          notificationsListProvider.overrideWith(
            () => _PaymentListNotifier([
              _payment(
                id: 'pay-failed',
                type: 'PAYMENT_REFUND_FAILED',
                paymentStatus: 'REFUND_FAILED',
              ),
            ]),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _UnreadCount(1),
          ),
        ],
      );
      await tester.tap(find.text('الاسترداد يحتاج متابعة'));
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('goldens/pay05e_detail_refund_failed_ar.png'),
      );
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump();
    }, tags: ['golden']);
  });
}
