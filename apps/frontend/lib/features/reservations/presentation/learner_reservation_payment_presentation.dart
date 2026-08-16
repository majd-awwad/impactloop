import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../../../shared/widgets/app_status_badge.dart';
import '../../deliveries/data/models/learner_delivery.dart';
import '../data/models/learner_reservation.dart';
import '../data/models/reservation_payment_summary.dart';
import 'learner_reservation_ui_helpers.dart';

/// Primary card action driven by server payment + fulfillment state.
enum LearnerReservationPrimaryAction {
  payNow,
  completePayment,
  viewPickupCode,
  trackDelivery,
  viewDetails,
  none,
}

class LearnerReservationCardPresentation {
  const LearnerReservationCardPresentation({
    required this.reservationStatusLabel,
    required this.reservationTone,
    this.paymentStatusLabel,
    this.paymentTone,
    required this.nextStepMessage,
    required this.nextStepTone,
    required this.primaryAction,
    required this.showSecondaryDetails,
    required this.accentTone,
    required this.showActionAccent,
    required this.isHistoricalCompact,
  });

  final String reservationStatusLabel;
  final AppStatusTone reservationTone;
  final String? paymentStatusLabel;
  final AppStatusTone? paymentTone;
  final String nextStepMessage;
  final AppStatusTone nextStepTone;
  final LearnerReservationPrimaryAction primaryAction;
  final bool showSecondaryDetails;
  final AppStatusTone accentTone;
  final bool showActionAccent;
  final bool isHistoricalCompact;
}

AppStatusTone paymentSummaryTone(ReservationPaymentSummary? summary) {
  if (summary == null || summary.isPaymentsDisabled) {
    return AppStatusTone.neutral;
  }
  if (summary.dueAtHandover) return AppStatusTone.warning;

  switch (summary.overallStatus) {
    case 'PAID':
    case 'NOT_REQUIRED':
      return AppStatusTone.success;
    case 'REQUIRES_PAYMENT':
    case 'BLOCKED':
    case 'PAYMENT_FAILED':
    case 'NEW_PAYMENT_CYCLE_REQUIRED':
      return AppStatusTone.danger;
    case 'PROCESSING':
    case 'REFUND_PENDING':
    case 'AWAITING_ACCEPTANCE':
    case 'AWAITING_GROUP_CONFIRMATION':
      return AppStatusTone.warning;
    case 'RESOLUTION_REQUIRED':
      return AppStatusTone.warning;
    case 'REFUNDED':
    case 'CANCELLED':
      return AppStatusTone.neutral;
    default:
      if (summary.isPartialPayment) return AppStatusTone.info;
      return AppStatusTone.neutral;
  }
}

String? paymentStatusLabel(
  ReservationPaymentSummary? summary, {
  required AppLocalizations l10n,
}) {
  if (summary == null) return null;
  if (summary.isPaymentsDisabled) return null;
  if (summary.dueAtHandover) {
    return l10n.reservationPaymentDueAtHandover;
  }

  if (summary.isPartialPayment) {
    return l10n.paymentStatusPartial;
  }

  switch (summary.overallStatus) {
    case 'REQUIRES_PAYMENT':
    case 'NEW_PAYMENT_CYCLE_REQUIRED':
    case 'PAYMENT_FAILED':
      return l10n.paymentStatusRequired;
    case 'PROCESSING':
      return l10n.paymentStatusProcessing;
    case 'PAID':
      return l10n.paymentStatusPaid;
    case 'REFUND_PENDING':
      return l10n.paymentStatusRefundPending;
    case 'REFUNDED':
      return l10n.paymentStatusRefunded;
    case 'RESOLUTION_REQUIRED':
    case 'BLOCKED':
      return l10n.paymentStatusNeedsReview;
    case 'NOT_REQUIRED':
      return l10n.paymentStatusNotRequired;
    case 'AWAITING_ACCEPTANCE':
    case 'AWAITING_GROUP_CONFIRMATION':
    case 'PAYMENT_DISABLED':
    case 'CANCELLED':
      return null;
    default:
      return null;
  }
}

