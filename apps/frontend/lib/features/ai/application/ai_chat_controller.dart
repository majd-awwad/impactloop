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

bool isSequentialAuthoringStartPhrase(String text) {
  final normalized = text.trim().toLowerCase();
  if (normalized.isEmpty) {
    return false;
  }

  const englishPhrases = <String>{
    'start',
    'begin',
    "let's start",
    'lets start',
  };
  const arabicPhrases = <String>{
    'ابدأ',
    'نبدأ',
    'يلا نبدأ',
    'يلا نبدا',
  };

  if (englishPhrases.contains(normalized)) {
    return true;
  }

  return arabicPhrases.contains(text.trim());
}

class AiChatState {
  const AiChatState({
    this.conversationId,
    this.messages = const [],
    this.loadStatus = AiChatLoadStatus.idle,
    this.isSending = false,
    this.isBootstrapping = false,
    this.isGeneratingProposal = false,
    this.isSubmittingReview = false,
    this.isRevisingProposal = false,
    this.isPreparingApply = false,
    this.pendingSend,
    this.sendError,
    this.proposalRetryPending = false,
    this.disabledByProvider = false,
    this.pendingActionBusyId,
    this.actionErrors = const {},
    this.activeDiscussionTarget,
    this.activeDiscussionProposalId,
    this.activeDiscussionReviewStateId,
    this.authoringSnapshot,
    this.isLoadingAuthoringSnapshot = false,
  });

  final String? conversationId;
  final List<AiMessageItem> messages;
  final AiChatLoadStatus loadStatus;
  final bool isSending;
  final bool isBootstrapping;
  final bool isGeneratingProposal;
  final bool isSubmittingReview;
  final bool isRevisingProposal;
  final bool isPreparingApply;
  final AiPendingSend? pendingSend;
  final ApiException? sendError;
  final bool proposalRetryPending;
  final bool disabledByProvider;
  final String? pendingActionBusyId;
  final Map<String, ApiException> actionErrors;
  final String? activeDiscussionTarget;
  final String? activeDiscussionProposalId;
  final String? activeDiscussionReviewStateId;
  final AiAuthoringSnapshot? authoringSnapshot;
  final bool isLoadingAuthoringSnapshot;

  bool get canSend =>
      !isSending &&
      !disabledByProvider &&
      !isBootstrapping &&
      !isGeneratingProposal &&
      !isSubmittingReview &&
      !isRevisingProposal &&
      !isPreparingApply;

  bool get canGenerateProposal =>
      !isSending &&
      !disabledByProvider &&
      !isBootstrapping &&
      !isGeneratingProposal &&
      !proposalRetryPending &&
      !isSubmittingReview &&
      !isRevisingProposal &&
      !isPreparingApply;

  bool get canReviewProposal =>
      !isSending &&
      !disabledByProvider &&
      !isBootstrapping &&
      !isGeneratingProposal &&
      !isSubmittingReview &&
      !isRevisingProposal &&
      !isPreparingApply;

  AiChatState copyWith({
    String? conversationId,
    List<AiMessageItem>? messages,
    AiChatLoadStatus? loadStatus,
    bool? isSending,
    bool? isBootstrapping,
    bool? isGeneratingProposal,
    bool? isSubmittingReview,
    bool? isRevisingProposal,
    bool? isPreparingApply,
    AiPendingSend? pendingSend,
    ApiException? sendError,
    bool clearSendError = false,
    bool? proposalRetryPending,
    bool clearProposalRetryPending = false,
    bool? disabledByProvider,
    bool clearPendingSend = false,
    bool clearConversationId = false,
    String? pendingActionBusyId,
    bool clearPendingActionBusyId = false,
    Map<String, ApiException>? actionErrors,
    bool clearActionErrors = false,
    String? activeDiscussionTarget,
    String? activeDiscussionProposalId,
    String? activeDiscussionReviewStateId,
    bool clearActiveDiscussion = false,
    AiAuthoringSnapshot? authoringSnapshot,
    bool clearAuthoringSnapshot = false,
    bool? isLoadingAuthoringSnapshot,
  }) {
    return AiChatState(
      conversationId:
          clearConversationId ? null : conversationId ?? this.conversationId,
      messages: messages ?? this.messages,
      loadStatus: loadStatus ?? this.loadStatus,
      isSending: isSending ?? this.isSending,
      isBootstrapping: isBootstrapping ?? this.isBootstrapping,
      isGeneratingProposal: isGeneratingProposal ?? this.isGeneratingProposal,
      isSubmittingReview: isSubmittingReview ?? this.isSubmittingReview,
      isRevisingProposal: isRevisingProposal ?? this.isRevisingProposal,
      isPreparingApply: isPreparingApply ?? this.isPreparingApply,
      pendingSend: clearPendingSend ? null : pendingSend ?? this.pendingSend,
      sendError: clearSendError ? null : sendError ?? this.sendError,
      proposalRetryPending: clearProposalRetryPending
          ? false
          : proposalRetryPending ?? this.proposalRetryPending,
      disabledByProvider: disabledByProvider ?? this.disabledByProvider,
      pendingActionBusyId: clearPendingActionBusyId
          ? null
          : pendingActionBusyId ?? this.pendingActionBusyId,
      actionErrors: clearActionErrors
          ? const {}
          : actionErrors ?? this.actionErrors,
      activeDiscussionTarget: clearActiveDiscussion
          ? null
          : activeDiscussionTarget ?? this.activeDiscussionTarget,
      activeDiscussionProposalId: clearActiveDiscussion
          ? null
          : activeDiscussionProposalId ?? this.activeDiscussionProposalId,
      activeDiscussionReviewStateId: clearActiveDiscussion
          ? null
          : activeDiscussionReviewStateId ?? this.activeDiscussionReviewStateId,
      authoringSnapshot: clearAuthoringSnapshot
          ? null
          : authoringSnapshot ?? this.authoringSnapshot,
      isLoadingAuthoringSnapshot:
          isLoadingAuthoringSnapshot ?? this.isLoadingAuthoringSnapshot,
    );
  }
}

