import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/deliveries/data/models/learner_delivery.dart';
import 'package:frontend/features/deliveries/presentation/learner_delivery_windows.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/l10n/app_localizations_en.dart';
import 'package:frontend/shared/l10n/learner_ui_labels.dart';

LearnerDelivery _delivery({
  required String status,
  String? supplierPickupStart,
  String? supplierPickupEnd,
  String? pickupStart,
  String? pickupEnd,
  String? confirmedStart,
  String? confirmedEnd,
  bool canTrack = false,
}) {
  return LearnerDelivery.fromJson({
    'id': 'del-1',
    'reservationId': 'res-1',
    'status': status,
    'requestedAt': '2026-08-18T08:00:00.000Z',
    'canTrack': canTrack,
    'reservation': {
      'id': 'res-1',
      'status': 'ACCEPTED',
      'material': {'id': 'mat-1', 'title': 'Wood', 'status': 'RESERVED'},
      'supplier': {'id': 'sup-1', 'displayName': 'Supplier'},
      if (pickupStart != null) 'pickupWindowStart': pickupStart,
      if (pickupEnd != null) 'pickupWindowEnd': pickupEnd,
      if (supplierPickupStart != null)
        'supplierPickupWindowStart': supplierPickupStart,
      if (supplierPickupEnd != null)
        'supplierPickupWindowEnd': supplierPickupEnd,
      if (confirmedStart != null) 'confirmedDeliveryWindowStart': confirmedStart,
      if (confirmedEnd != null) 'confirmedDeliveryWindowEnd': confirmedEnd,
    },
    'pickupLocation': {
      'id': 'loc-1',
      'country': 'PS',
      'city': 'Nablus',
      'area': 'Old City',
    },
    'dropoffLocation': {
      'id': 'loc-2',
      'country': 'PS',
      'city': 'Ramallah',
    },
  });
}