String learnerReservationListStatusLabel(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
  String? linkedDeliveryStatus,
}) {
  if (reservation.isAwaitingResolution) {
    return l10n.reservationListStatusNeedsReview;
  }
  if (reservation.isPending || reservation.isAwaitingSupplierConfirmation) {
    return l10n.reservationListStatusWaiting;
  }
  if (reservation.isAwaitingConfirmation) {
    return l10n.reservationListStatusNeedsAction;
  }
  if (reservation.isAccepted) {
    return l10n.reservationListStatusAccepted;
  }
  if (reservation.isCompleted) {
    return l10n.reservationListStatusCompleted;
  }
  if (reservation.isCancelled ||
      reservation.isRejected ||
      reservation.isExpired ||
      reservation.status == 'NO_SHOW' ||
      reservation.status == 'FULFILLMENT_FAILED') {
    return l10n.reservationListStatusClosed;
  }

  final chips = learnerReservationStatusChipLabels(reservation, l10n: l10n);
  return chips.primary;
}

String reservationNextStepMessage(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
  LearnerDelivery? delivery,
}) {
  final summary = reservation.paymentSummary;

  if (summary == null && _mightNeedPayment(reservation)) {
    return l10n.reservationNextStepPaymentUnavailable;
  }

  if (summary != null && !summary.isPaymentsDisabled) {
    if (summary.dueAtHandover) {
      return l10n.reservationPaymentCashAtHandover;
    }
    if (summary.isResolutionRequired) {
      return l10n.reservationNextStepUnderReview;
    }
    if (summary.isRefundPending) {
      return l10n.reservationNextStepRefundProcessing;
    }
    if (summary.isRefunded) {
      return l10n.reservationNextStepRefunded;
    }
    if (summary.isProcessing) {
      return l10n.reservationNextStepPaymentProcessing;
    }
    if (summary.hasMaterialPaymentOutstanding &&
        summary.hasDeliveryFeeOutstanding) {
      return reservation.isDeliveryFulfillment
          ? l10n.reservationMoneyBothOutstanding
          : (summary.dueAtHandover
              ? l10n.reservationPaymentCashAtHandover
              : l10n.reservationNextStepPayToConfirm);
    }
    if (summary.hasMaterialPaymentOutstanding) {
      return reservation.isDeliveryFulfillment
          ? (summary.dueAtHandover
              ? l10n.reservationPaymentCashAtHandover
              : l10n.reservationNextStepPayToConfirmDelivery)
          : (summary.dueAtHandover
              ? l10n.reservationPaymentCashAtHandover
              : l10n.reservationNextStepPayToConfirm);
    }
    if (summary.hasDeliveryFeeOutstanding) {
      return summary.dueAtHandover
          ? l10n.reservationPaymentCashAtHandover
          : l10n.reservationNextStepDeliveryFeeRemaining;
    }
    if (summary.isPaid &&
        reservation.isPickupFulfillment &&
        !summary.pickupCodeAvailable) {
      return l10n.reservationNextStepPickupCodeWindow;
    }
    if (summary.pickupCodeAvailable) {
      return l10n.reservationNextStepPickupCodeReady;
    }
  }

  if (reservation.isAwaitingConfirmation) {
    return l10n.reservationNextStepConfirmProposal;
  }
  if (reservation.isPending || reservation.isAwaitingSupplierConfirmation) {
    return l10n.reservationNextStepWaitingSupplier;
  }
  if (reservation.isAwaitingResolution) {
    return l10n.reservationNextStepUnderReview;
  }

  final deliveryStatus = delivery?.status ?? reservation.activeDelivery?.status;
  if (deliveryStatus == 'WAITING_FOR_DRIVER') {
    return l10n.reservationNextStepFindingDriver;
  }
  if (deliveryStatus != null &&
      deliveryStatus != 'DELIVERED' &&
      deliveryStatus != 'CANCELLED') {
    return l10n.reservationNextStepTrackDelivery;
  }

  if (reservation.isCompleted) {
    return reservation.isDeliveryFulfillment
        ? l10n.reservationNextStepDelivered
        : l10n.reservationCompletedMessage;
  }

  if (reservation.isReadOnlyFinalState) {
    return l10n.reservationNextStepClosed;
  }

  if (reservation.isAccepted && reservation.isOverdue) {
    return l10n.pickupWindowPassedFollowup;
  }

  if (reservation.isAccepted) {
    return reservation.isPickupFulfillment
        ? l10n.reservationNextStepReadyPickup
        : l10n.reservationNextStepAcceptedDelivery;
  }

  return reservationStatusMessage(reservation, l10n: l10n) ??
      l10n.reservationNextStepViewDetails;
}

