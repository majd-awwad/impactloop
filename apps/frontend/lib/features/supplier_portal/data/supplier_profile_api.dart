import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/supplier_profile.dart';
import 'models/update_supplier_profile_request.dart';

class SupplierProfileApi {
  const SupplierProfileApi(this._client);

  final Dio _client;

  static const _basePath = '/api/supplier/profile';

  Future<SupplierProfileResponse> fetchProfile() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(_basePath),
      SupplierProfileResponse.fromJson,
    );
  }

  Future<SupplierProfileResponse> updateProfile(
    UpdateSupplierProfileRequest request,
  ) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(_basePath, data: request.toJson()),
      SupplierProfileResponse.fromJson,
    );
  }
}
