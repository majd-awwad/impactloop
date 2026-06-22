import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/material_price_rule.dart';
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

  Future<MaterialPriceRule?> fetchActivePriceRule(String materialTypeId) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/material-types/$materialTypeId/price-rule',
      );
      final body = response.data;

      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }

      final data = body['data'];
      if (data == null) {
        return null;
      }

      if (data is! Map<String, dynamic>) {
        throw const ApiException(message: 'Unexpected response data format');
      }

      return MaterialPriceRule.fromJson(data);
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