LearnerReservationPrimaryAction resolvePrimaryAction(
  LearnerReservation reservation, {
  LearnerDelivery? delivery,
}) {
  final summary = reservation.paymentSummary;

  if (summary != null &&
      !summary.isPaymentsDisabled &&
      summary.dueAtHandover) {
    return LearnerReservationPrimaryAction.viewDetails;
  }

  if (summary != null &&
      !summary.isPaymentsDisabled &&
      summary.canStartCheckout) {
    if (summary.isPartialPayment ||
        (summary.hasDeliveryFeeOutstanding &&
            !summary.hasMaterialPaymentOutstanding)) {
      return LearnerReservationPrimaryAction.completePayment;
    }
    return LearnerReservationPrimaryAction.payNow;
  }

  final deliveryId = delivery?.id ?? reservation.activeDelivery?.id;
  if (deliveryId != null &&
      !reservation.isCompleted &&
      !reservation.isReadOnlyFinalState) {
    return LearnerReservationPrimaryAction.trackDelivery;
  }

  if (summary?.pickupCodeAvailable == true) {
    return LearnerReservationPrimaryAction.viewPickupCode;
  }

  if (reservation.isReadOnlyFinalState || reservation.isCompleted) {
    return LearnerReservationPrimaryAction.viewDetails;
  }

  return LearnerReservationPrimaryAction.viewDetails;
}

LearnerReservationCardPresentation buildReservationCardPresentation(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
  LearnerDelivery? delivery,
}) {
  final summary = reservation.paymentSummary;
  final reservationTone = learnerReservationStatusTone(
    reservation.status,
    incidentReviewStatus: reservation.incidentReviewStatus,
  );
  final paymentTone = paymentSummaryTone(summary);
  final paymentLabel = paymentStatusLabel(summary, l10n: l10n);
  final primaryAction = resolvePrimaryAction(reservation, delivery: delivery);
  final isHistorical =
      reservation.isCompleted || reservation.isReadOnlyFinalState;

  AppStatusTone accent = reservationTone;
  if (summary != null &&
      !summary.isPaymentsDisabled &&
      summary.isPaymentActionRequired) {
    accent = paymentTone;
  } else if (paymentTone == AppStatusTone.info) {
    accent = AppStatusTone.info;
  }

  final needsAction =
      !isHistorical &&
      ((summary != null &&
              !summary.isPaymentsDisabled &&
              (summary.isPaymentActionRequired || summary.canStartCheckout)) ||
          reservation.isAwaitingConfirmation ||
          learnerReservationNeedsAction(reservation));

  final nextStepTone = _resolveNextStepTone(
    reservation,
    summary: summary,
    delivery: delivery,
  );

  return LearnerReservationCardPresentation(
    reservationStatusLabel: learnerReservationListStatusLabel(
      reservation,
      l10n: l10n,
      linkedDeliveryStatus: delivery?.status,
    ),
    reservationTone: reservationTone,
    paymentStatusLabel: paymentLabel,
    paymentTone: paymentLabel == null ? null : paymentTone,
    nextStepMessage: reservationNextStepMessage(
      reservation,
      l10n: l10n,
      delivery: delivery,
    ),
    nextStepTone: nextStepTone,
    primaryAction: primaryAction,
    showSecondaryDetails:
        primaryAction != LearnerReservationPrimaryAction.viewDetails,
    accentTone: accent,
    showActionAccent: needsAction,
    isHistoricalCompact: isHistorical,
  );
}

