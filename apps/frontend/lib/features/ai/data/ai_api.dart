import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import '../domain/ai_models.dart';
import '../domain/authoring_session_models.dart';

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

  Future<AiTurnResponse> startAuthoring({required String conversationId}) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/authoring/start',
      ),
      AiTurnResponse.fromJson,
    );
  }

  Future<AiTurnResponse> generateAuthoringProposal({
    required String conversationId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/authoring/proposal',
      ),
      AiTurnResponse.fromJson,
    );
  }

  Future<AiTurnResponse> submitAuthoringProposalReview({
    required String conversationId,
    required String proposalId,
    required String target,
    required String decision,
    String? comment,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/authoring/proposals/$proposalId/review',
        data: {
          'target': target,
          'decision': decision,
          if (comment != null && comment.trim().isNotEmpty)
            'comment': comment.trim(),
        },
      ),
      AiTurnResponse.fromJson,
    );
  }

  Future<AiTurnResponse> reviseAuthoringProposal({
    required String conversationId,
    required String proposalId,
    required String reviewStateId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/authoring/proposals/$proposalId/revise',
        data: {'reviewStateId': reviewStateId},
      ),
      AiTurnResponse.fromJson,
    );
  }

  Future<AiTurnResponse> prepareApplyReviewedAuthoringProposal({
    required String conversationId,
    required String reviewStateId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/authoring/reviews/$reviewStateId/apply',
      ),
      AiTurnResponse.fromJson,
    );
  }

  Future<AiTurnResponse> submitAuthoringProposalDiscussion({
    required String conversationId,
    required String proposalId,
    required String reviewStateId,
    required String target,
    required String comment,
    required String clientMessageId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/authoring/proposals/$proposalId/discuss',
        data: {
          'reviewStateId': reviewStateId,
          'target': target,
          'comment': comment,
          'clientMessageId': clientMessageId,
        },
      ),
      AiTurnResponse.fromJson,
    );
  }

  Future<AiTurnResponse> runSequentialAuthoringAction({
    required String conversationId,
    required String action,
    String? turnId,
    String? comment,
    String? clientMessageId,
    Object? manualValue,
    String? mode,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/authoring/sequential/action',
        data: {
          'action': action,
          if (turnId != null) 'turnId': turnId,
          if (comment != null) 'comment': comment,
          if (clientMessageId != null) 'clientMessageId': clientMessageId,
          if (manualValue != null) 'manualValue': manualValue,
          if (mode != null) 'mode': mode,
        },
      ),
      AiTurnResponse.fromJson,
    );
  }

  Future<AiTurnResponse> discussSequentialAuthoringTurn({
    required String conversationId,
    required String turnId,
    required String comment,
    required String clientMessageId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/authoring/turns/$turnId/discuss',
        data: {
          'comment': comment,
          'clientMessageId': clientMessageId,
        },
      ),
      AiTurnResponse.fromJson,
    );
  }

  Future<AuthoringSessionResponse> startAuthoringSession({
    required String conversationId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/authoring/sessions/start',
        data: {'conversationId': conversationId},
      ),
      AuthoringSessionResponse.fromJson,
    );
  }

  Future<AuthoringSessionResponse> loadAuthoringSession({
    required String sessionId,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/ai/v1/authoring/sessions/$sessionId',
      ),
      AuthoringSessionResponse.fromJson,
    );
  }

  Future<AuthoringSessionResponse> sendAuthoringSessionMessage({
    required String sessionId,
    required int expectedVersion,
    String? text,
    String? clientMessageId,
    String? questionId,
    List<String>? selectedOptionIds,
    String? otherText,
    String? currentTurnId,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/authoring/sessions/$sessionId/messages',
        data: {
          'expectedVersion': expectedVersion,
          if (text != null) 'text': text,
          if (clientMessageId != null) 'clientMessageId': clientMessageId,
          if (questionId != null) 'questionId': questionId,
          if (selectedOptionIds != null) 'selectedOptionIds': selectedOptionIds,
          if (otherText != null) 'otherText': otherText,
          if (currentTurnId != null) 'currentTurnId': currentTurnId,
        },
      ),
      AuthoringSessionResponse.fromJson,
    );
  }

  Future<AuthoringSessionResponse> runAuthoringSessionAction({
    required String sessionId,
    required String action,
    required int expectedVersion,
    String? turnId,
    Object? manualValue,
    String? mode,
    String? targetStage,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/authoring/sessions/$sessionId/actions',
        data: {
          'action': action,
          'expectedVersion': expectedVersion,
          if (turnId != null) 'turnId': turnId,
          if (manualValue != null) 'manualValue': manualValue,
          if (mode != null) 'mode': mode,
          if (targetStage != null) 'targetStage': targetStage,
        },
      ),
      AuthoringSessionResponse.fromJson,
    );
  }

  Future<AiAuthoringSnapshot?> loadSequentialAuthoringState({
    required String conversationId,
  }) async {
    final response = await unwrapApiResponse<Map<String, dynamic>>(
      _client.get<Map<String, dynamic>>(
        '/api/ai/v1/conversations/$conversationId/authoring/sequential/state',
      ),
      (json) => json,
    );
    final snapshotJson = response['authoringSnapshot'];
    if (snapshotJson is! Map) {
      return null;
    }
    return AiAuthoringSnapshot.fromJson(
      Map<String, dynamic>.from(snapshotJson),
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

  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/actions/$pendingActionId/confirm',
        data: {
          'idempotencyKey': idempotencyKey,
          'locale': locale,
        },
      ),
      (json) => AiContentBlock.fromJson(
        Map<String, dynamic>.from(json['block'] as Map? ?? json),
      ),
    );
  }

  Future<AiContentBlock?> cancelPendingAction({required String pendingActionId}) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/ai/v1/actions/$pendingActionId/cancel',
      ),
      (json) {
        final blockJson = json['block'];
        if (blockJson is! Map) {
          return null;
        }
        return AiContentBlock.fromJson(Map<String, dynamic>.from(blockJson));
      },
    );
  }
}
