import 'package:dio/dio.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import '../../../core/network/api_client.dart';
import '../../materials/data/categories_api.dart';
import '../../materials/data/models/category.dart';
import '../domain/learning_project_repository.dart';
import '../domain/learning_projects_result.dart';
import '../domain/models/learning_project.dart';
import '../domain/models/learning_project_submission.dart';
import '../domain/models/project_build.dart';
import '../domain/project_engagement.dart';
import '../domain/project_follow_status.dart';
import '../domain/project_save_status.dart';
import 'learning_hub_api_mapper.dart';

class ApiLearningHubRepository implements LearningProjectRepository {
  const ApiLearningHubRepository({
    required Dio client,
    required CategoriesApi categoriesApi,
  }) : _client = client,
       _categoriesApi = categoriesApi;

  final Dio _client;
  final CategoriesApi _categoriesApi;

  static const _basePath = '/api/learning-projects';

  @override
  Future<LearningProjectsResult> fetchProjects(
    LearningProjectsQuery query,
  ) async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        _basePath,
        queryParameters: _queryParameters(query),
      ),
      (json) => _mapProjectsResult(json, query),
    );
  }

  @override
  Future<LearningProjectsResult> fetchSavedProjects(
    LearningProjectsQuery query,
  ) async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '$_basePath/me/saved',
        queryParameters: _queryParameters(query),
      ),
      (json) => _mapProjectsResult(json, query),
    );
  }

  @override
  Future<LearningProjectsResult> fetchFollowedProjects(
    LearningProjectsQuery query,
  ) async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '$_basePath/me/followed',
        queryParameters: _queryParameters(query),
      ),
      (json) => _mapProjectsResult(json, query),
    );
  }

  @override
  Future<LearningProject?> fetchProjectById(String id) async {
    try {
      return await unwrapApiResponse(
        _client.get<Map<String, dynamic>>('$_basePath/$id'),
        LearningHubApiMapper.fromDetailJson,
      );
    } on ApiException catch (error) {
      if (error.statusCode == 404 || error.code == 'NOT_FOUND') {
        return null;
      }

      rethrow;
    }
  }

  @override
  Future<LearningProjectSubmissionsResult> fetchMyLearningProjectSubmissions(
    LearningProjectSubmissionsQuery query,
  ) async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '$_basePath/mine',
        queryParameters: _submissionQueryParameters(query),
      ),
      (json) => _mapSubmissionsResult(json, query),
    );
  }

  @override
  Future<LearningProjectSubmission> fetchMyLearningProjectSubmission(
    String id,
  ) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('$_basePath/mine/$id'),
      LearningHubApiMapper.submissionFromJson,
    );
  }

  @override
  Future<LearningProjectSubmission> updateMyLearningProjectSubmission(
    String id,
    Map<String, dynamic> payload,
  ) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>('$_basePath/mine/$id', data: payload),
      LearningHubApiMapper.submissionFromJson,
    );
  }

  @override
  Future<LearningProjectSubmission> resubmitMyLearningProjectSubmission(
    String id,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>('$_basePath/mine/$id/resubmit'),
      LearningHubApiMapper.submissionFromJson,
    );
  }

  @override
  Future<LearningProjectSubmission> submitMyLearningProjectDraft(
    String id, {
    required String idempotencyKey,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/mine/$id/submit',
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      ),
      LearningHubApiMapper.submissionFromJson,
    );
  }

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '$_basePath/$projectId/builds/me',
      );
      final body = response.data;

      if (body == null) {
        throw const ApiException(message: 'Empty response from server');
      }

      if (body['success'] != true) {
        throw const ApiException(message: 'Request failed');
      }

      final data = body['data'];
      if (data == null) {
        return null;
      }

      if (data is! Map) {
        throw const ApiException(message: 'Unexpected response data format');
      }

      return LearningHubApiMapper.fromBuildJson(
        Map<String, dynamic>.from(data),
      );
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return null;
      }

      throw mapDioException(error);
    }
  }

  @override
  Future<ProjectBuild> startBuild(
    String projectId, {
    String? recommendationImpressionId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/$projectId/builds/start',
        options: Options(
          headers: recommendationHeaders(recommendationImpressionId),
        ),
      ),
      LearningHubApiMapper.fromBuildJson,
    );
  }

  @override
  Future<ProjectBuild> updateBuildItem(
    String projectId,
    String itemId, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
    String? recommendationImpressionId,
  }) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '$_basePath/$projectId/builds/me/items/$itemId',
        data: {'status': status.apiValue, 'learnerNote': learnerNote?.trim()},
        options: Options(
          headers: recommendationHeaders(recommendationImpressionId),
        ),
      ),
      LearningHubApiMapper.fromBuildJson,
    );
  }

  @override
  Future<BuildMaterialCandidatesResult> fetchMaterialCandidates(
    String projectId,
    String itemId,
  ) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '$_basePath/$projectId/builds/me/items/$itemId/material-candidates',
      ),
      LearningHubApiMapper.fromMaterialCandidatesJson,
    );
  }

  @override
  Future<ProjectBuild> linkMaterial(
    String projectId,
    String itemId, {
    required String materialId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/$projectId/builds/me/items/$itemId/link-material',
        data: {'materialId': materialId},
      ),
      LearningHubApiMapper.fromBuildJson,
    );
  }

  @override
  Future<ProjectBuild> unlinkMaterial(String projectId, String itemId) {
    return unwrapApiResponse(
      _client.delete<Map<String, dynamic>>(
        '$_basePath/$projectId/builds/me/items/$itemId/link-material',
      ),
      LearningHubApiMapper.fromBuildJson,
    );
  }

  @override
  Future<ProjectBuild> removeAcquiredMaterialFromBuildItem(
    String projectId,
    String itemId, {
    required String materialId,
    required String reservationId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/$projectId/builds/me/items/$itemId/remove-acquired-allocation',
        data: {
          'materialId': materialId,
          'reservationId': reservationId,
        },
      ),
      (json) => LearningHubApiMapper.fromBuildJson(
        (json['build'] as Map<String, dynamic>?) ?? json,
      ),
    );
  }

  @override
  Future<ProjectBuild> completeBuildStep(String projectId, String stepId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/$projectId/builds/me/steps/$stepId/complete',
      ),
      LearningHubApiMapper.fromBuildJson,
    );
  }

  @override
  Future<BuildGuideConversationResult> getOrCreateBuildGuideConversation(
    String projectId,
  ) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/$projectId/builds/me/guide-conversation',
        data: const {},
      ),
      (json) => LearningHubApiMapper.fromBuildGuideConversationJson(json),
    );
  }

  @override
  Future<List<MaterialCategory>> fetchProjectCategories() {
    return _categoriesApi.fetchProjectCategories();
  }

  @override
  Future<List<MaterialCategory>> fetchMaterialCategories() {
    return _categoriesApi.fetchMaterialCategories();
  }

  @override
  Future<ProjectEngagement> likeProject(
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
      ProjectEngagement.fromJson,
    );
  }

  @override
  Future<ProjectEngagement> unlikeProject(
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
      ProjectEngagement.fromJson,
    );
  }

  @override
  Future<ProjectSaveStatus> saveProject(
    String id, {
    String? recommendationImpressionId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/$id/save',
        options: Options(
          headers: recommendationHeaders(recommendationImpressionId),
        ),
      ),
      ProjectSaveStatus.fromJson,
    );
  }

  @override
  Future<ProjectSaveStatus> unsaveProject(
    String id, {
    String? recommendationImpressionId,
  }) {
    return unwrapApiResponse(
      _client.delete<Map<String, dynamic>>(
        '$_basePath/$id/save',
        options: Options(
          headers: recommendationHeaders(recommendationImpressionId),
        ),
      ),
      ProjectSaveStatus.fromJson,
    );
  }

  @override
  Future<ProjectFollowStatus> followProject(
    String id, {
    String? recommendationImpressionId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/$id/follow',
        options: Options(
          headers: recommendationHeaders(recommendationImpressionId),
        ),
      ),
      ProjectFollowStatus.fromJson,
    );
  }

  @override
  Future<ProjectFollowStatus> unfollowProject(
    String id, {
    String? recommendationImpressionId,
  }) {
    return unwrapApiResponse(
      _client.delete<Map<String, dynamic>>(
        '$_basePath/$id/follow',
        options: Options(
          headers: recommendationHeaders(recommendationImpressionId),
        ),
      ),
      ProjectFollowStatus.fromJson,
    );
  }

  @override
  Future<void> reviewProject(
    String id, {
    required int rating,
    String? comment,
  }) async {
    await unwrapApiResponse(
      _client.put<Map<String, dynamic>>(
        '$_basePath/$id/review',
        data: {
          'rating': rating,
          if (comment != null && comment.trim().isNotEmpty)
            'comment': comment.trim(),
        },
      ),
      (json) => json,
    );
  }

  @override
  Future<void> deleteProjectReview(String id) async {
    await unwrapApiResponse(
      _client.delete<Map<String, dynamic>>('$_basePath/$id/review'),
      (json) => json,
    );
  }

  @override
  Future<void> submitProjectForReview({
    required String idempotencyKey,
    required String title,
    required String shortDescription,
    required String description,
    required String categoryId,
    required String difficulty,
    int? estimatedDurationMinutes,
    List<Map<String, dynamic>>? requiredComponents,
    List<Map<String, dynamic>>? steps,
    List<Map<String, dynamic>>? links,
  }) async {
    final data = <String, dynamic>{
      'title': title,
      'shortDescription': shortDescription,
      'description': description,
      'categoryId': categoryId,
      'difficulty': difficulty,
      if (requiredComponents != null && requiredComponents.isNotEmpty)
        'requiredComponents': requiredComponents,
      if (steps != null && steps.isNotEmpty) 'steps': steps,
      if (links != null && links.isNotEmpty) 'links': links,
    };
    if (estimatedDurationMinutes != null) {
      data['estimatedDurationMinutes'] = estimatedDurationMinutes;
    }

    await unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/submit',
        data: data,
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      ),
      (json) => json,
    );
  }

  @override
  Future<LearningProjectAuthoringSession> createAiAuthoringDraft({
    required String ideaText,
    required String categoryId,
    required String difficulty,
    required String idempotencyKey,
    String? locale,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/mine/ai-authoring-drafts',
        data: {
          'ideaText': ideaText,
          'categoryId': categoryId,
          'difficulty': difficulty,
          if (locale != null) 'locale': locale,
        },
        options: Options(headers: {'Idempotency-Key': idempotencyKey}),
      ),
      LearningHubApiMapper.authoringSessionFromJson,
    );
  }

  @override
  Future<LearningProjectAuthoringSession> getOrCreateAuthoringConversation({
    required String projectId,
    String? locale,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_basePath/mine/$projectId/authoring-conversation',
        data: {if (locale != null) 'locale': locale},
      ),
      LearningHubApiMapper.authoringSessionFromJson,
    );
  }

  static int? _intFromDynamic(Object? value) {
    if (value is int) {
      return value;
    }

    if (value is num) {
      return value.toInt();
    }

    if (value is String) {
      return int.tryParse(value);
    }

    return null;
  }

  Map<String, dynamic> _queryParameters(LearningProjectsQuery query) {
    return {
      'page': query.page,
      'limit': query.limit,
      if (query.q != null && query.q!.trim().isNotEmpty) 'q': query.q,
      if (query.categoryId != null && query.categoryId!.trim().isNotEmpty)
        'categoryId': query.categoryId,
      if (query.difficulty != null && query.difficulty!.trim().isNotEmpty)
        'difficulty': query.difficulty,
      if (query.tag != null && query.tag!.trim().isNotEmpty) 'tag': query.tag,
    };
  }

  Map<String, dynamic> _submissionQueryParameters(
    LearningProjectSubmissionsQuery query,
  ) {
    return {
      'page': query.page,
      'limit': query.limit,
      if (query.status != null) 'status': query.status!.apiValue,
    };
  }

  LearningProjectsResult _mapProjectsResult(
    Map<String, dynamic> json,
    LearningProjectsQuery query,
  ) {
    final itemsJson = json['items'];
    final paginationJson = json['pagination'];
    final items = itemsJson is List
        ? itemsJson
              .whereType<Map>()
              .map(
                (item) => LearningHubApiMapper.fromListItemJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
        : const <LearningProject>[];

    final pagination = paginationJson is Map
        ? Map<String, dynamic>.from(paginationJson)
        : const <String, dynamic>{};

    final page = _intFromDynamic(pagination['page']) ?? query.page;
    final limit = _intFromDynamic(pagination['limit']) ?? query.limit;
    final total = _intFromDynamic(pagination['total']) ?? items.length;
    final totalPages =
        _intFromDynamic(pagination['totalPages']) ??
        (total == 0 ? 0 : ((total + limit - 1) / limit).ceil());

    return LearningProjectsResult(
      items: items,
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
    );
  }

  LearningProjectSubmissionsResult _mapSubmissionsResult(
    Map<String, dynamic> json,
    LearningProjectSubmissionsQuery query,
  ) {
    final itemsJson = json['items'];
    final paginationJson = json['pagination'];
    final items = itemsJson is List
        ? itemsJson
              .whereType<Map>()
              .map(
                (item) => LearningHubApiMapper.submissionFromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
        : const <LearningProjectSubmission>[];

    final pagination = paginationJson is Map
        ? Map<String, dynamic>.from(paginationJson)
        : const <String, dynamic>{};

    final page = _intFromDynamic(pagination['page']) ?? query.page;
    final limit = _intFromDynamic(pagination['limit']) ?? query.limit;
    final total = _intFromDynamic(pagination['total']) ?? items.length;
    final totalPages =
        _intFromDynamic(pagination['totalPages']) ??
        (total == 0 ? 0 : ((total + limit - 1) / limit).ceil());

    return LearningProjectSubmissionsResult(
      items: items,
      page: page,
      limit: limit,
      total: total,
      totalPages: totalPages,
    );
  }
}
