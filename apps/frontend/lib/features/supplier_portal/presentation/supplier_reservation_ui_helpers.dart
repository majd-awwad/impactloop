import 'package:flutter/material.dart';

import '../../../core/format/localized_formatters.dart';
import '../../../l10n/l10n.dart';
import '../../../shared/l10n/learner_ui_labels.dart';
import '../data/models/supplier_incoming_request.dart';
import '../data/models/supplier_pickup_schedule_item.dart';

class SupplierReservationUiHelpers {
  const SupplierReservationUiHelpers(this.l10n);

  final AppLocalizations l10n;

  LearnerUiLabels get _labels => LearnerUiLabels(l10n);
  LocalizedFormatters get _fmt => LocalizedFormatters(l10n);

  static SupplierReservationUiHelpers of(BuildContext context) =>
      SupplierReservationUiHelpers(context.l10n);

  String get emDash => '—';

  String reservationStatus(SupplierIncomingRequest request) =>
      _labels.reservationStatus(
        request.status.apiValue,
        fulfillmentMethod: request.fulfillmentMethod,
        deliveryStatus:
            request.deliverySummary?.status ?? request.activeDelivery?.status,
        pickupWindowEnd: request.scheduleSummary?.effectiveWindow?.end,
        incidentReviewStatus: request.incidentSummary?.status,
        isOverdue: request.isOverdue,
        needsFollowUp: request.needsFollowUp,
        rejectionReason: request.status == SupplierIncomingRequestStatus.expired
            ? request.declineReason
            : null,
        pendingRescheduleReason:
            request.pendingRescheduleReason ??
            request.scheduleSummary?.pendingReschedule?.reason,
      );