bool learnerReservationNeedsPaymentAction(LearnerReservation reservation) {
  final summary = reservation.paymentSummary;
  if (summary == null || summary.isPaymentsDisabled) return false;
  return summary.isPaymentActionRequired || summary.canStartCheckout;
}

bool _mightNeedPayment(LearnerReservation reservation) {
  return reservation.isAccepted &&
      ((reservation.materialSubtotal ?? 0) > 0 ||
          (reservation.deliveryFee ?? 0) > 0 ||
          (reservation.totalAmount ?? 0) > 0);
}

Color accentColorForTone(BuildContext context, AppStatusTone tone) {
  final style = AppStatusStyle.of(context, tone);
  return style.foreground.withValues(alpha: 0.9);
}

String primaryActionLabel(
  LearnerReservationPrimaryAction action, {
  required AppLocalizations l10n,
}) {
  switch (action) {
    case LearnerReservationPrimaryAction.payNow:
      return l10n.payNow;
    case LearnerReservationPrimaryAction.completePayment:
      return l10n.completePayment;
    case LearnerReservationPrimaryAction.viewPickupCode:
      return l10n.viewPickupCode;
    case LearnerReservationPrimaryAction.trackDelivery:
      return l10n.trackDelivery;
    case LearnerReservationPrimaryAction.viewDetails:
      return l10n.viewDetails;
    case LearnerReservationPrimaryAction.none:
      return l10n.viewDetails;
  }
}

IconData primaryActionIcon(LearnerReservationPrimaryAction action) {
  switch (action) {
    case LearnerReservationPrimaryAction.payNow:
    case LearnerReservationPrimaryAction.completePayment:
      return Icons.credit_card_rounded;
    case LearnerReservationPrimaryAction.viewPickupCode:
      return Icons.qr_code_2_rounded;
    case LearnerReservationPrimaryAction.trackDelivery:
      return Icons.local_shipping_outlined;
    case LearnerReservationPrimaryAction.viewDetails:
    case LearnerReservationPrimaryAction.none:
      return Icons.arrow_forward_rounded;
  }
}

// ---------------------------------------------------------------------------
// Money presentation for list card
// ---------------------------------------------------------------------------

enum LearnerReservationMoneyTone { success, warning, danger, neutral }

class LearnerReservationMoneyPresentation {
  const LearnerReservationMoneyPresentation({
    required this.title,
    this.amountLine,
    this.supportingLine,
    required this.tone,
  });

  final String title;
  final String? amountLine;
  final String? supportingLine;
  final LearnerReservationMoneyTone tone;
}

