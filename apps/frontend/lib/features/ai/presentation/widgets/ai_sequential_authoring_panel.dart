import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/utils/content_text_direction.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/authoring_workspace_controller.dart';
import '../../application/ai_chat_controller.dart';
import '../../domain/authoring_session_models.dart';
import '../../domain/ai_helpers.dart';
import '../../domain/ai_models.dart';
import '../l10n/ai_l10n.dart';
import 'ai_message_bubble.dart';

bool isGenericComponentPlaceholderText(String text) {
  final normalized = text.trim().toLowerCase();
  return normalized.contains('coherent component list') ||
      normalized.contains('قائمة مكوّنات متماسكة');
}

bool isScalarAuthoringStage(String stage) {
  return switch (stage) {
    'TITLE' ||
    'SHORT_DESCRIPTION' ||
    'FULL_DESCRIPTION' ||
    'DIFFICULTY' ||
    'ESTIMATED_DURATION' =>
      true,
    _ => false,
  };
}

class AiSequentialAuthoringPanel extends ConsumerStatefulWidget {
  const AiSequentialAuthoringPanel({
    super.key,
    required this.locale,
    this.projectUpdatedAt,
    this.draftSnapshot,
  });

  final String locale;
  final DateTime? projectUpdatedAt;
  final AuthoringDraftSnapshot? draftSnapshot;

  @override
  ConsumerState<AiSequentialAuthoringPanel> createState() =>
      _AiSequentialAuthoringPanelState();
}

