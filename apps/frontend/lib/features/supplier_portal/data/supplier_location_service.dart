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
      SupplierLocationFailure.permissionDenied =>
        'Location permission is required to use your current location.',
      SupplierLocationFailure.permissionDeniedForever =>
        'Location permission is blocked. Enable it from browser or device settings.',
      SupplierLocationFailure.serviceDisabled =>
        'Please enable location services and try again.',
      SupplierLocationFailure.unavailable =>
        'Current location is not available on this browser or device.',
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
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );

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
