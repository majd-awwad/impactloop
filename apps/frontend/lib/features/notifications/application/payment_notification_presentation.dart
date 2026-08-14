import 'package:flutter/material.dart';

import '../../../app/theme/app_color_tokens.dart';
import '../../../features/auth/application/auth_route_helpers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/app_status_badge.dart';
import '../data/models/app_notification.dart';

/// Backend payment notification types already produced by PAY-04.
const Set<String> kPaymentNotificationTypes = {
  'PAYMENT_REQUIRED',
  'PAYMENT_COMPLETED',
  'PAYMENT_FULFILLMENT_READY',
  'PAYMENT_REFUND_REQUESTED',
  'PAYMENT_REFUNDED',
  'PAYMENT_REFUND_FAILED',
  'PAYMENT_LATE_SUCCESS_REFUND',
  'PAYMENT_NEW_CYCLE_REQUIRED',
  'PAYMENT_RESOLUTION_REQUIRED',
};

const Set<String> kPaymentRefundNotificationTypes = {
  'PAYMENT_REFUND_REQUESTED',
  'PAYMENT_REFUNDED',
  'PAYMENT_REFUND_FAILED',
  'PAYMENT_LATE_SUCCESS_REFUND',
};

const Set<String> kPaymentActionNotificationTypes = {
  'PAYMENT_REQUIRED',
  'PAYMENT_COMPLETED',
  'PAYMENT_NEW_CYCLE_REQUIRED',
  'PAYMENT_RESOLUTION_REQUIRED',
};

bool isPaymentNotificationType(String? type) {
  final normalized = type?.trim().toUpperCase() ?? '';
  return kPaymentNotificationTypes.contains(normalized);
}

bool isPaymentNotification(AppNotification notification) =>
    isPaymentNotificationType(notification.notificationType);

enum PaymentNotificationKind {
  required,
  completed,
  fulfillmentReady,
  refundRequested,
  refunded,
  refundFailed,
  lateSuccessRefund,
  newCycleRequired,
  resolutionRequired,
}

PaymentNotificationKind? paymentNotificationKind(AppNotification notification) {
  return switch (notification.notificationType.trim().toUpperCase()) {
    'PAYMENT_REQUIRED' => PaymentNotificationKind.required,
    'PAYMENT_COMPLETED' => PaymentNotificationKind.completed,
    'PAYMENT_FULFILLMENT_READY' => PaymentNotificationKind.fulfillmentReady,
    'PAYMENT_REFUND_REQUESTED' => PaymentNotificationKind.refundRequested,
    'PAYMENT_REFUNDED' => PaymentNotificationKind.refunded,
    'PAYMENT_REFUND_FAILED' => PaymentNotificationKind.refundFailed,
    'PAYMENT_LATE_SUCCESS_REFUND' => PaymentNotificationKind.lateSuccessRefund,
    'PAYMENT_NEW_CYCLE_REQUIRED' => PaymentNotificationKind.newCycleRequired,
    'PAYMENT_RESOLUTION_REQUIRED' => PaymentNotificationKind.resolutionRequired,
    _ => null,
  };
}

enum PaymentNotificationCategoryFilter {
  all,
  payments,
  delivery,
  refunds,
}

bool notificationMatchesCategoryFilter(
  AppNotification notification,
  PaymentNotificationCategoryFilter filter,
) {
  switch (filter) {
    case PaymentNotificationCategoryFilter.all:
      return true;
    case PaymentNotificationCategoryFilter.payments:
      return kPaymentActionNotificationTypes.contains(
        notification.notificationType.trim().toUpperCase(),
      );
    case PaymentNotificationCategoryFilter.delivery:
      final type = notification.notificationType.trim().toUpperCase();
      return type == 'PAYMENT_FULFILLMENT_READY' ||
          notification.relatedEntityType == 'DELIVERY' ||
          type.contains('DELIVERY') ||
          type.startsWith('DRIVER_');
    case PaymentNotificationCategoryFilter.refunds:
      return kPaymentRefundNotificationTypes.contains(
        notification.notificationType.trim().toUpperCase(),
      );
  }
}

