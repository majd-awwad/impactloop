import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../data/ai_repository.dart';
import '../domain/ai_helpers.dart';
import '../domain/ai_models.dart';
import '../domain/authoring_session_models.dart';
import 'ai_chat_controller.dart';

enum AuthoringWorkspaceLifecycle {
  inactive,
  activating,
  loading,
  ready,
  failed,
  disposed,
}

class AuthoringWorkspaceState {
  const AuthoringWorkspaceState({
    this.key,
    this.response,
    this.snapshot,
    this.historicalTurns = const [],
    this.pendingUserMessages = const [],
    this.sessionConversationMessages = const [],
    this.lifecycle = AuthoringWorkspaceLifecycle.inactive,
    this.isBusy = false,
    this.actionError,
    this.hasLegacyWithoutSession = false,
    this.requestGeneration = 0,
    this.workspaceGeneration = 0,
    this.lastActionTurnId,
    this.activeAction,
  });

  final AuthoringWorkspaceKey? key;
  final AuthoringSessionResponse? response;
  final AiAuthoringSnapshot? snapshot;
  final List<AuthoringHistoricalTurnSummary> historicalTurns;
  final List<AiMessageItem> pendingUserMessages;
  final List<AiMessageItem> sessionConversationMessages;
  final AuthoringWorkspaceLifecycle lifecycle;
  final bool isBusy;
  final ApiException? actionError;
  final bool hasLegacyWithoutSession;
  final int requestGeneration;
  final int workspaceGeneration;
  final String? lastActionTurnId;
  final String? activeAction;

  bool get isReady =>
      lifecycle == AuthoringWorkspaceLifecycle.ready &&
      key != null &&
      response != null &&
      snapshot != null;

  bool get isActive => isReady;

  bool get isLoading =>
      lifecycle == AuthoringWorkspaceLifecycle.activating ||
      lifecycle == AuthoringWorkspaceLifecycle.loading;

  bool get isComplete =>
      response?.session.status == 'COMPLETE' ||
      response?.session.stage == 'COMPLETE';

  AuthoringWorkspaceState copyWith({
    AuthoringWorkspaceKey? key,
    bool clearKey = false,
    AuthoringSessionResponse? response,
    bool clearResponse = false,
    AiAuthoringSnapshot? snapshot,
    bool clearSnapshot = false,
    List<AuthoringHistoricalTurnSummary>? historicalTurns,
    List<AiMessageItem>? pendingUserMessages,
    List<AiMessageItem>? sessionConversationMessages,
    AuthoringWorkspaceLifecycle? lifecycle,
    bool? isBusy,
    ApiException? actionError,
    bool clearActionError = false,
    bool? hasLegacyWithoutSession,
    int? requestGeneration,
    int? workspaceGeneration,
    String? lastActionTurnId,
    bool clearLastActionTurnId = false,
    String? activeAction,
    bool clearActiveAction = false,
  }) {
    return AuthoringWorkspaceState(
      key: clearKey ? null : key ?? this.key,
      response: clearResponse ? null : response ?? this.response,
      snapshot: clearSnapshot ? null : snapshot ?? this.snapshot,
      historicalTurns: historicalTurns ?? this.historicalTurns,
      pendingUserMessages: pendingUserMessages ?? this.pendingUserMessages,
      sessionConversationMessages:
          sessionConversationMessages ?? this.sessionConversationMessages,
      lifecycle: lifecycle ?? this.lifecycle,
      isBusy: isBusy ?? this.isBusy,
      actionError: clearActionError ? null : actionError ?? this.actionError,
      hasLegacyWithoutSession:
          hasLegacyWithoutSession ?? this.hasLegacyWithoutSession,
      requestGeneration: requestGeneration ?? this.requestGeneration,
      workspaceGeneration: workspaceGeneration ?? this.workspaceGeneration,
      lastActionTurnId:
          clearLastActionTurnId ? null : lastActionTurnId ?? this.lastActionTurnId,
      activeAction: clearActiveAction ? null : activeAction ?? this.activeAction,
    );
  }
}

