import 'package:dio/dio.dart';

import '../../../core/auth/auth_interceptor.dart';
import '../../../core/network/api_response.dart';
import '../../learning_hub/data/learning_hub_api_mapper.dart';
import '../../learning_hub/domain/models/project_build.dart';
import '../../project_notebook/domain/models/project_build_notebook.dart';
import 'models/learner_build_models.dart';

class UpdateCompletionStoryPayload {
  const UpdateCompletionStoryPayload({this.reflection, this.caption});

  final String? reflection;
  final String? caption;

  Map<String, dynamic> toJson() {
    return {
      if (reflection != null) 'reflection': reflection,
      if (caption != null) 'caption': caption,
    };
  }
}

class LearnerBuildsApi {
  const LearnerBuildsApi(this._client);

  final Dio _client;

  static const _buildsPath = '/api/learner/builds';
  static const _portfolioPath = '/api/learner/portfolio';

  Future<LearnerBuildListResult> fetchBuilds({
    String? status,
    int page = 1,
    int limit = 20,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        _buildsPath,
        queryParameters: {
          'status': ?status,
          'page': page,
          'limit': limit,
        },
      ),
      LearnerBuildListResult.fromJson,
    );
  }

  Future<LearnerBuildListResult> fetchPortfolio({
    int page = 1,
    int limit = 20,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        _portfolioPath,
        queryParameters: {'page': page, 'limit': limit},
      ),
      (json) => LearnerBuildListResult.fromJson(json, portfolioMode: true),
    );
  }

  Future<ProjectBuild> fetchBuild(String buildId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('$_buildsPath/$buildId'),
      LearningHubApiMapper.fromBuildJson,
    );
  }

  Future<ProjectBuild> pauseBuild(String buildId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>('$_buildsPath/$buildId/pause'),
      LearningHubApiMapper.fromBuildJson,
    );
  }

  Future<ProjectBuild> resumeBuild(String buildId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>('$_buildsPath/$buildId/resume'),
      LearningHubApiMapper.fromBuildJson,
    );
  }

  Future<ProjectBuild> archiveBuild(String buildId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>('$_buildsPath/$buildId/archive'),
      LearningHubApiMapper.fromBuildJson,
    );
  }

  Future<ProjectBuildCompletionStory> updateCompletionStory(
    String buildId,
    UpdateCompletionStoryPayload payload,
  ) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '$_buildsPath/$buildId/completion-story',
        data: payload.toJson(),
      ),
      (json) =>
          LearningHubApiMapper.completionStoryFromJson(json['story']) ??
          const ProjectBuildCompletionStory(photos: []),
    );
  }

  Future<ProjectBuildCompletionStoryPhoto> uploadCompletionPhoto(
    String buildId, {
    required List<int> bytes,
    required String fileName,
    required String mimeType,
    String? caption,
  }) async {
    final formData = FormData.fromMap({
      'photo': MultipartFile.fromBytes(
        bytes,
        filename: fileName,
        contentType: DioMediaType.parse(mimeType),
      ),
      'caption': ?caption,
    });

    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_buildsPath/$buildId/completion-story/photos',
        data: formData,
        options: Options(
          contentType: 'multipart/form-data',
          sendTimeout: const Duration(seconds: 60),
          receiveTimeout: const Duration(seconds: 60),
          extra: const {AuthInterceptor.skipAuthRefreshExtraKey: true},
        ),
      ),
      (json) {
        final photo = json['photo'];
        if (photo is Map) {
          return ProjectBuildCompletionStoryPhoto(
            id: photo['id'] as String? ?? '',
            imageUrl: photo['imageUrl'] as String? ?? '',
            caption: photo['caption'] as String?,
            sortOrder: (photo['sortOrder'] as num?)?.toInt() ?? 0,
          );
        }
        throw StateError('Missing completion photo in response.');
      },
    );
  }

  Future<void> deleteCompletionPhoto(String buildId, String photoId) async {
    await _client.delete<void>(
      '$_buildsPath/$buildId/completion-story/photos/$photoId',
    );
  }

  Future<ProjectBuildNotebook> fetchNotebook(String buildId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('$_buildsPath/$buildId/notebook'),
      ProjectBuildNotebook.fromJson,
    );
  }

  Future<ProjectBuildNotebook> saveNotebook(
    String buildId,
    NotebookDocument content,
  ) {
    return unwrapApiResponse(
      _client.put<Map<String, dynamic>>(
        '$_buildsPath/$buildId/notebook',
        data: {'content': content.toJson()},
      ),
      ProjectBuildNotebook.fromJson,
    );
  }
}
