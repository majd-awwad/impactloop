import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import '../../learning_hub/data/learning_hub_api_mapper.dart';
import '../../learning_hub/domain/learning_projects_result.dart';
import '../../learning_hub/domain/models/learning_project.dart';
import 'public_user_profile_models.dart';

class PublicUsersApi {
  const PublicUsersApi(this._client);

  final Dio _client;

  Future<PublicUserProfile> fetchProfile(String userId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/users/$userId'),
      PublicUserProfile.fromJson,
    );
  }

  Future<LearningProjectsResult> fetchPublishedProjects(
    String userId, {
    int page = 1,
    int limit = 12,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/users/$userId/projects',
        queryParameters: {'page': page, 'limit': limit},
      ),
      (json) {
        final rawItems = json['items'];
        final items = rawItems is List
            ? rawItems
                  .whereType<Map>()
                  .map(
                    (item) => LearningHubApiMapper.fromListItemJson(
                      Map<String, dynamic>.from(item),
                    ),
                  )
                  .toList(growable: false)
            : const <LearningProject>[];
        final rawPagination = json['pagination'];
        final pagination = rawPagination is Map
            ? Map<String, dynamic>.from(rawPagination)
            : const <String, dynamic>{};
        return LearningProjectsResult(
          items: items,
          page: (pagination['page'] as num?)?.toInt() ?? page,
          limit: (pagination['limit'] as num?)?.toInt() ?? limit,
          total: (pagination['total'] as num?)?.toInt() ?? items.length,
          totalPages:
              (pagination['totalPages'] as num?)?.toInt() ??
              (items.isEmpty ? 0 : 1),
        );
      },
    );
  }
}