final authoringWorkspaceControllerProvider =
    NotifierProvider<AuthoringWorkspaceController, AuthoringWorkspaceState>(
  AuthoringWorkspaceController.new,
);

class AuthoringWorkspaceController extends Notifier<AuthoringWorkspaceState> {
  AiRepository get _repository => ref.read(aiRepositoryProvider);
  int _operationGeneration = 0;
  int _workspaceGeneration = 0;

  @override
  AuthoringWorkspaceState build() => const AuthoringWorkspaceState();

  @visibleForTesting
  int get operationGeneration => _operationGeneration;

  @visibleForTesting
  int get workspaceGeneration => _workspaceGeneration;

  void deactivate() {
    _operationGeneration += 1;
    _workspaceGeneration += 1;
    ref.read(authoringCanonicalProjectUpdateProvider.notifier).clear();
    ref.read(authoringEditorAppliedSnapshotProvider.notifier).clear();
    ref.read(authoringSaveSyncFailedProvider.notifier).clear();
    ref.read(authoringSaveSuccessVisibleProvider.notifier).hide();
    ref.read(authoringHighlightedFieldsProvider.notifier).clear();
    state = AuthoringWorkspaceState(
      lifecycle: AuthoringWorkspaceLifecycle.disposed,
      workspaceGeneration: _workspaceGeneration,
    );
    state = AuthoringWorkspaceState(workspaceGeneration: _workspaceGeneration);
  }

  Future<void> activateAndLoad({
    required String projectId,
    required String conversationId,
    bool hasLegacyBlocks = false,
  }) async {
    final nextKey = AuthoringWorkspaceKey(
      projectId: projectId,
      conversationId: conversationId,
    );
    if (state.key != null &&
        (state.key!.projectId != projectId ||
            state.key!.conversationId != conversationId)) {
      _operationGeneration += 1;
      _workspaceGeneration += 1;
      ref.read(authoringCanonicalProjectUpdateProvider.notifier).clear();
      ref.read(authoringEditorAppliedSnapshotProvider.notifier).clear();
      ref.read(authoringSaveSyncFailedProvider.notifier).clear();
      ref.read(authoringSaveSuccessVisibleProvider.notifier).hide();
      ref.read(authoringHighlightedFieldsProvider.notifier).clear();
      state = AuthoringWorkspaceState(workspaceGeneration: _workspaceGeneration);
    }

    final generation = ++_operationGeneration;
    final workspaceGen = ++_workspaceGeneration;
    final sameWorkspace = state.key?.projectId == projectId &&
        state.key?.conversationId == conversationId;
    state = state.copyWith(
      key: nextKey,
      lifecycle: AuthoringWorkspaceLifecycle.activating,
      workspaceGeneration: workspaceGen,
      clearActionError: true,
      hasLegacyWithoutSession: hasLegacyBlocks,
      historicalTurns: sameWorkspace ? state.historicalTurns : const [],
      pendingUserMessages: sameWorkspace ? state.pendingUserMessages : const [],
      sessionConversationMessages:
          sameWorkspace ? state.sessionConversationMessages : const [],
      clearSnapshot: !sameWorkspace,
      clearResponse: !sameWorkspace,
      clearLastActionTurnId: true,
    );

    if (hasLegacyBlocks) {
      state = state.copyWith(
        lifecycle: AuthoringWorkspaceLifecycle.ready,
        hasLegacyWithoutSession: true,
      );
      return;
    }

    state = state.copyWith(lifecycle: AuthoringWorkspaceLifecycle.loading);

    try {
      final response = await _repository.startAuthoringSession(
        conversationId: conversationId,
      );
      if (!_matchesGeneration(generation, nextKey, workspaceGen)) {
        return;
      }
      _applyResponse(
        response,
        hasLegacyBlocks: hasLegacyBlocks,
        generation: generation,
      );
      _ingestConversationMessages(response);
      state = state.copyWith(lifecycle: AuthoringWorkspaceLifecycle.ready);
    } on ApiException catch (error) {
      if (!_matchesGeneration(generation, nextKey, workspaceGen)) {
        return;
      }
      if (hasLegacyBlocks && _isSessionMissingError(error)) {
        state = state.copyWith(
          lifecycle: AuthoringWorkspaceLifecycle.ready,
          hasLegacyWithoutSession: true,
        );
        return;
      }
      state = state.copyWith(
        lifecycle: AuthoringWorkspaceLifecycle.failed,
        actionError: _mapError(error),
      );
    }
  }

