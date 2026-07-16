import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/ai_models.dart';
import 'ai_api.dart';

abstract class AiRepository {
  Future<AiConversationSummary> createConversation({
    required String locale,
    String? title,
  });

  Future<AiConversationListPage> listConversations({
    int limit = 20,
    int page = 1,
    AiConversationStatus status = AiConversationStatus.active,
  });

  Future<AiConversationMessagesPage> listMessages({
    required String conversationId,
    int limit = 50,
    int page = 1,
  });

  Future<AiTurnResponse> sendMessage({
    required String conversationId,
    required String text,
    required String locale,
    required String clientMessageId,
  });

  Future<void> archiveConversation({required String conversationId});

  Future<void> restoreConversation({required String conversationId});

  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  });

  Future<AiContentBlock?> cancelPendingAction({required String pendingActionId});
}

class ApiAiRepository implements AiRepository {
  const ApiAiRepository(this._api);

  final AiApi _api;

  @override
  Future<AiConversationSummary> createConversation({
    required String locale,
    String? title,
  }) {
    return _api.createConversation(locale: locale, title: title);
  }

  @override
  Future<AiConversationListPage> listConversations({
    int limit = 20,
    int page = 1,
    AiConversationStatus status = AiConversationStatus.active,
  }) {
    return _api.listConversations(
      limit: limit,
      page: page,
      status: status,
    );
  }

  @override
  Future<AiConversationMessagesPage> listMessages({
    required String conversationId,
    int limit = 50,
    int page = 1,
  }) {
    return _api.listMessages(
      conversationId: conversationId,
      limit: limit,
      page: page,
    );
  }

  @override
  Future<AiTurnResponse> sendMessage({
    required String conversationId,
    required String text,
    required String locale,
    required String clientMessageId,
  }) {
    return _api.sendMessage(
      conversationId: conversationId,
      text: text,
      locale: locale,
      clientMessageId: clientMessageId,
    );
  }

  @override
  Future<void> archiveConversation({required String conversationId}) {
    return _api.archiveConversation(conversationId: conversationId);
  }

  @override
  Future<void> restoreConversation({required String conversationId}) {
    return _api.restoreConversation(conversationId: conversationId);
  }

  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) {
    return _api.confirmPendingAction(
      pendingActionId: pendingActionId,
      idempotencyKey: idempotencyKey,
      locale: locale,
    );
  }

  @override
  Future<AiContentBlock?> cancelPendingAction({required String pendingActionId}) {
    return _api.cancelPendingAction(pendingActionId: pendingActionId);
  }
}

final aiApiProvider = Provider<AiApi>((ref) {
  return AiApi(ref.watch(apiClientProvider));
});

final aiRepositoryProvider = Provider<AiRepository>((ref) {
  return ApiAiRepository(ref.watch(aiApiProvider));
});
