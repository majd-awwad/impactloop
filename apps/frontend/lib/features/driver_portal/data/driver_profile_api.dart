import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/driver_operational_profile.dart';

class DriverProfileApi {
  const DriverProfileApi(this._client);

  final Dio _client;

  Future<DriverOperationalProfile> fetchProfile() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/driver/profile'),
      DriverOperationalProfile.fromJson,
    );
  }

  Future<DriverOperationalProfile> updateProfile(
    UpdateDriverOperationalProfileRequest request,
  ) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/driver/profile',
        data: request.toJson(),
      ),
      DriverOperationalProfile.fromJson,
    );
  }

  Future<DriverOperationalProfile> updateAvailability(
    UpdateDriverAvailabilityRequest request,
  ) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/driver/profile/availability',
        data: request.toJson(),
      ),
      DriverOperationalProfile.fromJson,
    );
  }
}