  Future<void> reload() async {
    if (state.isLoading || state.isBusy) {
      return;
    }
    final sessionId = state.key?.sessionId ?? state.response?.session.id;
    final key = state.key;
    if (sessionId == null || key == null) {
      return;
    }
    final generation = ++_operationGeneration;
    final workspaceGen = state.workspaceGeneration;
    state = state.copyWith(
      lifecycle: AuthoringWorkspaceLifecycle.loading,
      isBusy: true,
      activeAction: 'RELOAD_DRAFT',
      clearActionError: true,
    );
    try {
      // The session load reads the owning persisted project and returns its
      // canonical draft. It is intentionally read-only: no new session or
      // draft is created by this recovery action.
      final response = await _repository.loadAuthoringSession(sessionId: sessionId);
      if (!_matchesGeneration(generation, key, workspaceGen)) {
        return;
      }
      _applyResponse(response, generation: generation);
      _ingestConversationMessages(response);
      state = state.copyWith(lifecycle: AuthoringWorkspaceLifecycle.ready);
      _scheduleSaveSyncCheck(response);
    } on ApiException catch (error) {
      if (!_matchesGeneration(generation, key, workspaceGen)) {
        return;
      }
      state = state.copyWith(
        // Keep the existing workspace and local draft visible when a recovery
        // fetch fails. The localized action error is rendered in place.
        lifecycle: AuthoringWorkspaceLifecycle.ready,
        actionError: _mapError(error),
      );
    } finally {
      if (_matchesGeneration(generation, key, workspaceGen)) {
        state = state.copyWith(isBusy: false, clearActiveAction: true);
      }
    }
  }

  Future<void> continueGuidedAuthoring() async {
    final key = state.key;
    if (key == null) {
      return;
    }
    await activateAndLoad(
      projectId: key.projectId,
      conversationId: key.conversationId,
      hasLegacyBlocks: false,
    );
  }

