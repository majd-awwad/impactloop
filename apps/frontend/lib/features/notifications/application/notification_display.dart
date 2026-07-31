import '../data/models/app_notification.dart';
import '../../supplier_portal/data/models/supplier_action_notification.dart';
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
    case 'DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN':
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

String _metadataString(Map<String, dynamic> metadata, String key) =>
    metadata[key]?.toString().trim() ?? '';

LocalizedNotificationCopy _localizedSupplierNotificationTemplates(
  String rawType,
  AppLocalizations l10n, {
  required String materialTitle,
  required String learnerName,
}) {
  final safeLearnerName =
      learnerName.isEmpty ? l10n.learner : learnerName;

  return switch (rawType) {
    'RESERVATION_REQUESTED' => (
      title: l10n.notificationReservationRequestedTitle,
      body: l10n.notificationReservationRequestedBody(
        safeLearnerName,
        materialTitle,
      ),
    ),
    'RESERVATION_CANCELLED' => (
      title: l10n.notificationReservationCancelledSupplierTitle,
      body: l10n.notificationReservationCancelledSupplierBody(
        safeLearnerName,
        materialTitle,
      ),
    ),
    'RESERVATION_EXPIRED' => (
      title: l10n.notificationReservationExpiredSupplierTitle,
      body: l10n.notificationReservationExpiredSupplierBody(materialTitle),
    ),
    'NO_DRIVER_SUPPLIER_RESCHEDULE_REQUESTED' => (
      title: l10n.notificationChoosePickupWindowTitle,
      body: l10n.notificationChoosePickupWindowBody(materialTitle),
    ),
    'STALE_PICKUP_SUPPLIER_RESCHEDULE_REQUESTED' => (
      title: l10n.notificationNewPickupWindowNeededTitle,
      body: l10n.notificationNewPickupWindowNeededBody(materialTitle),
    ),
    'CATEGORY_REQUEST_UPDATE' => (
      title: l10n.notificationCategoryRequestUpdateTitle,
      body: l10n.notificationCategoryRequestUpdateBody,
    ),
    'PRICE_REQUEST_UPDATE' => (
      title: l10n.notificationPriceRequestUpdateTitle,
      body: l10n.notificationPriceRequestUpdateBody,
    ),
    'MATERIAL_MODERATION_UPDATE' => (
      title: l10n.notificationMaterialModerationUpdateTitle,
      body: l10n.notificationMaterialModerationUpdateBody,
    ),
    'SUPPLIER_VERIFICATION_UPDATE' => (
      title: l10n.notificationSupplierVerificationUpdateTitle,
      body: l10n.notificationSupplierVerificationUpdateBody,
    ),
    _ => (
      title: l10n.notificationFallbackTitle,
      body: l10n.notificationFallbackBody,
    ),
  };
}

LocalizedNotificationCopy localizedNotificationCopy(
  AppNotification notification,
  AppLocalizations l10n,
) {
  final contentTitle = _metadataString(notification.metadata, 'materialTitle');
  final learnerName = _metadataString(notification.metadata, 'learnerName');
  final projectTitle = _metadataString(notification.metadata, 'projectTitle');
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

  final supplierTemplate = _localizedSupplierNotificationTemplates(
    notification.notificationType,
    l10n,
    materialTitle: materialTitle,
    learnerName: learnerName,
  );

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
    'RESERVATION_EXPIRED' => learnerName.isNotEmpty
        ? (
            title: l10n.notificationReservationExpiredSupplierTitle,
            body: l10n.notificationReservationExpiredSupplierBody(materialTitle),
          )
        : (
            title: l10n.reservationExpiredTitle,
            body: l10n.reservationExpiredBody(materialTitle),
          ),
    'RESERVATION_REQUESTED' ||
    'RESERVATION_CANCELLED' ||
    'NO_DRIVER_SUPPLIER_RESCHEDULE_REQUESTED' ||
    'STALE_PICKUP_SUPPLIER_RESCHEDULE_REQUESTED' ||
    'CATEGORY_REQUEST_UPDATE' ||
    'PRICE_REQUEST_UPDATE' ||
    'MATERIAL_MODERATION_UPDATE' ||
    'SUPPLIER_VERIFICATION_UPDATE' =>
      supplierTemplate,
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
    'DRIVER_NEW_JOB' => (
      title: l10n.notificationDriverNewJobTitle,
      body: l10n.notificationDriverNewJobBody(materialTitle),
    ),
    'DRIVER_PICKUP_TIME' => (
      title: l10n.notificationDriverPickupTimeTitle,
      body: l10n.notificationDriverPickupTimeBody(materialTitle),
    ),
    'DRIVER_DROPOFF_TIME' => (
      title: l10n.notificationDriverDropoffTimeTitle,
      body: l10n.notificationDriverDropoffTimeBody(materialTitle),
    ),
    'DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN' => (
      title: l10n.notificationDriverUnassignedTitle,
      body: l10n.notificationDriverUnassignedBody(materialTitle),
    ),
    'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW' => (
      title: l10n.notificationDriverMovedToAdminTitle,
      body: l10n.notificationDriverMovedToAdminBody,
    ),
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

LocalizedNotificationCopy localizedSupplierNotificationCopy(
  SupplierActionNotification notification,
  AppLocalizations l10n,
) {
  final materialTitle = _metadataString(notification.metadata, 'materialTitle');
  final learnerName = _metadataString(notification.metadata, 'learnerName');
  final safeMaterialTitle =
      materialTitle.isEmpty ? l10n.material : materialTitle;
  final copy = _localizedSupplierNotificationTemplates(
    notification.rawType.toUpperCase(),
    l10n,
    materialTitle: safeMaterialTitle,
    learnerName: learnerName,
  );

  if (l10n.localeName == 'en' &&
      copy.title == l10n.notificationFallbackTitle &&
      notification.title.trim().isNotEmpty) {
    return (title: notification.title, body: notification.body);
  }

  return copy;
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
