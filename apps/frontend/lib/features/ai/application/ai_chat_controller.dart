import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../learning_hub/application/learning_hub_providers.dart';
import '../data/ai_repository.dart';
import '../domain/ai_helpers.dart';
import '../domain/ai_models.dart';
import 'ai_assistant_shell_provider.dart';

enum AiChatLoadStatus { idle, loading, ready, error }

class AiPendingSend {
  const AiPendingSend({
    required this.text,
    required this.clientMessageId,
    required this.locale,
  });

  final String text;
  final String clientMessageId;
  final String locale;
}

class AiChatState {
  const AiChatState({
    this.conversationId,
    this.messages = const [],
    this.loadStatus = AiChatLoadStatus.idle,
    this.isSending = false,
    this.pendingSend,
    this.sendError,
    this.disabledByProvider = false,
    this.pendingActionBusyId,
    this.actionErrors = const {},
  });

  final String? conversationId;
  final List<AiMessageItem> messages;
  final AiChatLoadStatus loadStatus;
  final bool isSending;
  final AiPendingSend? pendingSend;
  final ApiException? sendError;
  final bool disabledByProvider;
  final String? pendingActionBusyId;
  final Map<String, ApiException> actionErrors;

  bool get canSend => !isSending && !disabledByProvider;

  AiChatState copyWith({
    String? conversationId,
    List<AiMessageItem>? messages,
    AiChatLoadStatus? loadStatus,
    bool? isSending,
    AiPendingSend? pendingSend,
    ApiException? sendError,
    bool clearSendError = false,
    bool? disabledByProvider,
    bool clearPendingSend = false,
    bool clearConversationId = false,
    String? pendingActionBusyId,
    bool clearPendingActionBusyId = false,
    Map<String, ApiException>? actionErrors,
    bool clearActionErrors = false,
  }) {
    return AiChatState(
      conversationId:
          clearConversationId ? null : conversationId ?? this.conversationId,
      messages: messages ?? this.messages,
      loadStatus: loadStatus ?? this.loadStatus,
      isSending: isSending ?? this.isSending,
      pendingSend: clearPendingSend ? null : pendingSend ?? this.pendingSend,
      sendError: clearSendError ? null : sendError ?? this.sendError,
      disabledByProvider: disabledByProvider ?? this.disabledByProvider,
      pendingActionBusyId: clearPendingActionBusyId
          ? null
          : pendingActionBusyId ?? this.pendingActionBusyId,
      actionErrors: clearActionErrors
          ? const {}
          : actionErrors ?? this.actionErrors,
    );
  }
}

final aiAssistantControllerProvider =
    NotifierProvider<AiAssistantController, AiChatState>(
  AiAssistantController.new,
);

@Deprecated('Use aiAssistantControllerProvider')
final aiGeneralLearningChatProvider = aiAssistantControllerProvider;

class AiAssistantController extends Notifier<AiChatState> {
  AiRepository get _repository => ref.read(aiRepositoryProvider);
  int _messageReloadGeneration = 0;

  @override
  AiChatState build() => const AiChatState();

  Future<void> _reloadConversationMessages(String conversationId) async {
    final generation = ++_messageReloadGeneration;

    try {
      final page =
          await _repository.listMessages(conversationId: conversationId);
      if (generation != _messageReloadGeneration) {
        return;
      }
      if (state.conversationId != conversationId) {
        return;
      }
      if (page.items.isEmpty) {
        return;
      }

      state = state.copyWith(
        messages: reconcileConversationMessages(
          current: state.messages,
          incoming: page.items,
        ),
      );
    } on Object {
      // Keep merged turn messages when background reload fails.
    }
  }

  void resetForSignOut() {
    state = const AiChatState();
  }

  Future<void> startNewChat() async {
    state = const AiChatState(loadStatus: AiChatLoadStatus.ready);
  }

