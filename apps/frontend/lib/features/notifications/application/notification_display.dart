import '../data/models/app_notification.dart';
import '../../../l10n/app_localizations.dart';

final RegExp _testTagPattern = RegExp(r'\[test[^\]]*\]', caseSensitive: false);

String sanitizeNotificationText(String value) {
  var result = value.replaceAll(_testTagPattern, '');
  result = result.replaceAll(RegExp(r',\s*,+'), ',');
  result = result.replaceAll(RegExp(r'\s{2,}'), ' ');
  result = result.replaceAll(RegExp(r'\s+,'), ',');
  result = result.replaceAll(RegExp(r',\s*$'), '');
  result = result.replaceAll(RegExp(r'^\s*,\s*'), '');
  return result.trim();
}

AppNotification sanitizeNotification(AppNotification notification) {
  return notification.copyWith(
    title: sanitizeNotificationText(notification.title).isEmpty
        ? 'Notification'
        : sanitizeNotificationText(notification.title),
    body: sanitizeNotificationText(notification.body),
  );
}

enum NotificationVisualCategory {
  job,
  reminder,
  deliveryUpdate,
  account,
  general,
}

NotificationVisualCategory categoryForNotification(
  AppNotification notification,
) {
  switch (notification.notificationType) {
    case 'DRIVER_NEW_JOB':
      return NotificationVisualCategory.job;
    case 'DRIVER_PICKUP_TIME':
    case 'DRIVER_PICKUP_REMINDER':
    case 'DRIVER_PICKUP_STARTING_SOON':
    case 'DRIVER_PICKUP_WINDOW_STARTED':
    case 'DRIVER_PICKUP_OVERDUE':
    case 'DRIVER_DROPOFF_TIME':
    case 'DRIVER_DROPOFF_REMINDER':
    case 'DRIVER_DROPOFF_STARTING_SOON':
    case 'DRIVER_DROPOFF_WINDOW_STARTED':
    case 'DRIVER_DROPOFF_OVERDUE':
      return NotificationVisualCategory.reminder;
    case 'DRIVER_DELIVERY_REQUEST_CREATED':
      return NotificationVisualCategory.deliveryUpdate;
    case 'DRIVER_DELIVERY_ACCEPTED':
    case 'DRIVER_DELIVERY_NEXT_STEP':
    case 'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW':
    case 'DELIVERY_DRIVER_ASSIGNED':
      return NotificationVisualCategory.deliveryUpdate;
    default:
      if (notification.notificationType.contains('VERIFICATION') ||
          notification.notificationType.contains('ACCOUNT')) {
        return NotificationVisualCategory.account;
      }
      return NotificationVisualCategory.general;
  }
}

String notificationTypeChipLabel(
  NotificationVisualCategory category, {
  AppLocalizations? l10n,
}) {
  if (l10n != null) {
    return switch (category) {
      NotificationVisualCategory.job => l10n.notificationChipJob,
      NotificationVisualCategory.reminder => l10n.notificationChipReminder,
      NotificationVisualCategory.deliveryUpdate =>
        l10n.notificationChipDelivery,
      NotificationVisualCategory.account => l10n.notificationChipAccount,
      NotificationVisualCategory.general => l10n.notificationChipUpdate,
    };
  }
  switch (category) {
    case NotificationVisualCategory.job:
      return 'Job';
    case NotificationVisualCategory.reminder:
      return 'Reminder';
    case NotificationVisualCategory.deliveryUpdate:
      return 'Delivery update';
    case NotificationVisualCategory.account:
      return 'Account';
    case NotificationVisualCategory.general:
      return 'Update';
  }
}

String notificationActionLabel(
  AppNotification notification, {
  AppLocalizations? l10n,
}) {
  if (notification.relatedEntityType == 'DELIVERY') {
    if (notification.notificationType == 'DRIVER_NEW_JOB') {
      return l10n?.viewJobs ?? 'View jobs';
    }
    if (notification.notificationType ==
            'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW' ||
        notification.notificationType ==
            'DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN') {
      return l10n?.viewDetails ?? 'View details';
    }
    return l10n?.viewDelivery ?? 'View delivery';
  }
  if (notification.relatedEntityType == 'RESERVATION') {
    return l10n?.viewReservation ?? 'View reservation';
  }
  if (notification.relatedEntityType == 'LEARNING_PROJECT') {
    return l10n?.viewSubmission ?? 'View submission';
  }
  return l10n?.open ?? 'Open';
}

