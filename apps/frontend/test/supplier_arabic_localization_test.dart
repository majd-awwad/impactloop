import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_action_notification.dart';
import 'package:frontend/features/supplier_portal/data/models/supplier_incoming_request.dart';
import 'package:frontend/features/supplier_portal/data/pickup_schedule_filters.dart';
import 'package:frontend/features/supplier_portal/presentation/l10n/supplier_l10n.dart';
import 'package:frontend/features/supplier_portal/presentation/supplier_reservation_ui_helpers.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/l10n/app_localizations_en.dart';
import 'package:frontend/shared/l10n/learner_ui_labels.dart';
import 'package:frontend/shared/l10n/material_ui_labels.dart';

SupplierIncomingRequest _reservation({
  String fulfillmentMethod = 'PICKUP',
  String? fulfillmentLabel,
  Map<String, dynamic>? fulfillmentContract,
}) {
  return SupplierIncomingRequest.fromJson({
    'id': 'reservation-1',
    'status': 'ACCEPTED',
    'createdAt': '2026-07-01T08:00:00.000Z',
    'quantityRequested': 1,
    'fulfillmentMethod': fulfillmentMethod,
    'fulfillmentLabel': fulfillmentLabel,
    'fulfillmentContract': fulfillmentContract,
    'material': {'title': 'Wood scraps', 'unit': 'kg'},
    'learner': {'displayName': 'Lina'},
  });
}