  Future<void> openConversation(String conversationId) async {
    final generation = ++_messageReloadGeneration;
    final isSameConversation = state.conversationId == conversationId;

    state = state.copyWith(
      conversationId: conversationId,
      loadStatus: AiChatLoadStatus.loading,
      clearSendError: true,
      clearPendingSend: true,
      disabledByProvider: false,
      messages: isSameConversation ? state.messages : const [],
    );

    try {
      final page = await _repository.listMessages(conversationId: conversationId);
      if (generation != _messageReloadGeneration) {
        return;
      }
      if (state.conversationId != conversationId) {
        return;
      }

      state = state.copyWith(
        conversationId: conversationId,
        messages: reconcileConversationMessages(
          current: state.messages,
          incoming: page.items,
        ),
        loadStatus: AiChatLoadStatus.ready,
      );
    } on ApiException catch (error) {
      state = state.copyWith(
        loadStatus: AiChatLoadStatus.error,
        sendError: error,
      );
    } on Object catch (_) {
      state = state.copyWith(
        loadStatus: AiChatLoadStatus.error,
        sendError: const ApiException(
          message: 'Something went wrong. Please try again.',
          code: 'UNKNOWN_ERROR',
        ),
      );
    }
  }

  Future<void> sendMessage({
    required String text,
    required String locale,
    String? clientMessageId,
    void Function()? onAccepted,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || !state.canSend) {
      return;
    }

    if (trimmed.length > aiMaxMessageLength) {
      state = state.copyWith(
        sendError: const ApiException(
          message: 'Message is too long.',
          code: 'VALIDATION_ERROR',
        ),
      );
      return;
    }

    AiPendingSend? pending;
    AiMessageItem? optimisticUserMessage;

    try {
      final pendingId = clientMessageId ?? createClientMessageId();
      pending = AiPendingSend(
        text: trimmed,
        clientMessageId: pendingId,
        locale: locale,
      );
      final optimisticId = 'optimistic-$pendingId';
      optimisticUserMessage = AiMessageItem(
        id: optimisticId,
        role: 'USER',
        status: 'COMPLETED',
        contentText: trimmed,
        contentBlocks: const [],
        createdAt: DateTime.now().toUtc(),
      );

      final isRetry = clientMessageId != null;
      final alreadyVisible = state.messages.any(
        (message) =>
            message.id == optimisticId ||
            (isRetry &&
                message.role == 'USER' &&
                message.contentText == trimmed),
      );

      state = state.copyWith(
        isSending: true,
        pendingSend: pending,
        clearSendError: true,
        messages: alreadyVisible
            ? state.messages
            : [...state.messages, optimisticUserMessage],
        loadStatus: AiChatLoadStatus.ready,
      );
      onAccepted?.call();

      var conversationId = state.conversationId;
      if (conversationId == null) {
        final created = await _repository.createConversation(locale: locale);
        conversationId = created.id;
        state = state.copyWith(conversationId: conversationId);
      }

      final turn = await _repository.sendMessage(
        conversationId: conversationId,
        text: trimmed,
        locale: locale,
        clientMessageId: pendingId,
      );

      final mergedMessages = mergeTurnIntoMessages(
        existing: state.messages,
        turn: turn,
        userText: trimmed,
        optimisticId: optimisticId,
      );

      state = state.copyWith(
        conversationId: conversationId,
        messages: mergedMessages,
        loadStatus: AiChatLoadStatus.ready,
        isSending: false,
        clearPendingSend: true,
        disabledByProvider: false,
      );

      ref.invalidate(aiActiveConversationsProvider);
      ref.invalidate(aiArchivedConversationsProvider);

      await _reloadConversationMessages(conversationId);
    } on ApiException catch (error) {
      if (error.code == 'AI_DISABLED') {
        state = state.copyWith(
          isSending: false,
          disabledByProvider: true,
          sendError: error,
          pendingSend: pending,
        );
        return;
      }

      state = state.copyWith(
        isSending: false,
        sendError: error,
        pendingSend: pending,
      );
    } on Object catch (_) {
      state = state.copyWith(
        isSending: false,
        sendError: const ApiException(
          message: 'Something went wrong. Please try again.',
          code: 'UNKNOWN_ERROR',
        ),
        pendingSend: pending,
      );
    }
  }

  Future<void> retryPendingSend() async {
    final pending = state.pendingSend;
    if (pending == null || state.isSending) {
      return;
    }

    await sendMessage(
      text: pending.text,
      locale: pending.locale,
      clientMessageId: pending.clientMessageId,
    );
  }

  Future<void> archiveCurrentConversation() async {
    final conversationId = state.conversationId;
    if (conversationId == null) {
      return;
    }

    await _repository.archiveConversation(conversationId: conversationId);
    ref.invalidate(aiActiveConversationsProvider);
    ref.invalidate(aiArchivedConversationsProvider);
    await startNewChat();
  }

