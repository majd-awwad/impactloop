import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/ai_models.dart';
import '../domain/authoring_session_models.dart';
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
    Map<String, Object?>? buildGuideContext,
  });

  Future<AiTurnResponse> startAuthoring({required String conversationId});

  Future<AiTurnResponse> generateAuthoringProposal({
    required String conversationId,
  });

  Future<AiTurnResponse> submitAuthoringProposalReview({
    required String conversationId,
    required String proposalId,
    required String target,
    required String decision,
    String? comment,
  });

  Future<AiTurnResponse> reviseAuthoringProposal({
    required String conversationId,
    required String proposalId,
    required String reviewStateId,
  });

  Future<AiTurnResponse> prepareApplyReviewedAuthoringProposal({
    required String conversationId,
    required String reviewStateId,
  });

  Future<AiTurnResponse> submitAuthoringProposalDiscussion({
    required String conversationId,
    required String proposalId,
    required String reviewStateId,
    required String target,
    required String comment,
    required String clientMessageId,
  });

  Future<AiTurnResponse> runSequentialAuthoringAction({
    required String conversationId,
    required String action,
    String? turnId,
    String? comment,
    String? clientMessageId,
    Object? manualValue,
    String? mode,
  });

  Future<AiTurnResponse> discussSequentialAuthoringTurn({
    required String conversationId,
    required String turnId,
    required String comment,
    required String clientMessageId,
  });

  Future<AiAuthoringSnapshot?> loadSequentialAuthoringState({
    required String conversationId,
  });

  Future<AuthoringSessionResponse> startAuthoringSession({
    required String conversationId,
  });

  Future<AuthoringSessionResponse> loadAuthoringSession({
    required String sessionId,
  });

  Future<AuthoringSessionResponse> sendAuthoringSessionMessage({
    required String sessionId,
    required int expectedVersion,
    String? text,
    String? clientMessageId,
    String? questionId,
    List<String>? selectedOptionIds,
    String? otherText,
    String? currentTurnId,
  });

  Future<AuthoringSessionResponse> runAuthoringSessionAction({
    required String sessionId,
    required String action,
    required int expectedVersion,
    String? turnId,
    Object? manualValue,
    String? mode,
    String? targetStage,
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
    Map<String, Object?>? buildGuideContext,
  }) {
    return _api.sendMessage(
      conversationId: conversationId,
      text: text,
      locale: locale,
      clientMessageId: clientMessageId,
      buildGuideContext: buildGuideContext,
    );
  }

  @override
  Future<AiTurnResponse> startAuthoring({required String conversationId}) {
    return _api.startAuthoring(conversationId: conversationId);
  }

  @override
  Future<AiTurnResponse> generateAuthoringProposal({
    required String conversationId,
  }) {
    return _api.generateAuthoringProposal(conversationId: conversationId);
  }

  @override
  Future<AiTurnResponse> submitAuthoringProposalReview({
    required String conversationId,
    required String proposalId,
    required String target,
    required String decision,
    String? comment,
  }) {
    return _api.submitAuthoringProposalReview(
      conversationId: conversationId,
      proposalId: proposalId,
      target: target,
      decision: decision,
      comment: comment,
    );
  }

  @override
  Future<AiTurnResponse> reviseAuthoringProposal({
    required String conversationId,
    required String proposalId,
    required String reviewStateId,
  }) {
    return _api.reviseAuthoringProposal(
      conversationId: conversationId,
      proposalId: proposalId,
      reviewStateId: reviewStateId,
    );
  }

  @override
  Future<AiTurnResponse> prepareApplyReviewedAuthoringProposal({
    required String conversationId,
    required String reviewStateId,
  }) {
    return _api.prepareApplyReviewedAuthoringProposal(
      conversationId: conversationId,
      reviewStateId: reviewStateId,
    );
  }

  @override
  Future<AiTurnResponse> submitAuthoringProposalDiscussion({
    required String conversationId,
    required String proposalId,
    required String reviewStateId,
    required String target,
    required String comment,
    required String clientMessageId,
  }) {
    return _api.submitAuthoringProposalDiscussion(
      conversationId: conversationId,
      proposalId: proposalId,
      reviewStateId: reviewStateId,
      target: target,
      comment: comment,
      clientMessageId: clientMessageId,
    );
  }

  @override
  Future<AiTurnResponse> runSequentialAuthoringAction({
    required String conversationId,
    required String action,
    String? turnId,
    String? comment,
    String? clientMessageId,
    Object? manualValue,
    String? mode,
  }) {
    return _api.runSequentialAuthoringAction(
      conversationId: conversationId,
      action: action,
      turnId: turnId,
      comment: comment,
      clientMessageId: clientMessageId,
      manualValue: manualValue,
      mode: mode,
    );
  }

  @override
  Future<AiTurnResponse> discussSequentialAuthoringTurn({
    required String conversationId,
    required String turnId,
    required String comment,
    required String clientMessageId,
  }) {
    return _api.discussSequentialAuthoringTurn(
      conversationId: conversationId,
      turnId: turnId,
      comment: comment,
      clientMessageId: clientMessageId,
    );
  }

  @override
  Future<AiAuthoringSnapshot?> loadSequentialAuthoringState({
    required String conversationId,
  }) {
    return _api.loadSequentialAuthoringState(conversationId: conversationId);
  }

  @override
  Future<AuthoringSessionResponse> startAuthoringSession({
    required String conversationId,
  }) {
    return _api.startAuthoringSession(conversationId: conversationId);
  }

  @override
  Future<AuthoringSessionResponse> loadAuthoringSession({
    required String sessionId,
  }) {
    return _api.loadAuthoringSession(sessionId: sessionId);
  }

  @override
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
    return _api.sendAuthoringSessionMessage(
      sessionId: sessionId,
      expectedVersion: expectedVersion,
      text: text,
      clientMessageId: clientMessageId,
      questionId: questionId,
      selectedOptionIds: selectedOptionIds,
      otherText: otherText,
      currentTurnId: currentTurnId,
    );
  }

  @override
  Future<AuthoringSessionResponse> runAuthoringSessionAction({
    required String sessionId,
    required String action,
    required int expectedVersion,
    String? turnId,
    Object? manualValue,
    String? mode,
    String? targetStage,
  }) {
    return _api.runAuthoringSessionAction(
      sessionId: sessionId,
      action: action,
      expectedVersion: expectedVersion,
      turnId: turnId,
      manualValue: manualValue,
      mode: mode,
      targetStage: targetStage,
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
