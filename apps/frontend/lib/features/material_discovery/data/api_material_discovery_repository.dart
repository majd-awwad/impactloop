import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import '../domain/discovery_material.dart';
import '../domain/material_discovery_repository.dart';
import 'material_discovery_api_mapper.dart';

class ApiMaterialDiscoveryRepository implements MaterialDiscoveryRepository {
  const ApiMaterialDiscoveryRepository(this._client);

  final Dio _client;

  static const _basePath = '/api/materials';

  @override
  Future<List<DiscoveryMaterial>> getMaterials() {
    return unwrapApiResponse(_client.get<Map<String, dynamic>>(_basePath), (
      json,
    ) {
      final items = json['items'];
      if (items is! List) {
        return const <DiscoveryMaterial>[];
      }

      return items
          .whereType<Map>()
          .map((item) {
            return MaterialDiscoveryApiMapper.fromJson(
              Map<String, dynamic>.from(item),
            );
          })
          .toList(growable: false);
    });
  }

  @override
  Future<DiscoveryMaterial?> getMaterialById(String id) async {
    try {
      return await unwrapApiResponse(
        _client.get<Map<String, dynamic>>('$_basePath/$id'),
        MaterialDiscoveryApiMapper.fromJson,
      );
    } on ApiException catch (error) {
      if (error.statusCode == 404 || error.code == 'NOT_FOUND') {
        return null;
      }

      rethrow;
    }
  }
}