LearnerReservationMoneyPresentation? buildReservationMoneyPresentation(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
}) {
  final summary = reservation.paymentSummary;
  if (summary == null || summary.isPaymentsDisabled) {
    if (_mightNeedPayment(reservation)) {
      return LearnerReservationMoneyPresentation(
        title: l10n.paymentSummaryUnavailable,
        tone: LearnerReservationMoneyTone.neutral,
      );
    }
    return null;
  }

  if (summary.isPaid) {
    return LearnerReservationMoneyPresentation(
      title: l10n.reservationMoneyPaidInFull,
      tone: LearnerReservationMoneyTone.success,
    );
  }

  if (summary.outstandingAmount != null) {
    final label = summary.isPartialPayment
        ? l10n.reservationMoneyRemaining
        : l10n.reservationMoneyAmountDue;
    final amountLine = l10n.reservationMoneyAmountWithCurrency(
      summary.outstandingAmount!,
    );

    String? supporting;
    if (summary.hasMaterialPaymentOutstanding &&
        summary.hasDeliveryFeeOutstanding) {
      supporting = l10n.reservationMoneyBothOutstanding;
    } else if (summary.hasMaterialPaymentOutstanding) {
      supporting = summary.outstandingOrderCount > 1
          ? l10n.reservationMoneyOrdersRemaining(summary.outstandingOrderCount)
          : null;
    } else if (summary.hasDeliveryFeeOutstanding) {
      supporting = l10n.reservationMoneyMaterialPaidDeliveryDue;
    }

    return LearnerReservationMoneyPresentation(
      title: label,
      amountLine: amountLine,
      supportingLine: supporting,
      tone: summary.isPartialPayment
          ? LearnerReservationMoneyTone.warning
          : LearnerReservationMoneyTone.danger,
    );
  }

  if (summary.isProcessing) {
    return LearnerReservationMoneyPresentation(
      title: l10n.reservationNextStepPaymentProcessing,
      tone: LearnerReservationMoneyTone.warning,
    );
  }
  if (summary.isRefundPending) {
    return LearnerReservationMoneyPresentation(
      title: l10n.reservationNextStepRefundProcessing,
      tone: LearnerReservationMoneyTone.warning,
    );
  }
  if (summary.isRefunded) {
    return LearnerReservationMoneyPresentation(
      title: l10n.reservationNextStepRefunded,
      tone: LearnerReservationMoneyTone.neutral,
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Next-step title / supporting for list card
// ---------------------------------------------------------------------------

String reservationNextStepTitle(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
  LearnerDelivery? delivery,
}) {
  final summary = reservation.paymentSummary;

  if (summary != null &&
      !summary.isPaymentsDisabled &&
      (summary.isPaymentActionRequired || summary.canStartCheckout)) {
    if (summary.isPartialPayment) {
      return l10n.reservationNextStepPartialTitle;
    }
    return l10n.reservationNextStepPayTitle;
  }

  return reservationNextStepMessage(
    reservation,
    l10n: l10n,
    delivery: delivery,
  );
}

String? reservationNextStepSupporting(
  LearnerReservation reservation, {
  required AppLocalizations l10n,
  LearnerDelivery? delivery,
}) {
  final summary = reservation.paymentSummary;

  if (summary != null &&
      !summary.isPaymentsDisabled &&
      (summary.isPaymentActionRequired || summary.canStartCheckout)) {
    if (summary.isPartialPayment) {
      return l10n.reservationNextStepPartialSupporting;
    }
    return reservation.isDeliveryFulfillment
        ? l10n.reservationNextStepPaySupportingDelivery
        : l10n.reservationNextStepPaySupporting;
  }

  return null;
}

AppStatusTone _resolveNextStepTone(
  LearnerReservation reservation, {
  ReservationPaymentSummary? summary,
  LearnerDelivery? delivery,
}) {
  if (summary != null && !summary.isPaymentsDisabled) {
    if (summary.isPaymentActionRequired || summary.canStartCheckout) {
      return AppStatusTone.danger;
    }
    if (summary.isProcessing ||
        summary.isPartialPayment ||
        summary.isRefundPending) {
      return AppStatusTone.warning;
    }
    if (summary.isPaid) return AppStatusTone.success;
  }

  if (reservation.isAwaitingConfirmation) return AppStatusTone.warning;
  if (reservation.isPending || reservation.isAwaitingSupplierConfirmation) {
    return AppStatusTone.warning;
  }

  final deliveryStatus = delivery?.status ?? reservation.activeDelivery?.status;
  if (deliveryStatus != null &&
      deliveryStatus != 'DELIVERED' &&
      deliveryStatus != 'CANCELLED') {
    return AppStatusTone.info;
  }

  if (reservation.isAccepted) return AppStatusTone.success;
  if (reservation.isCompleted) return AppStatusTone.success;
  if (reservation.isReadOnlyFinalState) return AppStatusTone.neutral;

  return AppStatusTone.neutral;
}
