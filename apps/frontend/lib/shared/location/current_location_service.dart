import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

enum CurrentLocationFailure {
  permissionDenied,
  permissionDeniedForever,
  serviceDisabled,
  unavailable,
  timeout,
  unsupported,
}

class CurrentLocationException implements Exception {
  const CurrentLocationException(this.failure);

  final CurrentLocationFailure failure;

  String get message {
    return switch (failure) {
      CurrentLocationFailure.permissionDenied =>
        'Location permission was denied. Enable location permission or try again.',
      CurrentLocationFailure.permissionDeniedForever =>
        'Location permission is permanently denied. Enable it in settings.',
      CurrentLocationFailure.serviceDisabled =>
        'Location services are disabled. Turn on location services and try again.',
      CurrentLocationFailure.timeout =>
        'Getting your location timed out. Please try again.',
      CurrentLocationFailure.unsupported =>
        'Current location is not supported on this device or browser.',
      CurrentLocationFailure.unavailable =>
        'Could not get your current location. Please try again.',
    };
  }

  @override
  String toString() => message;
}

class CurrentLocationCapture {
  const CurrentLocationCapture({
    required this.latitude,
    required this.longitude,
    this.accuracyMeters,
    this.heading,
    this.speed,
    this.capturedAt,
  });

  final double latitude;
  final double longitude;
  final double? accuracyMeters;
  final double? heading;
  final double? speed;
  final DateTime? capturedAt;
}

class CurrentLocationService {
  const CurrentLocationService();

  Future<CurrentLocationCapture> captureCurrentLocation() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw const CurrentLocationException(
          CurrentLocationFailure.serviceDisabled,
        );
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever) {
        throw const CurrentLocationException(
          CurrentLocationFailure.permissionDeniedForever,
        );
      }

      if (permission == LocationPermission.denied) {
        throw const CurrentLocationException(
          CurrentLocationFailure.permissionDenied,
        );
      }

      if (permission == LocationPermission.unableToDetermine) {
        throw const CurrentLocationException(
          CurrentLocationFailure.unsupported,
        );
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.best,
          timeLimit: Duration(seconds: 20),
        ),
      );

      return CurrentLocationCapture(
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyMeters: position.accuracy,
        heading: position.heading,
        speed: position.speed,
        capturedAt: DateTime.now(),
      );
    } on CurrentLocationException {
      rethrow;
    } on TimeoutException {
      throw const CurrentLocationException(CurrentLocationFailure.timeout);
    } on LocationServiceDisabledException {
      throw const CurrentLocationException(
        CurrentLocationFailure.serviceDisabled,
      );
    } on PermissionDeniedException {
      throw const CurrentLocationException(
        CurrentLocationFailure.permissionDenied,
      );
    } catch (_) {
      throw const CurrentLocationException(CurrentLocationFailure.unavailable);
    }
  }
}

final currentLocationServiceProvider = Provider<CurrentLocationService>((ref) {
  return const CurrentLocationService();
});
