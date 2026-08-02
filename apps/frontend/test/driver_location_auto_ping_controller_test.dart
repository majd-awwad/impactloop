import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/features/driver_portal/application/driver_location_auto_ping_controller.dart';
import 'package:frontend/features/driver_portal/data/models/driver_delivery.dart';
import 'package:frontend/shared/location/current_location_service.dart';

void main() {
  group('isDriverAutoPingEligibleStatus', () {
    test('returns true for active assigned statuses', () {
      for (final status in driverAutoPingEligibleStatuses) {
        expect(isDriverAutoPingEligibleStatus(status), isTrue);
      }
    });

    test('returns false for DRIVER_ASSIGNED and ARRIVED_PICKUP', () {
      expect(isDriverAutoPingEligibleStatus('DRIVER_ASSIGNED'), isFalse);
      expect(isDriverAutoPingEligibleStatus('ARRIVED_PICKUP'), isFalse);
    });

    test('returns false for WAITING_FOR_DRIVER and terminal statuses', () {
      expect(isDriverAutoPingEligibleStatus('WAITING_FOR_DRIVER'), isFalse);
      expect(isDriverAutoPingEligibleStatus('DELIVERED'), isFalse);
      expect(isDriverAutoPingEligibleStatus('CANCELLED'), isFalse);
      expect(isDriverAutoPingEligibleStatus('FAILED_PICKUP'), isFalse);
      expect(isDriverAutoPingEligibleStatus('FAILED_DELIVERY'), isFalse);
    });
  });

  group('DriverLocationAutoPingController', () {
    test(
      'defaults to off until the driver explicitly enables sharing',
      () async {
        var pingCount = 0;
        final controller = DriverLocationAutoPingController(
          sendPing: () async => pingCount += 1,
        )..updateDeliveryStatus('PICKED_UP');

        await pumpEventQueue();
        expect(controller.state.enabled, isFalse);
        expect(controller.state.isSharing, isFalse);
        expect(pingCount, 0);
        controller.dispose();
      },
    );

    test('explicit backend false blocks an eligible status', () async {
      var pingCount = 0;
      final controller =
          DriverLocationAutoPingController(sendPing: () async => pingCount += 1)
            ..updateDeliveryStatus('ON_THE_WAY', canShareLocation: false)
            ..setEnabled(true);

      await pumpEventQueue();

      expect(controller.state.enabled, isTrue);
      expect(controller.state.isSharing, isFalse);
      expect(pingCount, 0);
      controller.dispose();
    });

    test(
      'starts sharing after explicit action and pings immediately',
      () async {
        final pingTimes = <DateTime>[];
        late DriverLocationAutoPingController controller;

        controller =
            DriverLocationAutoPingController(
                sendPing: () async {
                  pingTimes.add(DateTime.now());
                },
                onStateChanged: (_) {},
              )
              ..updateDeliveryStatus('PICKED_UP')
              ..setEnabled(true);

        await pumpEventQueue();

        expect(controller.state.isSharing, isTrue);
        expect(pingTimes, hasLength(1));

        controller.dispose();
      },
    );

    test('does not start for DRIVER_ASSIGNED', () async {
      final pingTimes = <int>[];
      final controller = DriverLocationAutoPingController(
        sendPing: () async {
          pingTimes.add(1);
        },
      )..updateDeliveryStatus('DRIVER_ASSIGNED');

      await pumpEventQueue();

      expect(controller.state.isSharing, isFalse);
      expect(pingTimes, isEmpty);

      controller.dispose();
    });

    test('does not start for ARRIVED_PICKUP', () async {
      final pingTimes = <int>[];
      final controller = DriverLocationAutoPingController(
        sendPing: () async {
          pingTimes.add(1);
        },
      )..updateDeliveryStatus('ARRIVED_PICKUP');

      await pumpEventQueue();

      expect(controller.state.isSharing, isFalse);
      expect(pingTimes, isEmpty);

      controller.dispose();
    });

    test('does not start for WAITING_FOR_DRIVER', () async {
      final pingTimes = <int>[];
      final controller = DriverLocationAutoPingController(
        sendPing: () async {
          pingTimes.add(1);
        },
      )..updateDeliveryStatus('WAITING_FOR_DRIVER');

      await pumpEventQueue();

      expect(controller.state.isSharing, isFalse);
      expect(pingTimes, isEmpty);

      controller.dispose();
    });

    test('does not start for DELIVERED', () async {
      final pingTimes = <int>[];
      final controller = DriverLocationAutoPingController(
        sendPing: () async {
          pingTimes.add(1);
        },
      )..updateDeliveryStatus('DELIVERED');

      await pumpEventQueue();

      expect(controller.state.isSharing, isFalse);
      expect(pingTimes, isEmpty);

      controller.dispose();
    });

    test('stops sharing on dispose', () async {
      final timers = <Timer>[];
      final controller =
          DriverLocationAutoPingController(
              sendPing: () async {},
              periodicTimerFactory: (duration, callback) {
                final timer = Timer.periodic(duration, callback);
                timers.add(timer);
                return timer;
              },
            )
            ..updateDeliveryStatus('ON_THE_WAY')
            ..setEnabled(true);

      await pumpEventQueue();
      expect(controller.state.isSharing, isTrue);
      expect(timers, isNotEmpty);

      controller.dispose();

      expect(timers.every((timer) => !timer.isActive), isTrue);
      expect(controller.state.isSharing, isFalse);
    });

    test('does not overlap pings when one is already in flight', () async {
      final completer = Completer<void>();
      var pingCount = 0;

      final controller =
          DriverLocationAutoPingController(
              sendPing: () async {
                pingCount += 1;
                if (pingCount == 1) {
                  await completer.future;
                }
              },
              periodicTimerFactory: (duration, callback) {
                final timer = Timer.periodic(
                  const Duration(milliseconds: 10),
                  callback,
                );
                return timer;
              },
              interval: const Duration(milliseconds: 10),
            )
            ..updateDeliveryStatus('PICKED_UP')
            ..setEnabled(true);

      await pumpEventQueue();
      expect(pingCount, 1);

      await Future<void>.delayed(const Duration(milliseconds: 30));
      expect(pingCount, 1);

      completer.complete();
      await pumpEventQueue();
      await Future<void>.delayed(const Duration(milliseconds: 30));

      expect(pingCount, greaterThan(1));

      controller.dispose();
    });

    test('periodic timer sends additional pings', () async {
      var pingCount = 0;
      final controller =
          DriverLocationAutoPingController(
              sendPing: () async {
                pingCount += 1;
              },
              periodicTimerFactory: (duration, callback) {
                return Timer.periodic(
                  const Duration(milliseconds: 20),
                  callback,
                );
              },
              interval: const Duration(milliseconds: 20),
            )
            ..updateDeliveryStatus('PICKED_UP')
            ..setEnabled(true);

      await pumpEventQueue();
      expect(pingCount, 1);

      await Future<void>.delayed(const Duration(milliseconds: 45));
      expect(pingCount, greaterThan(1));

      controller.dispose();
    });

    test('permission failure disables sharing and stops timer', () async {
      final timers = <Timer>[];
      final states = <DriverLocationAutoPingState>[];
      final controller =
          DriverLocationAutoPingController(
              sendPing: () async {
                throw const CurrentLocationException(
                  CurrentLocationFailure.permissionDenied,
                );
              },
              onStateChanged: states.add,
              periodicTimerFactory: (duration, callback) {
                final timer = Timer.periodic(duration, callback);
                timers.add(timer);
                return timer;
              },
            )
            ..updateDeliveryStatus('PICKED_UP')
            ..setEnabled(true);

      await pumpEventQueue();

      expect(controller.state.enabled, isFalse);
      expect(controller.state.isSharing, isFalse);
      expect(controller.state.inlineError, isNotNull);
      expect(timers.every((timer) => !timer.isActive), isTrue);

      controller.dispose();
    });

    test('setEnabled false pauses sharing', () async {
      final controller = DriverLocationAutoPingController(sendPing: () async {})
        ..updateDeliveryStatus('ON_THE_WAY')
        ..setEnabled(true);

      await pumpEventQueue();
      expect(controller.state.isSharing, isTrue);

      controller.setEnabled(false);
      expect(controller.state.isSharing, isFalse);

      controller.dispose();
    });
  });
}
