import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/material_listing_policy.dart';

class MaterialListingPolicyApi {
  const MaterialListingPolicyApi(this._client);

  final Dio _client;

  Future<MaterialListingPolicy> fetchListingPolicy() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/materials/listing-policy'),
      MaterialListingPolicy.fromJson,
    );
  }
}
