import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/project_help_session_models.dart';

class ProjectHelpSessionsApi {
  const ProjectHelpSessionsApi(this._client);

  final Dio _client;

  static const _learnerSessionsPath = '/api/project-help-sessions/learner';
  static const _authorSessionsPath = '/api/project-help-sessions/author';

  String _availabilityPath(String projectId) =>
      '/api/learning-projects/$projectId/help-sessions/availability';

  String _settingsPath(String projectId) =>
      '/api/learning-projects/mine/$projectId/help-sessions/settings';

  Future<ProjectHelpSessionAvailability> fetchAvailability(String projectId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(_availabilityPath(projectId)),
      ProjectHelpSessionAvailability.fromJson,
    );
  }

  Future<ProjectHelpSession> createRequest({
    required String buildId,
    required CreateProjectHelpSessionRequestPayload payload,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_learnerSessionsPath/builds/$buildId/request',
        data: payload.toJson(),
      ),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSessionListResult> fetchSessions({
    int page = 1,
    int limit = 20,
    String? status,
  }) {
    final queryParameters = <String, dynamic>{
      'page': page,
      'limit': limit,
    };
    if (status != null) {
      queryParameters['status'] = status;
    }
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        _learnerSessionsPath,
        queryParameters: queryParameters,
      ),
      ProjectHelpSessionListResult.fromJson,
    );
  }

  Future<ProjectHelpSession> fetchSession(String sessionId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('$_learnerSessionsPath/$sessionId'),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSession> acceptAlternative(String sessionId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_learnerSessionsPath/$sessionId/alternative/accept',
      ),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSession> rejectAlternative(String sessionId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_learnerSessionsPath/$sessionId/alternative/reject',
      ),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSession> cancelSession({
    required String sessionId,
    String? reason,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_learnerSessionsPath/$sessionId/cancel',
        data: {'reason': reason},
      ),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSessionJoinResult> joinZoom(String sessionId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_learnerSessionsPath/$sessionId/zoom/join',
      ),
      ProjectHelpSessionJoinResult.fromJson,
    );
  }

  Future<ProjectHelpSessionSettings> fetchSettings(String projectId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(_settingsPath(projectId)),
      ProjectHelpSessionSettings.fromJson,
    );
  }

  Future<ProjectHelpSessionSettings> updateSettings({
    required String projectId,
    required ProjectHelpSessionSettings settings,
  }) {
    return unwrapApiResponse(
      _client.put<Map<String, dynamic>>(
        _settingsPath(projectId),
        data: settings.toJson(),
      ),
      ProjectHelpSessionSettings.fromJson,
    );
  }

  Future<ProjectHelpSessionListResult> fetchAuthorSessions({
    int page = 1,
    int limit = 20,
    String? status,
    String? projectId,
  }) {
    final queryParameters = <String, dynamic>{
      'page': page,
      'limit': limit,
    };
    if (status != null) {
      queryParameters['status'] = status;
    }
    if (projectId != null) {
      queryParameters['projectId'] = projectId;
    }
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        _authorSessionsPath,
        queryParameters: queryParameters,
      ),
      ProjectHelpSessionListResult.fromJson,
    );
  }

  Future<ProjectHelpSession> fetchAuthorSession(String sessionId) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('$_authorSessionsPath/$sessionId'),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSession> acceptOption({
    required String sessionId,
    required String timeOptionId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_authorSessionsPath/$sessionId/accept',
        data: {'timeOptionId': timeOptionId},
      ),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSession> proposeAlternative({
    required String sessionId,
    required DateTime startsAtUtc,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_authorSessionsPath/$sessionId/propose-alternative',
        data: {'startsAt': startsAtUtc.toUtc().toIso8601String()},
      ),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSession> declineSession({
    required String sessionId,
    String? reason,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_authorSessionsPath/$sessionId/decline',
        data: {'reason': reason},
      ),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSession> cancelAuthorSession({
    required String sessionId,
    String? reason,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_authorSessionsPath/$sessionId/cancel',
        data: {'reason': reason},
      ),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSession> retryZoom(String sessionId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_authorSessionsPath/$sessionId/zoom/retry',
      ),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSessionStartResult> startZoom(String sessionId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_authorSessionsPath/$sessionId/zoom/start',
      ),
      ProjectHelpSessionStartResult.fromJson,
    );
  }

  Future<ProjectHelpSession> completeSession(String sessionId) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_authorSessionsPath/$sessionId/complete',
      ),
      ProjectHelpSession.fromJson,
    );
  }

  Future<ProjectHelpSessionNotebookHandoff> ensureNotebookNotes({
    required String sessionId,
    required String localeCode,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_learnerSessionsPath/$sessionId/notebook-notes',
        queryParameters: {'locale': localeCode == 'ar' ? 'ar' : 'en'},
      ),
      ProjectHelpSessionNotebookHandoff.fromJson,
    );
  }
}
