import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/deliveries/presentation/delivery_status_presentation.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/features/driver_portal/presentation/driver_delivery_timing_presentation.dart';
import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/l10n/app_localizations_en.dart';
import 'package:frontend/shared/l10n/driver_ui_labels.dart';
import 'package:frontend/shared/location/current_location_service.dart';

DriverDelivery _delivery({
  String status = 'DRIVER_ASSIGNED',
  String? nextStatus = 'ARRIVED_PICKUP',
  DateTime? supplierPickupWindowStart,
  DateTime? supplierPickupWindowEnd,
  DateTime? confirmedDeliveryWindowStart,
  DateTime? confirmedDeliveryWindowEnd,
}) {
  return DriverDelivery.fromJson({
    'id': 'delivery-1',
    'reservationId': 'reservation-1',
    'status': status,
    'nextStatus': nextStatus,
    'requestedAt': '2026-07-01T08:00:00.000Z',
    'material': {
      'id': 'material-1',
      'title': 'Arduino',
      'quantityRequested': 1,
      'unit': 'pcs',
    },
    'supplier': {'displayName': 'Supplier'},
    'pickupLocation': {'city': 'Hebron'},
    'dropoffLocation': {'city': 'Nablus'},
    if (supplierPickupWindowStart != null)
      'supplierPickupWindowStart': supplierPickupWindowStart
          .toUtc()
          .toIso8601String(),
    if (supplierPickupWindowEnd != null)
      'supplierPickupWindowEnd': supplierPickupWindowEnd
          .toUtc()
          .toIso8601String(),
    if (confirmedDeliveryWindowStart != null)
      'confirmedDeliveryWindowStart': confirmedDeliveryWindowStart
          .toUtc()
          .toIso8601String(),
    if (confirmedDeliveryWindowEnd != null)
      'confirmedDeliveryWindowEnd': confirmedDeliveryWindowEnd
          .toUtc()
          .toIso8601String(),
  });
}

