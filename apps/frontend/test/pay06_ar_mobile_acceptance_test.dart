import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/deliveries/application/learner_deliveries_provider.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/notifications/presentation/pages/user_notifications_page.dart';
import 'package:frontend/features/reservations/application/my_reservations_provider.dart';
import 'package:frontend/features/reservations/data/models/learner_reservation.dart';
import 'package:frontend/features/reservations/presentation/learner_reservation_payment_presentation.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';

/// PAY-06 E2E-19 / E2E-20 — Arabic + mobile viewport acceptance for payment UX.
void main() {
  final ar = AppLocalizationsAr();
  const sizes = <Size>[
    Size(390, 844),
    Size(412, 915),
  ];

  test('E2E-19 AR: paid pickup vs delivery wording and free delivery', () {
    final pickup = _reservation(
      id: 'res-p',
      fulfillmentMethod: 'PICKUP',
      hasMaterial: true,
      amount: '45.00',
    );
    final delivery = _reservation(
      id: 'res-d',
      fulfillmentMethod: 'DELIVERY',
      hasMaterial: true,
      amount: '220.00',
    );

    expect(
      reservationNextStepSupporting(pickup, l10n: ar),
      ar.reservationNextStepPaySupporting,
    );
    expect(
      reservationNextStepSupporting(delivery, l10n: ar),
      ar.reservationNextStepPaySupportingDelivery,
    );
    expect(
      reservationNextStepSupporting(delivery, l10n: ar)!.toLowerCase(),
      isNot(contains('pickup')),
    );
    expect(ar.paymentStatusNotRequired, isNot(contains('unavailable')));
    expect(ar.freeDeliveryLabel, 'توصيل مجاني');
    expect(ar.reservationMoneyAmountWithCurrency('220.00'), contains('₪'));
    expect(paymentStatusLabel(
      pickup.paymentSummary,
      l10n: ar,
    ), isNot(equals('REQUIRES_PAYMENT')));
  });

  for (final size in sizes) {
    testWidgets(
      'E2E-20 AR notifications ${size.width.toInt()}x${size.height.toInt()} no overflow/enums',
      (tester) async {
        await tester.binding.setSurfaceSize(size);
        addTearDown(() async {
          await tester.binding.setSurfaceSize(null);
        });

        await tester.pumpWidget(
          MediaQuery(
            data: MediaQueryData(size: size),
            child: ProviderScope(
              overrides: [
                authControllerProvider.overrideWith(_LearnerAuth.new),
                myReservationsProvider.overrideWith((ref) async => const []),
                learnerDeliveriesProvider.overrideWith((ref) async => const []),
                notificationsListProvider.overrideWith(
                  () => _PaymentListNotifier([
                    AppNotification(
                      id: 'pay-required',
                      notificationType: 'PAYMENT_REQUIRED',
                      title: 'Server',
                      body: 'Server',
                      relatedEntityType: 'RESERVATION',
                      relatedEntityId: 'res-1',
                      actionType: 'OPEN_RESERVATION',
                      isRead: false,
                      createdAt: DateTime.utc(2026, 8, 7),
                      metadata: const {
                        'paymentOrderId': 'ord-1',
                        'paymentPurpose': 'MATERIAL_SUBTOTAL',
                        'paymentStatus': 'REQUIRES_PAYMENT',
                        'amount': '42.00',
                        'currency': 'NIS',
                        'reservationId': 'res-1',
                        'materialTitle': 'أسمنت',
                      },
                    ),
                  ]),
                ),
                myNotificationUnreadCountProvider.overrideWith(
                  () => _UnreadCount(1),
                ),
              ],
              child: MaterialApp(
                locale: const Locale('ar'),
                supportedLocales: AppLocalizations.supportedLocales,
                localizationsDelegates: const [
                  AppLocalizations.delegate,
                  GlobalMaterialLocalizations.delegate,
                  GlobalWidgetsLocalizations.delegate,
                  GlobalCupertinoLocalizations.delegate,
                ],
                home: const UserNotificationsPage(),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
        expect(find.textContaining('PAYMENT_REQUIRED'), findsNothing);
        expect(find.textContaining('Pay now'), findsNothing);
        expect(find.text(ar.notificationPaymentRequiredTitle), findsOneWidget);
        expect(find.textContaining('42.00'), findsWidgets);
        expect(find.textContaining('₪'), findsWidgets);
      },
    );
  }
}

LearnerReservation _reservation({
  required String id,
  required String fulfillmentMethod,
  required bool hasMaterial,
  required String amount,
}) {
  return LearnerReservation.fromJson({
    'id': id,
    'status': 'ACCEPTED',
    'fulfillmentMethod': fulfillmentMethod,
    'quantityRequested': 1,
    'createdAt': '2026-01-01T00:00:00.000Z',
    'updatedAt': '2026-01-01T00:00:00.000Z',
    'material': {
      'id': 'm1',
      'title': 'Cement',
      'materialType': 'Cement',
      'status': 'RESERVED',
      'unit': 'kg',
    },
    'supplier': {'id': 's1', 'displayName': 'Supplier'},
    'paymentSummary': {
      'enforcementEnabled': true,
      'overallStatus': 'REQUIRES_PAYMENT',
      'outstandingOrderCount': 1,
      'outstandingAmount': amount,
      'currency': 'NIS',
      'hasMaterialPaymentOutstanding': hasMaterial,
      'hasDeliveryFeeOutstanding': false,
      'checkoutableOrderId': 'ord-1',
      'fulfillmentReady': false,
      'pickupCodeAvailable': false,
      'deliveryDispatchable': false,
    },
  });
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

class _UnreadCount extends NotificationUnreadCountNotifier {
  _UnreadCount(this.count);
  final int count;
  @override
  Future<int> build() async => count;
}

class _PaymentListNotifier extends NotificationsListNotifier {
  _PaymentListNotifier(this.items);
  final List<AppNotification> items;

  @override
  Future<NotificationsListState> build() async {
    return NotificationsListState(
      items: items,
      page: 1,
      totalPages: 1,
      total: items.length,
      unreadCount: items.where((n) => !n.isRead).length,
      isLoadingMore: false,
      filter: NotificationReadFilter.all,
    );
  }
}
