import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_route_helpers.dart';
import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/application/payment_notification_presentation.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/notifications/presentation/notification_visuals.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/l10n/app_localizations_en.dart';

AppNotification _paymentNotification({
  required String type,
  String id = 'notif-pay-1',
  String reservationId = 'res-1024',
  String? paymentStatus = 'REQUIRES_PAYMENT',
  String? amount = '42.00',
  String? currency = 'NIS',
  String? materialTitle = '50kg Cement',
  String? fulfillmentMethod,
  bool isRead = false,
  Map<String, dynamic>? extraMetadata,
}) {
  return AppNotification(
    id: id,
    notificationType: type,
    title: 'Server title',
    body: 'Server body',
    relatedEntityType: 'RESERVATION',
    relatedEntityId: reservationId,
    actionType: 'OPEN_RESERVATION',
    isRead: isRead,
    createdAt: DateTime.utc(2026, 8, 7, 10),
    metadata: {
      'paymentOrderId': 'ord-1',
      'paymentPurpose': 'MATERIAL_SUBTOTAL',
      if (paymentStatus != null) 'paymentStatus': paymentStatus,
      if (amount != null) 'amount': amount,
      if (currency != null) 'currency': currency,
      'cycleNumber': 1,
      'reservationId': reservationId,
      if (materialTitle != null) 'materialTitle': materialTitle,
      if (fulfillmentMethod != null) 'fulfillmentMethod': fulfillmentMethod,
      ...?extraMetadata,
    },
  );
}

