import '../../l10n/app_localizations.dart';

class LearnerUiLabels {
  const LearnerUiLabels(this.l10n);

  final AppLocalizations l10n;

  String reservationFilter(String value) => switch (value) {
    'all' => l10n.filterAll,
    'active' => l10n.filterActive,
    'needsAction' => l10n.filterNeedsAction,
    'pending' => l10n.filterPending,
    'accepted' => l10n.filterAccepted,
    'completed' => l10n.filterCompleted,
    'closed' => l10n.filterClosed,
    _ => l10n.unknownStatus,
  };

  String incidentReviewStatus(String? status) => switch (status) {
    'VERIFIED' => l10n.statusReportVerified,
    'REJECTED' => l10n.statusReportDismissed,
    'RESOLVED_NO_STRIKE' => l10n.statusResolvedNoStrike,
    _ => l10n.statusPendingAdminReview,
  };

  String reservationStatus(
    String status, {
    String? fulfillmentMethod,
    String? deliveryStatus,
    DateTime? pickupWindowEnd,
    String? incidentReviewStatus,
    bool isOverdue = false,
    bool needsFollowUp = false,
    String? rejectionReason,
    String? pendingRescheduleReason,
  }) {
    switch (status) {
      case 'PENDING':
        return l10n.statusPendingSupplier;
      case 'AWAITING_LEARNER_CONFIRMATION':
        return l10n.statusNeedsConfirmation;
      case 'AWAITING_SUPPLIER_CONFIRMATION':
        return pendingRescheduleReason == 'NO_DRIVER_ADMIN_REQUEST' ||
                pendingRescheduleReason == 'STALE_PICKUP_ADMIN_REQUEST'
            ? l10n.statusWaitingSupplierWindow
            : l10n.statusWaitingSupplier;
      case 'ACCEPTED':
        if (fulfillmentMethod == 'DELIVERY') return l10n.statusAccepted;
        if (isOverdue || needsFollowUp) {
          return l10n.statusPickupWindowPassed;
        }
        return l10n.statusAcceptedPickup;
      case 'REJECTED':
        return l10n.statusRejected;
      case 'COMPLETED':
        return l10n.statusCompleted;
      case 'CANCELLED':
        return fulfillmentMethod == 'PICKUP' && pickupWindowEnd != null
            ? l10n.statusClosedMissedPickup
            : l10n.statusCancelled;
      case 'EXPIRED':
        return switch (rejectionReason) {
          'PICKUP_WINDOW_MISSED' => l10n.pickupMissed,
          'NO_DRIVER_UNAVAILABLE' => l10n.statusCancelledNoDriver,
          'PICKUP_NOT_COMPLETED' => l10n.statusCancelledUnresolvedPickup,
          null || '' => l10n.statusExpiredNoResponse,
          _ => l10n.statusExpired,
        };
      case 'NO_SHOW':
        return l10n.pickupMissed;
      case 'FULFILLMENT_FAILED':
        return l10n.statusFulfillmentFailed;
      case 'AWAITING_RESOLUTION':
        return this.incidentReviewStatus(incidentReviewStatus);
      default:
        return l10n.unknownStatus;
    }
  }

  String deliveryStatus(String status) => switch (status.toUpperCase()) {
    'WAITING_FOR_DRIVER' => l10n.statusWaitingDriver,
    'DRIVER_ASSIGNED' => l10n.statusDriverAssigned,
    'ARRIVED_PICKUP' => l10n.statusDriverAtPickup,
    'PICKED_UP' => l10n.statusPickedUp,
    'ON_THE_WAY' => l10n.statusOnTheWay,
    'ARRIVED_DROPOFF' => l10n.statusArrivedDropoff,
    'REDELIVERY_PENDING' => l10n.statusRedeliveryPending,
    'REDELIVERY_SCHEDULED' => l10n.statusRedeliveryScheduled,
    'DELIVERED' => l10n.statusDelivered,
    'CANCELLED' => l10n.statusDeliveryCancelled,
    'FAILED_PICKUP' => l10n.statusPickupFailed,
    'FAILED_DELIVERY' => l10n.statusDeliveryFailed,
    'DRIVER_NO_SHOW' => l10n.statusDriverNoShow,
    'LEARNER_NO_SHOW' => l10n.statusLearnerNoShow,
    'AWAITING_RESOLUTION' => l10n.statusNeedsAdminReview,
    _ => l10n.unknownStatus,
  };
}
