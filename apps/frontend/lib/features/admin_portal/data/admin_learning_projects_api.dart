import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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
      if (status != null && status.isNotEmpty && status != 'ALL') 'status': status,
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
}

final adminLearningProjectsApiProvider = Provider<AdminLearningProjectsApi>(
  (ref) => AdminLearningProjectsApi(ref.watch(apiClientProvider)),
);