class AuthoringCanonicalApplyNonceNotifier extends Notifier<int> {
  @override
  int build() => 0;

  void bump() {
    state += 1;
  }
}

final authoringCanonicalApplyNonceProvider =
    NotifierProvider<AuthoringCanonicalApplyNonceNotifier, int>(
  AuthoringCanonicalApplyNonceNotifier.new,
);

final authoringActiveWorkspaceProvider =
    NotifierProvider<AuthoringActiveWorkspaceNotifier, AuthoringActiveWorkspace?>(
  AuthoringActiveWorkspaceNotifier.new,
);

class AuthoringActiveWorkspace {
  const AuthoringActiveWorkspace({
    required this.projectId,
    required this.conversationId,
  });

  final String projectId;
  final String conversationId;
}

class AuthoringActiveWorkspaceNotifier extends Notifier<AuthoringActiveWorkspace?> {
  @override
  AuthoringActiveWorkspace? build() => null;

  void activate({
    required String projectId,
    required String conversationId,
  }) {
    state = AuthoringActiveWorkspace(
      projectId: projectId,
      conversationId: conversationId,
    );
  }

  void deactivate() => state = null;
}

class ScopedAuthoringCanonicalUpdate {
  const ScopedAuthoringCanonicalUpdate({
    required this.projectId,
    required this.canonicalUpdatedAt,
    required this.snapshot,
  });

  final String projectId;
  final String canonicalUpdatedAt;
  final AuthoringDraftSnapshot snapshot;
}

class ScopedAuthoringEditorMirror {
  const ScopedAuthoringEditorMirror({
    required this.projectId,
    required this.canonicalUpdatedAt,
    required this.snapshot,
  });

  final String projectId;
  final String canonicalUpdatedAt;
  final AuthoringDraftSnapshot snapshot;
}

final authoringCanonicalProjectUpdateProvider =
    NotifierProvider<AuthoringCanonicalProjectUpdateNotifier, ScopedAuthoringCanonicalUpdate?>(
  AuthoringCanonicalProjectUpdateNotifier.new,
);

final authoringEditorAppliedSnapshotProvider =
    NotifierProvider<AuthoringEditorAppliedSnapshotNotifier, ScopedAuthoringEditorMirror?>(
  AuthoringEditorAppliedSnapshotNotifier.new,
);

class AuthoringEditorAppliedSnapshotNotifier extends Notifier<ScopedAuthoringEditorMirror?> {
  @override
  ScopedAuthoringEditorMirror? build() => null;

  void setMirror(ScopedAuthoringEditorMirror mirror) {
    state = mirror;
  }

  void clear() => state = null;
}

final authoringHighlightedFieldsProvider =
    NotifierProvider<AuthoringHighlightedFieldsNotifier, Set<String>>(
  AuthoringHighlightedFieldsNotifier.new,
);

class AuthoringHighlightedFieldsNotifier extends Notifier<Set<String>> {
  @override
  Set<String> build() => const {};

  void highlight(Set<String> fields) {
    state = fields;
  }

  void clear() {
    state = const {};
  }
}

final authoringSaveSuccessVisibleProvider =
    NotifierProvider<AuthoringSaveSuccessVisibleNotifier, bool>(
  AuthoringSaveSuccessVisibleNotifier.new,
);

class AuthoringSaveSuccessVisibleNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void show() => state = true;
  void hide() => state = false;
}

final authoringSaveSyncFailedProvider =
    NotifierProvider<AuthoringSaveSyncFailedNotifier, bool>(
  AuthoringSaveSyncFailedNotifier.new,
);

class AuthoringSaveSyncFailedNotifier extends Notifier<bool> {
  @override
  bool build() => false;

  void markFailed() => state = true;
  void clear() => state = false;
}

class AuthoringCanonicalProjectUpdateNotifier extends Notifier<ScopedAuthoringCanonicalUpdate?> {
  @override
  ScopedAuthoringCanonicalUpdate? build() => null;

  void setSnapshot(ScopedAuthoringCanonicalUpdate? snapshot) {
    state = snapshot;
  }

  void clear() => state = null;
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
  int _authoringActionGeneration = 0;
  int _authoringSnapshotReloadGeneration = 0;
  String? _pendingSequentialRetryAction;
  String? _pendingSequentialRetryTurnId;
  Object? _pendingSequentialRetryManualValue;
  String? _pendingSequentialRetryMode;

  @override
  AiChatState build() => const AiChatState();

  void resetAuthoringWorkspaceState() {
    ref.read(authoringCanonicalProjectUpdateProvider.notifier).clear();
    ref.read(authoringEditorAppliedSnapshotProvider.notifier).clear();
    ref.read(authoringSaveSyncFailedProvider.notifier).clear();
    ref.read(authoringSaveSuccessVisibleProvider.notifier).hide();
    ref.read(authoringHighlightedFieldsProvider.notifier).clear();
    state = state.copyWith(clearAuthoringSnapshot: true, clearSendError: true);
    _authoringActionGeneration += 1;
    _authoringSnapshotReloadGeneration += 1;
  }

  bool _matchesActiveAuthoringWorkspace(AiAuthoringSnapshot snapshot) {
    final workspace = ref.read(authoringActiveWorkspaceProvider);
    if (workspace == null) {
      return true;
    }
    if (snapshot.session.projectId != workspace.projectId) {
      return false;
    }
    if (state.conversationId != workspace.conversationId) {
      return false;
    }
    if (snapshot.canonicalProject.id != workspace.projectId) {
      return false;
    }
    return true;
  }