  Future<void> sendFeedback({
    required String text,
    required String locale,
  }) async {
    final trimmed = text.trim();
    final response = state.response;
    final key = state.key;
    if (trimmed.isEmpty || response == null || key == null || state.isBusy) {
      return;
    }

    final generation = ++_operationGeneration;
    final workspaceGen = state.workspaceGeneration;
    final previousTurn = response.currentTurn;
    final isRetry = state.actionError != null &&
        state.pendingUserMessages.isNotEmpty &&
        state.pendingUserMessages.last.contentText == trimmed;
    final clientMessageId = isRetry
        ? state.pendingUserMessages.last.id.replaceFirst('optimistic-', '')
        : createClientMessageId();
    final optimisticId = 'optimistic-$clientMessageId';
    final optimisticUserMessage = AiMessageItem(
      id: optimisticId,
      role: 'USER',
      status: 'COMPLETED',
      contentText: trimmed,
      contentBlocks: const [],
      createdAt: DateTime.now().toUtc(),
      clientMessageId: clientMessageId,
    );

    state = state.copyWith(
      isBusy: true,
      clearActionError: true,
      pendingUserMessages: isRetry
          ? state.pendingUserMessages
          : [...state.pendingUserMessages, optimisticUserMessage],
    );

    try {
      final previousMessageCount = state.sessionConversationMessages.length;
      final next = await _repository.sendAuthoringSessionMessage(
        sessionId: response.session.id,
        text: trimmed,
        expectedVersion: response.session.version,
        clientMessageId: clientMessageId,
        currentTurnId: response.currentTurn?.id,
      );
      if (!_acceptResponse(
        generation,
        key,
        next,
        workspaceGen: workspaceGen,
        previousMessageCount: previousMessageCount,
        pendingClientMessageId: clientMessageId,
      )) {
        return;
      }
      final turnUnchanged = previousTurn?.id == next.currentTurn?.id;
      if (!turnUnchanged) {
        _promoteTurnToHistory(previousTurn);
      }
      _applyResponse(next, generation: generation);
      _ingestConversationMessages(next);
      _commitPendingUserMessages();
    } on ApiException catch (error) {
      if (!_matchesGeneration(generation, key, workspaceGen)) {
        return;
      }
      state = state.copyWith(
        actionError: _mapError(error),
        pendingUserMessages: state.pendingUserMessages
            .where((message) => message.id != optimisticId)
            .toList(growable: false),
      );
      await _handleMutationError(error, generation: generation);
    } finally {
      if (_matchesGeneration(generation, key, workspaceGen)) {
        state = state.copyWith(isBusy: false);
      }
    }
  }

  Future<void> submitClarificationAnswer({
    required AuthoringClarificationQuestion question,
    required List<String> selectedOptionIds,
    required String locale,
    String? otherText,
  }) async {
    final response = state.response;
    final key = state.key;
    final currentTurn = response?.currentTurn;
    if (response == null ||
        key == null ||
        currentTurn == null ||
        state.isBusy ||
        selectedOptionIds.isEmpty) {
      return;
    }

    final generation = ++_operationGeneration;
    final workspaceGen = state.workspaceGeneration;
    final previousTurn = response.currentTurn;
    final clientMessageId = createClientMessageId();
    final answerPreview = selectedOptionIds.contains('other')
        ? (otherText?.trim() ?? '')
        : question.options
            .where((option) => selectedOptionIds.contains(option.id))
            .map((option) => option.label)
            .join(', ');
    final optimisticUserMessage = AiMessageItem(
      id: 'optimistic-$clientMessageId',
      role: 'USER',
      status: 'COMPLETED',
      contentText: answerPreview,
      contentBlocks: const [],
      createdAt: DateTime.now().toUtc(),
    );

    state = state.copyWith(
      isBusy: true,
      clearActionError: true,
      pendingUserMessages: [...state.pendingUserMessages, optimisticUserMessage],
    );

    try {
      final next = await _repository.sendAuthoringSessionMessage(
        sessionId: response.session.id,
        expectedVersion: response.session.version,
        clientMessageId: clientMessageId,
        questionId: question.questionId,
        selectedOptionIds: selectedOptionIds,
        otherText: otherText,
        currentTurnId: currentTurn.id,
      );
      if (!_acceptResponse(generation, key, next, workspaceGen: workspaceGen)) {
        return;
      }
      _promoteTurnToHistory(previousTurn);
      _applyResponse(next, generation: generation);
    } on ApiException catch (error) {
      if (!_matchesGeneration(generation, key, workspaceGen)) {
        return;
      }
      await _handleMutationError(error, generation: generation);
    } finally {
      if (_matchesGeneration(generation, key, workspaceGen)) {
        state = state.copyWith(isBusy: false);
      }
    }
  }

