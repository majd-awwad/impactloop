import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import '../../materials/data/models/create_material_request.dart';
import '../../materials/data/models/created_material.dart';

class SupplierMaterialsApi {
  const SupplierMaterialsApi(this._client);

  final Dio _client;

  Future<CreatedMaterial> createMaterial(CreateMaterialRequest request) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/supplier/materials',
        data: request.toJson(),
      ),
      CreatedMaterial.fromJson,
    );
  }
}
