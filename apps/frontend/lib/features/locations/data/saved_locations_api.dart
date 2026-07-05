import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'forward_geocode_result.dart';
import 'reverse_geocode_result.dart';
import 'saved_location.dart';

class SavedLocationsApi {
  const SavedLocationsApi(this._client);

  final Dio _client;

  Future<List<SavedLocation>> fetchSavedLocations() async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/locations/saved',
      );
      final body = response.data;

      if (body == null || body['success'] != true) {
        return const <SavedLocation>[];
      }

      final rawData = body['data'];
      if (rawData is! List) {
        return const <SavedLocation>[];
      }

      return rawData
          .whereType<Map>()
          .map(
            (item) => SavedLocation.fromJson(Map<String, dynamic>.from(item)),
          )
          .where((location) => location.id.isNotEmpty)
          .toList(growable: false);
    } on DioException catch (error) {
      final mapped = mapDioException(error);
      if (mapped.statusCode == 401 || mapped.code == 'UNAUTHENTICATED') {
        return const <SavedLocation>[];
      }

      throw mapped;
    } on ApiException catch (error) {
      if (error.statusCode == 401 || error.code == 'UNAUTHENTICATED') {
        return const <SavedLocation>[];
      }

      rethrow;
    }
  }

  Future<SavedLocation> createSavedLocation(
    SavedLocationPayload payload,
  ) async {
    return _unwrapLocation(
      _client.post<Map<String, dynamic>>(
        '/api/locations/saved',
        data: payload.toCreateJson(),
      ),
    );
  }

  Future<SavedLocation> updateSavedLocation(
    String id,
    SavedLocationPayload payload,
  ) async {
    return _unwrapLocation(
      _client.patch<Map<String, dynamic>>(
        '/api/locations/saved/$id',
        data: payload.toUpdateJson(),
      ),
    );
  }

  Future<SavedLocation> setDefaultSavedLocation(String id) async {
    return _unwrapLocation(
      _client.patch<Map<String, dynamic>>(
        '/api/locations/saved/$id',
        data: const {'isDefault': true},
      ),
    );
  }

  Future<void> deleteSavedLocation(String id) async {
    await unwrapApiVoidResponse(
      _client.delete<Map<String, dynamic>>('/api/locations/saved/$id'),
    );
  }

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

  Future<ForwardGeocodeResult> forwardGeocode({
    String country = 'Palestine',
    required String city,
    String? area,
    String? addressLine,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/locations/geocode',
        data: {
          'country': country,
          'city': city,
          if (_nonEmpty(area) != null) 'area': _nonEmpty(area),
          if (_nonEmpty(addressLine) != null)
            'addressLine': _nonEmpty(addressLine),
        },
      ),
      ForwardGeocodeResult.fromJson,
    );
  }

  Future<SavedLocation> _unwrapLocation(
    Future<Response<Map<String, dynamic>>> request,
  ) {
    return unwrapApiResponse(request, SavedLocation.fromJson);
  }

  static String? _nonEmpty(String? value) {
    final normalized = value?.trim();
    return normalized == null || normalized.isEmpty ? null : normalized;
  }
}
