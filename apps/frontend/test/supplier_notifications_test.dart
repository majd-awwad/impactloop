import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';

import 'package:frontend/app/theme/app_theme_colors.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_action_notification.dart';
import 'package:frontend/features/supplier_portal/data/supplier_notifications_api.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/supplier_notification_style.dart';
import 'package:frontend/shared/widgets/notification_bell_button.dart';

void main() {
  test('notification JSON maps approved max unit price from DB fields', () {
    final notification = SupplierActionNotification.fromJson({
      'id': 'price:1',
      'group': 'REVIEW_UPDATE',
      'kind': 'PRICE_APPROVED',
      'title': 'Price limit approved',
      'body':
          'Maximum allowed price per piece is 20 NIS. Continue your listing and set the unit price at or below this amount.',
      'status': 'APPROVED',
      'createdAt': '2026-06-17T10:00:00.000Z',
      'actionNeeded': true,
      'isCompleted': false,
      'actionLabel': 'Continue listing',
      'actionType': 'CONTINUE_LISTING',
      'priceRuleRequestId': 'price-1',
      'maxAllowedUnitPriceNis': 20,
      'unit': 'piece',
      'supplierRequestedUnitPriceNis': 35,
    });

    expect(notification.maxAllowedUnitPriceNis, 20);
    expect(notification.unit, 'piece');
    expect(notification.supplierRequestedUnitPriceNis, 35);
  });

  testWidgets('supplier notification colors follow semantic state tokens', (
    tester,
  ) async {
    late SupplierNotificationStyle needsAction;
    late SupplierNotificationStyle waiting;
    late SupplierNotificationStyle update;
    late SupplierNotificationStyle unknown;

    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(extensions: const [AppThemeColors.light]),
        home: Builder(
          builder: (context) {
            SupplierActionNotification notification(String state) {
              return SupplierActionNotification.fromJson({
                'id': state,
                'category': 'RESERVATION',
                'state': state,
                'title': 'Notification',
                'message': 'Message',
                'createdAt': '2026-06-17T10:00:00.000Z',
                'isRead': false,
              });
            }

            needsAction = SupplierNotificationStyle.forNotification(
              context,
              notification('NEEDS_ACTION'),
            );
            waiting = SupplierNotificationStyle.forNotification(
              context,
              notification('WAITING'),
            );
            update = SupplierNotificationStyle.forNotification(
              context,
              notification('UPDATE'),
            );
            unknown = SupplierNotificationStyle.forNotification(
              context,
              notification('FUTURE_STATE'),
            );
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    expect(needsAction.badgeForeground, AppThemeColors.light.accentAmber);
    expect(waiting.badgeForeground, AppThemeColors.light.info);
    expect(update.badgeForeground, AppThemeColors.light.accentMint);
    expect(unknown.badgeForeground, AppThemeColors.light.textSecondary);
    expect(
      SupplierNotificationStyle.filterSelectedColor(
        tester.element(find.byType(SizedBox)),
        SupplierNotificationFilter.completed,
      ),
      AppThemeColors.light.primary,
    );
  });

  test('notification JSON maps price approved body with per-unit wording', () {
    final notification = SupplierActionNotification.fromJson({
      'id': 'price:1',
      'group': 'REVIEW_UPDATE',
      'kind': 'PRICE_APPROVED',
      'title': 'Price limit approved',
      'body':
          'Maximum allowed price per piece is 20 NIS. Continue your listing and set the unit price at or below this amount.',
      'status': 'APPROVED',
      'createdAt': '2026-06-17T10:00:00.000Z',
      'actionNeeded': true,
      'isCompleted': false,
      'actionLabel': 'Continue listing',
      'actionType': 'CONTINUE_LISTING',
      'priceRuleRequestId': 'price-1',
    });

    expect(notification.kind, SupplierActionNotificationKind.priceApproved);
    expect(notification.body, contains('per piece'));
    expect(notification.body, contains('20 NIS'));
  });

  test('filter action needed keeps actionable notifications only', () {
    final actionable = SupplierActionNotification(
      id: 'reservation:1',
      group: SupplierActionNotificationGroup.reservationAlert,
      kind: SupplierActionNotificationKind.reservationPending,
      title: 'New reservation request',
      body: 'Ahmad requested Arduino Uno.',
      status: SupplierActionNotificationStatus.pending,
      createdAt: _fixedDate,
      actionNeeded: true,
      actionLabel: 'Review request',
      actionType: SupplierActionNotificationActionType.reviewRequest,
      reservationId: 'res-1',
      isCompleted: false,
    );

    final pendingOnly = SupplierActionNotification(
      id: 'category:1',
      group: SupplierActionNotificationGroup.reviewUpdate,
      kind: SupplierActionNotificationKind.categoryPending,
      title: 'Category request pending',
      body: 'Waiting',
      status: SupplierActionNotificationStatus.pending,
      createdAt: _fixedDate,
      actionNeeded: false,
      isCompleted: false,
    );

    expect(
      matchesSupplierNotificationFilter(
        actionable,
        SupplierNotificationFilter.actionNeeded,
      ),
      isTrue,
    );
    expect(
      matchesSupplierNotificationFilter(
        pendingOnly,
        SupplierNotificationFilter.actionNeeded,
      ),
      isFalse,
    );
  });

  test('filter completed keeps resolved notifications only', () {
    final completed = SupplierActionNotification(
      id: 'category:done',
      group: SupplierActionNotificationGroup.reviewUpdate,
      kind: SupplierActionNotificationKind.categoryCompleted,
      title: 'Listing completed',
      body: 'Published.',
      status: SupplierActionNotificationStatus.approved,
      createdAt: _fixedDate,
      actionNeeded: false,
      isCompleted: true,
      publishedMaterialId: 'mat-1',
    );

    expect(
      matchesSupplierNotificationFilter(
        completed,
        SupplierNotificationFilter.completed,
      ),
      isTrue,
    );
  });

  test('summary JSON maps action needed count', () {
    final summary = SupplierNotificationsSummary.fromJson({
      'totalCount': 8,
      'actionNeededCount': 5,
      'reviewCount': 6,
      'reservationCount': 1,
      'completedCount': 1,
    });

    expect(summary.actionNeededCount, 5);
    expect(summary.reviewCount, 6);
  });

  test('reservation notification maps review action', () {
    final notification = SupplierActionNotification(
      id: 'reservation:2',
      group: SupplierActionNotificationGroup.reservationAlert,
      kind: SupplierActionNotificationKind.reservationPending,
      title: 'New reservation request',
      body: 'Sara requested Cotton fabric scraps.',
      status: SupplierActionNotificationStatus.pending,
      createdAt: _fixedDate,
      actionNeeded: true,
      actionLabel: 'Review request',
      actionType: SupplierActionNotificationActionType.reviewRequest,
      reservationId: 'res-2',
      isCompleted: false,
    );

    expect(
      notification.actionType,
      SupplierActionNotificationActionType.reviewRequest,
    );
    expect(notification.reservationId, 'res-2');
  });

  test(
    'canonical envelope prefers items and never concatenates alias rows',
    () {
      final result = SupplierNotificationsResult.fromJson({
        'items': [
          {
            'id': 'canonical-1',
            'rawType': 'RESERVATION_REQUESTED',
            'category': 'RESERVATION',
            'state': 'NEEDS_ACTION',
            'title': 'Canonical',
            'message': 'Review this reservation.',
            'createdAt': '2026-06-17T10:00:00.000Z',
            'isRead': false,
            'action': {
              'type': 'REVIEW_RESERVATION',
              'destination': 'SUPPLIER_RESERVATION_DETAIL',
              'target': {'entityType': 'RESERVATION', 'entityId': 'res-1'},
            },
          },
        ],
        'notifications': [
          {
            'id': 'legacy-1',
            'kind': 'CATEGORY_APPROVED',
            'title': 'Legacy',
            'body': 'Legacy body',
            'createdAt': '2026-06-17T09:00:00.000Z',
          },
        ],
        'pagination': {'page': 1, 'limit': 20, 'total': 1, 'totalPages': 1},
        'summary': {
          'total': 1,
          'unread': 1,
          'needsAction': 1,
          'waiting': 0,
          'updates': 0,
          'resolved': 0,
          'unknownState': 0,
          'reservations': 1,
          'materials': 0,
          'deliveryRecovery': 0,
          'account': 0,
          'system': 0,
          'unknownCategory': 0,
        },
      });

      expect(result.items, hasLength(1));
      expect(result.items.single.id, 'canonical-1');
      expect(result.notifications, same(result.items));
      expect(result.pagination?.total, 1);
    },
  );

  test('canonical parser falls back to alias only when items are absent', () {
    final result = SupplierNotificationsResult.fromJson({
      'notifications': [
        {
          'id': 'legacy-1',
          'kind': 'CATEGORY_REJECTED',
          'title': 'Legacy title',
          'body': 'Legacy safe body',
          'createdAt': '2026-06-17T09:00:00.000Z',
          'isCompleted': false,
        },
      ],
    });

    expect(result.items.single.id, 'legacy-1');
    expect(result.items.single.body, 'Legacy safe body');
  });

  test(
    'query maps exact backend filters and resets page for filter changes',
    () {
      final query = SupplierNotificationsQuery(
        page: 4,
        limit: 50,
        state: SupplierNotificationState.waiting,
        category: SupplierNotificationCategory.materialReview,
        isRead: false,
        search: ' price ',
        dateFrom: DateTime.utc(2026, 6, 1),
        dateTo: DateTime.utc(2026, 6, 30),
        entityType: 'PRICE_RULE_REQUEST',
      );
      final params = query.toQueryParameters();
      final resolved = query.forFilter(SupplierNotificationFilter.completed);

      expect(params['state'], 'WAITING');
      expect(params['category'], 'MATERIAL_REVIEW');
      expect(params['isRead'], false);
      expect(params['search'], 'price');
      expect(params['entityType'], 'PRICE_RULE_REQUEST');
      expect(resolved.page, 1);
      expect(params.containsKey(''), isFalse);
    },
  );

  test('summary partitions reconcile and unread is orthogonal', () {
    final summary = SupplierNotificationsSummary.fromJson({
      'total': 9,
      'unread': 4,
      'needsAction': 2,
      'waiting': 2,
      'updates': 1,
      'resolved': 3,
      'unknownState': 1,
      'reservations': 2,
      'materials': 2,
      'deliveryRecovery': 1,
      'account': 1,
      'system': 2,
      'unknownCategory': 1,
    });

    expect(
      summary.canonicalNeedsAction +
          summary.canonicalWaiting +
          summary.canonicalUpdates +
          summary.canonicalResolved +
          summary.canonicalUnknownState,
      summary.canonicalTotal,
    );
    expect(
      summary.canonicalReservations +
          summary.canonicalMaterials +
          summary.canonicalDeliveryRecovery +
          summary.canonicalAccount +
          summary.canonicalSystem +
          summary.canonicalUnknownCategory,
      summary.canonicalTotal,
    );
    expect(summary.canonicalUnread, 4);
  });

  test(
    'known destinations map safely and unknown or malformed targets fail closed',
    () {
      SupplierNotificationAction action(
        String type,
        String destination,
        String? entityType,
        String? entityId,
      ) {
        return SupplierNotificationAction.fromJson({
          'type': type,
          'destination': destination,
          'target': entityType == null
              ? null
              : {'entityType': entityType, 'entityId': entityId},
        });
      }

      expect(
        SupplierNotificationDestinationMapper.routeFor(
          action(
            'REVIEW_RESERVATION',
            'SUPPLIER_RESERVATION_DETAIL',
            'RESERVATION',
            'res-1',
          ),
        ),
        '/supplier/reservations/res-1',
      );
      expect(
        SupplierNotificationDestinationMapper.routeFor(
          action(
            'CONTINUE_LISTING',
            'SUPPLIER_ADD_MATERIAL_CATEGORY_REQUEST',
            'CATEGORY_REQUEST',
            'cat-1',
          ),
        ),
        '/supplier/materials/new?categoryRequestId=cat-1',
      );
      expect(
        SupplierNotificationDestinationMapper.routeFor(
          action(
            'EDIT_LISTING',
            'SUPPLIER_ADD_MATERIAL_PRICE_REQUEST',
            'PRICE_RULE_REQUEST',
            'price-1',
          ),
        ),
        '/supplier/materials/new?priceRuleRequestId=price-1',
      );
      expect(
        SupplierNotificationDestinationMapper.routeFor(
          action(
            'OPEN_MATERIAL',
            'SUPPLIER_MATERIAL_DETAIL',
            'MATERIAL',
            'mat-1',
          ),
        ),
        '/supplier/materials/mat-1',
      );
      expect(
        SupplierNotificationDestinationMapper.routeFor(
          action(
            'OPEN_PROFILE',
            'SUPPLIER_PROFILE',
            'SUPPLIER_PROFILE',
            'profile-1',
          ),
        ),
        '/supplier/profile',
      );
      expect(
        SupplierNotificationDestinationMapper.routeFor(
          action(
            'OPEN_MATERIAL',
            'SUPPLIER_MATERIAL_DETAIL',
            'MATERIAL',
            '../bad',
          ),
        ),
        isNull,
      );
      final unknown = SupplierActionNotification.fromJson({
        'id': 'unknown-1',
        'rawType': 'FUTURE_EVENT',
        'category': 'FUTURE_CATEGORY',
        'state': 'FUTURE_STATE',
        'title': 'Safe title',
        'message': 'Safe message',
        'createdAt': '2026-06-17T10:00:00.000Z',
        'isRead': false,
        'action': {
          'type': 'FUTURE_ACTION',
          'destination': 'FUTURE_DESTINATION',
        },
      });

      expect(unknown.isUnknown, isTrue);
      expect(unknown.action.canNavigate, isFalse);
      expect(unknown.body, 'Safe message');
      expect(unknown.isRead, isFalse);
    },
  );

  test('canonical item order is preserved without client sorting', () {
    final result = SupplierNotificationsResult.fromJson({
      'items': [
        {
          'id': 'second',
          'rawType': 'SYSTEM_NOTICE',
          'category': 'SYSTEM',
          'state': 'RESOLVED',
          'title': 'Second',
          'message': 'Second',
          'createdAt': '2026-06-17T12:00:00.000Z',
          'isRead': true,
        },
        {
          'id': 'first',
          'rawType': 'RESERVATION_REQUESTED',
          'category': 'RESERVATION',
          'state': 'NEEDS_ACTION',
          'title': 'First',
          'message': 'First',
          'createdAt': '2026-06-17T10:00:00.000Z',
          'isRead': false,
        },
      ],
    });

    expect(result.items.map((item) => item.id), ['second', 'first']);
  });

  test(
    'bell routes Supplier to the canonical inbox and preserves other roles',
    () {
      User user(String role) => User(
        id: 'user-$role',
        displayName: role,
        email: '$role@example.com',
        accountStatus: 'ACTIVE',
        roles: [role],
        activeRole: role,
        createdAt: _fixedDate,
      );

      expect(
        notificationRouteForBell(user('SUPPLIER')),
        '/supplier/notifications',
      );
      expect(notificationRouteForBell(user('LEARNER')), '/notifications');
      expect(notificationRouteForBell(user('DRIVER')), '/driver/notifications');
    },
  );

  test(
    'Supplier API uses canonical list, unread, and read endpoints',
    () async {
      final adapter = _RecordingAdapter();
      final dio = Dio()..httpClientAdapter = adapter;
      final api = SupplierNotificationsApi(dio);

      final result = await api.fetchNotifications(
        query: const SupplierNotificationsQuery(
          state: SupplierNotificationState.needsAction,
        ),
      );
      final unread = await api.fetchUnreadCount();
      await api.markRead('notification-1');
      await api.markAllRead();

      expect(result.items, isEmpty);
      expect(unread, 3);
      expect(adapter.requests[0].uri.path, '/api/supplier/notifications');
      expect(adapter.requests[0].queryParameters['state'], 'NEEDS_ACTION');
      expect(
        adapter.requests[1].uri.path,
        '/api/supplier/notifications/unread-count',
      );
      expect(
        adapter.requests[2].uri.path,
        '/api/supplier/notifications/notification-1/read',
      );
      expect(
        adapter.requests[3].uri.path,
        '/api/supplier/notifications/read-all',
      );
    },
  );
}

final _fixedDate = DateTime(2026, 6, 17, 10);

class _RecordingAdapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final data = options.uri.path.endsWith('/unread-count')
        ? {'unreadCount': 3}
        : <String, dynamic>{};
    final body = {
      'success': true,
      'data': options.uri.path == '/api/supplier/notifications'
          ? {
              'items': <Map<String, dynamic>>[],
              'pagination': {
                'page': 1,
                'limit': 20,
                'total': 0,
                'totalPages': 0,
              },
              'summary': {'total': 0},
            }
          : data,
    };
    return ResponseBody.fromString(
      jsonEncode(body),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
