import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import '../../../core/network/api_client.dart';
import '../domain/discovery_material.dart';
import '../domain/material_engagement.dart';
import '../domain/material_discovery_query.dart';
import '../domain/material_discovery_repository.dart';
import '../domain/material_discovery_result.dart';
import 'material_discovery_api_mapper.dart';

class ApiMaterialDiscoveryRepository implements MaterialDiscoveryRepository {
  const ApiMaterialDiscoveryRepository(this._client);

  final Dio _client;

  static const _basePath = '/api/materials';

  @override
  Future<MaterialDiscoveryResult> fetchMaterials(MaterialDiscoveryQuery query) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        _basePath,
        queryParameters: buildQueryParameters(query),
      ),
      _parseResult,
    );
  }

  @visibleForTesting
  static Map<String, dynamic> buildQueryParameters(
    MaterialDiscoveryQuery query,
  ) {
    final savedLocationId = query.savedLocationId?.trim();
    final hasSavedLocation =
        savedLocationId != null && savedLocationId.isNotEmpty;
    final hasCoordinates = query.latitude != null && query.longitude != null;
    final sort = query.sort == 'nearest' && !hasSavedLocation && !hasCoordinates
        ? 'newest'
        : query.sort;

    final params = <String, dynamic>{
      'page': query.page,
      'limit': query.limit,
      'status': query.status,
      'priceType': query.priceType,
      'sort': sort,
    };

    final trimmedQ = query.q?.trim();
    if (trimmedQ != null && trimmedQ.isNotEmpty) {
      params['q'] = trimmedQ;
    }

    final categoryId = query.categoryId?.trim();
    if (categoryId != null && categoryId.isNotEmpty) {
      params['categoryId'] = categoryId;
    }

    final condition = query.condition?.trim();
    if (condition != null && condition.isNotEmpty) {
      params['condition'] = condition;
    }

    if (query.deliveryAvailable != null) {
      params['deliveryAvailable'] = query.deliveryAvailable;
    }

    if (query.pickupAllowed != null) {
      params['pickupAllowed'] = query.pickupAllowed;
    }

    final city = query.city?.trim();
    if (city != null && city.isNotEmpty) {
      params['city'] = city;
    }

    final area = query.area?.trim();
    if (area != null && area.isNotEmpty) {
      params['area'] = area;
    }

    if (query.latitude != null && query.longitude != null) {
      params['latitude'] = query.latitude;
      params['longitude'] = query.longitude;
    }

    if (savedLocationId != null && savedLocationId.isNotEmpty) {
      params['savedLocationId'] = savedLocationId;
    }

    return params;
  }

  static MaterialDiscoveryResult _parseResult(Map<String, dynamic> json) {
    final itemsJson = json['items'];
    final items = itemsJson is List
        ? itemsJson
              .whereType<Map>()
              .map(
                (item) => MaterialDiscoveryApiMapper.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
        : const <DiscoveryMaterial>[];

    final paginationJson = json['pagination'];
    final pagination = paginationJson is Map
        ? MaterialDiscoveryPagination.fromJson(
            Map<String, dynamic>.from(paginationJson),
          )
        : MaterialDiscoveryPagination.fromJson(null);

    return MaterialDiscoveryResult(items: items, pagination: pagination);
  }

  @override
  Future<DiscoveryMaterial?> getMaterialById(
    String id, {
    String? recommendationImpressionId,
  }) async {
    try {
      return await unwrapApiResponse(
        _client.get<Map<String, dynamic>>(
          '$_basePath/$id',
          options: Options(
            headers: recommendationHeaders(recommendationImpressionId),
          ),
        ),
        MaterialDiscoveryApiMapper.fromJson,
      );
    } on ApiException catch (error) {
      if (error.statusCode == 404 || error.code == 'NOT_FOUND') {
        return null;
      }

      rethrow;
    }
  }

  @override
  Future<MaterialEngagement> likeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/$id/like',
        options: Options(
          headers: recommendationHeaders(recommendationImpressionId),
        ),
      ),
      MaterialEngagement.fromJson,
    );
  }

  @override
  Future<MaterialEngagement> unlikeMaterial(
    String id, {
    String? recommendationImpressionId,
  }) {
    return unwrapApiResponse(
      _client.delete<Map<String, dynamic>>(
        '$_basePath/$id/like',
        options: Options(
          headers: recommendationHeaders(recommendationImpressionId),
        ),
      ),
      MaterialEngagement.fromJson,
    );
  }
}