/// Backend query value for the category filter, or null for unfiltered.
String? apiCategoryForFilter(PaymentNotificationCategoryFilter filter) {
  return switch (filter) {
    PaymentNotificationCategoryFilter.all => null,
    PaymentNotificationCategoryFilter.payments => 'payments',
    PaymentNotificationCategoryFilter.delivery => 'delivery',
    PaymentNotificationCategoryFilter.refunds => 'refunds',
  };
}

String? paymentNotificationMetadataString(
  AppNotification notification,
  String key,
) {
  final value = notification.metadata[key]?.toString().trim() ?? '';
  return value.isEmpty ? null : value;
}

String? paymentNotificationReservationId(AppNotification notification) {
  final related = notification.relatedEntityId?.trim();
  if (related != null && related.isNotEmpty) {
    return related;
  }
  return paymentNotificationMetadataString(notification, 'reservationId');
}

String? paymentNotificationOrderId(AppNotification notification) {
  return paymentNotificationMetadataString(notification, 'paymentOrderId');
}

String? paymentNotificationAmountRaw(AppNotification notification) {
  if (paymentNotificationIsAggregatedCheckout(notification)) {
    return paymentNotificationMetadataString(notification, 'totalAmount') ??
        paymentNotificationMetadataString(notification, 'amount');
  }
  return paymentNotificationMetadataString(notification, 'amount');
}

String? paymentNotificationCurrency(AppNotification notification) {
  return paymentNotificationMetadataString(notification, 'currency');
}

String? paymentNotificationMaterialTitle(AppNotification notification) {
  return paymentNotificationMetadataString(notification, 'materialTitle');
}

String? paymentNotificationFulfillmentMethod(AppNotification notification) {
  return paymentNotificationMetadataString(
    notification,
    'fulfillmentMethod',
  )?.toUpperCase();
}

String? paymentNotificationPaymentStatus(AppNotification notification) {
  return paymentNotificationMetadataString(
    notification,
    'paymentStatus',
  )?.toUpperCase();
}

String? paymentNotificationPurpose(AppNotification notification) {
  return paymentNotificationMetadataString(
    notification,
    'paymentPurpose',
  )?.toUpperCase();
}

bool paymentNotificationIsDeliveryFee(AppNotification notification) =>
    paymentNotificationPurpose(notification) == 'DELIVERY_FEE';

bool paymentNotificationIsAggregatedCheckout(AppNotification notification) =>
    notification.metadata['aggregatedCheckout'] == true;

bool paymentNotificationMaterialOutstanding(AppNotification notification) =>
    notification.metadata['materialOutstanding'] == true;

bool paymentNotificationDeliveryFeeOutstanding(AppNotification notification) =>
    notification.metadata['deliveryFeeOutstanding'] == true;

bool paymentNotificationMorePaymentRequired(AppNotification notification) =>
    notification.metadata['morePaymentRequired'] == true;

bool paymentNotificationNewCycleCreated(AppNotification notification) =>
    notification.metadata['newCycleCreated'] == true;

/// True when metadata indicates a still-payable obligation snapshot.
bool paymentNotificationHasPayableObligation(AppNotification notification) {
  final status = paymentNotificationPaymentStatus(notification);
  return status == 'REQUIRES_PAYMENT' || status == 'CHECKOUT_PENDING';
}

/// True when the learner should continue into reservation-scoped checkout.
///
/// For PAYMENT_REQUIRED, always prefer reservation-scoped checkout so stale
/// notification metadata cannot force a contradictory details-only path.
/// Checkout / requirement APIs remain the server truth for already-paid cases.
bool paymentNotificationShouldOpenCheckout(AppNotification notification) {
  final kind = paymentNotificationKind(notification);
  switch (kind) {
    case PaymentNotificationKind.required:
      return true;
    case PaymentNotificationKind.newCycleRequired:
      return true;
    case PaymentNotificationKind.completed:
      return paymentNotificationMorePaymentRequired(notification);
    case PaymentNotificationKind.refunded:
      return paymentNotificationNewCycleCreated(notification);
    case PaymentNotificationKind.fulfillmentReady:
    case PaymentNotificationKind.refundRequested:
    case PaymentNotificationKind.refundFailed:
    case PaymentNotificationKind.lateSuccessRefund:
    case PaymentNotificationKind.resolutionRequired:
    case null:
      return false;
  }
}

