import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/supplier_profile.dart';
import 'models/update_supplier_profile_request.dart';
import 'models/update_supplier_profile_images_request.dart';

class SupplierProfileApi {
  const SupplierProfileApi(this._client);

  final Dio _client;

  static const _basePath = '/api/supplier/profile';

  Future<SupplierProfileManagement> fetchManagementProfile() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('$_basePath/manage'),
      SupplierProfileManagement.fromJson,
    );
  }

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

  Future<SupplierProfileResponse> updateProfileImages(
    UpdateSupplierProfileImagesRequest request,
  ) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '$_basePath/images',
        data: request.toJson(),
      ),
      SupplierProfileResponse.fromJson,
    );
  }

  Future<Map<String, dynamic>> fetchFollowers({
    required int page,
    required int limit,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '$_basePath/followers',
        queryParameters: {'page': page, 'limit': limit},
      ),
      (json) => json,
    );
  }
}