  void _applyAuthoringSnapshot(
    AiAuthoringSnapshot? snapshot, {
    Set<String> highlightFields = const {},
  }) {
    if (snapshot == null) {
      return;
    }

    if (!_matchesActiveAuthoringWorkspace(snapshot)) {
      return;
    }

    final current = state.authoringSnapshot;
    if (!_isIncomingAuthoringSnapshotNewer(current, snapshot)) {
      return;
    }

    state = state.copyWith(
      authoringSnapshot: snapshot,
      clearActiveDiscussion: true,
    );
    ref.read(authoringCanonicalProjectUpdateProvider.notifier).setSnapshot(
          ScopedAuthoringCanonicalUpdate(
            projectId: snapshot.session.projectId,
            canonicalUpdatedAt: snapshot.canonicalProject.updatedAt,
            snapshot: snapshot.canonicalProject.toDraftSnapshot(),
          ),
        );
    if (highlightFields.isNotEmpty) {
      ref.read(authoringHighlightedFieldsProvider.notifier).highlight(highlightFields);
    }
  }

  Set<String> _foundationHighlightFields({
    AiAuthoringCanonicalProject? before,
    required AiAuthoringCanonicalProject after,
  }) {
    final fields = <String>{};
    if (before == null || before.title != after.title) {
      fields.add('title');
    }
    if (before == null || before.estimatedMinutes != after.estimatedMinutes) {
      fields.add('estimatedMinutes');
    }
    if (before == null || !_componentsMatch(before.components, after.components)) {
      fields.add('components');
    }
    return fields;
  }

  bool _componentsMatch(
    List<AiAuthoringProposalComponent> before,
    List<AiAuthoringProposalComponent> after,
  ) {
    if (before.length != after.length) {
      return false;
    }
    for (var index = 0; index < before.length; index += 1) {
      final left = before[index];
      final right = after[index];
      if (left.componentName != right.componentName ||
          left.quantity != right.quantity ||
          left.unit != right.unit) {
        return false;
      }
    }
    return true;
  }

  DateTime? _parseAuthoringUpdatedAt(String? value) {
    if (value == null) {
      return null;
    }
    return DateTime.tryParse(value)?.toUtc();
  }

  bool _isIncomingAuthoringSnapshotNewer(
    AiAuthoringSnapshot? current,
    AiAuthoringSnapshot incoming,
  ) {
    if (current == null) {
      return true;
    }

    if (current.session.projectId != incoming.session.projectId) {
      return !_matchesActiveAuthoringWorkspace(current);
    }

    final currentStageRank = _authoringStageRank(current.session.stage);
    final incomingStageRank = _authoringStageRank(incoming.session.stage);
    if (incomingStageRank > currentStageRank) {
      return true;
    }
    if (incomingStageRank < currentStageRank) {
      return false;
    }

    final currentAt = _parseAuthoringUpdatedAt(current.canonicalProject.updatedAt);
    final incomingAt = _parseAuthoringUpdatedAt(incoming.canonicalProject.updatedAt);
    if (currentAt != null && incomingAt != null) {
      if (incomingAt.isAfter(currentAt)) {
        return true;
      }
      if (incomingAt.isBefore(currentAt)) {
        return false;
      }
    }

    final currentTurnId = current.currentSuggestion?.turnId ?? current.currentTurn?.turnId;
    final incomingTurnId =
        incoming.currentSuggestion?.turnId ?? incoming.currentTurn?.turnId;
    if (currentTurnId != incomingTurnId) {
      return incomingTurnId != null;
    }

    return true;
  }

  int _authoringStageRank(String stage) {
    return switch (stage) {
      'OVERVIEW' => 0,
      'TITLE' => 1,
      'SHORT_DESCRIPTION' => 2,
      'FULL_DESCRIPTION' => 3,
      'DIFFICULTY' => 4,
      'ESTIMATED_DURATION' => 5,
      'COMPONENTS' => 6,
      'STEPS_OVERVIEW' => 7,
      'STEP_REVIEW' => 7,
      'FINAL_REVIEW' => 8,
      'COMPLETE' => 9,
      _ => 0,
    };
  }

  bool _canonicalSnapshotApplied(AiAuthoringSnapshot snapshot) {
    final editorMirror = ref.read(authoringEditorAppliedSnapshotProvider);
    if (editorMirror == null) {
      return false;
    }
    if (editorMirror.projectId != snapshot.session.projectId) {
      return false;
    }
    if (editorMirror.canonicalUpdatedAt != snapshot.canonicalProject.updatedAt) {
      return false;
    }
    final canonicalDraft = snapshot.canonicalProject.toDraftSnapshot();
    return authoringDraftSnapshotsSynchronized(
      canonicalDraft,
      editorMirror.snapshot,
      checkSteps: _stageNeedsStepSync(snapshot.session.stage),
    );
  }

  void acknowledgeEditorSynchronized(ScopedAuthoringEditorMirror mirror) {
    final snapshot = state.authoringSnapshot;
    if (snapshot == null) {
      return;
    }
    if (mirror.projectId != snapshot.session.projectId) {
      return;
    }
    if (mirror.canonicalUpdatedAt != snapshot.canonicalProject.updatedAt) {
      return;
    }
    final canonicalDraft = snapshot.canonicalProject.toDraftSnapshot();
    if (!authoringDraftSnapshotsSynchronized(
      canonicalDraft,
      mirror.snapshot,
      checkSteps: _stageNeedsStepSync(snapshot.session.stage),
    )) {
      return;
    }
    ref.read(authoringSaveSyncFailedProvider.notifier).clear();
    ref.read(authoringSaveSuccessVisibleProvider.notifier).show();
    final errorCode = state.sendError?.code;
    if (errorCode == 'AI_COMPONENT_CLIENT_SYNC_FAILED' ||
        errorCode == 'AI_STEP_SAVE_FAILED') {
      state = state.copyWith(clearSendError: true);
    }
  }

