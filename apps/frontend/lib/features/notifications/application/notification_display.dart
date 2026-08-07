import '../data/models/app_notification.dart';
import '../../supplier_portal/data/models/supplier_action_notification.dart';
import '../../../l10n/app_localizations.dart';
import 'payment_notification_presentation.dart';

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
  reservation,
  payment,
  refund,
  material,
  learning,
  materialRequest,
  account,
  general,
}

NotificationVisualCategory categoryForNotification(
  AppNotification notification,
) {
  final type = notification.notificationType;
  final entity = notification.relatedEntityType;

  switch (type) {
    case 'PAYMENT_REQUIRED':
    case 'PAYMENT_COMPLETED':
    case 'PAYMENT_NEW_CYCLE_REQUIRED':
    case 'PAYMENT_FULFILLMENT_READY':
    case 'PAYMENT_RESOLUTION_REQUIRED':
      return NotificationVisualCategory.payment;
    case 'PAYMENT_REFUND_REQUESTED':
    case 'PAYMENT_REFUNDED':
    case 'PAYMENT_REFUND_FAILED':
    case 'PAYMENT_LATE_SUCCESS_REFUND':
      return NotificationVisualCategory.refund;
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
    case 'DRIVER_DELIVERY_ACCEPTED':
    case 'DRIVER_DELIVERY_NEXT_STEP':
    case 'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW':
    case 'DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN':
    case 'DELIVERY_DRIVER_ASSIGNED':
      return NotificationVisualCategory.deliveryUpdate;
    case 'RESERVATION_ACCEPTED':
    case 'RESERVATION_SCHEDULING_PROPOSAL':
    case 'RESERVATION_DECLINED':
    case 'RESERVATION_EXPIRED':
    case 'RESERVATION_REQUESTED':
    case 'RESERVATION_CANCELLED':
    case 'NO_DRIVER_SUPPLIER_RESCHEDULE_REQUESTED':
    case 'STALE_PICKUP_SUPPLIER_RESCHEDULE_REQUESTED':
      return NotificationVisualCategory.reservation;
    case 'MATERIAL_MODERATION_UPDATE':
      return NotificationVisualCategory.material;
    case 'MATERIAL_REQUEST_SUGGESTION':
    case 'MATERIAL_REQUEST_MATCH_UNAVAILABLE':
    case 'MATERIAL_REQUEST_FULFILLED':
      return NotificationVisualCategory.materialRequest;
    case 'CATEGORY_REQUEST_UPDATE':
    case 'PRICE_REQUEST_UPDATE':
      return NotificationVisualCategory.materialRequest;
    case 'LEARNING_PROJECT_MODERATION':
      return NotificationVisualCategory.learning;
    case 'SUPPLIER_VERIFICATION_UPDATE':
      return NotificationVisualCategory.account;
    default:
      break;
  }

  if (entity == 'RESERVATION' || type.contains('RESERVATION')) {
    return NotificationVisualCategory.reservation;
  }
  if (entity == 'DELIVERY' || type.contains('DELIVERY')) {
    return NotificationVisualCategory.deliveryUpdate;
  }
  if (entity == 'LEARNING_PROJECT' || type.contains('LEARNING_PROJECT')) {
    return NotificationVisualCategory.learning;
  }
  if (entity == 'MATERIAL_REQUEST' || type.startsWith('MATERIAL_REQUEST_')) {
    return NotificationVisualCategory.materialRequest;
  }
  if (entity == 'CATEGORY_REQUEST' || entity == 'PRICE_RULE_REQUEST') {
    return NotificationVisualCategory.materialRequest;
  }
  if (entity == 'MATERIAL' || type.contains('MATERIAL')) {
    return NotificationVisualCategory.material;
  }
  if (type.contains('VERIFICATION') || type.contains('ACCOUNT')) {
    return NotificationVisualCategory.account;
  }
  return NotificationVisualCategory.general;
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
      NotificationVisualCategory.reservation =>
        l10n.notificationChipReservation,
      NotificationVisualCategory.payment => l10n.notificationChipPayment,
      NotificationVisualCategory.refund => l10n.notificationChipRefund,
      NotificationVisualCategory.material => l10n.notificationChipMaterial,
      NotificationVisualCategory.learning => l10n.notificationChipLearning,
      NotificationVisualCategory.materialRequest =>
        l10n.notificationChipMaterialRequest,
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
    case NotificationVisualCategory.reservation:
      return 'Reservation';
    case NotificationVisualCategory.payment:
      return 'Payment';
    case NotificationVisualCategory.refund:
      return 'Refund';
    case NotificationVisualCategory.material:
      return 'Material';
    case NotificationVisualCategory.learning:
      return 'Learning';
    case NotificationVisualCategory.materialRequest:
      return 'Material request';
    case NotificationVisualCategory.account:
      return 'Account';
    case NotificationVisualCategory.general:
      return 'Update';
  }
}

