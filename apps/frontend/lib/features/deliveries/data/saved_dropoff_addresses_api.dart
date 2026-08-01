import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/saved_dropoff_address.dart';

class SavedDropoffAddressesApi {
  const SavedDropoffAddressesApi(this._client);

  final Dio _client;

  Future<List<SavedDropoffAddress>> fetchSavedAddresses() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/learner/saved-dropoff-addresses'),
      (json) {
        final items = json['items'];
        if (items is! List) {
          return const <SavedDropoffAddress>[];
        }

        return items
            .whereType<Map>()
            .map(
              (item) =>
                  SavedDropoffAddress.fromJson(Map<String, dynamic>.from(item)),
            )
            .toList(growable: false);
      },
    );
  }

  Future<SavedDropoffAddress> createSavedAddress({
    required String label,
    required SavedDropoffLocation location,
    bool isDefault = false,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/learner/saved-dropoff-addresses',
        data: {
          'label': label,
          'location': location.toJson(),
          'isDefault': isDefault,
        },
      ),
      (json) => SavedDropoffAddress.fromJson(
        Map<String, dynamic>.from(json['savedAddress'] as Map? ?? const {}),
      ),
    );
  }

  Future<SavedDropoffAddress> updateSavedAddress(
    String id, {
    String? label,
    SavedDropoffLocation? location,
    bool? isDefault,
  }) {
    final data = <String, dynamic>{};
    if (label != null) data['label'] = label;
    if (location != null) data['location'] = location.toJson();
    if (isDefault != null) data['isDefault'] = isDefault;

    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/learner/saved-dropoff-addresses/$id',
        data: data,
      ),
      (json) => SavedDropoffAddress.fromJson(
        Map<String, dynamic>.from(json['savedAddress'] as Map? ?? const {}),
      ),
    );
  }

  Future<void> deleteSavedAddress(String id) {
    return unwrapApiResponse(
      _client.delete<Map<String, dynamic>>(
        '/api/learner/saved-dropoff-addresses/$id',
      ),
      (_) {},
    );
  }
}