  Future<void> restoreConversation(String conversationId) async {
    await _repository.restoreConversation(conversationId: conversationId);
    ref.invalidate(aiActiveConversationsProvider);
    ref.invalidate(aiArchivedConversationsProvider);
    await openConversation(conversationId);
  }

  Future<void> confirmPendingAction({
    required String pendingActionId,
    required String locale,
  }) async {
    if (state.pendingActionBusyId != null || state.conversationId == null) {
      return;
    }

    final updatedErrors = Map<String, ApiException>.from(state.actionErrors)
      ..remove(pendingActionId);

    state = state.copyWith(
      pendingActionBusyId: pendingActionId,
      actionErrors: updatedErrors,
      clearSendError: true,
    );

    try {
      final resultBlock = await _repository.confirmPendingAction(
        pendingActionId: pendingActionId,
        idempotencyKey: 'confirm-$pendingActionId',
        locale: locale,
      );

      final optimisticMessages = appendActionResultToMessages(
        messages: state.messages,
        pendingActionId: pendingActionId,
        resultBlock: resultBlock,
      );

      state = state.copyWith(
        messages: optimisticMessages,
        clearPendingActionBusyId: true,
      );

      await _reloadConversationMessages(state.conversationId!);
      state = state.copyWith(clearPendingActionBusyId: true);

      if (_shouldRefreshBuildGuideAfterAction(resultBlock)) {
        final buildGuideContext =
            ref.read(aiAssistantShellProvider).buildGuideContext;
        if (buildGuideContext != null) {
          ref.invalidate(projectBuildProvider(buildGuideContext.projectId));
          await ref.refresh(
            projectBuildProvider(buildGuideContext.projectId).future,
          );
          await ref
              .read(aiAssistantShellProvider.notifier)
              .refreshBuildGuideContext();
        }
      }
    } on ApiException catch (error) {
      state = state.copyWith(
        clearPendingActionBusyId: true,
        actionErrors: {
          ...state.actionErrors,
          pendingActionId: error,
        },
      );
    } on Object catch (_) {
      state = state.copyWith(
        clearPendingActionBusyId: true,
        actionErrors: {
          ...state.actionErrors,
          pendingActionId: const ApiException(
            message: 'Action confirmation failed.',
            code: 'AI_ACTION_EXECUTION_FAILED',
          ),
        },
      );
    }
  }

  Future<void> cancelPendingAction(String pendingActionId) async {
    if (state.pendingActionBusyId != null || state.conversationId == null) {
      return;
    }

    state = state.copyWith(
      pendingActionBusyId: pendingActionId,
      clearSendError: true,
    );

    try {
      final resultBlock = await _repository.cancelPendingAction(
        pendingActionId: pendingActionId,
      );

      var messages = state.messages;
      if (resultBlock != null) {
        messages = appendActionResultToMessages(
          messages: messages,
          pendingActionId: pendingActionId,
          resultBlock: resultBlock,
        );
        state = state.copyWith(
          messages: messages,
          clearPendingActionBusyId: true,
        );
      }

      await _reloadConversationMessages(state.conversationId!);
      state = state.copyWith(clearPendingActionBusyId: true);
    } on Object {
      state = state.copyWith(clearPendingActionBusyId: true);
    }
  }
}

bool _shouldRefreshBuildGuideAfterAction(AiContentBlock resultBlock) {
  if (resultBlock.actionStatus != 'EXECUTED') {
    return false;
  }

  switch (resultBlock.actionType) {
    case 'UPDATE_BUILD_COMPONENT_STATUSES':
    case 'LINK_MATERIAL_TO_BUILD_COMPONENT':
    case 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT':
    case 'CONFIRM_MATERIAL_RESERVATION':
    case 'COMPLETE_CURRENT_BUILD_STEP':
      return true;
    default:
      return false;
  }
}

final aiActiveConversationsProvider =
    FutureProvider<List<AiConversationSummary>>((ref) async {
  final page = await ref.watch(aiRepositoryProvider).listConversations(
        status: AiConversationStatus.active,
      );
  return page.items;
});

final aiArchivedConversationsProvider =
    FutureProvider<List<AiConversationSummary>>((ref) async {
  final page = await ref.watch(aiRepositoryProvider).listConversations(
        status: AiConversationStatus.archived,
      );
  return page.items;
});

@Deprecated('Use aiActiveConversationsProvider')
final aiConversationHistoryProvider = aiActiveConversationsProvider;
