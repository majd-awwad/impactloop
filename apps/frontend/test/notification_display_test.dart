import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';

AppNotification _deliveryNotification({
  required String notificationType,
  String deliveryId = 'delivery-1',
}) {
  return AppNotification(
    id: 'notif-1',
    notificationType: notificationType,
    title: 'Delivery moved to admin review',
    body:
        'Delivery moved to admin review because pickup was not completed within the pickup window.',
    relatedEntityType: 'DELIVERY',
    relatedEntityId: deliveryId,
    isRead: false,
    createdAt: DateTime.utc(2026),
  );
}

void main() {
  group('driver moved-to-admin-review notification display', () {
    test('renders friendly delivery-update category instead of raw enum', () {
      final notification = _deliveryNotification(
        notificationType: 'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW',
      );
      final sanitized = sanitizeNotification(notification);

      expect(
        categoryForNotification(notification),
        NotificationVisualCategory.deliveryUpdate,
      );
      expect(
        notificationTypeChipLabel(categoryForNotification(notification)),
        'Delivery update',
      );
      expect(sanitized.title, 'Delivery moved to admin review');
      expect(sanitized.body, contains('pickup was not completed'));
      expect(sanitized.title, isNot(contains('DRIVER_DELIVERY_MOVED')));
    });

    test(
      'uses inactive delivery detail route for moved-to-admin-review tap',
      () {
        final notification = _deliveryNotification(
          notificationType: 'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW',
          deliveryId: 'delivery-42',
        );

        expect(notificationHasNavigationTarget(notification), isTrue);
        expect(notificationActionLabel(notification), 'View details');
        expect(
          driverDeliveryNotificationRoute(notification),
          '/driver/deliveries/delivery-42',
        );
      },
    );

    test('new job notifications still route to jobs board', () {
      final notification = _deliveryNotification(
        notificationType: 'DRIVER_NEW_JOB',
        deliveryId: 'delivery-99',
      );

      expect(notificationActionLabel(notification), 'View jobs');
      expect(driverDeliveryNotificationRoute(notification), '/driver/jobs');
    });

    test('unknown notification types keep safe fallback labels', () {
      final notification = AppNotification(
        id: 'notif-unknown',
        notificationType: 'LEGACY_UNKNOWN_EVENT',
        title: 'Something happened',
        body: 'Please check your account.',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(
        categoryForNotification(notification),
        NotificationVisualCategory.general,
      );
      expect(
        notificationTypeChipLabel(NotificationVisualCategory.general),
        'Update',
      );
      expect(notificationActionLabel(notification), 'Open');
      expect(notificationHasNavigationTarget(notification), isFalse);
      expect(driverDeliveryNotificationRoute(notification), isNull);
    });
  });

  group('Learner notification localization', () {
    final ar = AppLocalizationsAr();

    test('localizes every Learner reservation notification type', () {
      final expectedTitles = <String, String>{
        'RESERVATION_ACCEPTED': ar.reservationAcceptedTitle,
        'RESERVATION_SCHEDULING_PROPOSAL': ar.reservationProposalTitle,
        'RESERVATION_DECLINED': ar.reservationDeclinedTitle,
        'RESERVATION_EXPIRED': ar.reservationExpiredTitle,
      };

      for (final entry in expectedTitles.entries) {
        final copy = localizedNotificationCopy(
          AppNotification(
            id: entry.key,
            notificationType: entry.key,
            title: 'Legacy English title',
            body: 'Legacy English body',
            relatedEntityType: 'RESERVATION',
            relatedEntityId: 'reservation-1',
            metadata: const {'materialTitle': 'Arduino Uno'},
            isRead: false,
            createdAt: DateTime.utc(2026),
          ),
          ar,
        );

        expect(copy.title, entry.value);
        expect(copy.body, contains('Arduino Uno'));
        expect(copy.title, isNot(contains('Legacy')));
      }
    });

    test('localizes every project moderation outcome from metadata', () {
      final expectedTitles = <String, String>{
        'APPROVED': ar.projectApprovedTitle,
        'CHANGES_REQUESTED': ar.projectChangesRequestedTitle,
        'REJECTED': ar.projectRejectedTitle,
        'HIDDEN': ar.projectHiddenTitle,
        'RESTORED': ar.projectRestoredTitle,
        'ARCHIVED': ar.projectArchivedTitle,
      };

      for (final entry in expectedTitles.entries) {
        final copy = localizedNotificationCopy(
          AppNotification(
            id: entry.key,
            notificationType: 'LEARNING_PROJECT_MODERATION',
            title: 'Legacy English title',
            body: 'Legacy English body',
            relatedEntityType: 'LEARNING_PROJECT',
            relatedEntityId: 'project-1',
            metadata: {
              'projectTitle': 'مشروع الروبوت',
              'moderationEvent': entry.key,
              if (entry.key == 'CHANGES_REQUESTED') 'feedback': 'أضف صورة أوضح',
            },
            isRead: false,
            createdAt: DateTime.utc(2026),
          ),
          ar,
        );

        expect(copy.title, entry.value);
        expect(copy.body, contains('مشروع الروبوت'));
        if (entry.key == 'CHANGES_REQUESTED') {
          expect(copy.body, contains('أضف صورة أوضح'));
        }
      }
    });

    test('unknown Learner notification uses Arabic safe fallback', () {
      final copy = localizedNotificationCopy(
        AppNotification(
          id: 'future',
          notificationType: 'FUTURE_LEARNER_EVENT',
          title: 'English backend prose',
          body: 'English backend body',
          isRead: false,
          createdAt: DateTime.utc(2026),
        ),
        ar,
      );

      expect(copy.title, ar.notificationFallbackTitle);
      expect(copy.body, ar.notificationFallbackBody);
    });
  });
}