  String deliveryStatus(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return l10n.supplierDeliveryRequested;
    }
    return _labels.deliveryStatus(raw);
  }

  String fulfillmentMethodLabel(SupplierIncomingRequest reservation) {
    final contractMethod =
        reservation.fulfillmentContract?.fulfillmentMethod?.trim() ?? '';
    final method = contractMethod.isNotEmpty
        ? contractMethod
        : reservation.fulfillmentMethod.trim();
    if (method.isEmpty) {
      return reservation.isDeliveryFulfillment
          ? l10n.delivery
          : l10n.supplierSelfPickup;
    }
    return pickupTypeLabel(method);
  }

  String pickupTypeLabel(String pickupType) {
    final normalized = pickupType
        .trim()
        .toUpperCase()
        .replaceAll('-', '_')
        .replaceAll(' ', '_');
    if (normalized == 'DELIVERY') return l10n.delivery;
    if (normalized == 'PICKUP' || normalized == 'SELF_PICKUP') {
      return l10n.supplierSelfPickup;
    }
    return l10n.unknownStatus;
  }

  String attentionLabel(SupplierAttentionState? attention) =>
      switch (attention) {
        SupplierAttentionState.supplierActionRequired =>
          l10n.supplierAttentionNeedsYourResponse,
        SupplierAttentionState.waitingForLearner =>
          l10n.supplierAttentionWaitingForLearner,
        SupplierAttentionState.fulfillmentInProgress =>
          l10n.supplierAttentionInProgress,
        SupplierAttentionState.adminReviewRequired =>
          l10n.supplierAttentionAdminReview,
        SupplierAttentionState.terminal =>
          l10n.supplierAttentionNoFurtherAction,
        SupplierAttentionState.unknown || null => emDash,
      };

  String actorLabel(SupplierNextActor? actor) => switch (actor) {
    SupplierNextActor.supplier => l10n.supplier,
    SupplierNextActor.learner => l10n.learner,
    SupplierNextActor.driver => l10n.driver,
    SupplierNextActor.admin => l10n.supplierNextActorAdmin,
    SupplierNextActor.system => l10n.supplierNextActorSystem,
    SupplierNextActor.none => l10n.supplierNextActorNone,
    SupplierNextActor.unknown || null => emDash,
  };

  String attentionWithNextActor({
    required SupplierAttentionState? attention,
    required SupplierNextActor? nextActor,
    bool adminReview = false,
  }) {
    if (adminReview) {
      return l10n.supplierRecoveryNextAdmin;
    }
    if (nextActor != null && nextActor != SupplierNextActor.none) {
      return l10n.supplierAttentionNextActor(
        attentionLabel(attention),
        actorLabel(nextActor),
      );
    }
    return attentionLabel(attention);
  }

  String workflowLabel(SupplierWorkflowPhase? phase) => switch (phase) {
    SupplierWorkflowPhase.initialDecision =>
      l10n.supplierWorkflowInitialDecision,
    SupplierWorkflowPhase.scheduling => l10n.supplierWorkflowScheduling,
    SupplierWorkflowPhase.selfPickup => l10n.supplierWorkflowSelfPickup,
    SupplierWorkflowPhase.delivery => l10n.supplierWorkflowDelivery,
    SupplierWorkflowPhase.recovery => l10n.supplierWorkflowRecovery,
    SupplierWorkflowPhase.completed => l10n.statusCompleted,
    SupplierWorkflowPhase.closed => l10n.filterClosed,
    SupplierWorkflowPhase.unknown || null => emDash,
  };

  String terminalOutcome(SupplierIncomingRequestStatus status) =>
      switch (status) {
        SupplierIncomingRequestStatus.completed =>
          l10n.supplierCompletedSuccessfully,
        SupplierIncomingRequestStatus.expired =>
          l10n.supplierNoResponseBeforeDeadline,
        _ => null,
      } ??
      terminalFulfillmentLine(status);

  String terminalFulfillmentLine(SupplierIncomingRequestStatus status) =>
      switch (status) {
        SupplierIncomingRequestStatus.completed =>
          l10n.supplierCompletedFulfillment,
        SupplierIncomingRequestStatus.cancelled =>
          l10n.supplierCancelledBeforeFulfillment,
        SupplierIncomingRequestStatus.expired =>
          l10n.supplierExpiredBeforeFulfillment,
        SupplierIncomingRequestStatus.noShow => l10n.supplierClosedAfterNoShow,
        SupplierIncomingRequestStatus.fulfillmentFailed =>
          l10n.statusFulfillmentFailed,
        SupplierIncomingRequestStatus.declined =>
          l10n.supplierRejectedBeforeFulfillment,
        _ => l10n.supplierFinalReservationOutcome,
      };

  String terminalScheduleOutcome(SupplierIncomingRequest reservation) =>
      switch (reservation.status) {
        SupplierIncomingRequestStatus.completed =>
          l10n.supplierCompletedSuccessfully,
        SupplierIncomingRequestStatus.cancelled =>
          l10n.supplierCancelledBeforeFulfillment,
        SupplierIncomingRequestStatus.expired =>
          l10n.supplierExpiredBeforeFulfillment,
        SupplierIncomingRequestStatus.noShow => l10n.statusLearnerNoShow,
        _ => terminalOutcome(reservation.status),
      };

  String terminalVerb(SupplierIncomingRequestStatus status) => switch (status) {
    SupplierIncomingRequestStatus.cancelled =>
      l10n.supplierTerminalVerbCancelled,
    SupplierIncomingRequestStatus.expired => l10n.supplierTerminalVerbExpired,
    SupplierIncomingRequestStatus.completed =>
      l10n.supplierTerminalVerbCompleted,
    _ => l10n.supplierTerminalVerbClosed,
  };

  String reservationActionLabel(
    SupplierReservationAction action,
  ) => switch (action) {
    SupplierReservationAction.accept => l10n.supplierActionAcceptLearnerTime,
    SupplierReservationAction.decline => l10n.supplierDeclineRequest,
    SupplierReservationAction.sendMessage => l10n.supplierSendMessage,
    SupplierReservationAction.completeSelfPickup =>
      l10n.supplierActionCompleteSelfPickup,
    SupplierReservationAction.proposeReschedule => l10n.supplierProposeNewTime,
    SupplierReservationAction.acceptLearnerReschedule =>
      l10n.supplierAcceptNewTime,
    SupplierReservationAction.closeReservation => l10n.cancelReservation,
    SupplierReservationAction.markLearnerNoShow =>
      l10n.supplierActionMarkLearnerNoShow,
    SupplierReservationAction.reportIncident =>
      l10n.supplierActionReportIncident,
    SupplierReservationAction.reportNoDriver =>
      l10n.supplierActionReportNoDriver,
    SupplierReservationAction.markDeliveryPickupExpired =>
      l10n.supplierActionMarkPickupExpired,
    SupplierReservationAction.reportDriverNoShow =>
      l10n.supplierActionReportDriverNoShow,
    SupplierReservationAction.submitRecoveryPickupWindow =>
      l10n.supplierActionSubmitRecoveryWindow,
    SupplierReservationAction.unknown => l10n.supplierReviewRequest,
  };

  String inboxActionLabel(SupplierReservationAction action) => switch (action) {
    SupplierReservationAction.accept => l10n.supplierAcceptRequest,
    SupplierReservationAction.decline => l10n.supplierDeclineRequest,
    SupplierReservationAction.completeSelfPickup => l10n.supplierConfirmPickup,
    SupplierReservationAction.proposeReschedule ||
    SupplierReservationAction.submitRecoveryPickupWindow =>
      l10n.supplierSubmitPickupWindow,
    SupplierReservationAction.acceptLearnerReschedule =>
      l10n.supplierReviewReschedule,
    SupplierReservationAction.closeReservation => l10n.cancelReservation,
    SupplierReservationAction.markLearnerNoShow =>
      l10n.supplierActionMarkLearnerNoShow,
    SupplierReservationAction.reportIncident => l10n.supplierReportToAdmin,
    SupplierReservationAction.reportNoDriver =>
      l10n.supplierActionReportNoDriver,
    SupplierReservationAction.markDeliveryPickupExpired =>
      l10n.supplierActionMarkPickupExpired,
    SupplierReservationAction.reportDriverNoShow =>
      l10n.supplierActionReportDriverNoShow,
    SupplierReservationAction.sendMessage => l10n.supplierSendMessage,
    SupplierReservationAction.unknown => l10n.supplierReviewRequest,
  };

  String attentionFilterLabel(String code) => switch (code) {
    'SUPPLIER_ACTION_REQUIRED' => l10n.supplierAttentionNeedsYourResponse,
    'WAITING_FOR_LEARNER' => l10n.supplierAttentionWaitingForLearner,
    'FULFILLMENT_IN_PROGRESS' => l10n.supplierAttentionInProgress,
    'ADMIN_REVIEW_REQUIRED' => l10n.supplierAttentionAdminReview,
    'TERMINAL' => l10n.supplierAttentionTerminal,
    _ => code,
  };

  String statusFilterLabel(String code) {
    final mapped = switch (code) {
      'PENDING' => l10n.filterPending,
      'AWAITING_LEARNER_CONFIRMATION' =>
        l10n.supplierStatusFilterAwaitingLearner,
      'AWAITING_SUPPLIER_CONFIRMATION' =>
        l10n.supplierStatusFilterAwaitingSupplier,
      'ACCEPTED' => l10n.filterAccepted,
      'REJECTED' => l10n.statusRejected,
      'CANCELLED' => l10n.statusCancelled,
      'COMPLETED' => l10n.filterCompleted,
      'EXPIRED' => l10n.statusExpired,
      'NO_SHOW' => l10n.statusLearnerNoShow,
      'FULFILLMENT_FAILED' => l10n.statusFulfillmentFailed,
      'AWAITING_RESOLUTION' => l10n.supplierStatusFilterAwaitingResolution,
      _ => null,
    };
    if (mapped != null) return mapped;
    return reasonCodeLabel(code);
  }

  String noShowReasonLabel(String code) => switch (code) {
    'LEARNER_DID_NOT_ARRIVE' => l10n.supplierNoShowReasonLearnerDidNotArrive,
    'REPEATED_DELAY' => l10n.supplierNoShowReasonRepeatedDelay,
    'WRONG_INFORMATION' => l10n.supplierNoShowReasonWrongInformation,
    'SAFETY_OR_TRUST_CONCERN' => l10n.supplierNoShowReasonSafetyConcern,
    'OTHER' => l10n.supplierNoShowReasonOther,
    _ => reasonCodeLabel(code),
  };

  String reasonCodeLabel(String raw) {
    final normalized = raw.trim().toUpperCase();
    return switch (normalized) {
      'PICKUP_WINDOW_MISSED' => l10n.pickupMissed,
      'NO_DRIVER_UNAVAILABLE' => l10n.statusCancelledNoDriver,
      'PICKUP_NOT_COMPLETED' => l10n.statusCancelledUnresolvedPickup,
      'NO_DRIVER_ADMIN_REQUEST' ||
      'STALE_PICKUP_ADMIN_REQUEST' => l10n.statusWaitingSupplierWindow,
      'PICKUP_WINDOW_MISSED_ADMIN_REQUEST' => l10n.pickupMissed,
      'VERIFIED' => l10n.statusReportVerified,
      'REJECTED' => l10n.statusReportDismissed,
      'RESOLVED_NO_STRIKE' => l10n.statusResolvedNoStrike,
      'PENDING' => l10n.filterPending,
      'ACCEPTED' => l10n.filterAccepted,
      'COMPLETED' => l10n.filterCompleted,
      'CANCELLED' => l10n.statusCancelled,
      'EXPIRED' => l10n.statusExpired,
      'NO_SHOW' => l10n.statusLearnerNoShow,
      'FULFILLMENT_FAILED' => l10n.statusFulfillmentFailed,
      'AWAITING_RESOLUTION' => l10n.statusNeedsAdminReview,
      'WAITING_FOR_DRIVER' => l10n.statusWaitingDriver,
      'DRIVER_ASSIGNED' => l10n.statusDriverAssigned,
      'ARRIVED_PICKUP' => l10n.statusDriverAtPickup,
      'PICKED_UP' => l10n.statusPickedUp,
      'ON_THE_WAY' => l10n.statusOnTheWay,
      'ARRIVED_DROPOFF' => l10n.statusArrivedDropoff,
      'REDELIVERY_PENDING' => l10n.statusRedeliveryPending,
      'REDELIVERY_SCHEDULED' => l10n.statusRedeliveryScheduled,
      'RETURN_TO_SUPPLIER_REQUIRED' => l10n.statusReturnToSupplierRequired,
      'RETURNED_TO_SUPPLIER' => l10n.statusReturnedToSupplier,
      'IN_TRANSIT' => l10n.statusOnTheWay,
      'DELIVERED' => l10n.statusDelivered,
      'FAILED_PICKUP' => l10n.statusPickupFailed,
      'FAILED_DELIVERY' => l10n.statusDeliveryFailed,
      'DRIVER_NO_SHOW' => l10n.statusDriverNoShow,
      'LEARNER_NO_SHOW' => l10n.statusLearnerNoShow,
      'INITIAL_DECISION' => l10n.supplierWorkflowInitialDecision,
      'SCHEDULING' => l10n.supplierWorkflowScheduling,
      'SELF_PICKUP' => l10n.supplierWorkflowSelfPickup,
      'DELIVERY' => l10n.supplierWorkflowDelivery,
      'RECOVERY' => l10n.supplierWorkflowRecovery,
      'CLOSED' => l10n.filterClosed,
      'SUPPLIER' => l10n.supplier,
      'LEARNER' => l10n.learner,
      'DRIVER' => l10n.driver,
      'ADMIN' => l10n.supplierNextActorAdmin,
      'SYSTEM' => l10n.supplierNextActorSystem,
      _ => l10n.unknownStatus,
    };
  }

  String formatDateTime(DateTime? value) =>
      value == null ? emDash : _fmt.dateTime(value);

  String formatPickupWindowShort(DateTime start, DateTime end) {
    final localStart = start.toLocal();
    final localEnd = end.toLocal();
    final sameDay =
        localStart.year == localEnd.year &&
        localStart.month == localEnd.month &&
        localStart.day == localEnd.day;
    if (sameDay) {
      return '${_fmt.date(localStart)} · ${_fmt.time(localStart)} – ${_fmt.time(localEnd)}';
    }
    return _fmt.dateTimeRange(start, end);
  }

  String formatPickupWindow(SupplierPickupWindow window) =>
      formatPickupWindowShort(window.start, window.end);

  String formatScheduleWindow(SupplierScheduleWindow window) {
    final start = window.start;
    final end = window.end;
    if (start == null && end == null) return l10n.supplierNotProposed;
    if (start == null) {
      return l10n.supplierWindowUntil(formatDateTime(end));
    }
    if (end == null) {
      return l10n.supplierWindowFrom(formatDateTime(start));
    }
    return _fmt.dateTimeRange(start, end);
  }

  String formatScheduleDateLabel(DateTime date) {
    final local = date.toLocal();
    final localDay = DateTime(local.year, local.month, local.day);
    final nowLocal = DateTime.now();
    final todayDate = DateTime(nowLocal.year, nowLocal.month, nowLocal.day);
    final tomorrow = todayDate.add(const Duration(days: 1));
    if (localDay == todayDate) return l10n.supplierToday;
    if (localDay == tomorrow) return l10n.supplierTomorrow;
    return _fmt.date(local);
  }

  String pickupScheduleGroupLabel(
    PickupScheduleGroupKind kind, {
    String? dateLabel,
  }) => switch (kind) {
    PickupScheduleGroupKind.today => l10n.supplierToday,
    PickupScheduleGroupKind.tomorrow => l10n.supplierTomorrow,
    PickupScheduleGroupKind.completed => l10n.filterCompleted,
    PickupScheduleGroupKind.date => dateLabel ?? l10n.supplierNeedsAttention,
  };

  String formatPickupTimeRange(DateTime start, DateTime end) =>
      '${_fmt.time(start)} – ${_fmt.time(end)}';

  String formatPickupScheduleCardWindow(SupplierPickupWindow window) =>
      '${formatScheduleDateLabel(window.start)} · ${formatPickupTimeRange(window.start, window.end)}';

  Map<String, String> attentionFilterOptions() => {
    'SUPPLIER_ACTION_REQUIRED': l10n.supplierAttentionNeedsYourResponse,
    'WAITING_FOR_LEARNER': l10n.supplierAttentionWaitingForLearner,
    'FULFILLMENT_IN_PROGRESS': l10n.supplierAttentionInProgress,
    'ADMIN_REVIEW_REQUIRED': l10n.supplierAttentionAdminReview,
    'TERMINAL': l10n.supplierAttentionTerminal,
  };

  Map<String, String> statusFilterOptions() => {
    'PENDING': l10n.filterPending,
    'AWAITING_LEARNER_CONFIRMATION': l10n.supplierStatusFilterAwaitingLearner,
    'AWAITING_SUPPLIER_CONFIRMATION': l10n.supplierStatusFilterAwaitingSupplier,
    'ACCEPTED': l10n.filterAccepted,
    'REJECTED': l10n.statusRejected,
    'CANCELLED': l10n.statusCancelled,
    'COMPLETED': l10n.filterCompleted,
    'EXPIRED': l10n.statusExpired,
    'NO_SHOW': l10n.statusLearnerNoShow,
    'FULFILLMENT_FAILED': l10n.statusFulfillmentFailed,
    'AWAITING_RESOLUTION': l10n.supplierStatusFilterAwaitingResolution,
  };

  Map<String, String> noShowReasonOptions() => {
    'LEARNER_DID_NOT_ARRIVE': l10n.supplierNoShowReasonLearnerDidNotArrive,
    'REPEATED_DELAY': l10n.supplierNoShowReasonRepeatedDelay,
    'WRONG_INFORMATION': l10n.supplierNoShowReasonWrongInformation,
    'SAFETY_OR_TRUST_CONCERN': l10n.supplierNoShowReasonSafetyConcern,
    'OTHER': l10n.supplierNoShowReasonOther,
  };
}