String? formatPaymentNotificationAmount(
  AppNotification notification,
  AppLocalizations l10n,
) {
  final amount = paymentNotificationAmountRaw(notification);
  if (amount == null) {
    return null;
  }
  return l10n.reservationMoneyAmountWithCurrency(amount);
}

/// Semantic accent for payment notification tiles (not color-only meaning).
class PaymentNotificationVisualStyle {
  const PaymentNotificationVisualStyle({
    required this.tone,
    required this.accent,
    required this.icon,
  });

  final AppStatusTone tone;
  final Color accent;
  final IconData icon;
}

PaymentNotificationVisualStyle paymentNotificationVisualStyle(
  AppNotification notification,
) {
  final kind = paymentNotificationKind(notification);
  switch (kind) {
    case PaymentNotificationKind.required:
    case PaymentNotificationKind.newCycleRequired:
      return const PaymentNotificationVisualStyle(
        tone: AppStatusTone.warning,
        accent: AppColorTokens.amber,
        icon: Icons.notifications_active_outlined,
      );
    case PaymentNotificationKind.completed:
      if (paymentNotificationMorePaymentRequired(notification)) {
        return const PaymentNotificationVisualStyle(
          tone: AppStatusTone.warning,
          accent: AppColorTokens.amber,
          icon: Icons.notifications_active_outlined,
        );
      }
      return const PaymentNotificationVisualStyle(
        tone: AppStatusTone.success,
        accent: AppColorTokens.forest,
        icon: Icons.check_circle_outline_rounded,
      );
    case PaymentNotificationKind.fulfillmentReady:
      final method = paymentNotificationFulfillmentMethod(notification);
      if (method == 'PICKUP') {
        return const PaymentNotificationVisualStyle(
          tone: AppStatusTone.success,
          accent: AppColorTokens.teal,
          icon: Icons.storefront_outlined,
        );
      }
      return const PaymentNotificationVisualStyle(
        tone: AppStatusTone.info,
        accent: AppColorTokens.teal,
        icon: Icons.local_shipping_outlined,
      );
    case PaymentNotificationKind.refundRequested:
      return const PaymentNotificationVisualStyle(
        tone: AppStatusTone.info,
        accent: AppColorTokens.blue,
        icon: Icons.hourglass_top_rounded,
      );
    case PaymentNotificationKind.refunded:
      if (paymentNotificationNewCycleCreated(notification)) {
        return const PaymentNotificationVisualStyle(
          tone: AppStatusTone.warning,
          accent: AppColorTokens.amber,
          icon: Icons.notifications_active_outlined,
        );
      }
      return const PaymentNotificationVisualStyle(
        tone: AppStatusTone.success,
        accent: AppColorTokens.forest,
        icon: Icons.check_circle_outline_rounded,
      );
    case PaymentNotificationKind.refundFailed:
    case PaymentNotificationKind.resolutionRequired:
      return const PaymentNotificationVisualStyle(
        tone: AppStatusTone.warning,
        accent: Color(0xFF7C3AED),
        icon: Icons.notification_important_outlined,
      );
    case PaymentNotificationKind.lateSuccessRefund:
      return const PaymentNotificationVisualStyle(
        tone: AppStatusTone.info,
        accent: AppColorTokens.blue,
        icon: Icons.info_outline_rounded,
      );
    case null:
      return const PaymentNotificationVisualStyle(
        tone: AppStatusTone.neutral,
        accent: AppColorTokens.textMuted,
        icon: Icons.payments_outlined,
      );
  }
}

IconData paymentNotificationIcon(AppNotification notification) =>
    paymentNotificationVisualStyle(notification).icon;

AppStatusTone paymentNotificationTone(AppNotification notification) =>
    paymentNotificationVisualStyle(notification).tone;

Color paymentNotificationAccent(AppNotification notification) =>
    paymentNotificationVisualStyle(notification).accent;

