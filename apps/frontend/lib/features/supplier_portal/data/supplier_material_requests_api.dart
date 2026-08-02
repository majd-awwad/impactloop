import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/supplier_material_request.dart';

class SupplierMaterialRequestsApi {
  const SupplierMaterialRequestsApi(this._client);

  final Dio _client;

  static const _basePath = '/api/supplier/material-requests';

  Future<SupplierMaterialRequestListResult> fetchFeed({
    String? categoryId,
    String? city,
    String? area,
    bool? unansweredByMe,
    int page = 1,
    int limit = 20,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        _basePath,
        queryParameters: {
          if (categoryId != null) 'categoryId': categoryId,
          if (city != null) 'city': city,
          if (area != null) 'area': area,
          if (unansweredByMe != null)
            'unansweredByMe': unansweredByMe.toString(),
          'page': page,
          'limit': limit,
        },
      ),
      SupplierMaterialRequestListResult.fromJson,
    );
  }

  Future<SupplierMaterialRequest> fetchRequest(String id) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('$_basePath/$id'),
      SupplierMaterialRequest.fromJson,
    );
  }

  Future<SupplierMaterialRequestCandidatesResult> fetchCandidateMaterials(
    String id, {
    int limit = 12,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '$_basePath/$id/candidate-materials',
        queryParameters: {'limit': limit},
      ),
      SupplierMaterialRequestCandidatesResult.fromJson,
    );
  }

  Future<SupplierMaterialRequest> suggestMaterial(
    String id, {
    required String materialId,
    bool confirmWeakMatch = false,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/$id/suggestions',
        data: {
          'materialId': materialId,
          if (confirmWeakMatch) 'confirmWeakMatch': true,
        },
      ),
      SupplierMaterialRequest.fromJson,
    );
  }
}
