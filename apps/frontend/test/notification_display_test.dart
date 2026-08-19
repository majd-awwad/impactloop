import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_action_notification.dart';
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

AppNotification _materialRequestNotification({
  required String notificationType,
  String requestId = 'req-1',
}) {
  return AppNotification(
    id: 'notif-mr-1',
    notificationType: notificationType,
    title: 'Material request update',
    body: 'A supplier suggested a material for your request.',
    relatedEntityType: 'MATERIAL_REQUEST',
    relatedEntityId: requestId,
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

        expect(
          notificationHasNavigationTarget(notification, isDriverMode: true),
          isTrue,
        );
        expect(
          notificationActionLabel(notification, isDriverMode: true),
          'View details',
        );
        expect(
          driverDeliveryNotificationRoute(notification),
          '/driver/deliveries/delivery-42',
        );
        expect(
          notificationOpenRoute(
            notification,
            isSupplierMode: false,
            isDriverMode: true,
          ),
          '/driver/deliveries/delivery-42',
        );
      },
    );

    test('new job notifications still route to jobs board', () {
      final notification = _deliveryNotification(
        notificationType: 'DRIVER_NEW_JOB',
        deliveryId: 'delivery-99',
      );

      expect(
        notificationActionLabel(notification, isDriverMode: true),
        'View jobs',
      );
      expect(driverDeliveryNotificationRoute(notification), '/driver/jobs');
      expect(
        notificationOpenRoute(
          notification,
          isSupplierMode: false,
          isDriverMode: true,
        ),
        '/driver/jobs',
      );
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
      expect(notificationActionLabel(notification), '');
      expect(notificationHasNavigationTarget(notification), isFalse);
      expect(driverDeliveryNotificationRoute(notification), isNull);
    });

    test(
      'supplier material moderation resolves to supplier material detail',
      () {
        final notification = AppNotification(
          id: 'mod-1',
          notificationType: 'MATERIAL_MODERATION_UPDATE',
          title: 'Listing updated',
          body: 'Your material was updated by moderation.',
          relatedEntityType: 'MATERIAL',
          relatedEntityId: 'material-42',
          actionType: 'OPEN_MATERIAL',
          isRead: false,
          createdAt: DateTime.utc(2026),
        );

        expect(
          notificationHasNavigationTarget(notification, isSupplierMode: true),
          isTrue,
        );
        expect(
          notificationActionLabel(notification, isSupplierMode: true),
          'View material',
        );
        expect(
          notificationOpenRoute(
            notification,
            isSupplierMode: true,
            isDriverMode: false,
          ),
          '/supplier/materials/material-42',
        );
        expect(
          notificationOpenRoute(
            notification,
            isSupplierMode: false,
            isDriverMode: false,
          ),
          isNull,
        );
      },
    );

    test('invented material-request match types do not invent routes', () {
      final notification = AppNotification(
        id: 'match-1',
        notificationType: 'MATERIAL_REQUEST_MATCH',
        title: 'Match ready',
        body: 'A material matches your request.',
        relatedEntityType: 'MATERIAL',
        relatedEntityId: 'material-42',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(notificationHasNavigationTarget(notification), isFalse);
      expect(
        notificationOpenRoute(
          notification,
          isSupplierMode: false,
          isDriverMode: false,
        ),
        isNull,
      );
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

  group('Supplier notification localization', () {
    final ar = AppLocalizationsAr();

    SupplierActionNotification _supplierNotification({
      required String rawType,
      Map<String, dynamic> metadata = const {},
    }) {
      return SupplierActionNotification(
        id: 'supplier-notif-1',
        group: SupplierActionNotificationGroup.reservationAlert,
        kind: SupplierActionNotificationKind.reservationPending,
        title: 'Legacy English title',
        body: 'Legacy English body from server',
        status: SupplierActionNotificationStatus.pending,
        createdAt: DateTime.utc(2026),
        actionNeeded: true,
        isCompleted: false,
        rawType: rawType,
        category: SupplierNotificationCategory.reservation,
        state: SupplierNotificationState.needsAction,
        metadata: metadata,
      );
    }

    test('localizes every supplier notification type in Arabic', () {
      final expectedTitles = <String, String>{
        'RESERVATION_REQUESTED': ar.notificationReservationRequestedTitle,
        'RESERVATION_CANCELLED':
            ar.notificationReservationCancelledSupplierTitle,
        'RESERVATION_EXPIRED': ar.notificationReservationExpiredSupplierTitle,
        'NO_DRIVER_SUPPLIER_RESCHEDULE_REQUESTED':
            ar.notificationChoosePickupWindowTitle,
        'STALE_PICKUP_SUPPLIER_RESCHEDULE_REQUESTED':
            ar.notificationNewPickupWindowNeededTitle,
        'CATEGORY_REQUEST_UPDATE': ar.notificationCategoryRequestUpdateTitle,
        'PRICE_REQUEST_UPDATE': ar.notificationPriceRequestUpdateTitle,
        'MATERIAL_MODERATION_UPDATE':
            ar.notificationMaterialModerationUpdateTitle,
        'SUPPLIER_VERIFICATION_UPDATE':
            ar.notificationSupplierVerificationUpdateTitle,
      };

      for (final entry in expectedTitles.entries) {
        final copy = localizedSupplierNotificationCopy(
          _supplierNotification(
            rawType: entry.key,
            metadata: const {
              'materialTitle': 'Arduino Uno',
              'learnerName': 'Majd Learner',
            },
          ),
          ar,
        );

        expect(copy.title, entry.value);
        expect(copy.title, isNot(contains('Legacy')));
        expect(copy.body, isNot(contains('Legacy English body')));
        if (entry.key == 'RESERVATION_REQUESTED' ||
            entry.key == 'RESERVATION_CANCELLED') {
          expect(copy.body, contains('Arduino Uno'));
          expect(copy.body, contains('Majd Learner'));
        } else if (entry.key == 'RESERVATION_EXPIRED' ||
            entry.key == 'NO_DRIVER_SUPPLIER_RESCHEDULE_REQUESTED' ||
            entry.key == 'STALE_PICKUP_SUPPLIER_RESCHEDULE_REQUESTED') {
          expect(copy.body, contains('Arduino Uno'));
        }
      }
    });

    test('reservation expired uses learner body without supplier metadata', () {
      final copy = localizedNotificationCopy(
        AppNotification(
          id: 'expired-learner',
          notificationType: 'RESERVATION_EXPIRED',
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

      expect(copy.title, ar.reservationExpiredTitle);
      expect(copy.body, contains('Arduino Uno'));
    });

    test(
      'reservation expired uses supplier body when learnerName is present',
      () {
        final copy = localizedNotificationCopy(
          AppNotification(
            id: 'expired-supplier',
            notificationType: 'RESERVATION_EXPIRED',
            title: 'Legacy English title',
            body: 'Legacy English body',
            relatedEntityType: 'RESERVATION',
            relatedEntityId: 'reservation-1',
            metadata: const {
              'materialTitle': 'Arduino Uno',
              'learnerName': 'Majd Learner',
            },
            isRead: false,
            createdAt: DateTime.utc(2026),
          ),
          ar,
        );

        expect(copy.title, ar.notificationReservationExpiredSupplierTitle);
        expect(copy.body, contains('Arduino Uno'));
        expect(copy.body, isNot(contains('Legacy')));
      },
    );
  });

  group('Driver notification localization', () {
    final ar = AppLocalizationsAr();

    AppNotification _driverNotification({
      required String notificationType,
      Map<String, dynamic> metadata = const {},
    }) {
      return AppNotification(
        id: notificationType,
        notificationType: notificationType,
        title: 'Legacy English title',
        body: 'Legacy English body from server',
        relatedEntityType: 'DELIVERY',
        relatedEntityId: 'delivery-1',
        metadata: metadata,
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
    }

    test('localizes every driver notification type in Arabic', () {
      final expectedTitles = <String, String>{
        'DRIVER_NEW_JOB': ar.notificationDriverNewJobTitle,
        'DRIVER_PICKUP_TIME': ar.notificationDriverPickupTimeTitle,
        'DRIVER_DROPOFF_TIME': ar.notificationDriverDropoffTimeTitle,
        'DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN':
            ar.notificationDriverUnassignedTitle,
        'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW':
            ar.notificationDriverMovedToAdminTitle,
      };

      for (final entry in expectedTitles.entries) {
        final copy = localizedNotificationCopy(
          _driverNotification(
            notificationType: entry.key,
            metadata: const {'materialTitle': 'Arduino Uno'},
          ),
          ar,
        );

        expect(copy.title, entry.value);
        expect(copy.title, isNot(contains('Legacy')));
        expect(copy.body, isNot(contains('Legacy English body')));
        if (entry.key != 'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW') {
          expect(copy.body, contains('Arduino Uno'));
        }
      }
    });

    test('unassigned-by-admin uses deliveryUpdate category', () {
      final notification = _driverNotification(
        notificationType: 'DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN',
      );

      expect(
        categoryForNotification(notification),
        NotificationVisualCategory.deliveryUpdate,
      );
    });
  });

  group('supplier material-review notification contracts', () {
    final ar = AppLocalizationsAr();

    test('category and price updates never treat request ids as materials', () {
      final category = AppNotification(
        id: 'cat-1',
        notificationType: 'CATEGORY_REQUEST_UPDATE',
        title: 'Category request approved',
        body: 'Continue listing.',
        relatedEntityType: 'CATEGORY_REQUEST',
        relatedEntityId: 'category-request-1',
        actionType: 'CONTINUE_LISTING',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );
      final price = AppNotification(
        id: 'price-1',
        notificationType: 'PRICE_REQUEST_UPDATE',
        title: 'Price request rejected',
        body: 'Edit listing.',
        relatedEntityType: 'PRICE_RULE_REQUEST',
        relatedEntityId: 'price-request-1',
        actionType: 'EDIT_LISTING',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(
        notificationOpenRoute(
          category,
          isSupplierMode: true,
          isDriverMode: false,
        ),
        '/supplier/materials/new?categoryRequestId=category-request-1',
      );
      expect(
        notificationOpenRoute(price, isSupplierMode: true, isDriverMode: false),
        '/supplier/materials/new?priceRuleRequestId=price-request-1',
      );
      expect(
        notificationOpenRoute(
          category,
          isSupplierMode: true,
          isDriverMode: false,
        ),
        isNot(contains('/materials/category-request-1')),
      );
      expect(
        notificationOpenRoute(price, isSupplierMode: true, isDriverMode: false),
        isNot(contains('/learner/material-requests/')),
      );
    });

    test('Arabic and English action labels for material moderation', () {
      final notification = AppNotification(
        id: 'mod-1',
        notificationType: 'MATERIAL_MODERATION_UPDATE',
        title: 'Listing updated',
        body: 'Body',
        relatedEntityType: 'MATERIAL',
        relatedEntityId: 'material-1',
        actionType: 'OPEN_MATERIAL',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(
        notificationActionLabel(notification, isSupplierMode: true),
        'View material',
      );
      expect(
        notificationActionLabel(notification, isSupplierMode: true, l10n: ar),
        ar.viewMaterial,
      );
    });

    test('missing material id yields no navigation target', () {
      final notification = AppNotification(
        id: 'mod-missing',
        notificationType: 'MATERIAL_MODERATION_UPDATE',
        title: 'Listing updated',
        body: 'Body',
        relatedEntityType: 'MATERIAL',
        actionType: 'OPEN_MATERIAL',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(
        notificationOpenRoute(
          notification,
          isSupplierMode: true,
          isDriverMode: false,
        ),
        isNull,
      );
    });
  });

  group('learner material request notification display', () {
    test('suggestion notification routes to request details', () {
      final notification = _materialRequestNotification(
        notificationType: 'MATERIAL_REQUEST_SUGGESTION',
        requestId: 'req-abc',
      );

      expect(notificationHasNavigationTarget(notification), isTrue);
      expect(notificationActionLabel(notification), 'View request');
      expect(
        materialRequestNotificationRoute(notification),
        '/learner/material-requests/req-abc',
      );
    });

    test('unavailable-match notification routes to the same request details', () {
      final notification = _materialRequestNotification(
        notificationType: 'MATERIAL_REQUEST_MATCH_UNAVAILABLE',
        requestId: 'req-xyz',
      );

      expect(notificationHasNavigationTarget(notification), isTrue);
      expect(
        materialRequestNotificationRoute(notification),
        '/learner/material-requests/req-xyz',
      );
    });

    test('reservation navigation remains unchanged', () {
      final notification = AppNotification(
        id: 'notif-res',
        notificationType: 'RESERVATION_ACCEPTED',
        title: 'Reservation accepted',
        body: 'Your reservation was accepted.',
        relatedEntityType: 'RESERVATION',
        relatedEntityId: 'res-1',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(notificationHasNavigationTarget(notification), isTrue);
      expect(notificationActionLabel(notification), 'View reservation');
      expect(materialRequestNotificationRoute(notification), isNull);
      expect(driverDeliveryNotificationRoute(notification), isNull);
    });
  });

  group('reservation message and project comment deep links', () {
    test('reservation message routes to the reservation conversation context', () {
      final notification = AppNotification(
        id: 'msg-1',
        notificationType: 'RESERVATION_MESSAGE_RECEIVED',
        title: 'New message about your reservation',
        body: 'Workshop: Please confirm pickup.',
        relatedEntityType: 'RESERVATION',
        relatedEntityId: 'res-msg',
        actionType: 'OPEN_RESERVATION',
        metadata: const {
          'actorDisplayName': 'Majd Tech Reuse Workshop',
          'messagePreview': 'Please confirm pickup.',
        },
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(
        notificationOpenRoute(
          notification,
          isSupplierMode: false,
          isDriverMode: false,
        ),
        '/learner/reservations/res-msg?focus=messages',
      );
      expect(
        notificationOpenRoute(
          notification,
          isSupplierMode: true,
          isDriverMode: false,
        ),
        '/supplier/reservations/res-msg',
      );
      expect(
        categoryForNotification(notification),
        NotificationVisualCategory.reservation,
      );
    });

    test('missing reservation message destination does not invent a route', () {
      final notification = AppNotification(
        id: 'msg-missing',
        notificationType: 'RESERVATION_MESSAGE_RECEIVED',
        title: 'New message about your reservation',
        body: 'Workshop: Please confirm pickup.',
        relatedEntityType: 'RESERVATION',
        relatedEntityId: '',
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(
        notificationOpenRoute(
          notification,
          isSupplierMode: false,
          isDriverMode: false,
        ),
        isNull,
      );
      expect(notificationHasNavigationTarget(notification), isFalse);
    });

    test('project comment routes to the public project comments context', () {
      final notification = AppNotification(
        id: 'cmt-1',
        notificationType: 'PROJECT_COMMENT_RECEIVED',
        title: 'New comment on your project',
        body: 'Israa: Great build guide.',
        relatedEntityType: 'LEARNING_PROJECT',
        relatedEntityId: 'project-42',
        actionType: 'OPEN_ENTITY',
        metadata: const {
          'projectTitle': 'Obstacle Avoidance Robot',
          'actorDisplayName': 'Israa Learner',
          'commentPreview': 'Great build guide.',
          'commentId': 'comment-1',
        },
        isRead: false,
        createdAt: DateTime.utc(2026),
      );

      expect(
        notificationOpenRoute(
          notification,
          isSupplierMode: false,
          isDriverMode: false,
        ),
        '/learning/project-42?focus=comments',
      );
      expect(
        notificationOpenRoute(
          AppNotification(
            id: 'mod-1',
            notificationType: 'LEARNING_PROJECT_MODERATION',
            title: 'Project approved',
            body: 'Approved',
            relatedEntityType: 'LEARNING_PROJECT',
            relatedEntityId: 'project-42',
            actionType: 'OPEN_LEARNING_PROJECT_SUBMISSION',
            isRead: false,
            createdAt: DateTime.utc(2026),
          ),
          isSupplierMode: false,
          isDriverMode: false,
        ),
        '/learning/submissions/project-42',
      );
    });

    test('material request suggestion route remains the request detail', () {
      final notification = _materialRequestNotification(
        notificationType: 'MATERIAL_REQUEST_SUGGESTION',
        requestId: 'req-live',
      );
      expect(
        notificationOpenRoute(
          notification,
          isSupplierMode: false,
          isDriverMode: false,
        ),
        '/learner/material-requests/req-live',
      );
    });

    test('localizes reservation message and project comment copy', () {
      final ar = AppLocalizationsAr();
      final messageCopy = localizedNotificationCopy(
        AppNotification(
          id: 'msg-ar',
          notificationType: 'RESERVATION_MESSAGE_RECEIVED',
          title: 'New message about your reservation',
          body: 'English body',
          relatedEntityType: 'RESERVATION',
          relatedEntityId: 'res-1',
          metadata: const {
            'actorDisplayName': 'ورشة مجد',
            'messagePreview': 'أكد موعد الاستلام',
          },
          isRead: false,
          createdAt: DateTime.utc(2026),
        ),
        ar,
      );
      expect(messageCopy.title, ar.notificationReservationMessageTitle);
      expect(messageCopy.body, contains('ورشة مجد'));
      expect(messageCopy.body, contains('أكد موعد الاستلام'));

      final commentCopy = localizedNotificationCopy(
        AppNotification(
          id: 'cmt-ar',
          notificationType: 'PROJECT_COMMENT_RECEIVED',
          title: 'New comment on your project',
          body: 'English body',
          relatedEntityType: 'LEARNING_PROJECT',
          relatedEntityId: 'project-1',
          metadata: const {
            'actorDisplayName': 'إسراء',
            'commentPreview': 'شرح الخطوات واضح',
          },
          isRead: false,
          createdAt: DateTime.utc(2026),
        ),
        ar,
      );
      expect(commentCopy.title, ar.notificationProjectCommentTitle);
      expect(commentCopy.body, contains('إسراء'));
    });
  });
}