({String title, String body}) localizedPaymentNotificationCopy(
  AppNotification notification,
  AppLocalizations l10n,
) {
  final material =
      paymentNotificationMaterialTitle(notification) ?? l10n.material;
  final amount = formatPaymentNotificationAmount(notification, l10n);
  final kind = paymentNotificationKind(notification);

  switch (kind) {
    case PaymentNotificationKind.required:
      if (paymentNotificationIsAggregatedCheckout(notification)) {
        final amount = formatPaymentNotificationAmount(notification, l10n);
        if (amount == null) {
          return (
            title: l10n.notificationPaymentAcceptedReadyTitle,
            body: l10n.notificationPaymentRequiredBody(material),
          );
        }
        if (paymentNotificationMaterialOutstanding(notification) &&
            paymentNotificationDeliveryFeeOutstanding(notification)) {
          return (
            title: l10n.notificationPaymentAcceptedReadyTitle,
            body: l10n.notificationPaymentAcceptedReadyBodyMaterialsAndDelivery(
              amount,
            ),
          );
        }
        if (paymentNotificationDeliveryFeeOutstanding(notification) &&
            !paymentNotificationMaterialOutstanding(notification)) {
          return (
            title: l10n.notificationPaymentAcceptedReadyTitle,
            body: l10n.notificationPaymentAcceptedReadyBodyDeliveryOnly(amount),
          );
        }
        if (paymentNotificationFulfillmentMethod(notification) == 'PICKUP') {
          return (
            title: l10n.notificationPaymentAcceptedReadyTitle,
            body: l10n.notificationPaymentAcceptedReadyBodyPickup(
              amount,
              material,
            ),
          );
        }
        return (
          title: l10n.notificationPaymentAcceptedReadyTitle,
          body: l10n.notificationPaymentAcceptedReadyBodyMaterialsOnly(amount),
        );
      }
      if (paymentNotificationIsDeliveryFee(notification)) {
        return (
          title: l10n.notificationPaymentDeliveryFeeRequiredTitle,
          body: amount == null
              ? l10n.notificationPaymentDeliveryFeeRequiredBody(material)
              : l10n.notificationPaymentDeliveryFeeRequiredBodyWithAmount(
                  material,
                  amount,
                ),
        );
      }
      return (
        title: l10n.notificationPaymentRequiredTitle,
        body: amount == null
            ? l10n.notificationPaymentRequiredBody(material)
            : l10n.notificationPaymentRequiredBodyWithAmount(material, amount),
      );
    case PaymentNotificationKind.completed:
      if (paymentNotificationMorePaymentRequired(notification)) {
        return (
          title: l10n.notificationPaymentCompletedMoreRequiredTitle,
          body: amount == null
              ? l10n.notificationPaymentCompletedMoreRequiredBody(material)
              : l10n.notificationPaymentCompletedMoreRequiredBodyWithAmount(
                  material,
                  amount,
                ),
        );
      }
      return (
        title: l10n.notificationPaymentCompletedTitle,
        body: amount == null
            ? l10n.notificationPaymentCompletedBody(material)
            : l10n.notificationPaymentCompletedBodyWithAmount(material, amount),
      );
    case PaymentNotificationKind.fulfillmentReady:
      final method = paymentNotificationFulfillmentMethod(notification);
      if (method == 'PICKUP') {
        return (
          title: l10n.notificationPaymentPickupReadyTitle,
          body: l10n.notificationPaymentPickupReadyBody(material),
        );
      }
      return (
        title: l10n.notificationPaymentFulfillmentReadyTitle,
        body: l10n.notificationPaymentFulfillmentReadyBody(material),
      );
    case PaymentNotificationKind.refundRequested:
      return (
        title: l10n.notificationPaymentRefundRequestedTitle,
        body: amount == null
            ? l10n.notificationPaymentRefundRequestedBody(material)
            : l10n.notificationPaymentRefundRequestedBodyWithAmount(
                material,
                amount,
              ),
      );
    case PaymentNotificationKind.refunded:
      if (paymentNotificationNewCycleCreated(notification)) {
        return (
          title: l10n.notificationPaymentRefundedNewCycleTitle,
          body: amount == null
              ? l10n.notificationPaymentRefundedNewCycleBody(material)
              : l10n.notificationPaymentRefundedNewCycleBodyWithAmount(
                  material,
                  amount,
                ),
        );
      }
      return (
        title: l10n.notificationPaymentRefundedTitle,
        body: amount == null
            ? l10n.notificationPaymentRefundedBody(material)
            : l10n.notificationPaymentRefundedBodyWithAmount(material, amount),
      );
    case PaymentNotificationKind.refundFailed:
      return (
        title: l10n.notificationPaymentRefundFailedTitle,
        body: l10n.notificationPaymentRefundFailedBody(material),
      );
    case PaymentNotificationKind.lateSuccessRefund:
      return (
        title: l10n.notificationPaymentLateSuccessRefundTitle,
        body: l10n.notificationPaymentLateSuccessRefundBody(material),
      );
    case PaymentNotificationKind.newCycleRequired:
      return (
        title: l10n.notificationPaymentNewCycleRequiredTitle,
        body: amount == null
            ? l10n.notificationPaymentNewCycleRequiredBody(material)
            : l10n.notificationPaymentNewCycleRequiredBodyWithAmount(
                material,
                amount,
              ),
      );
    case PaymentNotificationKind.resolutionRequired:
      return (
        title: l10n.notificationPaymentResolutionRequiredTitle,
        body: l10n.notificationPaymentResolutionRequiredBody(material),
      );
    case null:
      return (
        title: l10n.notificationFallbackTitle,
        body: l10n.notificationFallbackBody,
      );
  }
}