  Future<void> runAction({
    required String action,
    String? turnId,
    Object? manualValue,
    String? mode,
    String? targetStage,
  }) async {
    final response = state.response;
    final key = state.key;
    if (response == null || key == null || state.isBusy) {
      return;
    }

    final persisted = mapUiActionToPersistedAction(
      uiAction: action,
      response: response,
      mode: mode,
    );
    if (persisted == null) {
      assert(() {
        throw StateError('Unmapped authoring UI action: $action');
      }());
      state = state.copyWith(
        actionError: ApiException(
          message: 'Unsupported action.',
          statusCode: 400,
          code: 'AI_AUTHORING_ACTION_NOT_ALLOWED',
        ),
      );
      return;
    }

    final generation = ++_operationGeneration;
    final workspaceGen = state.workspaceGeneration;
    final previousTurn = response.currentTurn;
    final previousCanonical = response.canonicalProject;
    final resolvedTurnId = response.currentTurn?.id ?? turnId;
    state = state.copyWith(
      isBusy: true,
      clearActionError: true,
      lastActionTurnId: resolvedTurnId,
      activeAction: action,
    );

    try {
      final next = await _repository.runAuthoringSessionAction(
        sessionId: response.session.id,
        action: persisted,
        expectedVersion: response.session.version,
        turnId: resolvedTurnId,
        manualValue: manualValue,
        mode: mapUiModeToPersistedMode(mode, stage: response.session.stage),
        targetStage: targetStage,
      );
      if (!_acceptResponse(generation, key, next, workspaceGen: workspaceGen)) {
        return;
      }
      if (persisted != 'EXPLAIN_STEP') {
        final turnUnchanged = previousTurn?.id == next.currentTurn?.id;
        if (!(response.session.stage == 'STEP_REVIEW' && turnUnchanged)) {
          _promoteTurnToHistory(previousTurn);
        }
      }
      final highlightFields = _foundationHighlightFields(
        before: previousCanonical,
        after: next.canonicalProject,
        persistedAction: persisted,
        previousStage: response.session.stage,
      );
      _applyResponse(
        next,
        generation: generation,
        highlightFields: highlightFields,
      );
      _ingestConversationMessages(next);
      if (persisted == 'EXPLAIN_STEP' ||
          persisted == 'BACK_STEP_ITEM' ||
          persisted == 'REMOVE_STEP_ITEM' ||
          persisted == 'ADD_STEP_ITEM' ||
          response.session.stage == 'STEP_REVIEW') {
        await _reloadConversationMessages(key.conversationId);
      }
      if (persisted == 'ACCEPT_CURRENT' ||
          persisted == 'SAVE_MANUAL' ||
          persisted == 'FINALIZE_COMPONENTS' ||
          persisted == 'FINALIZE_STEPS') {
        _scheduleSaveSyncCheck(next);
      }
    } on ApiException catch (error) {
      if (!_matchesGeneration(generation, key, workspaceGen)) {
        return;
      }
      await _handleMutationError(error, generation: generation);
    } finally {
      if (_matchesGeneration(generation, key, workspaceGen)) {
        state = state.copyWith(isBusy: false, clearActiveAction: true);
      }
    }
  }

  Future<void> revisitStage(String targetStage) {
    return runAction(action: 'REVISIT_STAGE', targetStage: targetStage);
  }

  Future<void> regenerateFailedStage() {
    return runAction(action: 'REGENERATE_STALE');
  }

  void acknowledgeEditorSynchronized(ScopedAuthoringEditorMirror mirror) {
    final snapshot = state.snapshot;
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
    if (state.actionError?.code == 'CANONICAL_CLIENT_SYNC_FAILED') {
      state = state.copyWith(clearActionError: true);
    }
  }

  void clearActionError() {
    state = state.copyWith(clearActionError: true);
  }

