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
}