String notificationActionLabel(
  AppNotification notification, {
  AppLocalizations? l10n,
  bool isSupplierMode = false,
  bool isDriverMode = false,
}) {
  if (notificationOpenRoute(
        notification,
        isSupplierMode: isSupplierMode,
        isDriverMode: isDriverMode,
      ) ==
      null) {
    return l10n?.open ?? 'Open';
  }

  if (isPaymentNotification(notification) && l10n != null) {
    return paymentNotificationActionLabel(notification, l10n);
  }

  switch (notification.notificationType) {
    case 'MATERIAL_MODERATION_UPDATE':
      return l10n?.viewMaterial ?? 'View material';
    case 'CATEGORY_REQUEST_UPDATE':
    case 'PRICE_REQUEST_UPDATE':
      return l10n?.open ?? 'Open';
    default:
      break;
  }

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
  if (notification.relatedEntityType == 'MATERIAL_REQUEST' ||
      notification.notificationType.startsWith('MATERIAL_REQUEST_')) {
    return 'View request';
  }
  return l10n?.open ?? 'Open';
}

typedef LocalizedNotificationCopy = ({String title, String body});

String _metadataString(Map<String, dynamic> metadata, String key) =>
    metadata[key]?.toString().trim() ?? '';

LocalizedNotificationCopy _localizedDriverNotificationTemplates(
  String rawType,
  AppLocalizations l10n, {
  required String materialTitle,
}) {
  return switch (rawType) {
    'DRIVER_NEW_JOB' => (
      title: l10n.notificationDriverNewJobTitle,
      body: l10n.notificationDriverNewJobBody(materialTitle),
    ),
    'DRIVER_PICKUP_TIME' => (
      title: l10n.notificationDriverPickupTimeTitle,
      body: l10n.notificationDriverPickupTimeBody(materialTitle),
    ),
    'DRIVER_PICKUP_REMINDER' => (
      title: l10n.notificationDriverPickupReminderTitle,
      body: l10n.notificationDriverPickupReminderBody(materialTitle),
    ),
    'DRIVER_PICKUP_STARTING_SOON' => (
      title: l10n.notificationDriverPickupStartingSoonTitle,
      body: l10n.notificationDriverPickupStartingSoonBody(materialTitle),
    ),
    'DRIVER_PICKUP_WINDOW_STARTED' => (
      title: l10n.notificationDriverPickupWindowStartedTitle,
      body: l10n.notificationDriverPickupWindowStartedBody(materialTitle),
    ),
    'DRIVER_PICKUP_OVERDUE' => (
      title: l10n.notificationDriverPickupOverdueTitle,
      body: l10n.notificationDriverPickupOverdueBody(materialTitle),
    ),
    'DRIVER_DROPOFF_TIME' => (
      title: l10n.notificationDriverDropoffTimeTitle,
      body: l10n.notificationDriverDropoffTimeBody(materialTitle),
    ),
    'DRIVER_DROPOFF_REMINDER' => (
      title: l10n.notificationDriverDropoffReminderTitle,
      body: l10n.notificationDriverDropoffReminderBody(materialTitle),
    ),
    'DRIVER_DROPOFF_STARTING_SOON' => (
      title: l10n.notificationDriverDropoffStartingSoonTitle,
      body: l10n.notificationDriverDropoffStartingSoonBody(materialTitle),
    ),
    'DRIVER_DROPOFF_WINDOW_STARTED' => (
      title: l10n.notificationDriverDropoffWindowStartedTitle,
      body: l10n.notificationDriverDropoffWindowStartedBody(materialTitle),
    ),
    'DRIVER_DROPOFF_OVERDUE' => (
      title: l10n.notificationDriverDropoffOverdueTitle,
      body: l10n.notificationDriverDropoffOverdueBody(materialTitle),
    ),
    'DRIVER_DELIVERY_REQUEST_CREATED' => (
      title: l10n.notificationDriverDeliveryRequestCreatedTitle,
      body: l10n.notificationDriverDeliveryRequestCreatedBody(materialTitle),
    ),
    'DRIVER_DELIVERY_ACCEPTED' => (
      title: l10n.notificationDriverDeliveryAcceptedTitle,
      body: l10n.notificationDriverDeliveryAcceptedBody(materialTitle),
    ),
    'DRIVER_DELIVERY_NEXT_STEP' => (
      title: l10n.notificationDriverDeliveryNextStepTitle,
      body: l10n.notificationDriverDeliveryNextStepBody(materialTitle),
    ),
    'DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN' => (
      title: l10n.notificationDriverUnassignedTitle,
      body: l10n.notificationDriverUnassignedBody(materialTitle),
    ),
    'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW' => (
      title: l10n.notificationDriverMovedToAdminTitle,
      body: l10n.notificationDriverMovedToAdminBody,
    ),
    'DELIVERY_DRIVER_ASSIGNED' => (
      title: l10n.notificationDeliveryDriverAssignedTitle,
      body: l10n.notificationDeliveryDriverAssignedBody(materialTitle),
    ),
    _ => (
      title: l10n.notificationFallbackTitle,
      body: l10n.notificationFallbackBody,
    ),
  };
}

