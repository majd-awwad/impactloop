import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/deliveries/presentation/delivery_status_presentation.dart';
import 'package:frontend/features/driver_portal/application/driver_jobs_sort_labels.dart';
import 'package:frontend/features/driver_portal/presentation/widgets/driver_route_block.dart';
import 'package:frontend/features/notifications/application/notification_display.dart';
import 'package:frontend/features/notifications/data/models/app_notification.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/l10n/app_localizations_en.dart';
import 'package:frontend/shared/l10n/driver_quantity_labels.dart';
import 'package:frontend/shared/l10n/driver_status_labels.dart';
import 'package:frontend/shared/l10n/driver_ui_labels.dart';
import 'package:frontend/shared/widgets/app_status_badge.dart';

void main() {
  final ar = AppLocalizationsAr();
  final en = AppLocalizationsEn();

  test('driver-perspective statuses differ from learner labels in Arabic', () {
    expect(
      driverDeliveryStatusLabel('DRIVER_ASSIGNED', ar),
      ar.driverStatusAssigned,
    );
    expect(
      deliveryStatusLabel('DRIVER_ASSIGNED', l10n: ar),
      isNot(ar.driverStatusAssigned),
    );
    expect(
      driverDeliveryStatusLabel('ARRIVED_PICKUP', ar),
      ar.driverStatusAtPickup,
    );
    expect(
      driverDeliveryStatusLabel('AWAITING_RESOLUTION', ar),
      ar.driverStatusAwaitingReview,
    );
    expect(
      driverDeliveryStatusLabel('DRIVER_ASSIGNED', ar),
      isNot(contains('_')),
    );
  });

  test('learner deliveryStatusLabel remains unchanged for shared statuses', () {
    expect(
      deliveryStatusLabel('DRIVER_ASSIGNED', l10n: ar),
      ar.statusDriverAssigned,
    );
    expect(
      deliveryStatusLabel('ARRIVED_PICKUP', l10n: en),
      en.statusDriverAtPickup,
    );
  });

  test('driver quantity units localize pcs/bags without raw English codes', () {
    expect(driverQuantityLabel(ar, 1, 'pcs'), isNot(contains('pcs')));
    expect(driverQuantityLabel(ar, 2, 'pieces'), isNot(contains('pieces')));
    expect(driverQuantityLabel(ar, 3, 'bags'), isNot(contains('bags')));
    expect(driverQuantityLabel(en, 1, 'pcs'), en.driverQuantityPiece(1));
    expect(driverQuantityLabel(ar, 1, 'pcs'), ar.driverQuantityPiece(1));
  });

  test('partial pickup and grouped item plurals cover Arabic dual forms', () {
    expect(
      ar.driverPartialPickupSummary(2, 2),
      'سيُسلَّم عنصران الآن. سيبقى عنصران معلّقان.',
    );
    expect(ar.driverPartialPickupSummary(0, 0), contains('أي عنصر'));
    expect(ar.driverPartialPickupSummary(1, 1), contains('عنصر واحد'));
    expect(ar.driverGroupedItemsCount(2), 'عنصران');
    expect(ar.driverArriveBeforeDelivered, startsWith('صل'));
  });

  test(
    'legacy transport ARB keys stay aligned with canonical Driver terms',
    () {
      expect(ar.driverTransportBicycle, ar.driverTransportationBicycle);
      expect(ar.driverTransportWalking, ar.driverTransportationWalking);
      expect(ar.driverTransportCar, ar.driverTransportationCar);
    },
  );

  test('jobs sort chip labels never expose raw nearest/newest codes', () {
    expect(driverJobsSortChipLabel(ar, 'nearest'), ar.driverNearest);
    expect(driverJobsSortChipLabel(ar, 'newest'), ar.driverNewest);
    expect(driverJobsSortChipLabel(ar, 'nearest'), isNot(contains('nearest')));
    expect(driverJobsSortChipLabel(ar, 'newest'), isNot(contains('newest')));
    expect(ar.driverDone, isNot(ar.supplierApply));
  });

  test(
    'incident review tones use production driverIncidentReviewTone mapping',
    () {
      expect(driverIncidentReviewTone('PENDING_REVIEW'), AppStatusTone.warning);
      expect(driverIncidentReviewTone('VERIFIED'), AppStatusTone.success);
      expect(driverIncidentReviewTone('REJECTED'), AppStatusTone.danger);
      expect(
        driverIncidentReviewTone('RESOLVED_NO_STRIKE'),
        AppStatusTone.info,
      );
      expect(driverIncidentReviewTone('UNKNOWN'), AppStatusTone.neutral);
    },
  );

  test('transport terminology is canonical across DriverUiLabels', () {
    final labels = DriverUiLabels(ar);
    expect(labels.transportType('CAR'), ar.driverTransportationCar);
    expect(labels.transportType('BICYCLE'), ar.driverTransportationBicycle);
    expect(labels.transportType('WALKING'), ar.driverTransportationWalking);
  });

  test('all known DRIVER_* notification types have specific Arabic copy', () {
    const types = [
      'DRIVER_NEW_JOB',
      'DRIVER_PICKUP_TIME',
      'DRIVER_PICKUP_REMINDER',
      'DRIVER_PICKUP_STARTING_SOON',
      'DRIVER_PICKUP_WINDOW_STARTED',
      'DRIVER_PICKUP_OVERDUE',
      'DRIVER_DROPOFF_TIME',
      'DRIVER_DROPOFF_REMINDER',
      'DRIVER_DROPOFF_STARTING_SOON',
      'DRIVER_DROPOFF_WINDOW_STARTED',
      'DRIVER_DROPOFF_OVERDUE',
      'DRIVER_DELIVERY_REQUEST_CREATED',
      'DRIVER_DELIVERY_ACCEPTED',
      'DRIVER_DELIVERY_NEXT_STEP',
      'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW',
      'DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN',
      'DELIVERY_DRIVER_ASSIGNED',
    ];

    for (final type in types) {
      final notification = AppNotification(
        id: 'n-$type',
        title: 'Legacy English title',
        body: 'Legacy English body',
        createdAt: DateTime.utc(2026, 8, 1),
        isRead: false,
        notificationType: type,
        relatedEntityType: 'DELIVERY',
        relatedEntityId: 'delivery-1',
        metadata: const {'materialTitle': 'محركات'},
      );
      final copy = localizedNotificationCopy(notification, ar);
      expect(copy.title, isNot(ar.notificationFallbackTitle), reason: type);
      expect(copy.body, isNot(ar.notificationFallbackBody), reason: type);
      expect(copy.title.toLowerCase(), isNot(contains('legacy')), reason: type);
      expect(copy.body.toLowerCase(), isNot(contains('legacy')), reason: type);
    }
  });

  testWidgets('DriverRouteBlock mirrors forward arrow in RTL', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('ar'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const Scaffold(
          body: DriverRouteBlock(
            pickupSummary: 'الخليل',
            dropoffSummary: 'نابلس',
            compact: true,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final icon = tester.widget<Icon>(
      find.byWidgetPredicate(
        (widget) =>
            widget is Icon &&
            (widget.icon == Icons.arrow_forward_rounded ||
                widget.icon == Icons.arrow_back_rounded),
      ),
    );
    expect(icon.icon, Icons.arrow_back_rounded);
    expect(find.text('الاستلام'), findsOneWidget);
    expect(find.text('التسليم'), findsOneWidget);
  });
}