  @visibleForTesting
  void seedSnapshot({
    required String projectId,
    required String conversationId,
    required AiAuthoringSnapshot snapshot,
    String sessionId = 'test-session',
    AuthoringSessionResponse? response,
  }) {
    final resolvedResponse = response ??
        AuthoringSessionResponse(
          session: AuthoringPersistedSession(
            id: sessionId,
            conversationId: conversationId,
            learningProjectId: projectId,
            stage: snapshot.session.stage,
            status: snapshot.session.status,
            version: 1,
            completedStages: snapshot.session.completedStages,
            baseProjectUpdatedAt: snapshot.session.baseUpdatedAt,
            componentReviewState: null,
            stepReviewState: null,
            currentTurnId: snapshot.session.currentTurnId,
          ),
          currentTurn: null,
          canonicalProject: snapshot.canonicalProject,
          availableActions: snapshot.availableActions,
        );
    state = AuthoringWorkspaceState(
      key: AuthoringWorkspaceKey(
        projectId: projectId,
        conversationId: conversationId,
        sessionId: sessionId,
      ),
      response: resolvedResponse,
      snapshot: snapshot,
      lifecycle: AuthoringWorkspaceLifecycle.ready,
      workspaceGeneration: _workspaceGeneration,
    );
    if (response != null && response.conversationMessages.isNotEmpty) {
      _ingestConversationMessages(response);
    }
  }

  @visibleForTesting
  bool applyIncomingResponseForTest({
    required AuthoringSessionResponse incoming,
    required int operationGeneration,
    required int workspaceGeneration,
  }) {
    final key = state.key;
    if (key == null) {
      return false;
    }
    if (operationGeneration != _operationGeneration ||
        workspaceGeneration != state.workspaceGeneration) {
      return false;
    }
    return _acceptResponse(
      operationGeneration,
      key,
      incoming,
      workspaceGen: workspaceGeneration,
    );
  }

  bool _matchesGeneration(
    int generation,
    AuthoringWorkspaceKey key,
    int workspaceGen,
  ) {
    return generation == _operationGeneration &&
        workspaceGen == state.workspaceGeneration &&
        state.key?.projectId == key.projectId &&
        state.key?.conversationId == key.conversationId;
  }

  bool _acceptResponse(
    int generation,
    AuthoringWorkspaceKey key,
    AuthoringSessionResponse incoming, {
    required int workspaceGen,
    int? previousMessageCount,
    String? pendingClientMessageId,
  }) {
    if (!_matchesGeneration(generation, key, workspaceGen)) {
      return false;
    }
    final current = state.response;
    if (incoming.session.learningProjectId != key.projectId) {
      return false;
    }
    if (incoming.session.conversationId != key.conversationId) {
      return false;
    }
    if (key.sessionId != null && incoming.session.id != key.sessionId) {
      return false;
    }
    if (current != null) {
      if (incoming.session.id != current.session.id) {
        return false;
      }

      final incomingIds = incoming.conversationMessages
          .map((message) => message['id'] as String?)
          .whereType<String>()
          .toSet();
      final currentIds = state.sessionConversationMessages.map((message) => message.id).toSet();
      final hasNewPersistedMessage = incomingIds.difference(currentIds).isNotEmpty;
      final incomingClientIds = incoming.conversationMessages
          .map(authoringConversationClientMessageId)
          .whereType<String>()
          .toSet();
      final reconciledPendingClientMessage = pendingClientMessageId != null &&
          incomingClientIds.contains(pendingClientMessageId);

      if (incoming.currentTurn == null &&
          current.currentTurn != null &&
          incoming.session.version <= current.session.version) {
        if (hasNewPersistedMessage || reconciledPendingClientMessage) {
          return true;
        }
        final incomingMessages = incoming.conversationMessages.length;
        if (previousMessageCount != null &&
            incomingMessages > previousMessageCount) {
          return true;
        }
        return false;
      }
      final incomingMessages = incoming.conversationMessages.length;
      final currentMessages = state.sessionConversationMessages.length;
      if (incoming.session.version < current.session.version &&
          incomingMessages <= currentMessages &&
          !hasNewPersistedMessage) {
        return false;
      }
      if (hasNewPersistedMessage || reconciledPendingClientMessage) {
        return true;
      }
      if (previousMessageCount != null &&
          incomingMessages < previousMessageCount &&
          incoming.session.version == current.session.version) {
        return false;
      }
      if (previousMessageCount != null &&
          incomingMessages == previousMessageCount &&
          incoming.session.version == current.session.version &&
          incoming.currentTurn?.id == current.currentTurn?.id &&
          pendingClientMessageId != null) {
        return true;
      }
    }
    return true;
  }