void main() {
  final ar = AppLocalizationsAr();
  final en = AppLocalizationsEn();
  final labelsAr = DriverUiLabels(ar);
  final labelsEn = DriverUiLabels(en);

  test('delivery statuses localize for Driver via shared labels', () {
    const statuses = [
      'WAITING_FOR_DRIVER',
      'DRIVER_ASSIGNED',
      'ARRIVED_PICKUP',
      'PICKED_UP',
      'ON_THE_WAY',
      'ARRIVED_DROPOFF',
      'DELIVERED',
      'CANCELLED',
      'FAILED_PICKUP',
      'FAILED_DELIVERY',
      'DRIVER_NO_SHOW',
      'LEARNER_NO_SHOW',
      'AWAITING_RESOLUTION',
    ];

    for (final status in statuses) {
      final arabic = deliveryStatusLabel(status, l10n: ar);
      final english = deliveryStatusLabel(status, l10n: en);
      expect(arabic, isNot(status));
      expect(arabic, isNot(english));
      expect(arabic, isNot(contains('_')));
      expect(english, isNotEmpty);
    }

    expect(
      deliveryStatusLabel('FUTURE_UNKNOWN_STATUS', l10n: ar),
      ar.unknownStatus,
    );
  });

  test('DriverUiLabels map failure, closure, and transport codes', () {
    expect(
      labelsAr.failurePickupReason('SUPPLIER_UNAVAILABLE'),
      ar.driverFailureSupplierUnavailable,
    );
    expect(labelsAr.failurePickupReason('NOT_A_REAL_REASON'), ar.unknownStatus);
    expect(
      labelsAr.failureDeliveryReason('LEARNER_UNAVAILABLE'),
      ar.driverFailureLearnerUnavailable,
    );
    expect(labelsAr.failureDeliveryReason('BOGUS'), ar.unknownStatus);
    expect(
      labelsAr.inactiveClosureReason('MOVED_TO_ADMIN_REVIEW'),
      ar.driverInactiveMovedToAdminReview,
    );
    expect(
      labelsAr.inactiveClosureReason('NO_LONGER_ACTIVE'),
      ar.driverInactiveNoLongerActive,
    );
    expect(labelsAr.inactiveClosureReason(null), ar.unknownStatus);
    expect(labelsAr.inactiveClosureReason('OTHER'), ar.unknownStatus);
    expect(
      labelsAr.transportType('MOTORCYCLE'),
      ar.driverTransportationMotorcycle,
    );
    expect(labelsAr.transportType('HOVERBOARD'), ar.unknownStatus);
  });

  test('location and party fallbacks localize without English model copy', () {
    expect(labelsAr.locationSummary(''), ar.driverLocationUnavailableShort);
    expect(labelsAr.locationSummary('  '), ar.driverLocationUnavailableShort);
    expect(labelsAr.locationSummary('الخليل'), 'الخليل');
    expect(labelsAr.partyDisplayName(''), ar.driverUnknownParty);
    expect(labelsAr.partyDisplayName('أحمد'), 'أحمد');
    expect(labelsAr.materialTitle(''), ar.material);
    expect(labelsAr.groupedItemsCount(1), isNot(contains('item')));
    expect(labelsEn.groupedItemsCount(2), contains('2'));
  });

  test('location errors localize by failure enum', () {
    expect(
      labelsAr.locationFailure(CurrentLocationFailure.permissionDenied),
      ar.driverLocationPermissionDenied,
    );
    expect(
      labelsAr.locationFailure(CurrentLocationFailure.serviceDisabled),
      ar.driverLocationServicesDisabled,
    );
    expect(
      labelsAr.locationFailure(CurrentLocationFailure.unavailable),
      ar.driverCurrentLocationFailed,
    );
    expect(
      labelsAr.locationError(
        const CurrentLocationException(CurrentLocationFailure.permissionDenied),
      ),
      ar.driverLocationPermissionDenied,
    );
    expect(
      labelsAr.locationError(Exception('x')),
      ar.driverCouldNotShareLocation,
    );
  });

  test('next-action guidance localizes progression labels', () {
    final cases = <String, String>{
      'DRIVER_ASSIGNED': ar.driverArriveAtPickup,
      'ARRIVED_PICKUP': ar.driverMarkPickedUp,
      'PICKED_UP': ar.driverStartDeliveryOnTheWay,
      'ON_THE_WAY': ar.driverArriveAtDropoff,
      'ARRIVED_DROPOFF': ar.driverMarkDelivered,
    };

    for (final entry in cases.entries) {
      final guidance = buildDriverNextActionGuidance(
        _delivery(
          status: entry.key,
          confirmedDeliveryWindowStart: DateTime.now().subtract(
            const Duration(hours: 1),
          ),
          confirmedDeliveryWindowEnd: DateTime.now().add(
            const Duration(hours: 2),
          ),
          supplierPickupWindowStart: DateTime.now().subtract(
            const Duration(hours: 1),
          ),
          supplierPickupWindowEnd: DateTime.now().add(const Duration(hours: 2)),
        ),
        l10n: ar,
      );
      expect(guidance.actionLabel, entry.value);
      expect(guidance.actionLabel, isNot(contains('_')));
    }

    final terminal = buildDriverNextActionGuidance(
      _delivery(status: 'DELIVERED', nextStatus: null),
      l10n: ar,
    );
    expect(terminal.actionLabel, ar.driverNoNextAction);
  });

  test('timing gates use localized titles when blocked', () {
    final now = DateTime(2026, 7, 1, 12);
    final early = evaluatePickupHandoverTiming(
      _delivery(
        status: 'ARRIVED_PICKUP',
        nextStatus: 'PICKED_UP',
        supplierPickupWindowStart: now.add(const Duration(hours: 3)),
        supplierPickupWindowEnd: now.add(const Duration(hours: 4)),
      ),
      l10n: ar,
      now: now,
    );
    expect(early.isBlocked, isTrue);
    expect(early.title, ar.driverPickupNotAvailableYet);
    expect(early.remainingLabel, isNotNull);

    final noWindow = evaluateDeliveryHandoverTiming(
      _delivery(status: 'ARRIVED_DROPOFF', nextStatus: 'DELIVERED'),
      l10n: ar,
      now: now,
    );
    expect(noWindow.isBlocked, isTrue);
    expect(noWindow.title, ar.driverDeliveryWindowNotSet);
  });

  test('Arabic driver notifications never prefer legacy English bodies', () {
    const types = [
      'DRIVER_NEW_JOB',
      'DRIVER_PICKUP_TIME',
      'DRIVER_DROPOFF_TIME',
      'DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN',
      'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW',
    ];

    for (final type in types) {
      final copy = localizedNotificationCopy(
        AppNotification(
          id: type,
          notificationType: type,
          title: 'Legacy English title',
          body: 'Legacy English body from server',
          relatedEntityType: 'DELIVERY',
          relatedEntityId: 'delivery-1',
          metadata: const {'materialTitle': 'Arduino Uno'},
          isRead: false,
          createdAt: DateTime.utc(2026),
        ),
        ar,
      );
      expect(copy.title, isNot(contains('Legacy')));
      expect(copy.body, isNot(contains('Legacy English body')));
    }
  });

  test('empty location party model fields stay locale-neutral', () {
    final party = DriverDeliveryParty.fromJson(const {});
    final location = DriverSafeLocation.fromJson(const {});
    expect(party.displayName, isEmpty);
    expect(location.safeSummary, isEmpty);
    expect(location.exactSummary, isEmpty);
    expect(labelsAr.partyDisplayName(party.displayName), ar.driverUnknownParty);
    expect(
      labelsAr.locationSummary(location.exactSummary),
      ar.driverLocationUnavailableShort,
    );
  });
}
