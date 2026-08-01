import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/material_type.dart';

class MaterialTypesApi {
  const MaterialTypesApi(this._client);

  final Dio _client;

  Future<MaterialTypeSearchResult> searchMaterialTypes({
    String? categoryId,
    String? query,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/material-types',
        queryParameters: {
          if (categoryId != null && categoryId.isNotEmpty)
            'categoryId': categoryId,
          if (query != null && query.isNotEmpty) 'q': query,
        },
      ),
      MaterialTypeSearchResult.fromJson,
    );
  }
}
