import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/reverse_geocode_result.dart';

class LocationsApi {
  const LocationsApi(this._client);

  final Dio _client;

  Future<ReverseGeocodeResult> reverseGeocode({
    required double latitude,
    required double longitude,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/locations/reverse-geocode',
        data: {'latitude': latitude, 'longitude': longitude},
      ),
      ReverseGeocodeResult.fromJson,
    );
  }
}
