import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import '../domain/ai_models.dart';

class AiApi {
  const AiApi(this._client);

  final Dio _client;

  Future<AiConversationSummary> createConversation({
    required String locale,
    String? title,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations',
        data: {
          'mode': 'LEARNER_ASSISTANT',
          'locale': locale,
          if (title != null && title.isNotEmpty) 'title': title,
        },
      ),
      AiConversationSummary.fromJson,
    );
  }

  Future<AiConversationListPage> listConversations({
    int limit = 20,
    int page = 1,
    AiConversationStatus status = AiConversationStatus.active,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/ai/v1/conversations',
        queryParameters: {
          'limit': limit,
          'page': page,
          'status': status.apiValue,
        },
      ),
      AiConversationListPage.fromJson,
    );
  }

  Future<AiConversationMessagesPage> listMessages({
    required String conversationId,
    int limit = 50,
    int page = 1,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/messages',
        queryParameters: {
          'limit': limit,
          'page': page,
        },
      ),
      AiConversationMessagesPage.fromJson,
    );
  }

  Future<AiTurnResponse> sendMessage({
    required String conversationId,
    required String text,
    required String locale,
    required String clientMessageId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/messages',
        data: {
          'text': text,
          'locale': locale,
          'clientMessageId': clientMessageId,
        },
      ),
      AiTurnResponse.fromJson,
    );
  }

  Future<void> archiveConversation({required String conversationId}) {
    return unwrapApiVoidResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/archive',
      ),
    );
  }

  Future<void> restoreConversation({required String conversationId}) {
    return unwrapApiVoidResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/restore',
      ),
    );
  }
}
