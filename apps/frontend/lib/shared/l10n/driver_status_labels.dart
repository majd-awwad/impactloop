import '../../features/deliveries/presentation/delivery_status_presentation.dart';
import '../../l10n/app_localizations.dart';
import '../widgets/app_status_badge.dart';

/// Driver-perspective delivery status labels. Falls back to learner-oriented
/// [deliveryStatusLabel] only for unknown backend statuses.
String driverDeliveryStatusLabel(String status, AppLocalizations l10n) {
  final normalized = status.trim().toUpperCase();
  final label = switch (normalized) {
    'WAITING_FOR_DRIVER' => l10n.driverStatusWaitingForAssignment,
    'DRIVER_ASSIGNED' => l10n.driverStatusAssigned,
    'ARRIVED_PICKUP' => l10n.driverStatusAtPickup,
    'PICKED_UP' => l10n.driverStatusPickedUp,
    'ON_THE_WAY' => l10n.driverStatusOnTheWay,
    'ARRIVED_DROPOFF' => l10n.driverStatusAtDropoff,
    'REDELIVERY_PENDING' => l10n.driverStatusRedeliveryPending,
    'REDELIVERY_SCHEDULED' => l10n.driverStatusRedeliveryScheduled,
    'DELIVERED' => l10n.driverStatusDelivered,
    'CANCELLED' => l10n.driverStatusCancelled,
    'FAILED_PICKUP' => l10n.driverStatusPickupFailed,
    'FAILED_DELIVERY' => l10n.driverStatusDeliveryFailed,
    'DRIVER_NO_SHOW' => l10n.driverStatusDriverNoShow,
    'LEARNER_NO_SHOW' => l10n.driverStatusLearnerNoShow,
    'AWAITING_RESOLUTION' => l10n.driverStatusAwaitingReview,
    _ => null,
  };

  if (label != null) {
    return label;
  }

  return deliveryStatusLabel(status, l10n: l10n);
}

/// Production mapping for Driver archive incident review badge tones.
AppStatusTone driverIncidentReviewTone(String reviewStatus) {
  final normalized = reviewStatus.trim().toUpperCase();
  return switch (normalized) {
    'PENDING_REVIEW' => AppStatusTone.warning,
    'VERIFIED' => AppStatusTone.success,
    'REJECTED' => AppStatusTone.danger,
    'RESOLVED_NO_STRIKE' => AppStatusTone.info,
    _ => AppStatusTone.neutral,
  };
}
