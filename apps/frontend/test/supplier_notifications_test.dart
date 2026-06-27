import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/supplier_portal/data/models/supplier_action_notification.dart';

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

    expect(notification.actionType,
        SupplierActionNotificationActionType.reviewRequest);
    expect(notification.reservationId, 'res-2');
  });
}

final _fixedDate = DateTime(2026, 6, 17, 10);