LocalizedNotificationCopy _localizedSupplierNotificationTemplates(
  String rawType,
  AppLocalizations l10n, {
  required String materialTitle,
  required String learnerName,
}) {
  final safeLearnerName = learnerName.isEmpty ? l10n.learner : learnerName;

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

  final driverTemplate = _localizedDriverNotificationTemplates(
    notification.notificationType,
    l10n,
    materialTitle: materialTitle,
  );

  if (isPaymentNotification(notification)) {
    return localizedPaymentNotificationCopy(notification, l10n);
  }

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
    'RESERVATION_EXPIRED' =>
      learnerName.isNotEmpty
          ? (
              title: l10n.notificationReservationExpiredSupplierTitle,
              body: l10n.notificationReservationExpiredSupplierBody(
                materialTitle,
              ),
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
    'SUPPLIER_VERIFICATION_UPDATE' => supplierTemplate,
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
    'DRIVER_NEW_JOB' ||
    'DRIVER_PICKUP_TIME' ||
    'DRIVER_PICKUP_REMINDER' ||
    'DRIVER_PICKUP_STARTING_SOON' ||
    'DRIVER_PICKUP_WINDOW_STARTED' ||
    'DRIVER_PICKUP_OVERDUE' ||
    'DRIVER_DROPOFF_TIME' ||
    'DRIVER_DROPOFF_REMINDER' ||
    'DRIVER_DROPOFF_STARTING_SOON' ||
    'DRIVER_DROPOFF_WINDOW_STARTED' ||
    'DRIVER_DROPOFF_OVERDUE' ||
    'DRIVER_DELIVERY_REQUEST_CREATED' ||
    'DRIVER_DELIVERY_ACCEPTED' ||
    'DRIVER_DELIVERY_NEXT_STEP' ||
    'DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN' ||
    'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW' ||
    'DELIVERY_DRIVER_ASSIGNED' => driverTemplate,
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
  final safeMaterialTitle = materialTitle.isEmpty
      ? l10n.material
      : materialTitle;
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

bool notificationHasNavigationTarget(
  AppNotification notification, {
  bool isSupplierMode = false,
  bool isDriverMode = false,
}) {
  return notificationOpenRoute(
        notification,
        isSupplierMode: isSupplierMode,
        isDriverMode: isDriverMode,
      ) !=
      null;
}

String? _nonEmptyId(String? value) {
  final id = value?.trim() ?? '';
  return id.isEmpty ? null : id;
}

/// Explicit metadata material id only when the backend contract provides it.
String? _metadataMaterialId(AppNotification notification) {
  final materialId =
      notification.metadata['materialId']?.toString().trim() ?? '';
  return materialId.isEmpty ? null : materialId;
}

String? _metadataPublishedMaterialId(AppNotification notification) {
  final materialId =
      notification.metadata['publishedMaterialId']?.toString().trim() ?? '';
  return materialId.isEmpty ? null : materialId;
}

/// Resolves the in-app route for a notification open action, or null when the
/// notification is informational only.
///
/// Material-request / material routing is contract-driven only. There are
/// currently no learner material-request notification producers in the
/// backend; invented types must not invent destinations.
String? notificationOpenRoute(
  AppNotification notification, {
  required bool isSupplierMode,
  required bool isDriverMode,
}) {
  if (!isSupplierMode &&
      !isDriverMode &&
      isPaymentNotification(notification)) {
    return paymentNotificationOpenRoute(notification);
  }

  if (notification.relatedEntityType == 'RESERVATION' &&
      notification.relatedEntityId != null &&
      notification.relatedEntityId!.isNotEmpty) {
    final reservationId = notification.relatedEntityId!;
    if (isSupplierMode) {
      return '/supplier/reservations?tab=pending&focus=$reservationId';
    }
    return '/learner/reservations/$reservationId';
  }

  if (notification.relatedEntityType == 'DELIVERY' &&
      notification.relatedEntityId != null &&
      notification.relatedEntityId!.isNotEmpty) {
    if (isDriverMode) {
      return driverDeliveryNotificationRoute(notification);
    }
    return null;
  }

  if (notification.relatedEntityType == 'LEARNING_PROJECT' &&
      notification.relatedEntityId != null &&
      notification.relatedEntityId!.isNotEmpty) {
    return '/learning/submissions/${notification.relatedEntityId}';
  }

  if (!isSupplierMode && !isDriverMode) {
    final materialRequestRoute = materialRequestNotificationRoute(notification);
    if (materialRequestRoute != null) {
      return materialRequestRoute;
    }
  }

  return _supplierMaterialReviewOpenRoute(
    notification,
    isSupplierMode: isSupplierMode,
  );
}

/// Routes for real supplier material-review notification producers only.
String? _supplierMaterialReviewOpenRoute(
  AppNotification notification, {
  required bool isSupplierMode,
}) {
  if (!isSupplierMode) {
    return null;
  }

  final type = notification.notificationType;
  final entity = notification.relatedEntityType;
  final relatedId = _nonEmptyId(notification.relatedEntityId);
  final action = notification.actionType?.trim().toUpperCase();

  switch (type) {
    case 'MATERIAL_MODERATION_UPDATE':
      // Backend: relatedEntityType=MATERIAL, relatedEntityId=materialId,
      // actionType=OPEN_MATERIAL. Destination: supplier owned material.
      if (entity != 'MATERIAL') {
        return null;
      }
      final materialId = relatedId ?? _metadataMaterialId(notification);
      if (materialId == null) {
        return null;
      }
      if (action != null && action != 'OPEN_MATERIAL') {
        return null;
      }
      return '/supplier/materials/$materialId';

    case 'CATEGORY_REQUEST_UPDATE':
      // Backend: relatedEntityType=CATEGORY_REQUEST,
      // relatedEntityId=CategoryRequest.id. Never treat that id as a material.
      if (entity != 'CATEGORY_REQUEST' || relatedId == null) {
        return null;
      }
      if (action == 'NONE') {
        // Listing-published updates carry metadata.publishedMaterialId but are
        // resolved informational notices (actionType NONE).
        return null;
      }
      if (action == 'CONTINUE_LISTING' || action == 'EDIT_LISTING') {
        return '/supplier/materials/new?categoryRequestId=$relatedId';
      }
      return null;

    case 'PRICE_REQUEST_UPDATE':
      // Backend: relatedEntityType=PRICE_RULE_REQUEST,
      // relatedEntityId=PriceRuleRequest.id.
      if (entity != 'PRICE_RULE_REQUEST' || relatedId == null) {
        return null;
      }
      if (action == 'NONE') {
        return null;
      }
      if (action == 'CONTINUE_LISTING' || action == 'EDIT_LISTING') {
        return '/supplier/materials/new?priceRuleRequestId=$relatedId';
      }
      return null;

    default:
      if (_metadataPublishedMaterialId(notification) != null) {
        return null;
      }
      return null;
  }
}

/// Learner material-request notifications open the request detail route.
String? materialRequestNotificationRoute(AppNotification notification) {
  if (notification.relatedEntityType != 'MATERIAL_REQUEST' ||
      notification.relatedEntityId == null ||
      notification.relatedEntityId!.isEmpty) {
    return null;
  }

  return '/learner/material-requests/${notification.relatedEntityId}';
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
