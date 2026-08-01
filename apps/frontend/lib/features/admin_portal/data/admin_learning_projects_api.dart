import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import 'models/admin_learning_projects_models.dart';

class AdminLearningProjectsApi {
  const AdminLearningProjectsApi(this._client);

  final Dio _client;

  Future<AdminLearningProjectsListResponse> fetchProjects({
    required int page,
    required int limit,
    String? search,
    String? status,
    String? categoryId,
    String? difficulty,
    String? dateFrom,
    String? dateTo,
  }) {
    final queryParameters = <String, dynamic>{
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty && status != 'ALL')
        'status': status,
      if (categoryId != null && categoryId.isNotEmpty && categoryId != 'ALL')
        'categoryId': categoryId,
      if (difficulty != null && difficulty.isNotEmpty && difficulty != 'ALL')
        'difficulty': difficulty,
      if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
      if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
    };

    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/learning-projects',
        queryParameters: queryParameters,
      ),
      AdminLearningProjectsListResponse.fromJson,
    );
  }

  Future<AdminLearningProjectDetail> fetchProjectDetail(String id) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/learning-projects/$id'),
      AdminLearningProjectDetail.fromJson,
    );
  }

  Future<AdminLearningProjectDetail> approveProject(String id) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/admin/learning-projects/$id/approve',
      ),
      AdminLearningProjectDetail.fromJson,
    );
  }

  Future<AdminLearningProjectDetail> requestChanges({
    required String id,
    required String reason,
  }) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/admin/learning-projects/$id/request-changes',
        data: {'reason': reason},
      ),
      AdminLearningProjectDetail.fromJson,
    );
  }

  Future<AdminLearningProjectDetail> rejectProject({
    required String id,
    required String reason,
  }) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/admin/learning-projects/$id/reject',
        data: {'reason': reason},
      ),
      AdminLearningProjectDetail.fromJson,
    );
  }

  Future<AdminLearningProjectDetail> hideProject({
    required String id,
    required String reason,
  }) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/admin/learning-projects/$id/hide',
        data: {'reason': reason},
      ),
      AdminLearningProjectDetail.fromJson,
    );
  }

  Future<AdminLearningProjectDetail> restoreProject(String id) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/admin/learning-projects/$id/restore',
      ),
      AdminLearningProjectDetail.fromJson,
    );
  }

  Future<AdminLearningProjectDetail> archiveProject({
    required String id,
    required String reason,
  }) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/admin/learning-projects/$id/archive',
        data: {'reason': reason},
      ),
      AdminLearningProjectDetail.fromJson,
    );
  }

  Future<AdminLearningProjectDetail> updateProjectComponent({
    required String projectId,
    required String componentId,
    required Map<String, dynamic> body,
  }) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/admin/learning-projects/$projectId/components/$componentId',
        data: body,
      ),
      AdminLearningProjectDetail.fromJson,
    );
  }

  Future<AdminLearningProjectSavedAiReviewResponse> getSavedAiReview({
    required String projectId,
    required String locale,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/learning-projects/$projectId/ai-review',
        queryParameters: {'locale': locale},
      ),
      (json) {
        try {
          return AdminLearningProjectSavedAiReviewResponse.fromJson(json);
        } on FormatException catch (error) {
          throw ApiException(
            message: error.message,
            code: 'AI_REVIEW_INVALID',
            statusCode: 502,
          );
        }
      },
    );
  }

  Future<AdminLearningProjectAiReviewResult> runAiReview({
    required String projectId,
    required String locale,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/admin/learning-projects/$projectId/ai-review',
        data: {'locale': locale},
      ),
      (json) {
        try {
          return AdminLearningProjectAiReviewResult.fromJson(json);
        } on FormatException catch (error) {
          throw ApiException(
            message: error.message,
            code: 'AI_REVIEW_INVALID',
            statusCode: 502,
          );
        }
      },
    );
  }
}

final adminLearningProjectsApiProvider = Provider<AdminLearningProjectsApi>(
  (ref) => AdminLearningProjectsApi(ref.watch(apiClientProvider)),
);