class _AiSequentialAuthoringPanelState
    extends ConsumerState<AiSequentialAuthoringPanel> {
  final _scrollController = ScrollController();
  final _conversationTailKey = GlobalKey();
  final _composerController = TextEditingController();
  bool _manualEntryMode = false;
  final _manualController = TextEditingController();
  String? _manualDifficulty;
  final List<_ManualComponentDraft> _manualComponents = [];
  final List<_ManualStepDraft> _manualSteps = [];
  bool _manualPreviewMode = false;
  int _earlierConversationEndIndex = 0;
  bool _showEarlierConversation = false;
  bool _userAwayFromBottom = false;
  bool _hasNewReplyBelow = false;
  String? _trackedStage;
  bool _pendingComposerScroll = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_handleScrollPosition);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_handleScrollPosition);
    _scrollController.dispose();
    _composerController.dispose();
    _manualController.dispose();
    super.dispose();
  }

  void _handleScrollPosition() {
    if (!_scrollController.hasClients) {
      return;
    }
    final distanceFromBottom =
        _scrollController.position.maxScrollExtent - _scrollController.offset;
    final away = distanceFromBottom > 120;
    if (away != _userAwayFromBottom) {
      setState(() => _userAwayFromBottom = away);
    }
    if (!away && _hasNewReplyBelow) {
      setState(() => _hasNewReplyBelow = false);
    }
  }

  void _scheduleScrollToLatest({bool force = false}) {
    if (!force && _userAwayFromBottom) {
      if (!_hasNewReplyBelow) {
        setState(() => _hasNewReplyBelow = true);
      }
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      final tailContext = _conversationTailKey.currentContext;
      if (tailContext != null) {
        Scrollable.ensureVisible(
          tailContext,
          alignment: 1,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
        return;
      }
      if (!_scrollController.hasClients) {
        return;
      }
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  void _syncWorkspaceScrollTriggers(AuthoringWorkspaceState? previous, AuthoringWorkspaceState next) {
    final nextStage = next.snapshot?.session.stage ?? next.response?.session.stage;
    if (nextStage != null && nextStage != _trackedStage) {
      if (_trackedStage != null && next.sessionConversationMessages.isNotEmpty) {
        _earlierConversationEndIndex = next.sessionConversationMessages.length;
        _showEarlierConversation = false;
      }
      _trackedStage = nextStage;
      _hasNewReplyBelow = false;
      return;
    }

    if (!_pendingComposerScroll) {
      return;
    }

    final becameIdle = previous?.isBusy == true && !next.isBusy;
    if (!becameIdle) {
      return;
    }

    _pendingComposerScroll = false;
    _scheduleScrollToLatest(force: true);
  }

  ({
    List<AiMessageItem> earlier,
    List<AiMessageItem> current,
  }) _conversationSections(List<AiMessageItem> messages) {
    final cutoff = _earlierConversationEndIndex.clamp(0, messages.length);
    if (cutoff <= 0) {
      return (earlier: const [], current: messages);
    }
    if (_showEarlierConversation) {
      return (earlier: const [], current: messages);
    }
    return (
      earlier: messages.sublist(0, cutoff),
      current: messages.sublist(cutoff),
    );
  }

  List<AiMessageItem> _historyMessages(List<AiMessageItem> messages) {
    return messages
        .map((message) {
          if (message.role == 'USER') {
            return message;
          }
          final visibleBlocks = message.contentBlocks
              .where(
                (block) =>
                    !isAuthoringStructuredHistoryBlock(block.type) &&
                    !(block.type == 'text' &&
                        isAuthoringSaveAckText(block.text)),
              )
              .toList(growable: false);
          if (visibleBlocks.isEmpty &&
              (message.contentText == null ||
                  message.contentText!.isEmpty ||
                  isAuthoringSaveAckText(message.contentText))) {
            return null;
          }
          return AiMessageItem(
            id: message.id,
            role: message.role,
            status: message.status,
            contentText: isAuthoringSaveAckText(message.contentText)
                ? null
                : message.contentText,
            contentBlocks: visibleBlocks,
            createdAt: message.createdAt,
          );
        })
        .whereType<AiMessageItem>()
        .toList(growable: false);
  }

  String _suggestionPreview(AiAuthoringCurrentSuggestion suggestion) {
    if (suggestion.hasStepList) {
      return suggestion.steps
          .map((step) => '${step.title}: ${step.description}')
          .join('\n');
    }
    if (suggestion.step != null && suggestion.step!['title'] != null) {
      return '${suggestion.step!['title']}';
    }
    if (suggestion.hasComponentList) {
      return suggestion.components
          .map((component) => component.componentName)
          .join(', ');
    }
    if (suggestion.component != null &&
        suggestion.component!['componentName'] != null) {
      return '${suggestion.component!['componentName']}';
    }
    if (suggestion.value != null) {
      return '${suggestion.value}';
    }
    return '';
  }

  String? _canonicalSavedPreview(AiAuthoringSnapshot snapshot) {
    final stage = snapshot.session.stage;
    final canonical = snapshot.canonicalProject;
    if (stage == 'TITLE') {
      return canonical.title;
    }
    if (stage == 'ESTIMATED_DURATION') {
      return canonical.estimatedMinutes?.toString();
    }
    if (stage == 'STEPS_OVERVIEW' || stage == 'STEP_REVIEW') {
      if (canonical.steps.isEmpty) {
        return null;
      }
      return canonical.steps.map((step) => step.title).join(', ');
    }
    return null;
  }

  Future<void> _sendComposerMessage() async {
    final workspace = ref.read(authoringWorkspaceControllerProvider.notifier);
    final workspaceState = ref.read(authoringWorkspaceControllerProvider);
    final text = _composerController.text.trim();
    if (text.isEmpty || workspaceState.isBusy) {
      return;
    }

    _pendingComposerScroll = true;
    _userAwayFromBottom = false;
    _scheduleScrollToLatest(force: true);
    await workspace.sendFeedback(
      text: text,
      locale: widget.locale,
    );
    if (!mounted) {
      return;
    }
    final error = ref.read(authoringWorkspaceControllerProvider).actionError;
    if (error == null) {
      _composerController.clear();
    } else {
      _pendingComposerScroll = false;
      _scheduleScrollToLatest(force: true);
    }
  }

  Future<void> _showAddStepReviewDialog({
    required AuthoringWorkspaceController workspace,
    required String turnId,
    required bool busy,
    required String locale,
  }) async {
    if (busy) {
      return;
    }
    final titleController = TextEditingController(
      text: locale == 'ar' ? 'خطوة جديدة' : 'New step',
    );
    final descriptionController = TextEditingController(
      text: locale == 'ar'
          ? 'صف ما يجب فعله في هذه الخطوة.'
          : 'Describe what to do in this step.',
    );
    final safetyController = TextEditingController();
    final saved = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(locale == 'ar' ? 'إضافة خطوة' : 'Add step'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: titleController,
                  decoration: InputDecoration(
                    labelText: locale == 'ar' ? 'العنوان' : 'Title',
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: descriptionController,
                  minLines: 2,
                  maxLines: 5,
                  decoration: InputDecoration(
                    labelText: locale == 'ar' ? 'الوصف' : 'Description',
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextField(
                  controller: safetyController,
                  minLines: 1,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: locale == 'ar'
                        ? 'تنبيه أمان (اختياري)'
                        : 'Safety note (optional)',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: Text(locale == 'ar' ? 'إلغاء' : 'Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(locale == 'ar' ? 'حفظ' : 'Save'),
            ),
          ],
        );
      },
    );
    final title = titleController.text.trim();
    final description = descriptionController.text.trim();
    final safety = safetyController.text.trim();
    titleController.dispose();
    descriptionController.dispose();
    safetyController.dispose();
    if (saved != true || !mounted) {
      return;
    }
    if (title.isEmpty || description.isEmpty) {
      return;
    }
    await workspace.runAction(
      action: 'ADD_ITEM',
      turnId: turnId,
      manualValue: {
        'title': title,
        'description': description,
        if (safety.isNotEmpty) 'safetyNote': safety,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    ref.listen<AuthoringWorkspaceState>(
      authoringWorkspaceControllerProvider,
      _syncWorkspaceScrollTriggers,
    );
    final chatState = ref.watch(aiAssistantControllerProvider);
    final workspaceState = ref.watch(authoringWorkspaceControllerProvider);
    final workspaceScope = ref.watch(authoringActiveWorkspaceProvider);
    final workspace = ref.read(authoringWorkspaceControllerProvider.notifier);
    final snapshot = workspaceState.isReady
        ? workspaceState.snapshot
        : (workspaceState.response != null
            ? authoringSessionResponseToSnapshot(workspaceState.response!)
            : null);
    final workspaceActive =
        workspaceScope != null || workspaceState.isReady || workspaceState.isLoading;
    final busy = workspaceActive
        ? workspaceState.isBusy
        : workspaceState.isBusy ||
            (chatState.isSubmittingReview ||
                chatState.isGeneratingProposal ||
                chatState.isSending);
    final composerEnabled = !busy &&
        !_manualEntryMode &&
        (snapshot?.currentSuggestion != null ||
            (snapshot != null &&
                (snapshot.session.stage == 'COMPONENTS' ||
                    snapshot.session.stage == 'STEPS_OVERVIEW' ||
                    snapshot.session.stage == 'STEP_REVIEW') &&
                snapshot.session.status != 'GENERATION_FAILED'));
    final saveSuccessVisible = ref.watch(authoringSaveSuccessVisibleProvider);
    final saveSyncFailed = ref.watch(authoringSaveSyncFailedProvider);
    final history = _historyMessages(
      workspaceActive
          ? [
              ...workspaceState.sessionConversationMessages,
              ...workspaceState.pendingUserMessages,
            ]
          : [
              ...chatState.messages,
              ...workspaceState.sessionConversationMessages.where(
                (message) => !chatState.messages.any((item) => item.id == message.id),
              ),
              ...workspaceState.pendingUserMessages,
            ],
    );
    final conversationSections = _conversationSections(history);
    final currentConversation = conversationSections.current;
    final earlierConversation = conversationSections.earlier;

    if (workspaceScope != null &&
        workspaceState.isLoading &&
        !workspaceState.hasLegacyWithoutSession &&
        workspaceState.response == null &&
        workspaceState.snapshot == null) {
      return const Center(child: CircularProgressIndicator());
    }

    if (workspaceScope != null &&
        workspaceState.lifecycle == AuthoringWorkspaceLifecycle.failed &&
        snapshot == null &&
        !workspaceState.hasLegacyWithoutSession) {
      return Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              workspaceState.actionError?.message ??
                  (widget.locale == 'ar'
                      ? 'تعذّر تحميل جلسة التأليف.'
                      : 'Could not load the authoring session.'),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: busy
                  ? null
                  : () {
                      final scope = workspaceScope;
                      workspace.activateAndLoad(
                        projectId: scope.projectId,
                        conversationId: scope.conversationId,
                      );
                    },
              child: Text(widget.locale == 'ar' ? 'إعادة المحاولة' : 'Retry'),
            ),
          ],
        ),
      );
    }

    if (workspaceState.hasLegacyWithoutSession && snapshot == null) {
      return Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: ListView(
                children: [
                  for (final message in history)
                    Padding(
                      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                      child: AiMessageBubble(
                        message: message,
                        locale: widget.locale,
                        hideStructuredAuthoringBlocks: true,
                      ),
                    ),
                ],
              ),
            ),
            Text(
              AiL10n.authoringSequentialLegacyTransitionBanner.resolve(context),
              style: AppTextStyles.body(context).copyWith(
                color: palette.textPrimary,
                height: 1.45,
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            FilledButton(
              onPressed: busy
                  ? null
                  : () => workspace.continueGuidedAuthoring(),
              child: Text(
                AiL10n.authoringSequentialContinueGuided.resolve(context),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (snapshot != null)
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.xs,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AiL10n.authoringSequentialProgressTitle.resolve(context),
                  style: AppTextStyles.subtitle(context).copyWith(
                    color: palette.textPrimary,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                LinearProgressIndicator(
                  value: snapshot.progress.total == 0
                      ? 0
                      : snapshot.progress.completed / snapshot.progress.total,
                  minHeight: 6,
                  borderRadius: AppRadius.smAll,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${snapshot.progress.completed}/${snapshot.progress.total} · ${AiL10n.authoringSequentialStageLabel(snapshot.session.stage).resolve(context)}',
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        Expanded(
          child: ListView(
            controller: _scrollController,
            padding: EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              AppSpacing.xs,
              AppSpacing.md,
              (_manualEntryMode ? 0 : 88) +
                  (MediaQuery.viewInsetsOf(context).bottom > 0
                      ? AppSpacing.md
                      : AppSpacing.lg),
            ),
            children: [
              if (earlierConversation.isNotEmpty && !_showEarlierConversation)
                Padding(
                  padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                  child: OutlinedButton.icon(
                    onPressed: () => setState(() => _showEarlierConversation = true),
                    icon: const Icon(Icons.history_rounded, size: 18),
                    label: Text(
                      widget.locale == 'ar'
                          ? 'محادثة المراحل السابقة (${earlierConversation.length})'
                          : 'Earlier conversation (${earlierConversation.length})',
                    ),
                  ),
                ),
              if (_showEarlierConversation && earlierConversation.isNotEmpty)
                for (final message in earlierConversation)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                    child: Opacity(
                      opacity: 0.82,
                      child: AiMessageBubble(
                        message: message,
                        locale: widget.locale,
                        authoringProjectUpdatedAt: widget.projectUpdatedAt,
                        authoringDraftSnapshot: widget.draftSnapshot,
                        hideStructuredAuthoringBlocks: true,
                      ),
                    ),
                  ),
              for (final historical in workspaceState.historicalTurns)
                Padding(
                  padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                  child: _HistoricalTurnCard(
                    summary: historical,
                    locale: widget.locale,
                  ),
                ),
              if (snapshot != null)
                Padding(
                  padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                  child: _ActiveStageCard(
                    snapshot: snapshot,
                    locale: widget.locale,
                    busy: busy,
                    blockAccept:
                        workspaceState.actionError?.code ==
                        'AI_STEP_COMPONENT_INCONSISTENT',
                    manualEntryMode: _manualEntryMode,
                    manualController: _manualController,
                    manualDifficulty: _manualDifficulty,
                    manualComponents: _manualComponents,
                    manualSteps: _manualSteps,
                    manualPreviewMode: _manualPreviewMode,
                    onManualDifficultyChanged: (value) =>
                        setState(() => _manualDifficulty = value),
                    onStartManualEntry: () {
                      final suggestion = snapshot.currentSuggestion;
                      setState(() {
                        _manualEntryMode = true;
                        _manualPreviewMode = false;
                        if (snapshot.session.stage == 'COMPONENTS') {
                          _manualComponents
                            ..clear()
                            ..addAll(
                              suggestion != null && suggestion.hasComponentList
                                  ? suggestion.components
                                      .map(_ManualComponentDraft.fromProposal)
                                      .toList(growable: false)
                                  : [_ManualComponentDraft.empty()],
                            );
                        } else if (snapshot.session.stage == 'STEPS_OVERVIEW' ||
                            snapshot.session.stage == 'STEP_REVIEW') {
                          _manualSteps
                            ..clear()
                            ..addAll(
                              suggestion != null && suggestion.hasStepList
                                  ? suggestion.steps
                                      .map(_ManualStepDraft.fromProposal)
                                      .toList(growable: false)
                                  : [_ManualStepDraft.empty()],
                            );
                        }
                      });
                    },
                    onCancelManualEntry: () => setState(() {
                      _manualEntryMode = false;
                      _manualPreviewMode = false;
                      _manualController.clear();
                      _manualDifficulty = null;
                      _manualComponents.clear();
                      _manualSteps.clear();
                    }),
                    onToggleManualPreview: () => setState(
                      () => _manualPreviewMode = !_manualPreviewMode,
                    ),
                    onAddManualComponent: () => setState(
                      () => _manualComponents.add(_ManualComponentDraft.empty()),
                    ),
                    onRemoveManualComponent: (index) => setState(() {
                      if (_manualComponents.length > 1) {
                        _manualComponents.removeAt(index);
                      }
                    }),
                    onManualComponentChanged: (index, draft) => setState(
                      () => _manualComponents[index] = draft,
                    ),
                    onAddManualStep: () => setState(
                      () => _manualSteps.add(_ManualStepDraft.empty()),
                    ),
                    onRemoveManualStep: (index) => setState(() {
                      if (_manualSteps.length > 1) {
                        _manualSteps.removeAt(index);
                      }
                    }),
                    onManualStepChanged: (index, draft) => setState(
                      () => _manualSteps[index] = draft,
                    ),
                    onAddStepReview: ({
                      required turnId,
                      required busy,
                    }) =>
                        _showAddStepReviewDialog(
                          workspace: workspace,
                          turnId: turnId,
                          busy: busy,
                          locale: widget.locale,
                        ),
                    suggestionPreview: _suggestionPreview,
                    canonicalSavedPreview: _canonicalSavedPreview,
                  ),
                ),
              for (final message in currentConversation)
                Padding(
                  padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                  child: AiMessageBubble(
                    message: message,
                    locale: widget.locale,
                    authoringProjectUpdatedAt: widget.projectUpdatedAt,
                    authoringDraftSnapshot: widget.draftSnapshot,
                    hideStructuredAuthoringBlocks: true,
                  ),
                ),
              if (workspaceState.isBusy)
                const Padding(
                  padding: EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                  child: _AuthoringLoadingBubble(),
                ),
              if (!workspaceActive && chatState.isSending)
                const Padding(
                  padding: EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                  child: _AuthoringLoadingBubble(),
                ),
              if (workspaceState.actionError != null)
                Padding(
                  padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                  child: _AuthoringErrorBanner(
                    error: workspaceState.actionError!,
                    displayMessage: authoringErrorMessageForDisplay(
                      workspaceState.actionError!,
                      stage: snapshot?.session.stage,
                    ),
                    onRetry: hasStaleComponentProposalRecovery(
                      workspaceState.actionError!.code,
                      snapshot?.session.stage,
                    )
                        ? () => workspace.regenerateFailedStage()
                        : hasStepComponentInconsistencyRecovery(
                            workspaceState.actionError!.code,
                          )
                            ? () => workspace.runAction(
                                  action: 'SUGGEST_ANOTHER',
                                  turnId: snapshot?.currentSuggestion?.turnId,
                                )
                            : hasStepPlanGenerationRecovery(workspaceState.actionError!.code)
                                ? () => workspace.regenerateFailedStage()
                                : isRetryableAuthoringError(workspaceState.actionError!.code)
                                    ? () => workspace.reload()
                                    : null,
                    retryLabel: hasStaleComponentProposalRecovery(
                      workspaceState.actionError!.code,
                      snapshot?.session.stage,
                    )
                        ? staleComponentProposalRecoveryLabel()
                        : hasStepComponentInconsistencyRecovery(
                            workspaceState.actionError!.code,
                          )
                            ? AiL10n.authoringSequentialSuggestAnother.en
                            : hasStepPlanGenerationRecovery(workspaceState.actionError!.code)
                                ? AiL10n.authoringSequentialGenerateStepPlan.en
                                : null,
                    onDismiss: () => workspace.clearActionError(),
                  ),
                ),
              if (saveSyncFailed)
                Padding(
                  padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                  child: _AuthoringSyncFailedBanner(
                    onReload: () => workspace.reload(),
                  ),
                ),
              if (saveSuccessVisible)
                Padding(
                  padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
                  child: Text(
                    widget.locale == 'ar' ? 'تم الحفظ' : 'Saved',
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.heroMid,
                    ),
                  ),
                ),
              SizedBox(key: _conversationTailKey, height: 1),
            ],
          ),
        ),

        if (!_manualEntryMode)
          Stack(
            clipBehavior: Clip.none,
            children: [
              Padding(
                padding: EdgeInsetsDirectional.fromSTEB(
                  AppSpacing.md,
                  0,
                  AppSpacing.md,
                  MediaQuery.viewInsetsOf(context).bottom > 0
                      ? AppSpacing.xs
                      : AppSpacing.md,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _composerController,
                        enabled: composerEnabled,
                        minLines: 1,
                        maxLines: 4,
                        textInputAction: TextInputAction.send,
                        onSubmitted: composerEnabled ? (_) => _sendComposerMessage() : null,
                        decoration: InputDecoration(
                          hintText: snapshot?.currentSuggestion != null
                              ? AiL10n.authoringDiscussComposerHintForSessionStage(
                                  snapshot!.currentSuggestion!.stage,
                                ).resolve(context)
                              : AiL10n.authoringInputHint.resolve(context),
                          border: OutlineInputBorder(
                            borderRadius: AppRadius.lgAll,
                          ),
                          contentPadding: const EdgeInsetsDirectional.all(
                            AppSpacing.sm,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    IconButton.filled(
                      onPressed: composerEnabled ? _sendComposerMessage : null,
                      icon: const Icon(Icons.arrow_upward_rounded),
                    ),
                  ],
                ),
              ),
              if (_hasNewReplyBelow)
                PositionedDirectional(
                  top: -40,
                  start: AppSpacing.md,
                  end: AppSpacing.md,
                  child: Align(
                    alignment: AlignmentDirectional.center,
                    child: FilledButton.tonalIcon(
                      onPressed: () {
                        setState(() {
                          _hasNewReplyBelow = false;
                          _userAwayFromBottom = false;
                        });
                        _scheduleScrollToLatest(force: true);
                      },
                      icon: const Icon(Icons.arrow_downward_rounded, size: 18),
                      label: Text(
                        widget.locale == 'ar' ? 'أحدث رد' : 'Latest reply',
                      ),
                    ),
                  ),
                ),
            ],
          ),
      ],
    );
  }
}

class _ActiveStageCard extends ConsumerWidget {
  const _ActiveStageCard({
    required this.snapshot,
    required this.locale,
    required this.busy,
    this.blockAccept = false,
    required this.manualEntryMode,
    required this.manualController,
    required this.manualDifficulty,
    required this.manualComponents,
    required this.manualSteps,
    required this.manualPreviewMode,
    required this.onManualDifficultyChanged,
    required this.onStartManualEntry,
    required this.onCancelManualEntry,
    required this.onToggleManualPreview,
    required this.onAddManualComponent,
    required this.onRemoveManualComponent,
    required this.onManualComponentChanged,
    required this.onAddManualStep,
    required this.onRemoveManualStep,
    required this.onManualStepChanged,
    required this.onAddStepReview,
    required this.suggestionPreview,
    required this.canonicalSavedPreview,
  });

  final AiAuthoringSnapshot snapshot;
  final String locale;
  final bool busy;
  final bool blockAccept;
  final bool manualEntryMode;
  final TextEditingController manualController;
  final String? manualDifficulty;
  final List<_ManualComponentDraft> manualComponents;
  final List<_ManualStepDraft> manualSteps;
  final bool manualPreviewMode;
  final ValueChanged<String?> onManualDifficultyChanged;
  final VoidCallback onStartManualEntry;
  final VoidCallback onCancelManualEntry;
  final VoidCallback onToggleManualPreview;
  final VoidCallback onAddManualComponent;
  final ValueChanged<int> onRemoveManualComponent;
  final void Function(int index, _ManualComponentDraft draft) onManualComponentChanged;
  final VoidCallback onAddManualStep;
  final ValueChanged<int> onRemoveManualStep;
  final void Function(int index, _ManualStepDraft draft) onManualStepChanged;
  final Future<void> Function({
    required String turnId,
    required bool busy,
  }) onAddStepReview;
  final String Function(AiAuthoringCurrentSuggestion suggestion) suggestionPreview;
  final String? Function(AiAuthoringSnapshot snapshot) canonicalSavedPreview;

  String _acceptLabel(BuildContext context) {
    if (snapshot.session.stage == 'COMPONENTS') {
      return AiL10n.authoringSequentialAcceptListAndSave.resolve(context);
    }
    if (snapshot.session.stage == 'STEPS_OVERVIEW' ||
        snapshot.session.stage == 'STEP_REVIEW') {
      return AiL10n.authoringSequentialAcceptPlanAndSave.resolve(context);
    }
    return AiL10n.authoringSequentialAcceptAndSave.resolve(context);
  }

  Widget _stepLine(
    BuildContext context,
    MaterialsUiPalette palette, {
    required int order,
    required String title,
    required String description,
    String? safetyNote,
  }) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$order. $title',
            style: AppTextStyles.body(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            description,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
              height: 1.35,
            ),
          ),
          if ((safetyNote ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              safetyNote!,
              style: AppTextStyles.label(context).copyWith(
                color: palette.heroMid,
                height: 1.35,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _componentLine(
    BuildContext context,
    MaterialsUiPalette palette, {
    required String name,
    required num quantity,
    required String unit,
    required bool isRequired,
    String? notes,
  }) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '$name · $quantity $unit · ${isRequired ? (locale == 'ar' ? 'مطلوب' : 'Required') : (locale == 'ar' ? 'اختياري' : 'Optional')}',
            style: AppTextStyles.body(context).copyWith(
              color: palette.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          if ((notes ?? '').isNotEmpty)
            Text(
              notes!,
              style: AppTextStyles.label(context).copyWith(
                color: palette.textSecondary,
                height: 1.35,
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final palette = MaterialsUiPalette.of(context);
    final workspaceState = ref.watch(authoringWorkspaceControllerProvider);
    final workspace = ref.read(authoringWorkspaceControllerProvider.notifier);
    bool actionBusy(String action) =>
        workspaceState.isBusy && workspaceState.activeAction == action;
    final session = snapshot.session;
    final suggestion = snapshot.currentSuggestion;
    final actions = snapshot.availableActions.toSet();
    final savedPreview = canonicalSavedPreview(snapshot);
    final canonicalComponents = snapshot.canonicalProject.components;
    final showFinalize = actions.contains('FINALIZE_SECTION');
    final showAccept =
        (actions.contains('ACCEPT_TURN') || showFinalize) && !blockAccept;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              AiL10n.authoringSequentialStageLabel(session.stage).resolve(context),
              style: AppTextStyles.subtitle(context).copyWith(
                color: palette.heroMid,
              ),
            ),
            if (session.stage == 'OVERVIEW') ...[
              _OverviewClarificationSection(
                snapshot: snapshot,
                locale: locale,
                busy: busy,
                actions: actions,
                onStart: () => workspace.runAction(action: 'START'),
              ),
            ] else if (manualEntryMode) ...[
              const SizedBox(height: AppSpacing.sm),
              if (session.stage == 'COMPONENTS') ...[
                for (var index = 0; index < manualComponents.length; index += 1)
                  _ManualComponentEditorRow(
                    key: ValueKey('manual-component-$index'),
                    draft: manualComponents[index],
                    enabled: !busy,
                    onChanged: (draft) => onManualComponentChanged(index, draft),
                    onRemove: manualComponents.length > 1
                        ? () => onRemoveManualComponent(index)
                        : null,
                  ),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    onPressed: busy ? null : onAddManualComponent,
                    icon: const Icon(Icons.add_rounded),
                    label: Text(locale == 'ar' ? 'إضافة مكوّن' : 'Add component'),
                  ),
                ),
                if (manualPreviewMode)
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: palette.mutedSurface,
                      borderRadius: AppRadius.mdAll,
                    ),
                    child: Padding(
                      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final component in manualComponents)
                            if (component.componentName.trim().isNotEmpty)
                              Text(
                                '${component.componentName.trim()} · ${component.quantity} ${component.unit.trim()}',
                                style: AppTextStyles.body(context),
                              ),
                        ],
                      ),
                    ),
                  ),
              ] else if (session.stage == 'STEPS_OVERVIEW' ||
                  session.stage == 'STEP_REVIEW') ...[
                for (var index = 0; index < manualSteps.length; index += 1)
                  _ManualStepEditorRow(
                    key: ValueKey('manual-step-$index'),
                    draft: manualSteps[index],
                    enabled: !busy,
                    onChanged: (draft) => onManualStepChanged(index, draft),
                    onRemove: manualSteps.length > 1
                        ? () => onRemoveManualStep(index)
                        : null,
                  ),
                Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: TextButton.icon(
                    onPressed: busy ? null : onAddManualStep,
                    icon: const Icon(Icons.add_rounded),
                    label: Text(locale == 'ar' ? 'إضافة خطوة' : 'Add step'),
                  ),
                ),
                if (manualPreviewMode)
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: palette.mutedSurface,
                      borderRadius: AppRadius.mdAll,
                    ),
                    child: Padding(
                      padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (var index = 0; index < manualSteps.length; index += 1)
                            if (manualSteps[index].title.trim().isNotEmpty)
                              Text(
                                '${index + 1}. ${manualSteps[index].title.trim()}',
                                style: AppTextStyles.body(context),
                              ),
                        ],
                      ),
                    ),
                  ),
              ] else if (session.stage == 'DIFFICULTY')
                DropdownButtonFormField<String>(
                  value: isValidAuthoringDifficulty(manualDifficulty)
                      ? manualDifficulty!.trim().toUpperCase()
                      : null,
                  items: const [
                    DropdownMenuItem(value: 'BEGINNER', child: Text('Beginner')),
                    DropdownMenuItem(
                      value: 'INTERMEDIATE',
                      child: Text('Intermediate'),
                    ),
                    DropdownMenuItem(value: 'ADVANCED', child: Text('Advanced')),
                  ],
                  onChanged: busy ? null : onManualDifficultyChanged,
                  decoration: const InputDecoration(labelText: 'Difficulty'),
                )
              else
                TextField(
                  controller: manualController,
                  enabled: !busy,
                  minLines: session.stage == 'FULL_DESCRIPTION' ? 4 : 1,
                  maxLines: session.stage == 'FULL_DESCRIPTION' ? 8 : 3,
                  decoration: InputDecoration(
                    labelText: AiL10n.authoringSequentialManualHint(session.stage)
                        .resolve(context),
                  ),
                ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  TextButton(
                    onPressed: busy ? null : onCancelManualEntry,
                    child: Text(AiL10n.cancelAction.resolve(context)),
                  ),
                  if (session.stage == 'COMPONENTS' ||
                      session.stage == 'STEPS_OVERVIEW' ||
                      session.stage == 'STEP_REVIEW')
                    OutlinedButton(
                      onPressed: busy ? null : onToggleManualPreview,
                      child: Text(
                        AiL10n.authoringSequentialManualPreview.resolve(context),
                      ),
                    ),
                  FilledButton(
                    onPressed: busy || !actions.contains('SAVE_MANUAL')
                        ? null
                        : () async {
                            Object? value = manualController.text.trim();
                            if (session.stage == 'DIFFICULTY') {
                              value = manualDifficulty;
                            }
                            if (session.stage == 'ESTIMATED_DURATION') {
                              value = int.tryParse(manualController.text.trim());
                            }
                            if (session.stage == 'COMPONENTS') {
                              value = manualComponents
                                  .where(
                                    (component) =>
                                        component.componentName.trim().isNotEmpty,
                                  )
                                  .map((component) => component.toJson())
                                  .toList(growable: false);
                            }
                            if (session.stage == 'STEPS_OVERVIEW' ||
                                session.stage == 'STEP_REVIEW') {
                              value = manualSteps
                                  .where((step) => step.title.trim().isNotEmpty)
                                  .map((step) => step.toJson())
                                  .toList(growable: false);
                            }
                            await workspace.runAction(
                              action: 'SAVE_MANUAL',
                              manualValue: value,
                            );
                            if (!ref.read(authoringSaveSyncFailedProvider)) {
                              onCancelManualEntry();
                            }
                          },
                    child: Text(
                      session.stage == 'COMPONENTS'
                          ? AiL10n.authoringSequentialSaveComponentList.resolve(context)
                          : session.stage == 'STEPS_OVERVIEW' ||
                                  session.stage == 'STEP_REVIEW'
                              ? AiL10n.authoringSequentialAcceptPlanAndSave.resolve(context)
                              : AiL10n.authoringSequentialSaveManualValue.resolve(context),
                    ),
                  ),
                ],
              ),
            ] else if ((session.stage == 'STEPS_OVERVIEW' ||
                    session.stage == 'STEP_REVIEW') &&
                busy &&
                session.status == 'PROCESSING' &&
                suggestion == null) ...[
              const SizedBox(height: AppSpacing.sm),
              const Center(child: CircularProgressIndicator()),
              const SizedBox(height: AppSpacing.sm),
              Text(
                AiL10n.authoringSequentialGeneratingStepPlan.resolve(context),
                textAlign: TextAlign.center,
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
            ] else if ((session.stage == 'STEPS_OVERVIEW' ||
                    session.stage == 'STEP_REVIEW') &&
                !busy &&
                session.status == 'PROCESSING' &&
                suggestion == null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                locale == 'ar'
                    ? 'تعذّر إكمال إنشاء خطة الخطوات. أعد المحاولة.'
                    : 'Step plan generation did not finish. Try again.',
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: busy ? null : () => workspace.regenerateFailedStage(),
                child: Text(
                  AiL10n.authoringSequentialGenerateStepPlan.resolve(context),
                ),
              ),
            ] else if (session.status == 'GENERATION_FAILED' &&
                session.stage == 'STEPS_OVERVIEW' &&
                !busy) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                locale == 'ar'
                    ? 'تم حفظ المكوّنات، لكن تعذّر إنشاء خطة الخطوات.'
                    : 'Components saved. The step plan could not be generated.',
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: busy
                    ? null
                    : () => workspace.regenerateFailedStage(),
                child: Text(
                  AiL10n.authoringSequentialGenerateStepPlan.resolve(context),
                ),
              ),
            ] else if (isScalarAuthoringStage(session.stage) &&
                suggestion == null &&
                (session.status == 'PROCESSING' || busy)) ...[
              const SizedBox(height: AppSpacing.sm),
              const Center(child: CircularProgressIndicator()),
              const SizedBox(height: AppSpacing.sm),
              Text(
                locale == 'ar'
                    ? 'جارٍ إعداد اقتراح لهذه المرحلة…'
                    : 'Preparing a suggestion for this stage…',
                textAlign: TextAlign.center,
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
            ] else if (isScalarAuthoringStage(session.stage) &&
                suggestion == null &&
                session.status == 'GENERATION_FAILED' &&
                !busy) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                locale == 'ar'
                    ? 'تعذّر إنشاء اقتراح لهذه المرحلة.'
                    : 'Could not generate a suggestion for this stage.',
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: busy ? null : () => workspace.regenerateFailedStage(),
                child: Text(locale == 'ar' ? 'إعادة المحاولة' : 'Retry'),
              ),
            ] else if (isScalarAuthoringStage(session.stage) &&
                suggestion == null &&
                !busy &&
                !manualEntryMode) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                locale == 'ar'
                    ? 'تعذّر عرض اقتراح المساعد لهذه المرحلة.'
                    : 'The assistant suggestion for this stage could not be displayed.',
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: busy ? null : () => workspace.reload(),
                child: Text(locale == 'ar' ? 'إعادة المحاولة' : 'Retry'),
              ),
            ] else if (suggestion != null && suggestion.isProposed) ...[
              if (savedPreview != null && savedPreview.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  locale == 'ar' ? 'القيمة المحفوظة' : 'Saved value',
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  savedPreview,
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textPrimary,
                    height: 1.45,
                  ),
                  textDirection: resolveContentTextDirection(savedPreview),
                ),
              ],
              if (session.stage == 'COMPONENTS' &&
                  canonicalComponents.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  AiL10n.authoringSequentialSavedComponents.resolve(context),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                for (final component in canonicalComponents)
                  _componentLine(
                    context,
                    palette,
                    name: component.componentName,
                    quantity: component.quantity,
                    unit: component.unit,
                    isRequired: component.isRequired,
                    notes: component.notes,
                  ),
              ],
              if (session.stage == 'COMPONENTS' &&
                  suggestion.component != null &&
                  !suggestion.hasComponentList) ...[
                Builder(
                  builder: (context) {
                    final componentTotal = suggestion.componentTotal ??
                        ((session.componentSourceTotal ?? 0) > 0
                            ? session.componentSourceTotal!
                            : 1);
                    final progressLabel = locale == 'ar'
                        ? 'المكوّن ${(suggestion.componentIndex ?? 0) + 1} من $componentTotal'
                        : 'Component ${(suggestion.componentIndex ?? 0) + 1} of $componentTotal';
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          progressLabel,
                          style: AppTextStyles.label(context).copyWith(
                            color: palette.textSecondary,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        _componentLine(
                          context,
                          palette,
                          name: '${suggestion.component!['componentName']}',
                          quantity: (suggestion.component!['quantity'] as num?) ?? 1,
                          unit: '${suggestion.component!['unit'] ?? 'piece'}',
                          isRequired: suggestion.component!['isRequired'] == true,
                          notes: suggestion.component!['notes'] as String?,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        if (showAccept)
                          FilledButton(
                            onPressed: busy
                                ? null
                                : () => workspace.runAction(
                                      action: 'ACCEPT_TURN',
                                      turnId: suggestion.turnId,
                                    ),
                            child: Text(
                              AiL10n.authoringSequentialAcceptComponent.resolve(context),
                            ),
                          ),
                        Wrap(
                          spacing: AppSpacing.xs,
                          runSpacing: AppSpacing.xs,
                          children: [
                            if (actions.contains('BACK_ITEM'))
                              OutlinedButton(
                                onPressed: busy
                                    ? null
                                    : () => workspace.runAction(
                                          action: 'BACK_ITEM',
                                          turnId: suggestion.turnId,
                                        ),
                                child: Text(
                                  AiL10n.authoringSequentialBackItem.resolve(context),
                                ),
                              ),
                            if (actions.contains('REMOVE_ITEM'))
                              OutlinedButton(
                                onPressed: busy
                                    ? null
                                    : () => workspace.runAction(
                                          action: 'REMOVE_ITEM',
                                          turnId: suggestion.turnId,
                                          manualValue: suggestion.componentIndex ?? 0,
                                        ),
                                child: Text(
                                  locale == 'ar' ? 'إزالة' : 'Remove',
                                ),
                              ),
                          ],
                        ),
                      ],
                    );
                  },
                ),
              ] else if (session.stage == 'COMPONENTS' && suggestion.hasComponentList) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  AiL10n.authoringSequentialProposedComponents.resolve(context),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                if (suggestion.explanation.isNotEmpty &&
                    !isGenericComponentPlaceholderText(suggestion.explanation))
                  Text(
                    suggestion.explanation,
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textMuted,
                    ),
                  ),
                const SizedBox(height: AppSpacing.sm),
                for (final component in suggestion.components)
                  _componentLine(
                    context,
                    palette,
                    name: component.componentName,
                    quantity: component.quantity,
                    unit: component.unit,
                    isRequired: component.isRequired,
                    notes: component.notes,
                  ),
                if (suggestion.explanation.isNotEmpty &&
                    !isGenericComponentPlaceholderText(suggestion.explanation)) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    suggestion.explanation,
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                if (showAccept)
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () => workspace.runAction(
                              action: showFinalize ? 'FINALIZE_SECTION' : 'ACCEPT_TURN',
                              turnId: suggestion.turnId,
                            ),
                    child: Text(_acceptLabel(context)),
                  ),
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    if (actions.contains('CHOOSE_MODE') &&
                        !session.awaitingComponentsFinalSave)
                      OutlinedButton(
                        onPressed: busy
                            ? null
                            : () => workspace.runAction(
                                  action: 'CHOOSE_MODE',
                                  mode: 'COMPONENTS_ONE_BY_ONE',
                                ),
                        child: Text(
                          AiL10n.authoringSequentialReviewOneByOne.resolve(context),
                        ),
                      ),
                    if (actions.contains('SUGGEST_ANOTHER'))
                      OutlinedButton(
                        onPressed: busy
                            ? null
                            : () => workspace.runAction(
                                  action: 'SUGGEST_ANOTHER',
                                  turnId: suggestion.turnId,
                                ),
                        child: Text(
                          locale == 'ar'
                              ? 'اقترح قائمة أخرى'
                              : 'Suggest another list',
                        ),
                      ),
                    if (actions.contains('SAVE_MANUAL'))
                      OutlinedButton(
                        onPressed: busy ? null : onStartManualEntry,
                        child: Text(
                          AiL10n.authoringSequentialEnterOwnComponentList.resolve(context),
                        ),
                      ),
                  ],
                ),
              ] else if (session.awaitingStepsFinalSave &&
                  (session.stage == 'STEPS_OVERVIEW' ||
                      session.stage == 'STEP_REVIEW')) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  locale == 'ar' ? 'الخطة المراجعة' : 'Reviewed plan',
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                for (var index = 0; index < suggestion.steps.length; index += 1)
                  _stepLine(
                    context,
                    palette,
                    order: index + 1,
                    title: suggestion.steps[index].title,
                    description: suggestion.steps[index].description,
                    safetyNote: suggestion.steps[index].safetyNote,
                  ),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => workspace.runAction(
                            action: 'FINALIZE_SECTION',
                            turnId: suggestion.turnId,
                          ),
                  child: Text(AiL10n.authoringSequentialAcceptPlanAndSave.resolve(context)),
                ),
              ] else if (session.stage == 'STEP_REVIEW' &&
                  session.isStepByStep &&
                  suggestion.step != null) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  AiL10n.authoringSequentialStepProgress(
                    (suggestion.stepIndex ?? session.currentStepIndex ?? 0) + 1,
                    suggestion.stepTotal ?? session.workingStepCount,
                  ).resolve(context),
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                _stepLine(
                  context,
                  palette,
                  order: (suggestion.stepIndex ?? 0) + 1,
                  title: '${suggestion.step!['title']}',
                  description: '${suggestion.step!['description'] ?? ''}',
                ),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => workspace.runAction(
                            action: 'ACCEPT_TURN',
                            turnId: suggestion.turnId,
                          ),
                  child: actionBusy('ACCEPT_TURN')
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(AiL10n.authoringSequentialAcceptStep.resolve(context)),
                ),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    if (actions.contains('BACK_ITEM') &&
                        (suggestion.stepIndex ?? session.currentStepIndex ?? 0) > 0)
                      OutlinedButton(
                        onPressed: busy
                            ? null
                            : () => workspace.runAction(
                                  action: 'BACK_ITEM',
                                  turnId: suggestion.turnId,
                                ),
                        child: Text(AiL10n.authoringSequentialBackItem.resolve(context)),
                      ),
                    if (actions.contains('REMOVE_ITEM'))
                      OutlinedButton(
                        onPressed: busy
                            ? null
                            : () => workspace.runAction(
                                  action: 'REMOVE_ITEM',
                                  turnId: suggestion.turnId,
                                  manualValue: suggestion.stepIndex ?? 0,
                                ),
                        child: Text(AiL10n.authoringSequentialRemoveItem.resolve(context)),
                      ),
                    if (actions.contains('ADD_ITEM'))
                      OutlinedButton(
                        onPressed: busy
                            ? null
                            : () => onAddStepReview(
                                  turnId: suggestion.turnId,
                                  busy: busy,
                                ),
                        child: Text(
                          locale == 'ar' ? 'إضافة خطوة' : 'Add step',
                        ),
                      ),
                    if (actions.contains('EXPLAIN_STEP'))
                      OutlinedButton(
                        onPressed: busy
                            ? null
                            : () => workspace.runAction(
                                  action: 'EXPLAIN_STEP',
                                  turnId: suggestion.turnId,
                                ),
                        child: actionBusy('EXPLAIN_STEP')
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(AiL10n.authoringSequentialExplainStep.resolve(context)),
                      ),
                  ],
                ),
              ] else if ((session.stage == 'STEPS_OVERVIEW' ||
                      session.stage == 'STEP_REVIEW') &&
                  suggestion.hasStepList) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  locale == 'ar' ? 'خطة الخطوات المقترحة' : 'Proposed step plan',
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                for (var index = 0; index < suggestion.steps.length; index += 1)
                  _stepLine(
                    context,
                    palette,
                    order: index + 1,
                    title: suggestion.steps[index].title,
                    description: suggestion.steps[index].description,
                    safetyNote: suggestion.steps[index].safetyNote,
                  ),
                if (suggestion.explanation.isNotEmpty &&
                    !isGenericStepPlaceholderText(suggestion.explanation)) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    suggestion.explanation,
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                if (showAccept)
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () => workspace.runAction(
                              action: showFinalize ? 'FINALIZE_SECTION' : 'ACCEPT_TURN',
                              turnId: suggestion.turnId,
                            ),
                    child: Text(_acceptLabel(context)),
                  ),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    if (actions.contains('CHOOSE_MODE') &&
                        !session.awaitingStepsFinalSave)
                      OutlinedButton(
                        onPressed: busy
                            ? null
                            : () => workspace.runAction(
                                  action: 'CHOOSE_MODE',
                                  mode: 'STEP_BY_STEP',
                                ),
                        child: Text(
                          AiL10n.authoringSequentialReviewStepByStep.resolve(context),
                        ),
                      ),
                    if (actions.contains('SUGGEST_ANOTHER'))
                      OutlinedButton(
                        onPressed: busy
                            ? null
                            : () => workspace.runAction(
                                  action: 'SUGGEST_ANOTHER',
                                  turnId: suggestion.turnId,
                                ),
                        child: Text(AiL10n.authoringSequentialSuggestAnother.resolve(context)),
                      ),
                    if (actions.contains('SAVE_MANUAL'))
                      OutlinedButton(
                        onPressed: busy ? null : onStartManualEntry,
                        child: Text(
                          AiL10n.authoringSequentialEnterOwnSteps.resolve(context),
                        ),
                      ),
                  ],
                ),
              ] else if ((session.stage == 'STEPS_OVERVIEW' ||
                      session.stage == 'STEP_REVIEW') &&
                  !suggestion.hasStepList &&
                  session.status != 'PROCESSING') ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  locale == 'ar'
                      ? 'تعذّر عرض خطة الخطوات المقترحة.'
                      : 'The proposed step plan could not be displayed.',
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textPrimary,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => workspace.regenerateFailedStage(),
                  child: Text(
                    AiL10n.authoringSequentialGenerateStepPlan.resolve(context),
                  ),
                ),
              ] else if ((session.stage == 'STEPS_OVERVIEW' ||
                      session.stage == 'STEP_REVIEW') &&
                  isGenericStepPlaceholderText(suggestion.explanation)) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  AiL10n.authoringSequentialGenerateStepPlan.resolve(context),
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textPrimary,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => workspace.runAction(
                            action: 'REGENERATE_STALE',
                          ),
                  child: Text(AiL10n.authoringSequentialGenerateStepPlan.resolve(context)),
                ),
              ] else ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  locale == 'ar' ? 'اقتراح المساعد' : 'Assistant suggestion',
                  style: AppTextStyles.label(context).copyWith(
                    color: palette.textSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  suggestionPreview(suggestion),
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textPrimary,
                    height: 1.45,
                  ),
                  textDirection: resolveContentTextDirection(
                    suggestionPreview(suggestion),
                  ),
                ),
                if (suggestion.explanation.isNotEmpty &&
                    suggestionPreview(suggestion) != suggestion.explanation &&
                    !isGenericComponentPlaceholderText(suggestion.explanation) &&
                    !isGenericStepPlaceholderText(suggestion.explanation)) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    suggestion.explanation,
                    style: AppTextStyles.label(context).copyWith(
                      color: palette.textSecondary,
                      height: 1.4,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpacing.md),
                if (showAccept)
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () => workspace.runAction(
                              action: showFinalize ? 'FINALIZE_SECTION' : 'ACCEPT_TURN',
                              turnId: suggestion.turnId,
                            ),
                    child: Text(_acceptLabel(context)),
                  ),
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    if (actions.contains('SUGGEST_ANOTHER'))
                      OutlinedButton(
                        onPressed: busy
                            ? null
                            : () => workspace.runAction(
                                  action: 'SUGGEST_ANOTHER',
                                  turnId: suggestion.turnId,
                                ),
                        child: Text(
                          AiL10n.authoringSequentialSuggestAnother.resolve(context),
                        ),
                      ),
                    if (actions.contains('SAVE_MANUAL'))
                      OutlinedButton(
                        onPressed: busy ? null : onStartManualEntry,
                        child: Text(
                          AiL10n.authoringSequentialEnterOwnValue.resolve(context),
                        ),
                      ),
                  ],
                ),
              ],
            ] else if (session.stage == 'FINAL_REVIEW' &&
                actions.contains('FINISH')) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                AiL10n.authoringSequentialFinalReviewSummary.resolve(context),
                style: AppTextStyles.subtitle(context).copyWith(
                  color: palette.textPrimary,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                snapshot.canonicalProject.title,
                style: AppTextStyles.body(context).copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                snapshot.canonicalProject.shortDescription,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                locale == 'ar'
                    ? 'الصعوبة: ${snapshot.canonicalProject.difficulty} · المدة: ${snapshot.canonicalProject.estimatedMinutes ?? '—'} دقيقة · المكوّنات: ${snapshot.canonicalProject.components.length} · الخطوات: ${snapshot.canonicalProject.steps.length}'
                    : 'Difficulty: ${snapshot.canonicalProject.difficulty} · Duration: ${snapshot.canonicalProject.estimatedMinutes ?? '—'} min · Components: ${snapshot.canonicalProject.components.length} · Steps: ${snapshot.canonicalProject.steps.length}',
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              FilledButton(
                onPressed: busy
                    ? null
                    : () => workspace.runAction(action: 'FINISH'),
                child: Text(AiL10n.authoringSequentialFinish.resolve(context)),
              ),
            ] else if (session.isComplete) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                locale == 'ar'
                    ? 'اكتمل التأليف. المسودة ما زالت قابلة للتحرير.'
                    : 'Authoring complete. The draft remains editable.',
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textPrimary,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ManualComponentDraft {
  _ManualComponentDraft({
    required this.componentName,
    required this.materialType,
    required this.quantity,
    required this.unit,
    required this.componentRole,
    required this.isRequired,
    this.notes,
  });

  factory _ManualComponentDraft.empty() => _ManualComponentDraft(
        componentName: '',
        materialType: 'Electronic component',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
      );

  factory _ManualComponentDraft.fromProposal(AiAuthoringProposalComponent component) =>
      _ManualComponentDraft(
        componentName: component.componentName,
        materialType: component.materialType,
        quantity: component.quantity,
        unit: component.unit,
        componentRole: component.componentRole,
        isRequired: component.isRequired,
        notes: component.notes,
      );

  final String componentName;
  final String materialType;
  final num quantity;
  final String unit;
  final String componentRole;
  final bool isRequired;
  final String? notes;

  Map<String, Object?> toJson() => {
        'componentName': componentName.trim(),
        'materialType': materialType.trim(),
        'quantity': quantity,
        'unit': unit.trim(),
        'componentRole': componentRole,
        'isRequired': isRequired,
        'canBeSubstituted': true,
        if (notes != null && notes!.trim().isNotEmpty) 'notes': notes!.trim(),
      };
}