void main() {
  final ar = AppLocalizationsAr();
  final en = AppLocalizationsEn();
  final supplierAr = SupplierL10n(ar);
  final materialAr = MaterialUiLabels(ar);
  final materialEn = MaterialUiLabels(en);
  final learnerAr = LearnerUiLabels(ar);
  final uiAr = SupplierReservationUiHelpers(ar);
  final uiEn = SupplierReservationUiHelpers(en);

  test('MaterialUiLabels localize condition/source/status enums in Arabic', () {
    final conditionCases = <String, String>{
      'NEW': ar.conditionNew,
      'LIKE_NEW': ar.conditionLikeNew,
      'GOOD': ar.conditionGood,
      'USED': ar.conditionUsed,
      'NEEDS_REPAIR': ar.conditionNeedsRepair,
    };
    for (final entry in conditionCases.entries) {
      expect(materialAr.condition(entry.key), entry.value);
      expect(materialAr.condition(entry.key), isNot(entry.key));
    }

    final sourceCases = <String, String>{
      'STUDENT_LEFTOVER': ar.sourceTypeStudentLeftover,
      'WORKSHOP_SURPLUS': ar.sourceTypeWorkshopSurplus,
      'FACTORY_SURPLUS': ar.sourceTypeFactorySurplus,
      'EDUCATIONAL_INSTITUTION': ar.sourceTypeEducationalInstitution,
    };
    for (final entry in sourceCases.entries) {
      expect(materialAr.sourceType(entry.key), entry.value);
      expect(materialAr.sourceType(entry.key), isNot(entry.key));
    }

    final statusCases = <String, String>{
      'AVAILABLE': ar.materialStatusAvailable,
      'PENDING_RESERVATION': ar.materialStatusPendingReservation,
      'RESERVED': ar.materialStatusReserved,
      'REUSED': ar.materialStatusReused,
      'UNAVAILABLE': ar.materialStatusUnavailable,
    };
    for (final entry in statusCases.entries) {
      expect(materialAr.materialStatus(entry.key), entry.value);
      expect(materialAr.materialStatus(entry.key), isNot(entry.key));
      expect(materialAr.materialStatus(entry.key), isNot('AVAILABLE'));
    }
  });

  test('MaterialUiLabels unknown values never appear raw or as available', () {
    expect(materialAr.condition('BRAND_NEW'), ar.unknownStatus);
    expect(materialAr.condition('BRAND_NEW'), isNot('BRAND_NEW'));
    expect(materialEn.condition('BRAND_NEW'), en.unknownStatus);

    expect(materialAr.sourceType('RANDOM_SOURCE'), ar.unknownStatus);
    expect(materialAr.sourceType('RANDOM_SOURCE'), isNot('RANDOM_SOURCE'));
    expect(materialEn.sourceType('RANDOM_SOURCE'), en.unknownStatus);

    expect(materialAr.materialStatus('ARCHIVED'), ar.unknownStatus);
    expect(materialAr.materialStatus('ARCHIVED'), isNot('ARCHIVED'));
    expect(
      materialAr.materialStatus('ARCHIVED'),
      isNot(ar.materialStatusAvailable),
    );
    expect(materialEn.materialStatus('SOMETHING_ELSE'), en.unknownStatus);
    expect(
      materialEn.materialStatus('SOMETHING_ELSE'),
      isNot(en.materialStatusAvailable),
    );
  });

  test(
    'fulfillment labels use localized pickup/delivery never model labels',
    () {
      final pickup = _reservation(
        fulfillmentMethod: 'PICKUP',
        fulfillmentLabel: 'Pickup selected',
        fulfillmentContract: {
          'fulfillmentMethod': 'PICKUP',
          'label': 'English contract label',
        },
      );
      final delivery = _reservation(
        fulfillmentMethod: 'DELIVERY',
        fulfillmentLabel: 'Delivery selected',
        fulfillmentContract: {
          'fulfillmentMethod': 'DELIVERY',
          'label': 'Driver delivery',
        },
      );

      expect(uiAr.fulfillmentMethodLabel(pickup), ar.supplierSelfPickup);
      expect(uiEn.fulfillmentMethodLabel(pickup), en.supplierSelfPickup);
      expect(
        uiAr.fulfillmentMethodLabel(pickup),
        isNot('English contract label'),
      );
      expect(uiAr.fulfillmentMethodLabel(pickup), isNot('Pickup selected'));

      expect(uiAr.fulfillmentMethodLabel(delivery), ar.delivery);
      expect(uiEn.fulfillmentMethodLabel(delivery), en.delivery);
      expect(uiAr.fulfillmentMethodLabel(delivery), isNot('Driver delivery'));
      expect(uiAr.fulfillmentMethodLabel(delivery), isNot('Delivery selected'));

      expect(uiAr.pickupTypeLabel('PICKUP'), ar.supplierSelfPickup);
      expect(uiEn.pickupTypeLabel('DELIVERY'), en.delivery);
      expect(uiAr.pickupTypeLabel('SELF_PICKUP'), ar.supplierSelfPickup);
      expect(uiAr.pickupTypeLabel('WEIRD_VALUE'), ar.unknownStatus);
      expect(uiEn.pickupTypeLabel('WEIRD_VALUE'), en.unknownStatus);
      expect(uiAr.pickupTypeLabel('WEIRD_VALUE'), isNot('WEIRD_VALUE'));
    },
  );

  test('formatScheduleDateLabel converts UTC to local calendar day', () {
    final nowLocal = DateTime.now();
    final todayLocal = DateTime(nowLocal.year, nowLocal.month, nowLocal.day);
    final tomorrowLocal = todayLocal.add(const Duration(days: 1));

    // Choose a UTC instant that is still "today" locally near midday, then a
    // boundary UTC instant whose local calendar day is tomorrow.
    final todayUtcMidday = DateTime.utc(
      todayLocal.year,
      todayLocal.month,
      todayLocal.day,
      12,
    );
    expect(uiEn.formatScheduleDateLabel(todayUtcMidday), en.supplierToday);
    expect(uiAr.formatScheduleDateLabel(todayUtcMidday), ar.supplierToday);

    final utcCrossingIntoTomorrowLocal = DateTime.utc(
      tomorrowLocal.year,
      tomorrowLocal.month,
      tomorrowLocal.day,
    ).subtract(const Duration(hours: 1));
    final localFromBoundary = utcCrossingIntoTomorrowLocal.toLocal();
    final localDay = DateTime(
      localFromBoundary.year,
      localFromBoundary.month,
      localFromBoundary.day,
    );

    // Only assert when the UTC timestamp actually lands on a different local day.
    if (localDay == tomorrowLocal) {
      expect(
        uiEn.formatScheduleDateLabel(utcCrossingIntoTomorrowLocal),
        en.supplierTomorrow,
      );
      expect(
        uiAr.formatScheduleDateLabel(utcCrossingIntoTomorrowLocal),
        ar.supplierTomorrow,
      );
      expect(
        pickupScheduleDateOnly(utcCrossingIntoTomorrowLocal),
        tomorrowLocal,
      );
    } else if (localDay == todayLocal) {
      expect(
        uiEn.formatScheduleDateLabel(utcCrossingIntoTomorrowLocal),
        en.supplierToday,
      );
    }

    // Explicit local-day extraction parity with grouping helper.
    final lateUtc = DateTime.utc(
      todayLocal.year,
      todayLocal.month,
      todayLocal.day,
      22,
    );
    expect(
      pickupScheduleDateOnly(lateUtc),
      DateTime(
        lateUtc.toLocal().year,
        lateUtc.toLocal().month,
        lateUtc.toLocal().day,
      ),
    );
  });

  test('SupplierL10n count badges delegate to ARB plurals', () {
    expect(
      supplierAr.materialRequestsBadge(1),
      ar.supplierMaterialRequestsBadge(1),
    );
    expect(
      supplierAr.materialRequestsBadge(3),
      ar.supplierMaterialRequestsBadge(3),
    );
    expect(
      SupplierL10n(en).materialsResultCount(2),
      en.supplierMaterialsResultCount(2),
    );
    expect(
      supplierAr.activeRequestsLabel(1),
      ar.supplierActiveRequestsLabel(1),
    );
    expect(
      supplierAr.demandCountLabel(2, 5),
      ar.supplierDemandCountLabel(2, 5),
    );
    expect(supplierAr.materialRequestsBadge(1), isNot(contains('request')));
  });

  test(
    'LearnerUiLabels reservation/delivery statuses localize for supplier',
    () {
      expect(learnerAr.reservationStatus('NO_SHOW'), ar.pickupMissed);
      expect(
        learnerAr.reservationStatus('FULFILLMENT_FAILED'),
        ar.statusFulfillmentFailed,
      );
      expect(
        learnerAr.reservationStatus('AWAITING_RESOLUTION'),
        ar.statusPendingAdminReview,
      );
      expect(learnerAr.deliveryStatus('ON_THE_WAY'), ar.statusOnTheWay);
      expect(learnerAr.reservationStatus('NO_SHOW'), isNot('NO_SHOW'));
      expect(ar.statusLearnerNoShow, isNot(en.statusLearnerNoShow));
      expect(
        supplierAr.incomingRequestStatusLabel(
          SupplierIncomingRequestStatus.noShow,
        ),
        ar.statusLearnerNoShow,
      );
    },
  );

  test('SupplierL10n incomingRequestStatusLabel uses Arabic ARB strings', () {
    final cases = <SupplierIncomingRequestStatus, String>{
      SupplierIncomingRequestStatus.noShow: ar.statusLearnerNoShow,
      SupplierIncomingRequestStatus.fulfillmentFailed:
          ar.statusFulfillmentFailed,
      SupplierIncomingRequestStatus.needsResolution: ar.statusNeedsAdminReview,
    };

    for (final entry in cases.entries) {
      final label = supplierAr.incomingRequestStatusLabel(entry.key);
      expect(label, entry.value);
      expect(label, isNot(contains('no-show')));
      expect(label, isNot(contains('Fulfillment')));
      expect(label, isNot(contains('Needs admin')));
    }
  });

  test(
    'localizedSupplierNotificationCopy for RESERVATION_REQUESTED uses Arabic title',
    () {
      final notification = SupplierActionNotification(
        id: 'supplier-notif-1',
        group: SupplierActionNotificationGroup.reservationAlert,
        kind: SupplierActionNotificationKind.reservationPending,
        title: 'New reservation request',
        body: 'Legacy English body from server',
        status: SupplierActionNotificationStatus.pending,
        createdAt: DateTime.utc(2026),
        actionNeeded: true,
        isCompleted: false,
        rawType: 'RESERVATION_REQUESTED',
        category: SupplierNotificationCategory.reservation,
        state: SupplierNotificationState.needsAction,
        metadata: const {
          'materialTitle': 'Arduino Uno',
          'learnerName': 'Majd Learner',
        },
      );

      final copy = localizedSupplierNotificationCopy(notification, ar);

      expect(copy.title, ar.notificationReservationRequestedTitle);
      expect(copy.title, isNot('New reservation request'));
      expect(copy.body, isNot(contains('Legacy English body')));
      expect(copy.body, contains('Arduino Uno'));
    },
  );

  test(
    'localizedApiErrorMessage for RESERVATION_ALREADY_ACCEPTED in Arabic',
    () {
      const error = ApiException(
        message: 'Reservation already accepted by another supplier',
        code: 'RESERVATION_ALREADY_ACCEPTED',
        statusCode: 409,
      );

      expect(
        localizedApiErrorMessage(error, ar),
        ar.reservationAlreadyAccepted,
      );
      expect(
        localizedApiErrorMessage(error, en),
        en.reservationAlreadyAccepted,
      );
      expect(
        localizedApiErrorMessage(error, ar),
        isNot(contains('accepted by')),
      );
    },
  );

  test(
    'supplier ARB keys conditionNew and notificationReservationRequestedTitle exist',
    () {
      expect(ar.conditionNew, isNotEmpty);
      expect(ar.notificationReservationRequestedTitle, isNotEmpty);
      expect(en.conditionNew, isNotEmpty);
      expect(en.notificationReservationRequestedTitle, isNotEmpty);
      expect(ar.conditionNew, isNot(en.conditionNew));
      expect(
        ar.notificationReservationRequestedTitle,
        isNot(en.notificationReservationRequestedTitle),
      );
    },
  );
}
