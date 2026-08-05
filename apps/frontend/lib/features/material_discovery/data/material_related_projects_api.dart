import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/material_related_projects.dart';

class MaterialRelatedProjectsApi {
  const MaterialRelatedProjectsApi(this._client);

  final Dio _client;

  Future<MaterialRelatedProjectsPage> fetchRelatedProjects({
    required String materialId,
    required int page,
    required int limit,
    CancelToken? cancelToken,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/materials/$materialId/related-projects',
        queryParameters: {
          'page': page,
          'limit': limit,
        },
        cancelToken: cancelToken,
      ),
      MaterialRelatedProjectsPage.fromJson,
    );
  }
}