class _ManualComponentEditorRow extends StatefulWidget {
  const _ManualComponentEditorRow({
    super.key,
    required this.draft,
    required this.enabled,
    required this.onChanged,
    this.onRemove,
  });

  final _ManualComponentDraft draft;
  final bool enabled;
  final ValueChanged<_ManualComponentDraft> onChanged;
  final VoidCallback? onRemove;

  @override
  State<_ManualComponentEditorRow> createState() => _ManualComponentEditorRowState();
}

class _ManualComponentEditorRowState extends State<_ManualComponentEditorRow> {
  late final TextEditingController _nameController;
  late final TextEditingController _quantityController;
  late final TextEditingController _unitController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.draft.componentName);
    _quantityController = TextEditingController(text: '${widget.draft.quantity}');
    _unitController = TextEditingController(text: widget.draft.unit);
  }

  @override
  void didUpdateWidget(covariant _ManualComponentEditorRow oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.draft.componentName != widget.draft.componentName &&
        _nameController.text != widget.draft.componentName) {
      _nameController.text = widget.draft.componentName;
    }
    if (oldWidget.draft.quantity != widget.draft.quantity &&
        _quantityController.text != '${widget.draft.quantity}') {
      _quantityController.text = '${widget.draft.quantity}';
    }
    if (oldWidget.draft.unit != widget.draft.unit &&
        _unitController.text != widget.draft.unit) {
      _unitController.text = widget.draft.unit;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _quantityController.dispose();
    _unitController.dispose();
    super.dispose();
  }

  void _emit() {
    widget.onChanged(
      _ManualComponentDraft(
        componentName: _nameController.text,
        materialType: widget.draft.materialType,
        quantity: num.tryParse(_quantityController.text) ?? widget.draft.quantity,
        unit: _unitController.text,
        componentRole: widget.draft.componentRole,
        isRequired: widget.draft.isRequired,
        notes: widget.draft.notes,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Column(
        children: [
          TextField(
            enabled: widget.enabled,
            controller: _nameController,
            onChanged: (_) => _emit(),
            decoration: const InputDecoration(labelText: 'Component name'),
          ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  enabled: widget.enabled,
                  keyboardType: TextInputType.number,
                  controller: _quantityController,
                  onChanged: (_) => _emit(),
                  decoration: const InputDecoration(labelText: 'Qty'),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: TextField(
                  enabled: widget.enabled,
                  controller: _unitController,
                  onChanged: (_) => _emit(),
                  decoration: const InputDecoration(labelText: 'Unit'),
                ),
              ),
              if (widget.onRemove != null)
                IconButton(
                  onPressed: widget.enabled ? widget.onRemove : null,
                  icon: const Icon(Icons.delete_outline_rounded),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ManualStepDraft {
  _ManualStepDraft({
    required this.title,
    required this.description,
    this.safetyNote,
  });

  factory _ManualStepDraft.empty() => _ManualStepDraft(
        title: '',
        description: '',
      );

  factory _ManualStepDraft.fromProposal(AiAuthoringProposalStep step) =>
      _ManualStepDraft(
        title: step.title,
        description: step.description,
        safetyNote: step.safetyNote,
      );

  final String title;
  final String description;
  final String? safetyNote;

  Map<String, Object?> toJson() => {
        'title': title.trim(),
        'description': description.trim(),
        if (safetyNote != null && safetyNote!.trim().isNotEmpty)
          'safetyNote': safetyNote!.trim(),
      };
}

class _ManualStepEditorRow extends StatefulWidget {
  const _ManualStepEditorRow({
    super.key,
    required this.draft,
    required this.enabled,
    required this.onChanged,
    this.onRemove,
  });

  final _ManualStepDraft draft;
  final bool enabled;
  final ValueChanged<_ManualStepDraft> onChanged;
  final VoidCallback? onRemove;

  @override
  State<_ManualStepEditorRow> createState() => _ManualStepEditorRowState();
}

class _ManualStepEditorRowState extends State<_ManualStepEditorRow> {
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _safetyController;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.draft.title);
    _descriptionController = TextEditingController(text: widget.draft.description);
    _safetyController = TextEditingController(text: widget.draft.safetyNote ?? '');
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _safetyController.dispose();
    super.dispose();
  }

  void _emit() {
    widget.onChanged(
      _ManualStepDraft(
        title: _titleController.text,
        description: _descriptionController.text,
        safetyNote: _safetyController.text.trim().isEmpty
            ? null
            : _safetyController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.sm),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: TextField(
                  enabled: widget.enabled,
                  controller: _titleController,
                  onChanged: (_) => _emit(),
                  decoration: const InputDecoration(labelText: 'Step title'),
                ),
              ),
              if (widget.onRemove != null)
                IconButton(
                  onPressed: widget.enabled ? widget.onRemove : null,
                  icon: const Icon(Icons.delete_outline_rounded),
                ),
            ],
          ),
          TextField(
            enabled: widget.enabled,
            controller: _descriptionController,
            minLines: 2,
            maxLines: 4,
            onChanged: (_) => _emit(),
            decoration: const InputDecoration(labelText: 'Description'),
          ),
          TextField(
            enabled: widget.enabled,
            controller: _safetyController,
            onChanged: (_) => _emit(),
            decoration: const InputDecoration(labelText: 'Safety note (optional)'),
          ),
        ],
      ),
    );
  }
}

