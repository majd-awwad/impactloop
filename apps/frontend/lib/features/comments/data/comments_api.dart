import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import '../domain/comment_models.dart';

class CommentsApi {
  const CommentsApi(this._client);

  final Dio _client;

  String _basePath(CommentTargetType type, String targetId) {
    switch (type) {
      case CommentTargetType.material:
        return '/api/materials/$targetId/comments';
      case CommentTargetType.learningProject:
        return '/api/learning-projects/$targetId/comments';
    }
  }

  Future<CommentsPage> listRootComments({
    required CommentTargetType type,
    required String targetId,
    int page = 1,
    int limit = 20,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        _basePath(type, targetId),
        queryParameters: {'page': page, 'limit': limit},
      ),
      CommentsPage.fromJson,
    );
  }

  Future<CommentsPage> listReplies({
    required CommentTargetType type,
    required String targetId,
    required String rootCommentId,
    int page = 1,
    int limit = 20,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '${_basePath(type, targetId)}/$rootCommentId/replies',
        queryParameters: {'page': page, 'limit': limit},
      ),
      CommentsPage.fromJson,
    );
  }

  Future<CommentItem> createComment({
    required CommentTargetType type,
    required String targetId,
    required String body,
    String? parentCommentId,
    String? replyToCommentId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        _basePath(type, targetId),
        data: {
          'body': body,
          'parentCommentId': ?parentCommentId,
          'replyToCommentId': ?replyToCommentId,
        },
      ),
      CommentItem.fromJson,
    );
  }

  Future<CommentItem> updateComment({
    required CommentTargetType type,
    required String targetId,
    required String commentId,
    required String body,
  }) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '${_basePath(type, targetId)}/$commentId',
        data: {'body': body},
      ),
      CommentItem.fromJson,
    );
  }

  Future<CommentItem> deleteComment({
    required CommentTargetType type,
    required String targetId,
    required String commentId,
  }) {
    return unwrapApiResponse(
      _client.delete<Map<String, dynamic>>(
        '${_basePath(type, targetId)}/$commentId',
      ),
      CommentItem.fromJson,
    );
  }
}