  void _applyResponse(
    AuthoringSessionResponse response, {
    bool hasLegacyBlocks = false,
    int? generation,
    Set<String> highlightFields = const {},
  }) {
    if (generation != null && state.key != null && generation != _operationGeneration) {
      return;
    }
    final snapshot = authoringSessionResponseToSnapshot(
      response,
      hasLegacyBlocks: hasLegacyBlocks || state.hasLegacyWithoutSession,
    );
    state = state.copyWith(
      key: state.key?.copyWith(sessionId: response.session.id),
      response: response,
      snapshot: snapshot,
      hasLegacyWithoutSession: false,
      requestGeneration: state.requestGeneration + 1,
    );
    // Always publish the authoritative canonical snapshot (valid accepted
    // scalars such as the estimated duration, plus finalized components) to the
    // left editor, even after a failed component generation. Invalid proposals
    // are never written to canonical on the server, so this cannot leak an
    // invalid component or a stale duration. `_applyResponse` only runs for
    // version-accepted (non-stale) responses, so older responses cannot
    // overwrite a newer accepted duration.
    if (snapshot.session.stage != 'OVERVIEW') {
      ref.read(authoringCanonicalProjectUpdateProvider.notifier).setSnapshot(
            ScopedAuthoringCanonicalUpdate(
              projectId: snapshot.session.projectId,
              canonicalUpdatedAt: snapshot.canonicalProject.updatedAt,
              snapshot: snapshot.canonicalProject.toDraftSnapshot(),
            ),
          );
    }
    if (highlightFields.isNotEmpty) {
      ref.read(authoringHighlightedFieldsProvider.notifier).highlight(highlightFields);
    }
  }

  void _promoteTurnToHistory(AuthoringPersistedTurn? turn) {
    if (turn == null || turn.status != 'PROPOSED') {
      return;
    }
    final summary = historicalSummaryFromTurn(turn);
    if (state.historicalTurns.any((item) => item.turnId == summary.turnId)) {
      return;
    }
    state = state.copyWith(
      historicalTurns: [...state.historicalTurns, summary],
    );
  }

  void _ingestConversationMessages(AuthoringSessionResponse response) {
    if (response.conversationMessages.isEmpty) {
      return;
    }
    final byId = <String, AiMessageItem>{
      for (final message in state.sessionConversationMessages) message.id: message,
    };
    for (final item in response.conversationMessages) {
      final message = AiMessageItem.fromJson(Map<String, dynamic>.from(item));
      byId[message.id] = message;
    }
    final merged = byId.values.toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    state = state.copyWith(sessionConversationMessages: merged);
  }

  void _commitPendingUserMessages() {
    if (state.pendingUserMessages.isEmpty) {
      return;
    }
    final byId = <String, AiMessageItem>{
      for (final message in state.sessionConversationMessages) message.id: message,
    };
    for (final pending in state.pendingUserMessages) {
      // Deduplicate against the server copy by stable identity
      // (clientMessageId), never by message text. This keeps a legitimate
      // repeated message visible while collapsing the optimistic echo once the
      // persisted USER message returns with the same clientMessageId.
      final hasPersistedUser = pending.clientMessageId != null &&
          state.sessionConversationMessages.any(
            (message) =>
                message.role == 'USER' &&
                message.id != pending.id &&
                message.clientMessageId != null &&
                message.clientMessageId == pending.clientMessageId,
          );
      if (!hasPersistedUser) {
        byId[pending.id] = pending;
      }
    }
    final merged = byId.values.toList()
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    state = state.copyWith(
      sessionConversationMessages: merged,
      pendingUserMessages: const [],
    );
  }

