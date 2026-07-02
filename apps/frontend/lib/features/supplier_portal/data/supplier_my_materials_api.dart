import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/supplier_my_materials_models.dart';

class SupplierMyMaterialsApi {
  const SupplierMyMaterialsApi(this._client);

  final Dio _client;

  Future<SupplierMyMaterialsListResult> listMaterials(
    SupplierMyMaterialsQuery query,
  ) {
    final queryParams = <String, dynamic>{
      'page': query.page,
      'limit': query.limit,
      if (query.search.trim().isNotEmpty) 'search': query.search.trim(),
      if (query.status != null && query.status!.isNotEmpty)
        'status': query.status,
      if (query.isFree != null) 'isFree': query.isFree.toString(),
      if (query.categoryId != null && query.categoryId!.isNotEmpty)
        'categoryId': query.categoryId,
    };

    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/supplier/materials',
        queryParameters: queryParams,
      ),
      SupplierMyMaterialsListResult.fromJson,
    );
  }

  Future<SupplierMyMaterial> getMaterial(String materialId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/supplier/materials/$materialId'),
      SupplierMyMaterial.fromJson,
    );
  }

  Future<SupplierMyMaterial> updateMaterial(
    String materialId,
    UpdateSupplierMyMaterialRequest request,
  ) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/supplier/materials/$materialId',
        data: request.toJson(),
      ),
      SupplierMyMaterial.fromJson,
    );
  }

  Future<void> deleteMaterial(String materialId) {
    return unwrapApiVoidResponse(
      _client.delete<Map<String, dynamic>>(
        '/api/supplier/materials/$materialId',
      ),
    );
  }

  Future<SupplierMyMaterial> markMaterialUnavailable(String materialId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/supplier/materials/$materialId/mark-unavailable',
      ),
      SupplierMyMaterial.fromJson,
    );
  }

  Future<SupplierMyMaterial> restoreMaterialAvailable(String materialId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/supplier/materials/$materialId/restore-available',
      ),
      SupplierMyMaterial.fromJson,
    );
  }
}