String paymentNotificationActionLabel(
  AppNotification notification,
  AppLocalizations l10n,
) {
  final kind = paymentNotificationKind(notification);
  // Soft CTA: do not hard-claim "Pay now" from frozen notification metadata.
  if (kind == PaymentNotificationKind.required) {
    if (paymentNotificationIsAggregatedCheckout(notification)) {
      return l10n.completePayment;
    }
    return l10n.notificationPaymentOpenCheckout;
  }
  if (paymentNotificationShouldOpenCheckout(notification)) {
    return kind == PaymentNotificationKind.newCycleRequired
        ? l10n.payNow
        : l10n.notificationPaymentOpenCheckout;
  }

  switch (kind) {
    case PaymentNotificationKind.required:
      return l10n.notificationPaymentOpenCheckout;
    case PaymentNotificationKind.newCycleRequired:
      return l10n.payNow;
    case PaymentNotificationKind.completed:
    case PaymentNotificationKind.refundRequested:
    case PaymentNotificationKind.refunded:
    case PaymentNotificationKind.refundFailed:
    case PaymentNotificationKind.lateSuccessRefund:
    case PaymentNotificationKind.resolutionRequired:
      return l10n.checkoutViewReservationDetails;
    case PaymentNotificationKind.fulfillmentReady:
      final method = paymentNotificationFulfillmentMethod(notification);
      if (method == 'PICKUP') {
        return l10n.notificationPaymentShowPickupCode;
      }
      return l10n.trackDelivery;
    case null:
      return l10n.viewReservation;
  }
}

String paymentNotificationNextStepCopy(
  AppNotification notification,
  AppLocalizations l10n,
) {
  final kind = paymentNotificationKind(notification);
  if (kind == PaymentNotificationKind.required) {
    return l10n.notificationPaymentStatusCheckPayment;
  }
  if (paymentNotificationShouldOpenCheckout(notification)) {
    return l10n.notificationPaymentNextStepPay;
  }

  return switch (kind) {
    PaymentNotificationKind.required =>
      l10n.notificationPaymentStatusCheckPayment,
    PaymentNotificationKind.newCycleRequired =>
      l10n.notificationPaymentNextStepPay,
    PaymentNotificationKind.completed =>
      l10n.notificationPaymentNextStepViewReservation,
    PaymentNotificationKind.fulfillmentReady =>
      paymentNotificationFulfillmentMethod(notification) == 'PICKUP'
          ? l10n.notificationPaymentNextStepPickup
          : l10n.notificationPaymentNextStepTrack,
    PaymentNotificationKind.refundRequested =>
      l10n.notificationPaymentNextStepRefundProcessing,
    PaymentNotificationKind.refunded =>
      l10n.notificationPaymentNextStepRefunded,
    PaymentNotificationKind.refundFailed ||
    PaymentNotificationKind.resolutionRequired =>
      l10n.notificationPaymentNextStepResolution,
    PaymentNotificationKind.lateSuccessRefund =>
      l10n.notificationPaymentNextStepLateRefund,
    null => l10n.notificationPaymentNextStepViewReservation,
  };
}