  void _evaluateAuthoringSaveSync(AiAuthoringSnapshot snapshot) {
    if (_canonicalSnapshotApplied(snapshot)) {
      ref.read(authoringSaveSyncFailedProvider.notifier).clear();
      ref.read(authoringSaveSuccessVisibleProvider.notifier).show();
      final errorCode = state.sendError?.code;
      if (errorCode == 'AI_COMPONENT_CLIENT_SYNC_FAILED' ||
          errorCode == 'AI_STEP_SAVE_FAILED') {
        state = state.copyWith(clearSendError: true);
      }
      return;
    }
    ref.read(authoringSaveSyncFailedProvider.notifier).markFailed();
    final stage = snapshot.session.stage;
    final syncCode = stage == 'STEPS_OVERVIEW' || stage == 'STEP_REVIEW'
        ? 'AI_STEP_SAVE_FAILED'
        : 'AI_COMPONENT_CLIENT_SYNC_FAILED';
    state = state.copyWith(
      sendError: ApiException(
        message: aiErrorMessageForCode(syncCode, ''),
        code: syncCode,
      ),
    );
  }

  void _applyAuthoringSnapshotFromTurn(
    AiTurnResponse turn, {
    Set<String> highlightFields = const {},
  }) {
    _applyAuthoringSnapshot(turn.authoringSnapshot, highlightFields: highlightFields);
  }

  Future<void> refreshAuthoringSnapshot() async {
    final conversationId = state.conversationId;
    if (conversationId == null) {
      return;
    }

    state = state.copyWith(isLoadingAuthoringSnapshot: true, clearSendError: true);
    try {
      final reloadGeneration = ++_authoringSnapshotReloadGeneration;
      final snapshot =
          await _repository.loadSequentialAuthoringState(conversationId: conversationId);
      if (reloadGeneration != _authoringSnapshotReloadGeneration) {
        return;
      }
      if (state.conversationId != conversationId) {
        return;
      }
      if (snapshot != null) {
        _applyAuthoringSnapshot(snapshot);
      }
    } on ApiException catch (error) {
      state = state.copyWith(sendError: error);
    } finally {
      state = state.copyWith(isLoadingAuthoringSnapshot: false);
    }
  }

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

  bool _stageNeedsStepSync(String stage) {
    return stage == 'STEPS_OVERVIEW' ||
        stage == 'STEP_REVIEW' ||
        stage == 'FINAL_REVIEW';
  }