class _AuthoringErrorBanner extends StatelessWidget {
  const _AuthoringErrorBanner({
    required this.error,
    required this.displayMessage,
    this.onRetry,
    this.retryLabel,
    this.onDismiss,
  });

  final ApiException error;
  final String displayMessage;
  final VoidCallback? onRetry;
  final String? retryLabel;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              displayMessage,
              style: AppTextStyles.body(context).copyWith(
                color: palette.textPrimary,
              ),
            ),
            if ((error.code ?? '').isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                error.code!,
                style: AppTextStyles.label(context).copyWith(
                  color: palette.textMuted,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                if (onRetry != null)
                  TextButton(
                    onPressed: onRetry,
                    child: Text(retryLabel ?? AiL10n.retry.resolve(context)),
                  ),
                if (onDismiss != null)
                  TextButton(
                    onPressed: onDismiss,
                    child: const Text('Dismiss'),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _AuthoringSyncFailedBanner extends StatelessWidget {
  const _AuthoringSyncFailedBanner({required this.onReload});

  final VoidCallback onReload;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.cardSurface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
        child: Row(
          children: [
            Expanded(
              child: Text(
                'Components were saved on the server. Reload the draft.',
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textPrimary,
                ),
              ),
            ),
            TextButton(
              onPressed: onReload,
              child: Text(AiL10n.authoringSequentialReloadDraft.resolve(context)),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoricalTurnCard extends StatelessWidget {
  const _HistoricalTurnCard({
    required this.summary,
    required this.locale,
  });

  final AuthoringHistoricalTurnSummary summary;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: palette.pageBackground,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              AiL10n.authoringSequentialStageLabel(summary.stage).resolve(context),
              style: AppTextStyles.label(context).copyWith(
                color: palette.textMuted,
              ),
            ),
            if (summary.preview.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                summary.preview,
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textSecondary,
                  height: 1.35,
                ),
                textDirection: resolveContentTextDirection(summary.preview),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AuthoringLoadingBubble extends StatelessWidget {
  const _AuthoringLoadingBubble();

  @override
  Widget build(BuildContext context) {
    return const Align(
      alignment: AlignmentDirectional.centerStart,
      child: SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
    );
  }
}

class _OverviewClarificationSection extends ConsumerStatefulWidget {
  const _OverviewClarificationSection({
    required this.snapshot,
    required this.locale,
    required this.busy,
    required this.actions,
    required this.onStart,
  });

  final AiAuthoringSnapshot snapshot;
  final String locale;
  final bool busy;
  final Set<String> actions;
  final VoidCallback onStart;

  @override
  ConsumerState<_OverviewClarificationSection> createState() =>
      _OverviewClarificationSectionState();
}

class _OverviewClarificationSectionState
    extends ConsumerState<_OverviewClarificationSection> {
  final Set<String> _selectedOptionIds = <String>{};
  final TextEditingController _otherController = TextEditingController();
  bool _otherSelected = false;
  String? _selectionScopeKey;

  @override
  void dispose() {
    _otherController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      _syncSelectionScope(resetIfChanged: true);
    });
  }

  @override
  void didUpdateWidget(covariant _OverviewClarificationSection oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldQuestion = clarificationQuestionFromProposal(
      oldWidget.snapshot.currentTurn?.proposal,
      stage: oldWidget.snapshot.session.stage,
    );
    final newQuestion = _activeQuestion;
    final oldTurnId = oldWidget.snapshot.currentTurn?.turnId ?? '';
    final newTurnId = widget.snapshot.currentTurn?.turnId ?? '';
    if (oldQuestion?.questionId == newQuestion?.questionId && oldTurnId == newTurnId) {
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _syncSelectionScope(resetIfChanged: true);
      });
    });
  }

  void _syncSelectionScope({required bool resetIfChanged}) {
    final question = _activeQuestion;
    final turnId = widget.snapshot.currentTurn?.turnId ?? '';
    final scopeKey =
        '${widget.snapshot.session.projectId}:${widget.snapshot.session.sessionId}:$turnId:${question?.questionId ?? ''}';
    if (_selectionScopeKey == scopeKey) {
      return;
    }
    if (resetIfChanged) {
      _selectedOptionIds.clear();
      _otherSelected = false;
      _otherController.clear();
    }
    _selectionScopeKey = scopeKey;
  }

  String? _resolvedSingleSelectValue(AuthoringClarificationQuestion question) {
    if (_otherSelected || question.allowMultiple || _selectedOptionIds.isEmpty) {
      return null;
    }
    final selectedId = _selectedOptionIds.first;
    final matches =
        question.options.where((option) => option.id == selectedId).length;
    return matches == 1 ? selectedId : null;
  }

  AuthoringClarificationQuestion? get _activeQuestion {
    final stage = widget.snapshot.session.stage;
    final proposal = widget.snapshot.currentTurn?.proposal;
    return clarificationQuestionFromProposal(
      proposal,
      stage: stage,
    );
  }

  List<AuthoringClarificationSummaryItem> get _summaryItems {
    final raw = widget.snapshot.currentTurn?.proposal['clarificationSummary'];
    if (raw is! List) {
      return const [];
    }
    return raw
        .whereType<Map>()
        .map((item) => AuthoringClarificationSummaryItem.fromJson(
              Map<String, dynamic>.from(item),
            ))
        .where((item) => item.answer.isNotEmpty)
        .toList(growable: false);
  }

  bool get _canContinue {
    if (_otherSelected) {
      return _otherController.text.trim().length >= 2;
    }
    return _selectedOptionIds.isNotEmpty;
  }

  Future<void> _submit() async {
    final question = _activeQuestion;
    if (question == null || !_canContinue || widget.busy) {
      return;
    }
    final selected = _otherSelected
        ? <String>['other']
        : _selectedOptionIds.toList(growable: false);
    await ref.read(authoringWorkspaceControllerProvider.notifier).submitClarificationAnswer(
          question: question,
          selectedOptionIds: selected,
          otherText: _otherSelected ? _otherController.text : null,
          locale: widget.locale,
        );
  }

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final question = _activeQuestion;
    final summary = _summaryItems;
    final locale = widget.locale;

    if (question != null) {
      return Column(
        key: ValueKey(
          '${widget.snapshot.session.projectId}:${widget.snapshot.session.sessionId}:${widget.snapshot.currentTurn?.turnId ?? ''}:${question.questionId}',
        ),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.sm),
          Text(
            locale == 'ar' ? 'لنوضح مشروعك' : "Let's clarify your project",
            style: AppTextStyles.subtitle(context).copyWith(color: palette.heroMid),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            locale == 'ar'
                ? 'السؤال ${question.questionNumber} من ${question.maxQuestions} كحد أقصى'
                : 'Question ${question.questionNumber} of up to ${question.maxQuestions}',
            style: AppTextStyles.label(context).copyWith(color: palette.textSecondary),
          ),
          if (question.summary.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            for (final item in question.summary)
              Padding(
                padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
                child: Text(
                  '${item.label}: ${item.answer}',
                  style: AppTextStyles.body(context).copyWith(
                    color: palette.textSecondary,
                    height: 1.35,
                  ),
                  textDirection: resolveContentTextDirection(item.answer),
                ),
              ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Text(
            question.question,
            style: AppTextStyles.body(context).copyWith(
              color: palette.textPrimary,
              height: 1.45,
            ),
            textDirection: resolveContentTextDirection(question.question),
          ),
          const SizedBox(height: AppSpacing.sm),
          if (!question.allowMultiple && question.options.isNotEmpty)
            DropdownButtonFormField<String>(
              key: ValueKey(
                '${widget.snapshot.session.projectId}:${widget.snapshot.session.sessionId}:${widget.snapshot.currentTurn?.turnId ?? ''}:${question.questionId}:dropdown',
              ),
              value: _resolvedSingleSelectValue(question),
              decoration: InputDecoration(
                labelText: locale == 'ar' ? 'اختر إجابة' : 'Select an answer',
              ),
              items: [
                for (final option in question.options)
                  DropdownMenuItem<String>(
                    value: option.id,
                    child: Text(
                      option.label,
                      textDirection: resolveContentTextDirection(option.label),
                    ),
                  ),
              ],
              onChanged: widget.busy
                  ? null
                  : (value) {
                      if (value == null) {
                        return;
                      }
                      setState(() {
                        _otherSelected = false;
                        _selectedOptionIds
                          ..clear()
                          ..add(value);
                      });
                    },
            )
          else if (question.options.isNotEmpty)
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                for (final option in question.options)
                  ChoiceChip(
                    label: Text(option.label),
                    selected:
                        !_otherSelected && _selectedOptionIds.contains(option.id),
                    onSelected: widget.busy
                        ? null
                        : (selected) {
                            setState(() {
                              _otherSelected = false;
                              if (question.allowMultiple) {
                                if (selected) {
                                  _selectedOptionIds.add(option.id);
                                } else {
                                  _selectedOptionIds.remove(option.id);
                                }
                              } else {
                                _selectedOptionIds
                                  ..clear()
                                  ..add(option.id);
                              }
                            });
                          },
                  ),
              ],
            ),
          if (question.allowOther) ...[
            const SizedBox(height: AppSpacing.xs),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: ChoiceChip(
                label: Text(question.otherLabel),
                selected: _otherSelected,
                onSelected: widget.busy
                    ? null
                    : (selected) {
                        setState(() {
                          _otherSelected = selected;
                          if (selected) {
                            _selectedOptionIds.clear();
                          }
                        });
                      },
              ),
            ),
          ],
          if (_otherSelected) ...[
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _otherController,
              enabled: !widget.busy,
              minLines: 2,
              maxLines: 4,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText: locale == 'ar' ? 'إجابتك' : 'Your answer',
                border: const OutlineInputBorder(),
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: widget.busy || !_canContinue ? null : _submit,
            child: Text(locale == 'ar' ? 'متابعة' : 'Continue'),
          ),
        ],
      );
    }

    if (summary.isNotEmpty) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: AppSpacing.sm),
          Text(
            locale == 'ar' ? 'ملخص التوضيح' : 'Clarification summary',
            style: AppTextStyles.subtitle(context).copyWith(color: palette.heroMid),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final item in summary)
            Padding(
              padding: const EdgeInsetsDirectional.only(bottom: AppSpacing.xs),
              child: Text(
                '• ${item.answer}',
                style: AppTextStyles.body(context).copyWith(height: 1.4),
                textDirection: resolveContentTextDirection(item.answer),
              ),
            ),
          const SizedBox(height: AppSpacing.md),
          FilledButton(
            onPressed: widget.busy || !widget.actions.contains('START')
                ? null
                : widget.onStart,
            child: Text(AiL10n.authoringSequentialStart.resolve(context)),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: AppSpacing.md),
        Text(
          locale == 'ar'
              ? 'أصبحت فكرة مشروعك جاهزة. ابدأ التأليف الموجّه.'
              : 'Your project idea is ready. Start guided authoring.',
          style: AppTextStyles.body(context).copyWith(
            color: palette.textSecondary,
            height: 1.45,
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        FilledButton(
          onPressed: widget.busy || !widget.actions.contains('START')
              ? null
              : widget.onStart,
          child: Text(AiL10n.authoringSequentialStart.resolve(context)),
        ),
      ],
    );
  }
}