String? paymentNotificationStatusCaption(
  AppNotification notification,
  AppLocalizations l10n,
) {
  final kind = paymentNotificationKind(notification);
  return switch (kind) {
    PaymentNotificationKind.required =>
      l10n.notificationPaymentStatusCheckPayment,
    PaymentNotificationKind.newCycleRequired =>
      l10n.notificationPaymentStatusUnpaid,
    PaymentNotificationKind.completed => l10n.notificationPaymentStatusPaid,
    PaymentNotificationKind.refundRequested =>
      l10n.notificationPaymentStatusRefundProcessing,
    PaymentNotificationKind.refunded =>
      l10n.notificationPaymentStatusRefunded,
    PaymentNotificationKind.refundFailed =>
      l10n.notificationPaymentStatusRefundFailed,
    PaymentNotificationKind.resolutionRequired =>
      l10n.notificationPaymentStatusResolutionRequired,
    PaymentNotificationKind.lateSuccessRefund =>
      l10n.notificationPaymentStatusLateRefund,
    PaymentNotificationKind.fulfillmentReady =>
      paymentNotificationFulfillmentMethod(notification) == 'PICKUP'
          ? l10n.notificationPaymentStatusPickupReady
          : l10n.notificationPaymentStatusFulfillmentReady,
    null => null,
  };
}

/// Resolves the learner deep-link for a payment notification.
///
/// Never returns a stale per-order checkout path — only reservation-scoped
/// checkout or reservation details with a section focus.
String? paymentNotificationOpenRoute(AppNotification notification) {
  final reservationId = paymentNotificationReservationId(notification);
  if (reservationId == null) {
    return null;
  }

  final orderId = paymentNotificationOrderId(notification);
  final kind = paymentNotificationKind(notification);

  switch (kind) {
    case PaymentNotificationKind.required:
      if (paymentNotificationShouldOpenCheckout(notification)) {
        return learnerReservationCheckoutRoute(reservationId);
      }
      return learnerReservationDetailRoute(
        reservationId,
        focus: 'payment',
        checkoutableOrderId: orderId,
      );
    case PaymentNotificationKind.newCycleRequired:
      return learnerReservationCheckoutRoute(reservationId);
    case PaymentNotificationKind.completed:
      if (paymentNotificationShouldOpenCheckout(notification)) {
        return learnerReservationCheckoutRoute(reservationId);
      }
      return learnerReservationDetailRoute(
        reservationId,
        focus: 'payment',
        checkoutableOrderId: orderId,
      );
    case PaymentNotificationKind.fulfillmentReady:
      final method = paymentNotificationFulfillmentMethod(notification);
      return learnerReservationDetailRoute(
        reservationId,
        focus: method == 'PICKUP' ? 'pickup' : 'fulfillment',
      );
    case PaymentNotificationKind.refundRequested:
      return learnerReservationDetailRoute(
        reservationId,
        focus: 'payment',
        checkoutableOrderId: orderId,
      );
    case PaymentNotificationKind.refunded:
      if (paymentNotificationShouldOpenCheckout(notification)) {
        return learnerReservationCheckoutRoute(reservationId);
      }
      return learnerReservationDetailRoute(
        reservationId,
        focus: 'payment',
      );
    case PaymentNotificationKind.refundFailed:
      return learnerReservationDetailRoute(
        reservationId,
        focus: 'resolution',
        checkoutableOrderId: orderId,
      );
    case PaymentNotificationKind.lateSuccessRefund:
      return learnerReservationDetailRoute(
        reservationId,
        focus: 'payment',
        checkoutableOrderId: orderId,
      );
    case PaymentNotificationKind.resolutionRequired:
      return learnerReservationDetailRoute(
        reservationId,
        focus: 'resolution',
        checkoutableOrderId: orderId,
      );
    case null:
      return learnerReservationDetailRoute(reservationId);
  }
}

/// Deduplicates notifications by stable identity (`id`).
List<AppNotification> dedupeNotificationsById(
  Iterable<AppNotification> notifications,
) {
  final seen = <String>{};
  final result = <AppNotification>[];
  for (final item in notifications) {
    final id = item.id.trim();
    if (id.isEmpty || !seen.add(id)) {
      continue;
    }
    result.add(item);
  }
  return result;
}
