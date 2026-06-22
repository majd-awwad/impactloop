import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

enum SupplierLocationFailure {
  permissionDenied,
  permissionDeniedForever,
  serviceDisabled,
  unavailable,
}

class SupplierLocationException implements Exception {
  const SupplierLocationException(this.failure);

  final SupplierLocationFailure failure;

  String get message {
    return switch (failure) {
      SupplierLocationFailure.permissionDenied ||
      SupplierLocationFailure.permissionDeniedForever =>
        'Location permission was denied. Enter your location manually.',
      SupplierLocationFailure.serviceDisabled ||
      SupplierLocationFailure.unavailable =>
        'Could not get current location. Please try again or enter it manually.',
    };
  }

  @override
  String toString() => message;
}

class SupplierLocationCapture {
  const SupplierLocationCapture({
    required this.latitude,
    required this.longitude,
  });

  final double latitude;
  final double longitude;
}

class SupplierLocationService {
  const SupplierLocationService();

  Future<SupplierLocationCapture> captureCurrentLocation() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw const SupplierLocationException(
          SupplierLocationFailure.serviceDisabled,
        );
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.deniedForever) {
        throw const SupplierLocationException(
          SupplierLocationFailure.permissionDeniedForever,
        );
      }

      if (permission == LocationPermission.denied) {
        throw const SupplierLocationException(
          SupplierLocationFailure.permissionDenied,
        );
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.best,
          timeLimit: Duration(seconds: 20),
        ),
      );

      if (kDebugMode) {
        debugPrint(
          '[SupplierLocation] captured lat=${position.latitude} '
          'lng=${position.longitude}',
        );
      }

      return SupplierLocationCapture(
        latitude: position.latitude,
        longitude: position.longitude,
      );
    } on SupplierLocationException {
      rethrow;
    } on LocationServiceDisabledException {
      throw const SupplierLocationException(
        SupplierLocationFailure.serviceDisabled,
      );
    } on PermissionDeniedException {
      throw const SupplierLocationException(
        SupplierLocationFailure.permissionDenied,
      );
    } catch (_) {
      throw const SupplierLocationException(
        SupplierLocationFailure.unavailable,
      );
    }
  }
}
