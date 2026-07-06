import 'dart:async';

import 'package:flutter/foundation.dart';

import '../data/models/driver_delivery.dart';

const demoTrackingPingInterval = Duration(seconds: 5);
const demoRoutePointCount = 12;

/// Debug-only demo route inside Nablus when delivery coordinates are missing.
const demoNablusPickupLatitude = 32.2211;
const demoNablusPickupLongitude = 35.2544;
const demoNablusDropoffLatitude = 32.2342;
const demoNablusDropoffLongitude = 35.2612;

bool get isDemoTrackingAllowed => kDebugMode;

const demoTrackingEligibleStatuses = {
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
};

class DemoRouteCoordinates {
  const DemoRouteCoordinates({
    required this.startLatitude,
    required this.startLongitude,
    required this.endLatitude,
    required this.endLongitude,
    required this.usesFallbackCoordinates,
  });

  final double startLatitude;
  final double startLongitude;
  final double endLatitude;
  final double endLongitude;
  final bool usesFallbackCoordinates;
}

class DemoTrackingProgress {
  const DemoTrackingProgress({
    required this.pointIndex,
    required this.pointCount,
    required this.latitude,
    required this.longitude,
  });

  final int pointIndex;
  final int pointCount;
  final double latitude;
  final double longitude;

  String get label => 'Point ${pointIndex + 1} of $pointCount';
}

List<({double latitude, double longitude})> buildDemoRoutePoints({
  required double startLatitude,
  required double startLongitude,
  required double endLatitude,
  required double endLongitude,
  int pointCount = demoRoutePointCount,
}) {
  if (pointCount < 2) {
    return [
      (latitude: startLatitude, longitude: startLongitude),
      (latitude: endLatitude, longitude: endLongitude),
    ];
  }

  return List.generate(pointCount, (index) {
    final progress = index / (pointCount - 1);
    return (
      latitude: startLatitude + (endLatitude - startLatitude) * progress,
      longitude: startLongitude + (endLongitude - startLongitude) * progress,
    );
  });
}

DemoRouteCoordinates? resolveRealDemoRouteCoordinates(DriverDelivery delivery) {
  if (!delivery.pickupLocation.hasExactCoordinates ||
      !delivery.dropoffLocation.hasExactCoordinates) {
    return null;
  }

  return DemoRouteCoordinates(
    startLatitude: delivery.pickupLocation.latitude!,
    startLongitude: delivery.pickupLocation.longitude!,
    endLatitude: delivery.dropoffLocation.latitude!,
    endLongitude: delivery.dropoffLocation.longitude!,
    usesFallbackCoordinates: false,
  );
}

DemoRouteCoordinates nablusDemoRouteCoordinates() {
  return const DemoRouteCoordinates(
    startLatitude: demoNablusPickupLatitude,
    startLongitude: demoNablusPickupLongitude,
    endLatitude: demoNablusDropoffLatitude,
    endLongitude: demoNablusDropoffLongitude,
    usesFallbackCoordinates: true,
  );
}

class DriverDemoTrackingController {
  DriverDemoTrackingController({
    required this.sendPing,
    required this.onActiveChanged,
    this.onProgressChanged,
  });

  final Future<void> Function(double latitude, double longitude) sendPing;
  final void Function(bool active) onActiveChanged;
  final void Function(DemoTrackingProgress progress)? onProgressChanged;

  Timer? _timer;
  List<({double latitude, double longitude})> _points = [];
  int _index = 0;
  bool _active = false;
  bool _sending = false;
  DemoRouteCoordinates? _route;

  bool get isActive => _active;
  DemoRouteCoordinates? get route => _route;

  static bool isStatusEligible(DriverDelivery delivery) {
    return demoTrackingEligibleStatuses.contains(delivery.status);
  }

  static bool canStart(
    DriverDelivery delivery, {
    DemoRouteCoordinates? route,
  }) {
    if (!isDemoTrackingAllowed) {
      return false;
    }
    if (!isStatusEligible(delivery)) {
      return false;
    }

    final resolved = route ?? resolveRealDemoRouteCoordinates(delivery);
    return resolved != null;
  }

  static String? disabledReason(
    DriverDelivery delivery, {
    bool demoFallbackSelected = false,
  }) {
    if (!isDemoTrackingAllowed) {
      return null;
    }
    if (!isStatusEligible(delivery)) {
      return 'Demo tracking starts after the driver picks up the material.';
    }

    final hasReal = resolveRealDemoRouteCoordinates(delivery) != null;
    if (hasReal) {
      return 'Ready to simulate route from pickup to drop-off.';
    }
    if (demoFallbackSelected) {
      return 'Demo route loaded for presentation. '
          'Demo route — not real delivery coordinates.';
    }
    return 'This delivery is missing coordinates. '
        'Use demo route coordinates for presentation.';
  }

  void start(DriverDelivery delivery, {DemoRouteCoordinates? route}) {
    final resolved = route ?? resolveRealDemoRouteCoordinates(delivery);
    if (!canStart(delivery, route: resolved)) {
      return;
    }

    stop();

    _route = resolved;
    _points = buildDemoRoutePoints(
      startLatitude: resolved!.startLatitude,
      startLongitude: resolved.startLongitude,
      endLatitude: resolved.endLatitude,
      endLongitude: resolved.endLongitude,
    );
    _index = 0;
    _active = true;
    onActiveChanged(true);
    unawaited(_sendCurrentPoint());
    _timer = Timer.periodic(demoTrackingPingInterval, (_) {
      unawaited(_advance());
    });
  }

  Future<void> _advance() async {
    if (_points.isEmpty || _sending) {
      return;
    }

    if (_index >= _points.length - 1) {
      stop();
      return;
    }

    _index += 1;
    await _sendCurrentPoint();
  }

  Future<void> _sendCurrentPoint() async {
    if (_points.isEmpty || _sending) {
      return;
    }

    final point = _points[_index];
    _sending = true;
    try {
      onProgressChanged?.call(
        DemoTrackingProgress(
          pointIndex: _index,
          pointCount: _points.length,
          latitude: point.latitude,
          longitude: point.longitude,
        ),
      );
      await sendPing(point.latitude, point.longitude);
    } finally {
      _sending = false;
    }
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    if (_active) {
      _active = false;
      onActiveChanged(false);
    }
  }

  void dispose() {
    stop();
  }
}
