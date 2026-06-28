import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/category.dart';

class CategoriesApi {
  const CategoriesApi(this._client);

  final Dio _client;

  Future<List<MaterialCategory>> fetchMaterialCategories({
    bool discoveryOnly = false,
  }) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/categories',
        queryParameters: {
          'type': 'MATERIAL',
          'rootOnly': true,
          if (discoveryOnly) 'discoveryOnly': true,
        },
      );
      final body = response.data;

      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }

      final data = body['data'];
      if (data is! List) {
        return const [];
      }

      return data
          .whereType<Map>()
          .map(
            (item) =>
                MaterialCategory.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList();
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