void main() {
  final en = AppLocalizationsEn();
  final ar = AppLocalizationsAr();

  group('payment notification mapping', () {
    test('every payment type maps to icon, tone, title, and description', () {
      final cases = <String, ({IconData icon, String enTitle})>{
        'PAYMENT_REQUIRED': (
          icon: Icons.notifications_active_outlined,
          enTitle: en.notificationPaymentRequiredTitle,
        ),
        'PAYMENT_COMPLETED': (
          icon: Icons.check_circle_outline_rounded,
          enTitle: en.notificationPaymentCompletedTitle,
        ),
        'PAYMENT_FULFILLMENT_READY': (
          icon: Icons.local_shipping_outlined,
          enTitle: en.notificationPaymentFulfillmentReadyTitle,
        ),
        'PAYMENT_REFUND_REQUESTED': (
          icon: Icons.hourglass_top_rounded,
          enTitle: en.notificationPaymentRefundRequestedTitle,
        ),
        'PAYMENT_REFUNDED': (
          icon: Icons.check_circle_outline_rounded,
          enTitle: en.notificationPaymentRefundedTitle,
        ),
        'PAYMENT_REFUND_FAILED': (
          icon: Icons.notification_important_outlined,
          enTitle: en.notificationPaymentRefundFailedTitle,
        ),
        'PAYMENT_LATE_SUCCESS_REFUND': (
          icon: Icons.info_outline_rounded,
          enTitle: en.notificationPaymentLateSuccessRefundTitle,
        ),
        'PAYMENT_NEW_CYCLE_REQUIRED': (
          icon: Icons.notifications_active_outlined,
          enTitle: en.notificationPaymentNewCycleRequiredTitle,
        ),
        'PAYMENT_RESOLUTION_REQUIRED': (
          icon: Icons.notification_important_outlined,
          enTitle: en.notificationPaymentResolutionRequiredTitle,
        ),
      };

      for (final entry in cases.entries) {
        final notification = _paymentNotification(
          type: entry.key,
          fulfillmentMethod: entry.key == 'PAYMENT_FULFILLMENT_READY'
              ? 'DELIVERY'
              : null,
          paymentStatus: entry.key == 'PAYMENT_COMPLETED' ? 'PAID' : 'REQUIRES_PAYMENT',
        );
        final copyEn = localizedNotificationCopy(notification, en);
        final copyAr = localizedNotificationCopy(notification, ar);

        expect(iconForNotification(notification), entry.value.icon, reason: entry.key);
        expect(copyEn.title, entry.value.enTitle, reason: entry.key);
        expect(copyEn.body, isNot(contains('Server body')), reason: entry.key);
        expect(copyAr.title, isNotEmpty, reason: entry.key);
        expect(copyAr.body, isNot(equals(en.notificationFallbackBody)));
        expect(categoryForNotification(notification), isNot(NotificationVisualCategory.general));
      }
    });

    test('pickup fulfillment ready uses storefront icon and pickup copy', () {
      final notification = _paymentNotification(
        type: 'PAYMENT_FULFILLMENT_READY',
        fulfillmentMethod: 'PICKUP',
        paymentStatus: 'PAID',
      );
      expect(iconForNotification(notification), Icons.storefront_outlined);
      expect(
        localizedNotificationCopy(notification, en).title,
        en.notificationPaymentPickupReadyTitle,
      );
    });
  });

  group('payment notification deep links', () {
    test('payment required opens reservation-scoped checkout when payable', () {
      final notification = _paymentNotification(type: 'PAYMENT_REQUIRED');
      expect(
        paymentNotificationOpenRoute(notification),
        learnerReservationCheckoutRoute('res-1024'),
      );
      expect(
        notificationOpenRoute(
          notification,
          isSupplierMode: false,
          isDriverMode: false,
        ),
        '/learner/checkout/reservation/res-1024',
      );
    });

    test('stale non-checkoutable payment required falls back to details', () {
      final notification = _paymentNotification(
        type: 'PAYMENT_REQUIRED',
        paymentStatus: 'PAID',
      );
      expect(
        paymentNotificationOpenRoute(notification),
        learnerReservationDetailRoute(
          'res-1024',
          focus: 'payment',
          checkoutableOrderId: 'ord-1',
        ),
      );
      expect(
        paymentNotificationOpenRoute(notification),
        isNot(contains('/learner/checkout/')),
      );
    });

    test('new cycle required always opens reservation checkout', () {
      final notification = _paymentNotification(
        type: 'PAYMENT_NEW_CYCLE_REQUIRED',
        paymentStatus: 'REQUIRES_PAYMENT',
      );
      expect(
        paymentNotificationOpenRoute(notification),
        learnerReservationCheckoutRoute('res-1024'),
      );
    });

    test('paid/ready/refund notifications open correct details sections', () {
      expect(
        paymentNotificationOpenRoute(
          _paymentNotification(type: 'PAYMENT_COMPLETED', paymentStatus: 'PAID'),
        ),
        contains('focus=payment'),
      );
      expect(
        paymentNotificationOpenRoute(
          _paymentNotification(
            type: 'PAYMENT_FULFILLMENT_READY',
            fulfillmentMethod: 'DELIVERY',
            paymentStatus: 'PAID',
          ),
        ),
        contains('focus=fulfillment'),
      );
      expect(
        paymentNotificationOpenRoute(
          _paymentNotification(
            type: 'PAYMENT_FULFILLMENT_READY',
            fulfillmentMethod: 'PICKUP',
            paymentStatus: 'PAID',
          ),
        ),
        contains('focus=pickup'),
      );
      expect(
        paymentNotificationOpenRoute(
          _paymentNotification(
            type: 'PAYMENT_REFUND_REQUESTED',
            paymentStatus: 'REFUND_PENDING',
          ),
        ),
        contains('focus=payment'),
      );
      expect(
        paymentNotificationOpenRoute(
          _paymentNotification(type: 'PAYMENT_REFUNDED', paymentStatus: 'REFUNDED'),
        ),
        contains('focus=payment'),
      );
      expect(
        paymentNotificationOpenRoute(
          _paymentNotification(
            type: 'PAYMENT_REFUND_FAILED',
            paymentStatus: 'REFUND_FAILED',
          ),
        ),
        contains('focus=resolution'),
      );
      expect(
        paymentNotificationOpenRoute(
          _paymentNotification(
            type: 'PAYMENT_LATE_SUCCESS_REFUND',
            paymentStatus: 'REFUNDED',
          ),
        ),
        contains('focus=payment'),
      );
      expect(
        paymentNotificationOpenRoute(
          _paymentNotification(type: 'PAYMENT_RESOLUTION_REQUIRED'),
        ),
        contains('focus=resolution'),
      );
    });

    test('never deep-links to stale per-order checkout', () {
      for (final type in kPaymentNotificationTypes) {
        final route = paymentNotificationOpenRoute(
          _paymentNotification(type: type, paymentStatus: 'REQUIRES_PAYMENT'),
        );
        expect(route, isNotNull);
        expect(route, isNot(contains('/learner/checkout/ord-')));
        expect(
          route!.startsWith('/learner/checkout/reservation/') ||
              route.startsWith('/learner/reservations/'),
          isTrue,
          reason: type,
        );
      }
    });
  });

  group('payment notification presentation helpers', () {
    test('amount and currency render when present and omit when missing', () {
      final withAmount = _paymentNotification(type: 'PAYMENT_REQUIRED');
      final withoutAmount = _paymentNotification(
        type: 'PAYMENT_REQUIRED',
        amount: null,
      );

      expect(formatPaymentNotificationAmount(withAmount, en), '42.00 ₪');
      expect(formatPaymentNotificationAmount(withoutAmount, en), isNull);
      expect(
        localizedNotificationCopy(withAmount, en).body,
        contains('42.00'),
      );
      expect(
        localizedNotificationCopy(withoutAmount, en).body,
        isNot(contains('42.00')),
      );
    });

    test('arabic and english localize payment titles', () {
      final notification = _paymentNotification(type: 'PAYMENT_REQUIRED');
      expect(
        localizedNotificationCopy(notification, en).title,
        'Payment required',
      );
      expect(
        localizedNotificationCopy(notification, ar).title,
        'الدفع مطلوب',
      );
      expect(
        paymentNotificationActionLabel(notification, ar),
        isNot(equals(paymentNotificationActionLabel(notification, en))),
      );
    });

    test('dedupes notifications by identity', () {
      final a = _paymentNotification(type: 'PAYMENT_REQUIRED', id: 'n1');
      final b = _paymentNotification(type: 'PAYMENT_REQUIRED', id: 'n1');
      final c = _paymentNotification(type: 'PAYMENT_COMPLETED', id: 'n2');
      final deduped = dedupeNotificationsById([a, b, c, a]);
      expect(deduped.map((n) => n.id), ['n1', 'n2']);
    });

    test('category filters are truthful for payment families', () {
      final required = _paymentNotification(type: 'PAYMENT_REQUIRED');
      final ready = _paymentNotification(
        type: 'PAYMENT_FULFILLMENT_READY',
        fulfillmentMethod: 'DELIVERY',
      );
      final refund = _paymentNotification(type: 'PAYMENT_REFUND_REQUESTED');

      expect(
        notificationMatchesCategoryFilter(
          required,
          PaymentNotificationCategoryFilter.payments,
        ),
        isTrue,
      );
      expect(
        notificationMatchesCategoryFilter(
          ready,
          PaymentNotificationCategoryFilter.delivery,
        ),
        isTrue,
      );
      expect(
        notificationMatchesCategoryFilter(
          refund,
          PaymentNotificationCategoryFilter.refunds,
        ),
        isTrue,
      );
      expect(
        notificationMatchesCategoryFilter(
          required,
          PaymentNotificationCategoryFilter.refunds,
        ),
        isFalse,
      );
    });
    test('delivery fee and more-payment / new-cycle metadata are mapped', () {
      final fee = _paymentNotification(
        type: 'PAYMENT_REQUIRED',
        extraMetadata: const {'paymentPurpose': 'DELIVERY_FEE'},
      );
      expect(
        localizedNotificationCopy(fee, en).title,
        en.notificationPaymentDeliveryFeeRequiredTitle,
      );
      expect(paymentNotificationOpenRoute(fee), contains('/checkout/reservation/'));

      final more = _paymentNotification(
        type: 'PAYMENT_COMPLETED',
        paymentStatus: 'PAID',
        extraMetadata: const {'morePaymentRequired': true},
      );
      expect(
        localizedNotificationCopy(more, en).title,
        en.notificationPaymentCompletedMoreRequiredTitle,
      );
      expect(paymentNotificationOpenRoute(more), contains('/checkout/reservation/'));
      expect(paymentNotificationActionLabel(more, en), en.payNow);

      final cycle = _paymentNotification(
        type: 'PAYMENT_REFUNDED',
        paymentStatus: 'REFUNDED',
        extraMetadata: const {'newCycleCreated': true},
      );
      expect(
        localizedNotificationCopy(cycle, en).title,
        en.notificationPaymentRefundedNewCycleTitle,
      );
      expect(paymentNotificationOpenRoute(cycle), contains('/checkout/reservation/'));
    });

    test('forged reservation id only builds a route — no auth bypass', () {
      final forged = _paymentNotification(
        type: 'PAYMENT_REQUIRED',
        reservationId: 'someone-elses-reservation',
      );
      final route = paymentNotificationOpenRoute(forged);
      expect(route, contains('someone-elses-reservation'));
      // Deep links never embed tokens, attempt ids, or provider refs.
      expect(route, isNot(contains('token')));
      expect(route, isNot(contains('paymentAttempt')));
      expect(route, isNot(contains('webhook')));
    });
  });
}