void main() {
  const supplierStart = '2026-08-18T07:00:00.000Z';
  const supplierEnd = '2026-08-18T09:00:00.000Z';
  const derivedStart = '2026-08-18T10:00:00.000Z';
  const derivedEnd = '2026-08-18T12:00:00.000Z';
  const operationalStart = '2026-08-18T16:00:00.000Z';
  const operationalEnd = '2026-08-18T18:00:00.000Z';
  const retryStart = '2026-08-19T15:00:00.000Z';
  const retryEnd = '2026-08-19T17:00:00.000Z';

  final en = AppLocalizationsEn();
  final ar = AppLocalizationsAr();

  test(
    'A: assigned driver before pickup keeps supplier window separate from learner appointment',
    () {
      final delivery = _delivery(
        status: 'DRIVER_ASSIGNED',
        supplierPickupStart: supplierStart,
        supplierPickupEnd: supplierEnd,
        confirmedStart: derivedStart,
        confirmedEnd: derivedEnd,
      );

      expect(hasSupplierPickupAvailability(delivery.reservation), isTrue);
      expect(
        learnerSupplierPickupWindowValue(delivery.reservation, en),
        isNot(en.pickupWindowNotSet),
      );
      expect(
        learnerSupplierPickupWindowValue(delivery.reservation, en),
        isNot(contains('4:00')),
      );

      final appointment = resolveLearnerDeliveryAppointment(delivery);
      expect(appointment.kind, LearnerDeliveryAppointmentKind.notScheduled);
      expect(appointment.showsOperationalWindow, isFalse);

      final copy = learnerDeliveryAppointmentCopy(delivery, en);
      expect(copy.label, en.learnerDeliveryAppointment);
      expect(copy.value, en.learnerDeliveryNotScheduled);
      expect(copy.helper, en.learnerDeliveryNotScheduledHelper);

      final tracking = learnerDeliveryStatusTrackingBody(delivery, en);
      expect(tracking, contains(en.driverAssigned));
      expect(tracking, contains(en.driverWillCollectFromSupplierFirst));
    },
  );

  test(
    'B: PICKED_UP without a driver-set window does not invent an appointment',
    () {
      final delivery = _delivery(
        status: 'PICKED_UP',
        supplierPickupStart: supplierStart,
        supplierPickupEnd: supplierEnd,
        canTrack: true,
      );

      final appointment = resolveLearnerDeliveryAppointment(delivery);
      expect(appointment.kind, LearnerDeliveryAppointmentKind.notScheduled);
      expect(
        learnerDeliveryAppointmentCopy(delivery, en).value,
        en.learnerDeliveryNotScheduled,
      );
      expect(
        learnerSupplierPickupWindowValue(delivery.reservation, en),
        isNot(en.learnerDeliveryNotScheduled),
      );
    },
  );

  test(
    'C: PICKED_UP with a driver delivery window shows the real learner appointment',
    () {
      final delivery = _delivery(
        status: 'PICKED_UP',
        supplierPickupStart: supplierStart,
        supplierPickupEnd: supplierEnd,
        confirmedStart: operationalStart,
        confirmedEnd: operationalEnd,
        canTrack: true,
      );

      final appointment = resolveLearnerDeliveryAppointment(delivery);
      expect(appointment.kind, LearnerDeliveryAppointmentKind.scheduled);
      expect(appointment.start, DateTime.parse(operationalStart));
      expect(appointment.end, DateTime.parse(operationalEnd));

      final copy = learnerDeliveryAppointmentCopy(delivery, en);
      expect(copy.label, en.learnerDeliveryAppointment);
      expect(copy.value, isNot(en.learnerDeliveryNotScheduled));
      expect(copy.helper, isNull);
    },
  );

  test(
    'D: REDELIVERY_PENDING does not present the old window as the active appointment',
    () {
      final delivery = _delivery(
        status: 'REDELIVERY_PENDING',
        supplierPickupStart: supplierStart,
        supplierPickupEnd: supplierEnd,
        confirmedStart: operationalStart,
        confirmedEnd: operationalEnd,
      );

      expect(delivery.reservation.confirmedDeliveryWindowStart, isNotNull);
      final appointment = resolveLearnerDeliveryAppointment(delivery);
      expect(
        appointment.kind,
        LearnerDeliveryAppointmentKind.redeliveryPending,
      );
      expect(appointment.showsOperationalWindow, isFalse);

      final copy = learnerDeliveryAppointmentCopy(delivery, en);
      expect(copy.value, en.learnerRedeliveryNeedsScheduling);
      expect(copy.helper, en.learnerRedeliveryNeedsSchedulingHelper);
      expect(copy.value, isNot(contains('4:00')));
    },
  );

  test(
    'E: REDELIVERY_SCHEDULED shows the retry window as the learner appointment',
    () {
      final delivery = _delivery(
        status: 'REDELIVERY_SCHEDULED',
        supplierPickupStart: supplierStart,
        supplierPickupEnd: supplierEnd,
        confirmedStart: retryStart,
        confirmedEnd: retryEnd,
      );

      final appointment = resolveLearnerDeliveryAppointment(delivery);
      expect(appointment.kind, LearnerDeliveryAppointmentKind.scheduled);
      expect(appointment.start, DateTime.parse(retryStart));
      expect(appointment.end, DateTime.parse(retryEnd));

      final copy = learnerDeliveryAppointmentCopy(delivery, en);
      expect(copy.label, en.learnerDeliveryAppointment);
      expect(copy.value, isNot(en.learnerRedeliveryNeedsScheduling));
      expect(copy.value, isNot(en.learnerDeliveryNotScheduled));
    },
  );

  test('F: Arabic and English learner delivery labels stay distinct and correct', () {
    expect(en.learnerDriverPickupWindow, 'Driver pickup from supplier');
    expect(ar.learnerDriverPickupWindow, 'موعد استلام السائق من المورد');
    expect(en.learnerDeliveryAppointment, 'Delivery to you');
    expect(ar.learnerDeliveryAppointment, 'موعد التوصيل إليك');
    expect(en.learnerDeliveryNotScheduled, startsWith('Delivery time has not'));
    expect(ar.learnerDeliveryNotScheduled, 'لم يتم تحديد موعد التوصيل بعد');
    expect(ar.learnerDriverPickupWindow, isNot(ar.pickupWindow));
    expect(ar.learnerDeliveryAppointment, isNot(ar.pickupWindow));
    expect(ar.learnerDeliveryAppointment, isNot(ar.driverDeliveryWindow));

    final assigned = _delivery(
      status: 'DRIVER_ASSIGNED',
      supplierPickupStart: supplierStart,
      supplierPickupEnd: supplierEnd,
      confirmedStart: derivedStart,
      confirmedEnd: derivedEnd,
    );
    final arCopy = learnerDeliveryAppointmentCopy(assigned, ar);
    expect(arCopy.label, ar.learnerDeliveryAppointment);
    expect(arCopy.value, ar.learnerDeliveryNotScheduled);
    expect(arCopy.helper, ar.learnerDeliveryNotScheduledHelper);

    final labels = LearnerUiLabels(ar);
    expect(labels.deliveryStatus('DRIVER_ASSIGNED'), ar.statusDriverAssigned);
    expect(labels.deliveryStatus('PICKED_UP'), ar.statusPickedUp);
    expect(ar.statusPickedUp, contains('المورد'));
    expect(en.statusPickedUp.toLowerCase(), contains('collected'));
    expect(en.statusOnTheWay.toLowerCase(), contains('to you'));
  });

  test('placeholder confirmed window before pickup is never treated as scheduled', () {
    final delivery = _delivery(
      status: 'ARRIVED_PICKUP',
      pickupStart: supplierStart,
      pickupEnd: supplierEnd,
      confirmedStart: derivedStart,
      confirmedEnd: derivedEnd,
    );

    expect(hasConfirmedLearnerDeliveryWindow(delivery.reservation), isTrue);
    expect(
      resolveLearnerDeliveryAppointment(delivery).kind,
      LearnerDeliveryAppointmentKind.notScheduled,
    );
  });
}