typedef LocalizedNotificationCopy = ({String title, String body});

LocalizedNotificationCopy localizedNotificationCopy(
  AppNotification notification,
  AppLocalizations l10n,
) {
  final contentTitle =
      notification.metadata['materialTitle']?.toString().trim() ?? '';
  final projectTitle =
      notification.metadata['projectTitle']?.toString().trim() ?? '';
  final materialTitle = contentTitle.isEmpty ? l10n.material : contentTitle;
  final safeProjectTitle = projectTitle.isEmpty
      ? l10n.learningProject
      : projectTitle;
  final moderationEvent =
      notification.metadata['moderationEvent']
          ?.toString()
          .trim()
          .toUpperCase() ??
      '';
  final feedback = notification.metadata['feedback']?.toString().trim() ?? '';

  String withFeedback(String summary) => feedback.isEmpty
      ? summary
      : l10n.projectModerationFeedback(summary, feedback);

  return switch (notification.notificationType) {
    'RESERVATION_ACCEPTED' => (
      title: l10n.reservationAcceptedTitle,
      body: l10n.reservationAcceptedBody(materialTitle),
    ),
    'RESERVATION_SCHEDULING_PROPOSAL' => (
      title: l10n.reservationProposalTitle,
      body: l10n.reservationProposalBody(materialTitle),
    ),
    'RESERVATION_DECLINED' => (
      title: l10n.reservationDeclinedTitle,
      body: l10n.reservationDeclinedBody(materialTitle),
    ),
    'RESERVATION_EXPIRED' => (
      title: l10n.reservationExpiredTitle,
      body: l10n.reservationExpiredBody(materialTitle),
    ),
    'LEARNING_PROJECT_MODERATION' => switch (moderationEvent) {
      'APPROVED' => (
        title: l10n.projectApprovedTitle,
        body: l10n.projectApprovedBody(safeProjectTitle),
      ),
      'CHANGES_REQUESTED' => (
        title: l10n.projectChangesRequestedTitle,
        body: withFeedback(l10n.projectChangesRequestedBody(safeProjectTitle)),
      ),
      'REJECTED' => (
        title: l10n.projectRejectedTitle,
        body: withFeedback(l10n.projectRejectedBody(safeProjectTitle)),
      ),
      'HIDDEN' => (
        title: l10n.projectHiddenTitle,
        body: withFeedback(l10n.projectHiddenBody(safeProjectTitle)),
      ),
      'RESTORED' => (
        title: l10n.projectRestoredTitle,
        body: l10n.projectRestoredBody(safeProjectTitle),
      ),
      'ARCHIVED' => (
        title: l10n.projectArchivedTitle,
        body: withFeedback(l10n.projectArchivedBody(safeProjectTitle)),
      ),
      _ => (
        title: l10n.projectModerationTitle,
        body: l10n.projectModerationBody(safeProjectTitle),
      ),
    },
    _ when l10n.localeName == 'en' && notification.title.trim().isNotEmpty => (
      title: notification.title,
      body: notification.body,
    ),
    _ => (
      title: l10n.notificationFallbackTitle,
      body: l10n.notificationFallbackBody,
    ),
  };
}

bool notificationHasNavigationTarget(AppNotification notification) {
  return (notification.relatedEntityType == 'DELIVERY' ||
          notification.relatedEntityType == 'RESERVATION' ||
          notification.relatedEntityType == 'LEARNING_PROJECT') &&
      notification.relatedEntityId != null &&
      notification.relatedEntityId!.isNotEmpty;
}

/// Driver delivery notifications open the delivery detail route, which shows
/// inactive-context messaging when the job is no longer active.
String? driverDeliveryNotificationRoute(AppNotification notification) {
  if (notification.relatedEntityType != 'DELIVERY' ||
      notification.relatedEntityId == null ||
      notification.relatedEntityId!.isEmpty) {
    return null;
  }

  final rawId = notification.relatedEntityId!;
  final deliveryId = rawId.contains(':') ? rawId.split(':').first : rawId;

  if (notification.notificationType == 'DRIVER_NEW_JOB') {
    return '/driver/jobs';
  }

  return '/driver/deliveries/$deliveryId';
}