  Future<void> openConversation(String conversationId) async {
    final generation = ++_messageReloadGeneration;
    final isSameConversation = state.conversationId == conversationId;

    if (!isSameConversation) {
      resetAuthoringWorkspaceState();
    }

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

      if (page.conversation.mode == 'PROJECT_AUTHORING') {
        final workspace = ref.read(authoringActiveWorkspaceProvider);
        if (workspace == null) {
          await refreshAuthoringSnapshot();
        }
      }
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

  bool conversationHasAuthoringClarification([List<AiMessageItem>? messages]) {
    final source = messages ?? state.messages;
    for (final message in source.reversed) {
      for (final block in message.contentBlocks) {
        if (block.type == 'project_authoring_clarification') {
          return true;
        }
      }
    }
    return false;
  }

  Future<void> ensureAuthoringBootstrapped() async {
    final conversationId = state.conversationId;
    if (conversationId == null || state.isBootstrapping || state.isSending) {
      return;
    }

    if (conversationHasAuthoringClarification()) {
      return;
    }

    state = state.copyWith(
      isBootstrapping: true,
      clearSendError: true,
    );

    try {
      final turn = await _repository.startAuthoring(conversationId: conversationId);
      final assistantId = turn.assistantMessageId;
      if (assistantId == null || turn.contentBlocks.isEmpty) {
        throw const ApiException(
          message: 'Authoring bootstrap returned an empty response.',
          code: 'AI_RESPONSE_INVALID',
        );
      }

      final assistantMessage = AiMessageItem(
        id: assistantId,
        role: 'ASSISTANT',
        status: 'COMPLETED',
        contentText: null,
        contentBlocks: turn.contentBlocks,
        createdAt: DateTime.now().toUtc(),
      );

      state = state.copyWith(
        messages: _mergeBootstrapAssistantMessage(
          existing: state.messages,
          assistantMessage: assistantMessage,
          assistantId: assistantId,
        ),
        isBootstrapping: false,
      );

      await _reloadConversationMessages(conversationId);
    } on ApiException catch (error) {
      state = state.copyWith(
        isBootstrapping: false,
        sendError: error,
      );
    } on Object catch (_) {
      state = state.copyWith(
        isBootstrapping: false,
        sendError: const ApiException(
          message: 'Something went wrong. Please try again.',
          code: 'UNKNOWN_ERROR',
        ),
      );
    }
  }

  Future<void> retryAuthoringBootstrap() => ensureAuthoringBootstrapped();

  Future<void> regenerateStepPlanAfterComponentSave() async {
    await runSequentialAuthoringAction(action: 'REGENERATE_STALE');
  }

  Future<void> regenerateStaleAuthoringSuggestion() async {
    await runSequentialAuthoringAction(action: 'REGENERATE_STALE');
  }

  Future<void> retryAuthoringFlow() async {
    if (_pendingSequentialRetryAction != null) {
      await runSequentialAuthoringAction(
        action: _pendingSequentialRetryAction!,
        turnId: _pendingSequentialRetryTurnId,
        manualValue: _pendingSequentialRetryManualValue,
        mode: _pendingSequentialRetryMode,
      );
      return;
    }

    if (state.proposalRetryPending) {
      await generateProjectProposal();
      return;
    }

    if (state.pendingSend != null) {
      await retryPendingSend();
      return;
    }

    await ensureAuthoringBootstrapped();
  }

  ({String? clarificationMessageId, AiContentBlock? proposal})?
      findLatestAuthoringProposalState([List<AiMessageItem>? messages]) {
    final source = messages ?? state.messages;
    String? latestReadyClarificationMessageId;

    for (final message in source.reversed) {
      for (final block in message.contentBlocks) {
        if (block.type == 'project_authoring_clarification' &&
            block.authoringStatus == 'READY_FOR_PROPOSAL') {
          latestReadyClarificationMessageId = message.id;
          break;
        }
      }
      if (latestReadyClarificationMessageId != null) {
        break;
      }
    }

    if (latestReadyClarificationMessageId == null) {
      return null;
    }

    AiContentBlock? bestProposal;
    var bestVersion = 0;

    for (final message in source.reversed) {
      for (final block in message.contentBlocks) {
        if (block.type != 'project_authoring_proposal') {
          continue;
        }
        if (block.authoringProposalClarificationMessageId !=
            latestReadyClarificationMessageId) {
          continue;
        }

        final version = block.authoringProposalVersion ?? 1;
        if (version >= bestVersion) {
          bestVersion = version;
          bestProposal = block;
        }
      }
    }

    return (
      clarificationMessageId: latestReadyClarificationMessageId,
      proposal: bestProposal,
    );
  }

  AiAuthoringSession? findLatestAuthoringSession([List<AiMessageItem>? messages]) {
    final source = messages ?? state.messages;
    for (final message in source.reversed) {
      for (final block in message.contentBlocks) {
        final session = block.authoringSession;
        if (session != null) {
          return session;
        }
      }
    }
    return null;
  }

  AiAuthoringTurn? findCurrentAuthoringTurn([List<AiMessageItem>? messages]) {
    final session = findLatestAuthoringSession(messages);
    if (session == null) {
      return null;
    }
    final source = messages ?? state.messages;
    AiAuthoringTurn? latestTurn;
    for (final message in source.reversed) {
      for (final block in message.contentBlocks) {
        final turn = block.authoringTurn;
        if (turn != null &&
            turn.sessionId == session.sessionId &&
            turn.status == 'PROPOSED') {
          latestTurn = turn;
          break;
        }
      }
      if (latestTurn != null) {
        break;
      }
    }
    if (latestTurn != null) {
      return latestTurn;
    }
    if (session.currentTurnId == null) {
      return null;
    }
    for (final message in source.reversed) {
      for (final block in message.contentBlocks) {
        final turn = block.authoringTurn;
        if (turn != null && turn.turnId == session.currentTurnId) {
          return turn;
        }
      }
    }
    return null;
  }

  bool get hasActiveSequentialAuthoring {
    final session = findLatestAuthoringSession();
    return session != null && !session.isComplete;
  }

  bool get hasLegacyAuthoringWithoutSession {
    if (findLatestAuthoringSession() != null) {
      return false;
    }

    for (final message in state.messages.reversed) {
      for (final block in message.contentBlocks) {
        if (block.type == 'project_authoring_proposal' ||
            block.type == 'project_authoring_review_state') {
          return true;
        }
      }
    }
    return false;
  }

  Future<void> runSequentialAuthoringAction({
    required String action,
    String? turnId,
    String? comment,
    Object? manualValue,
    String? mode,
  }) async {
    final conversationId = state.conversationId;
    if (conversationId == null) {
      return;
    }

    final actionGeneration = ++_authoringActionGeneration;
    _pendingSequentialRetryAction = action;
    _pendingSequentialRetryTurnId = turnId;
    _pendingSequentialRetryManualValue = manualValue;
    _pendingSequentialRetryMode = mode;

    state = state.copyWith(isSubmittingReview: true, clearSendError: true);
    try {
      final turn = await _repository.runSequentialAuthoringAction(
        conversationId: conversationId,
        action: action,
        turnId: turnId,
        comment: comment,
        clientMessageId: comment == null
            ? null
            : createClientMessageId(),
        manualValue: manualValue,
        mode: mode,
      );
      if (actionGeneration != _authoringActionGeneration) {
        return;
      }
      if (state.conversationId != conversationId) {
        return;
      }
      await _mergeAuthoringTurn(conversationId, turn);
      final snapshot = turn.authoringSnapshot;
      final previousCanonical = state.authoringSnapshot?.canonicalProject;
      final highlightFields = snapshot == null
          ? const <String>{}
          : _foundationHighlightFields(
              before: previousCanonical,
              after: snapshot.canonicalProject,
            );
      _applyAuthoringSnapshotFromTurn(turn, highlightFields: highlightFields);
      _pendingSequentialRetryAction = null;
      _pendingSequentialRetryTurnId = null;
      _pendingSequentialRetryManualValue = null;
      _pendingSequentialRetryMode = null;
      if (action == 'ACCEPT_TURN' || action == 'SAVE_MANUAL') {
        ref.read(authoringSaveSyncFailedProvider.notifier).clear();
        ref.read(authoringSaveSuccessVisibleProvider.notifier).hide();
        if (snapshot != null) {
          Future.microtask(() {
            if (!ref.mounted) {
              return;
            }
            if (state.authoringSnapshot?.canonicalProject.updatedAt !=
                snapshot.canonicalProject.updatedAt) {
              return;
            }
            _evaluateAuthoringSaveSync(snapshot);
          });
        }
      }
    } on ApiException catch (error) {
      state = state.copyWith(
        sendError: ApiException(
          message: aiErrorMessageForCode(error.code, error.message),
          code: error.code,
        ),
      );
    } on Object catch (_) {
      state = state.copyWith(
        sendError: const ApiException(
          message: 'Authoring action failed. Please try again.',
          code: 'UNKNOWN_ERROR',
        ),
      );
    } finally {
      state = state.copyWith(isSubmittingReview: false);
    }
  }

  void selectSequentialDiscussionTarget() {
    final snapshot = state.authoringSnapshot;
    final turn = snapshot?.currentTurn ?? findCurrentAuthoringTurn();
    final session = snapshot?.session;
    if (turn == null && session == null) {
      return;
    }
    state = state.copyWith(
      activeDiscussionTarget: turn?.stage ?? session?.stage,
      clearSendError: true,
    );
  }

  void clearSendError() {
    state = state.copyWith(clearSendError: true);
  }

  Future<void> submitSequentialComposerMessage({
    required String text,
    required String locale,
  }) async {
    final conversationId = state.conversationId;
    final trimmed = text.trim();
    if (conversationId == null || trimmed.isEmpty || !state.canSend) {
      return;
    }

    final snapshot = state.authoringSnapshot;
    final messageSession = findLatestAuthoringSession();
    final activeStage = snapshot?.session.stage ?? messageSession?.stage;
    final clientMessageId = createClientMessageId();
    final optimisticId = 'optimistic-$clientMessageId';
    final optimisticUserMessage = AiMessageItem(
      id: optimisticId,
      role: 'USER',
      status: 'COMPLETED',
      contentText: trimmed,
      contentBlocks: const [],
      createdAt: DateTime.now().toUtc(),
    );

    state = state.copyWith(
      isSubmittingReview: true,
      isSending: true,
      clearSendError: true,
      messages: [...state.messages, optimisticUserMessage],
    );

    try {
      if (activeStage == 'OVERVIEW' ||
          activeStage == 'TITLE' ||
          activeStage == 'ESTIMATED_DURATION' ||
          activeStage == 'COMPONENTS') {
        final turn = await _repository.runSequentialAuthoringAction(
          conversationId: conversationId,
          action: 'COMPOSER_MESSAGE',
          comment: trimmed,
          clientMessageId: clientMessageId,
        );
        await _mergeAuthoringTurn(conversationId, turn);
        _applyAuthoringSnapshotFromTurn(turn);
      } else {
        final turn = snapshot?.currentSuggestion ?? snapshot?.currentTurn;
        if (turn != null) {
          final turnId = turn is AiAuthoringCurrentSuggestion
              ? turn.turnId
              : (turn as AiAuthoringTurn).turnId;
          final turnResponse = await _repository.discussSequentialAuthoringTurn(
            conversationId: conversationId,
            turnId: turnId,
            comment: trimmed,
            clientMessageId: clientMessageId,
          );
          await _mergeAuthoringTurn(conversationId, turnResponse);
          _applyAuthoringSnapshotFromTurn(turnResponse);
        } else {
          await sendMessage(
            text: trimmed,
            locale: locale,
            clientMessageId: clientMessageId,
          );
          return;
        }
      }
    } on ApiException catch (error) {
      state = state.copyWith(
        sendError: ApiException(
          message: aiErrorMessageForCode(error.code, error.message),
          code: error.code,
        ),
      );
    } finally {
      state = state.copyWith(isSubmittingReview: false, isSending: false);
    }
  }

  Future<void> submitSequentialDiscussionComment({
    required String text,
    required String locale,
  }) async {
    final conversationId = state.conversationId;
    final turn = state.authoringSnapshot?.currentTurn ?? findCurrentAuthoringTurn();
    if (conversationId == null || turn == null) {
      return;
    }
    final trimmed = text.trim();
    if (trimmed.length < 8) {
      state = state.copyWith(
        sendError: const ApiException(
          message: 'Describe the change you want in more detail.',
          code: 'VALIDATION_ERROR',
        ),
      );
      return;
    }

    final clientMessageId = createClientMessageId();
    state = state.copyWith(isSubmittingReview: true, isSending: true, clearSendError: true);
    try {
      final turnResponse = await _repository.discussSequentialAuthoringTurn(
        conversationId: conversationId,
        turnId: turn.turnId,
        comment: trimmed,
        clientMessageId: clientMessageId,
      );
      await _mergeAuthoringTurn(conversationId, turnResponse);
      _applyAuthoringSnapshotFromTurn(turnResponse);
      state = state.copyWith(clearActiveDiscussion: true);
    } on ApiException catch (error) {
      state = state.copyWith(sendError: error);
    } finally {
      state = state.copyWith(isSubmittingReview: false, isSending: false);
    }
  }

  AiAuthoringReviewState? findLatestReviewStateForProposal(
    String proposalId, [
    List<AiMessageItem>? messages,
  ]) {
    final source = messages ?? state.messages;
    for (final message in source.reversed) {
      for (final block in message.contentBlocks) {
        final review = block.authoringReviewState;
        if (review != null && review.proposalId == proposalId) {
          return review;
        }
      }
    }
    return null;
  }

  AiAuthoringProposalDiff? findLatestDiffForProposal(
    String proposalId, [
    List<AiMessageItem>? messages,
  ]) {
    final source = messages ?? state.messages;
    for (final message in source.reversed) {
      for (final block in message.contentBlocks) {
        final diff = block.authoringProposalDiff;
        if (diff != null) {
          return diff;
        }
      }
      for (final block in message.contentBlocks) {
        if (block.type == 'project_authoring_proposal' &&
            block.authoringProposalId == proposalId) {
          break;
        }
      }
    }
    for (final message in source.reversed) {
      for (final block in message.contentBlocks) {
        final diff = block.authoringProposalDiff;
        if (diff != null) {
          return diff;
        }
      }
    }
    return null;
  }

  AuthoringReviewProgress computeAuthoringReviewProgress(
    AiAuthoringReviewState? review,
  ) {
    if (review == null) {
      return const AuthoringReviewProgress(
        resolved: 0,
        needsDiscussion: 0,
        unreviewed: 7,
        total: 7,
        status: 'IN_REVIEW',
      );
    }

    bool isResolved(String decision) =>
        decision == 'ACCEPT_PROPOSAL' || decision == 'KEEP_CURRENT';
    bool isDiscussion(String decision) =>
        decision == 'UNDER_DISCUSSION' ||
        decision == 'REVISION_REQUESTED' ||
        decision == 'NEEDS_REVISION';

    final decisions = [
      review.fieldDecisions.title,
      review.fieldDecisions.shortDescription,
      review.fieldDecisions.description,
      review.fieldDecisions.difficulty,
      review.fieldDecisions.estimatedMinutes,
      review.componentDecision,
      review.stepDecision,
    ];

    final resolved = decisions.where(isResolved).length;
    final needsDiscussion = decisions.where(isDiscussion).length;
    final unreviewed = decisions.where((d) => d == 'UNREVIEWED').length;

    return AuthoringReviewProgress(
      resolved: resolved,
      needsDiscussion: needsDiscussion,
      unreviewed: unreviewed,
      total: 7,
      status: review.isApplied
          ? 'APPLIED'
          : review.isReadyToApply
          ? 'READY_TO_APPLY'
          : needsDiscussion > 0
          ? 'DISCUSSION_NEEDED'
          : 'IN_REVIEW',
    );
  }

  void selectDiscussionTarget({
    required String proposalId,
    required String reviewStateId,
    required String target,
  }) {
    state = state.copyWith(
      activeDiscussionTarget: target,
      activeDiscussionProposalId: proposalId,
      activeDiscussionReviewStateId: reviewStateId,
      clearSendError: true,
    );
  }

  void clearDiscussionTarget() {
    state = state.copyWith(clearActiveDiscussion: true);
  }

  Future<void> submitDiscussionComment({
    required String text,
    required String locale,
  }) async {
    final conversationId = state.conversationId;
    final target = state.activeDiscussionTarget;
    final proposalId = state.activeDiscussionProposalId;
    final reviewStateId = state.activeDiscussionReviewStateId;
    if (conversationId == null ||
        target == null ||
        proposalId == null ||
        reviewStateId == null ||
        !state.canReviewProposal) {
      return;
    }

    final trimmed = text.trim();
    if (trimmed.length < 8) {
      state = state.copyWith(
        sendError: const ApiException(
          message: 'Describe the change you want in more detail.',
          code: 'VALIDATION_ERROR',
        ),
      );
      return;
    }

    final clientMessageId = createClientMessageId();
    final optimisticId = 'optimistic-$clientMessageId';
    final optimisticUserMessage = AiMessageItem(
      id: optimisticId,
      role: 'USER',
      status: 'COMPLETED',
      contentText: trimmed,
      contentBlocks: [
        AiContentBlock(
          type: 'project_authoring_discussion_context',
          authoringDiscussionTarget: target,
          authoringDiscussionProposalId: proposalId,
          authoringDiscussionReviewStateId: reviewStateId,
        ),
      ],
      createdAt: DateTime.now().toUtc(),
    );

    state = state.copyWith(
      isSubmittingReview: true,
      clearSendError: true,
      isSending: true,
      messages: [...state.messages, optimisticUserMessage],
    );

    try {
      final turn = await _repository.submitAuthoringProposalDiscussion(
        conversationId: conversationId,
        proposalId: proposalId,
        reviewStateId: reviewStateId,
        target: target,
        comment: trimmed,
        clientMessageId: clientMessageId,
      );

      final mergedMessages = mergeTurnIntoMessages(
        existing: state.messages,
        turn: turn,
        userText: trimmed,
        optimisticId: optimisticId,
      );

      state = state.copyWith(
        messages: mergedMessages,
        isSending: false,
        clearActiveDiscussion: true,
      );

      await _reloadConversationMessages(conversationId);
    } on ApiException catch (error) {
      state = state.copyWith(
        sendError: error,
        isSending: false,
        messages: state.messages
            .where((message) => message.id != optimisticId)
            .toList(growable: false),
      );
    } on Object catch (_) {
      state = state.copyWith(
        sendError: const ApiException(
          message: 'Something went wrong. Please try again.',
          code: 'UNKNOWN_ERROR',
        ),
        isSending: false,
        messages: state.messages
            .where((message) => message.id != optimisticId)
            .toList(growable: false),
      );
    } finally {
      state = state.copyWith(isSubmittingReview: false, isSending: false);
    }
  }

  Future<void> submitAuthoringReviewDecision({
    required String proposalId,
    required String target,
    required String decision,
    String? comment,
  }) async {
    final conversationId = state.conversationId;
    if (conversationId == null || !state.canReviewProposal) {
      return;
    }

    state = state.copyWith(isSubmittingReview: true, clearSendError: true);

    try {
      final turn = await _repository.submitAuthoringProposalReview(
        conversationId: conversationId,
        proposalId: proposalId,
        target: target,
        decision: decision,
        comment: comment,
      );
      await _mergeAuthoringTurn(conversationId, turn);
    } on ApiException catch (error) {
      state = state.copyWith(sendError: error);
    } on Object catch (_) {
      state = state.copyWith(
        sendError: const ApiException(
          message: 'Something went wrong. Please try again.',
          code: 'UNKNOWN_ERROR',
        ),
      );
    } finally {
      state = state.copyWith(isSubmittingReview: false);
    }
  }

  void changeReviewDecision({
    required String proposalId,
    required String reviewStateId,
    required String target,
  }) {
    selectDiscussionTarget(
      proposalId: proposalId,
      reviewStateId: reviewStateId,
      target: target,
    );
  }

  Future<void> reviseAuthoringProposal({
    required String proposalId,
    required String reviewStateId,
  }) async {
    final conversationId = state.conversationId;
    if (conversationId == null || !state.canReviewProposal) {
      return;
    }

    state = state.copyWith(isRevisingProposal: true, clearSendError: true);

    try {
      final turn = await _repository.reviseAuthoringProposal(
        conversationId: conversationId,
        proposalId: proposalId,
        reviewStateId: reviewStateId,
      );
      await _mergeAuthoringTurn(conversationId, turn);
    } on ApiException catch (error) {
      state = state.copyWith(sendError: error);
    } on Object catch (_) {
      state = state.copyWith(
        sendError: const ApiException(
          message: 'Something went wrong. Please try again.',
          code: 'UNKNOWN_ERROR',
        ),
      );
    } finally {
      state = state.copyWith(isRevisingProposal: false);
    }
  }

  Future<void> prepareApplyReviewedAuthoringProposal({
    required String reviewStateId,
  }) async {
    final conversationId = state.conversationId;
    if (conversationId == null || !state.canReviewProposal) {
      return;
    }

    state = state.copyWith(isPreparingApply: true, clearSendError: true);

    try {
      final turn = await _repository.prepareApplyReviewedAuthoringProposal(
        conversationId: conversationId,
        reviewStateId: reviewStateId,
      );
      await _mergeAuthoringTurn(conversationId, turn);
    } on ApiException catch (error) {
      state = state.copyWith(sendError: error);
    } on Object catch (_) {
      state = state.copyWith(
        sendError: const ApiException(
          message: 'Something went wrong. Please try again.',
          code: 'UNKNOWN_ERROR',
        ),
      );
    } finally {
      state = state.copyWith(isPreparingApply: false);
    }
  }

  Future<void> _mergeAuthoringTurn(
    String conversationId,
    AiTurnResponse turn,
  ) async {
    final assistantId = turn.assistantMessageId;
    if (assistantId == null || turn.contentBlocks.isEmpty) {
      throw const ApiException(
        message: 'Authoring response was empty.',
        code: 'AI_RESPONSE_INVALID',
      );
    }

    final assistantMessage = AiMessageItem(
      id: assistantId,
      role: 'ASSISTANT',
      status: 'COMPLETED',
      contentText: null,
      contentBlocks: turn.contentBlocks,
      createdAt: DateTime.now().toUtc(),
    );

    state = state.copyWith(
      messages: _mergeBootstrapAssistantMessage(
        existing: state.messages,
        assistantMessage: assistantMessage,
        assistantId: assistantId,
      ),
    );

    await _reloadConversationMessages(conversationId);
  }

  bool hasCurrentAuthoringProposal({
    required DateTime projectUpdatedAt,
    List<AiMessageItem>? messages,
  }) {
    final proposalState = findLatestAuthoringProposalState(messages);
    final proposal = proposalState?.proposal;
    if (proposal == null) {
      return false;
    }

    final baseUpdatedAt = proposal.authoringProposalBaseUpdatedAt;
    if (baseUpdatedAt == null) {
      return true;
    }

    return baseUpdatedAt == projectUpdatedAt.toUtc().toIso8601String();
  }

  Future<void> generateProjectProposal() async {
    final conversationId = state.conversationId;
    if (conversationId == null) {
      return;
    }
    if (hasActiveSequentialAuthoring) {
      final session = findLatestAuthoringSession();
      if (session?.stage == 'OVERVIEW') {
        await runSequentialAuthoringAction(action: 'START');
      }
      return;
    }
    if (!state.canGenerateProposal && !state.proposalRetryPending) {
      return;
    }

    state = state.copyWith(
      isGeneratingProposal: true,
      clearSendError: true,
      clearProposalRetryPending: true,
    );

    try {
      final turn = await _repository.generateAuthoringProposal(
        conversationId: conversationId,
      );
      final assistantId = turn.assistantMessageId;
      if (assistantId == null || turn.contentBlocks.isEmpty) {
        throw const ApiException(
          message: 'Proposal generation returned an empty response.',
          code: 'AI_RESPONSE_INVALID',
        );
      }

      final assistantMessage = AiMessageItem(
        id: assistantId,
        role: 'ASSISTANT',
        status: 'COMPLETED',
        contentText: null,
        contentBlocks: turn.contentBlocks,
        createdAt: DateTime.now().toUtc(),
      );

      state = state.copyWith(
        messages: _mergeBootstrapAssistantMessage(
          existing: state.messages,
          assistantMessage: assistantMessage,
          assistantId: assistantId,
        ),
        isGeneratingProposal: false,
        clearProposalRetryPending: true,
      );

      await _reloadConversationMessages(conversationId);
    } on ApiException catch (error) {
      state = state.copyWith(
        isGeneratingProposal: false,
        sendError: error,
        proposalRetryPending: true,
      );
    } on Object catch (_) {
      state = state.copyWith(
        isGeneratingProposal: false,
        sendError: const ApiException(
          message: 'Something went wrong. Please try again.',
          code: 'UNKNOWN_ERROR',
        ),
        proposalRetryPending: true,
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

    final session = findLatestAuthoringSession();
    if (session != null && session.stage == 'OVERVIEW') {
      onAccepted?.call();
      await submitSequentialComposerMessage(text: trimmed, locale: locale);
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
        buildGuideContext: ref
            .read(aiAssistantShellProvider)
            .buildGuideContext
            ?.toModelRequestPayload(),
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
          await ref.read(
            projectBuildProvider(buildGuideContext.projectId).future,
          );
          await ref
              .read(aiAssistantShellProvider.notifier)
              .refreshBuildGuideContext();
        }
      }

      if (_shouldRefreshAuthoringProjectAfterAction(resultBlock)) {
        final projectId = resultBlock.actionTarget?.id;
        if (projectId != null && projectId.isNotEmpty) {
          ref.read(authoringCanonicalApplyNonceProvider.notifier).bump();
          ref.invalidate(myLearningProjectSubmissionProvider(projectId));
          await ref.read(myLearningProjectSubmissionProvider(projectId).future);
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

List<AiMessageItem> _mergeBootstrapAssistantMessage({
  required List<AiMessageItem> existing,
  required AiMessageItem assistantMessage,
  required String assistantId,
}) {
  final preserved = existing
      .where((message) => message.id != assistantId)
      .toList(growable: false);
  return [...preserved, assistantMessage];
}

bool _shouldRefreshAuthoringProjectAfterAction(AiContentBlock resultBlock) {
  return resultBlock.actionStatus == 'EXECUTED' &&
      resultBlock.actionType == 'APPLY_PROJECT_AUTHORING_PROPOSAL' &&
      resultBlock.actionTarget?.type == 'PROJECT';
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
