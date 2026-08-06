import '../../data/models/learner_reservation.dart';
import '../../data/models/reservation_payment_summary.dart';
import 'reservation_detail_semantic.dart';

enum ReservationDetailPickupCodeState {
  available,
  lockedByPayment,
  paymentUnavailable,
  waitingForWindow,
  paymentProcessing,
  underReview,
  refundProcessing,
  refunded,
  closed,
  notApplicable,
}

class ReservationDetailPickupCodePresentation {
  const ReservationDetailPickupCodePresentation({
    required this.state,
    this.code,
    required this.semantic,
  });

  final ReservationDetailPickupCodeState state;
  final String? code;
  final ReservationDetailSemantic semantic;
}

ReservationDetailPickupCodePresentation resolvePickupCodePresentation(
  LearnerReservation reservation,
) {
  if (!reservation.isPickupFulfillment) {
    return const ReservationDetailPickupCodePresentation(
      state: ReservationDetailPickupCodeState.notApplicable,
      semantic: ReservationDetailSemantic.neutral,
    );
  }

  final summary = reservation.paymentSummary;
  final phase = reservation.pickupHandoverPhase?.toUpperCase();

  if (_isTerminalClosed(reservation)) {
    return const ReservationDetailPickupCodePresentation(
      state: ReservationDetailPickupCodeState.closed,
      semantic: ReservationDetailSemantic.neutral,
    );
  }

  if (summary != null && !summary.isPaymentsDisabled) {
    if (summary.isRefunded) {
      return const ReservationDetailPickupCodePresentation(
        state: ReservationDetailPickupCodeState.refunded,
        semantic: ReservationDetailSemantic.neutral,
      );
    }
    if (summary.isRefundPending) {
      return const ReservationDetailPickupCodePresentation(
        state: ReservationDetailPickupCodeState.refundProcessing,
        semantic: ReservationDetailSemantic.waiting,
      );
    }
    if (summary.isResolutionRequired) {
      return const ReservationDetailPickupCodePresentation(
        state: ReservationDetailPickupCodeState.underReview,
        semantic: ReservationDetailSemantic.resolution,
      );
    }
    if (summary.isProcessing) {
      return const ReservationDetailPickupCodePresentation(
        state: ReservationDetailPickupCodeState.paymentProcessing,
        semantic: ReservationDetailSemantic.waiting,
      );
    }
  }

  if (reservation.isAwaitingResolution) {
    return const ReservationDetailPickupCodePresentation(
      state: ReservationDetailPickupCodeState.underReview,
      semantic: ReservationDetailSemantic.resolution,
    );
  }

  // Backend is authoritative: a non-empty code means it may be shown.
  final code = reservation.selfPickupCode?.trim();
  if (code != null && code.isNotEmpty) {
    return ReservationDetailPickupCodePresentation(
      state: ReservationDetailPickupCodeState.available,
      code: code,
      semantic: ReservationDetailSemantic.pickup,
    );
  }

  if (summary == null) {
    if (_mightNeedPayment(reservation)) {
      return const ReservationDetailPickupCodePresentation(
        state: ReservationDetailPickupCodeState.paymentUnavailable,
        semantic: ReservationDetailSemantic.neutral,
      );
    }
  } else if (_paymentBlocksPickupCode(summary)) {
    return const ReservationDetailPickupCodePresentation(
      state: ReservationDetailPickupCodeState.lockedByPayment,
      semantic: ReservationDetailSemantic.payment,
    );
  }

  if (phase == 'AFTER_ALLOWED' && summary?.pickupCodeAvailable != true) {
    return const ReservationDetailPickupCodePresentation(
      state: ReservationDetailPickupCodeState.closed,
      semantic: ReservationDetailSemantic.neutral,
    );
  }

  if (phase == 'BEFORE_ALLOWED' ||
      (summary?.pickupCodeAvailable == false &&
          (summary?.isPaid == true || summary?.isPaymentsDisabled == true))) {
    return const ReservationDetailPickupCodePresentation(
      state: ReservationDetailPickupCodeState.waitingForWindow,
      semantic: ReservationDetailSemantic.waiting,
    );
  }

  if (!reservation.isAccepted) {
    return const ReservationDetailPickupCodePresentation(
      state: ReservationDetailPickupCodeState.notApplicable,
      semantic: ReservationDetailSemantic.neutral,
    );
  }

  return const ReservationDetailPickupCodePresentation(
    state: ReservationDetailPickupCodeState.waitingForWindow,
    semantic: ReservationDetailSemantic.waiting,
  );
}

bool _isTerminalClosed(LearnerReservation reservation) {
  return reservation.isCompleted ||
      reservation.isCancelled ||
      reservation.isRejected ||
      reservation.isExpired ||
      reservation.status == 'NO_SHOW' ||
      reservation.status == 'FULFILLMENT_FAILED';
}

bool _paymentBlocksPickupCode(ReservationPaymentSummary summary) {
  if (summary.isPaymentsDisabled) {
    return false;
  }

  return summary.isPaymentActionRequired ||
      summary.canStartCheckout ||
      summary.hasMaterialPaymentOutstanding ||
      summary.hasDeliveryFeeOutstanding;
}

bool _mightNeedPayment(LearnerReservation reservation) {
  return reservation.isAccepted &&
      ((reservation.materialSubtotal ?? 0) > 0 ||
          (reservation.deliveryFee ?? 0) > 0 ||
          (reservation.totalAmount ?? 0) > 0);
}