  Future<void> _reloadConversationMessages(String conversationId) async {
    await ref.read(aiAssistantControllerProvider.notifier).openConversation(
          conversationId,
        );
  }

  Future<void> _handleMutationError(
    ApiException error, {
    required int generation,
  }) async {
    final mapped = _mapError(error);
    state = state.copyWith(actionError: mapped);
    if (_shouldReloadAfterError(error.code)) {
      await reload();
    }
  }

  bool _shouldReloadAfterError(String? code) {
    return code == 'AI_AUTHORING_SESSION_STALE' ||
        code == 'AI_AUTHORING_TURN_SUPERSEDED' ||
        code == 'AI_AUTHORING_CONTEXT_MISMATCH' ||
        code == 'AI_AUTHORING_PROPOSAL_STALE' ||
        code == 'AI_RESPONSE_INVALID' ||
        code == 'AI_AUTHORING_STEP_GENERATION_FAILED' ||
        code == 'AI_AUTHORING_STEP_GENERATION_TIMEOUT' ||
        code == 'AI_PROVIDER_TIMEOUT';
  }

  ApiException _mapError(ApiException error) {
    if (error.code == 'NETWORK_ERROR' || error.code == 'CONNECTION_ERROR') {
      return ApiException(
        message: aiErrorMessageForCode('NETWORK_ERROR', error.message),
        code: 'NETWORK_ERROR',
      );
    }
    return ApiException(
      message: aiErrorMessageForCode(error.code, error.message),
      code: error.code ?? 'UNKNOWN_ERROR',
    );
  }

  bool _isSessionMissingError(ApiException error) {
    return error.code == 'AI_AUTHORING_SESSION_NOT_FOUND' ||
        error.statusCode == 404;
  }

  Set<String> _foundationHighlightFields({
    AiAuthoringCanonicalProject? before,
    required AiAuthoringCanonicalProject after,
    String? persistedAction,
    String? previousStage,
  }) {
    final fields = <String>{};
    if (before == null || before.title != after.title) {
      fields.add('title');
    }
    if (before == null || before.estimatedMinutes != after.estimatedMinutes) {
      fields.add('estimatedMinutes');
    }
    if (before == null ||
        before.components.length != after.components.length ||
        persistedAction == 'FINALIZE_COMPONENTS' ||
        (persistedAction == 'ACCEPT_CURRENT' && previousStage == 'COMPONENTS')) {
      fields.add('components');
    }
    if (before == null || before.steps.length != after.steps.length) {
      fields.add('steps');
    }
    return fields;
  }

  bool _stageNeedsStepSync(String stage) {
    return stage == 'STEPS_OVERVIEW' ||
        stage == 'STEP_REVIEW' ||
        stage == 'FINAL_REVIEW' ||
        stage == 'COMPLETE';
  }

  void _scheduleSaveSyncCheck(AuthoringSessionResponse response) {
    ref.read(authoringSaveSyncFailedProvider.notifier).clear();
    ref.read(authoringSaveSuccessVisibleProvider.notifier).hide();
    Future.microtask(() {
      if (!ref.mounted) {
        return;
      }
      final snapshot = state.snapshot;
      if (snapshot == null ||
          snapshot.canonicalProject.updatedAt != response.canonicalProject.updatedAt) {
        return;
      }
      final editorMirror = ref.read(authoringEditorAppliedSnapshotProvider);
      if (editorMirror == null) {
        ref.read(authoringSaveSyncFailedProvider.notifier).markFailed();
        state = state.copyWith(
          actionError: ApiException(
            message: aiErrorMessageForCode('CANONICAL_CLIENT_SYNC_FAILED', ''),
            code: 'CANONICAL_CLIENT_SYNC_FAILED',
          ),
        );
        return;
      }
      acknowledgeEditorSynchronized(editorMirror);
    });
  }
}
