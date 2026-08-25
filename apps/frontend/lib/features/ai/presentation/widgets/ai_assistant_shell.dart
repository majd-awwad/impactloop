import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_radius.dart';
import '../../../../app/theme/app_spacing.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../app/theme/app_theme_colors.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../shared/models/localized_text.dart';
import '../../../../shared/utils/content_text_direction.dart';
import '../../../../shared/widgets/app_status_badge.dart';
import '../../../../shared/widgets/materials/materials_ui_palette.dart';
import '../../application/ai_assistant_shell_provider.dart';
import '../../application/ai_chat_controller.dart';
import '../../application/authoring_workspace_controller.dart';
import '../../domain/ai_helpers.dart';
import '../../domain/ai_models.dart';
import '../../../learning_hub/domain/models/project_build.dart';
import 'ai_chat_empty_state.dart';
import 'ai_chat_thread.dart';
import 'ai_composer.dart';
import 'ai_history_panel.dart';
import 'ai_suggestion_chips.dart';
import 'ai_sequential_authoring_panel.dart';
import '../l10n/ai_l10n.dart';

const _panelWidthCompact = 460.0;
const _panelWidthWorkspace = 880.0;
const _historyColumnWidth = 300.0;
const _desktopBreakpoint = 900.0;
const _sidePanelMinViewportWidth = 920.0;
const _workspaceTwoColumnMinWidth = 1100.0;
const _compactHeaderBreakpoint = 400.0;

class AiAssistantShellOverlay extends ConsumerStatefulWidget {
  const AiAssistantShellOverlay({super.key});

  @override
  ConsumerState<AiAssistantShellOverlay> createState() =>
      _AiAssistantShellOverlayState();
}

class _AiAssistantShellOverlayState
    extends ConsumerState<AiAssistantShellOverlay> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  bool _shouldAutoScroll = true;

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _sendMessage({String? text}) async {
    final locale = resolveAiLocale(context);
    final message = text ?? _inputController.text;
    final trimmed = message.trim();
    if (trimmed.isEmpty) {
      return;
    }

    await ref.read(aiAssistantControllerProvider.notifier).sendMessage(
          text: trimmed,
          locale: locale,
          onAccepted: text == null ? _inputController.clear : null,
        );

    if (!mounted) {
      return;
    }

    _shouldAutoScroll = true;
    _scrollToBottom();
  }

  void _scrollToBottom() {
    if (!_shouldAutoScroll) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
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

  Future<void> _confirmArchive() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(AiL10n.archiveConfirm.resolve(context)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(MaterialLocalizations.of(context).cancelButtonLabel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(AiL10n.archive.resolve(context)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    try {
      await ref
          .read(aiAssistantControllerProvider.notifier)
          .archiveCurrentConversation();
    } on Object {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(AiL10n.genericFailure.resolve(context))),
      );
      return;
    }

    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(AiL10n.archivedNotice.resolve(context))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final shellState = ref.watch(aiAssistantShellProvider);
    if (!shellState.isOpen) {
      return const SizedBox.shrink();
    }

    final width = MediaQuery.sizeOf(context).width;
    final useSidePanel = width >= _desktopBreakpoint &&
        width >= _sidePanelMinViewportWidth &&
        !shellState.isExpanded;
    final useTwoColumn = useSidePanel && width >= _workspaceTwoColumnMinWidth;
    final panelWidth = useTwoColumn
        ? (_panelWidthWorkspace).clamp(720.0, width * 0.78)
        : (useSidePanel ? _panelWidthCompact : width);
    final chatState = ref.watch(aiAssistantControllerProvider);

    ref.listen(aiAssistantControllerProvider, (previous, next) {
      if ((next.messages.length) > (previous?.messages.length ?? 0)) {
        _scrollToBottom();
      }
    });

    final panel = _AssistantPanel(
      isWide: useSidePanel,
      useTwoColumn: useTwoColumn,
      shellState: shellState,
      chatState: chatState,
      inputController: _inputController,
      scrollController: _scrollController,
      onClose: () => ref.read(aiAssistantShellProvider.notifier).close(),
      onToggleHistory: () =>
          ref.read(aiAssistantShellProvider.notifier).toggleHistory(),
      onToggleExpanded: () =>
          ref.read(aiAssistantShellProvider.notifier).toggleExpanded(),
      onNewChat: () {
        ref.read(aiAssistantShellProvider.notifier).clearBuildGuideContext();
        ref.read(aiAssistantControllerProvider.notifier).startNewChat();
        _inputController.clear();
      },
      onArchive: _confirmArchive,
      onSend: () => _sendMessage(),
      onSuggestedTap: (question) => _sendMessage(text: question),
      onRetry: () => ref
          .read(aiAssistantControllerProvider.notifier)
          .retryPendingSend(),
      onScrollNotification: (notification) {
        if (notification is ScrollUpdateNotification &&
            notification.metrics.maxScrollExtent > 0) {
          final distanceFromBottom = notification.metrics.maxScrollExtent -
              notification.metrics.pixels;
          _shouldAutoScroll = distanceFromBottom < 96;
        }
        return false;
      },
      onInputChanged: () => setState(() {}),
      onConversationSelected: (conversationId) {
        ref.read(aiAssistantShellProvider.notifier).clearBuildGuideContext();
        ref
            .read(aiAssistantControllerProvider.notifier)
            .openConversation(conversationId);
        if (!useTwoColumn) {
          ref.read(aiAssistantShellProvider.notifier).toggleHistory();
        } else if (shellState.showHistory) {
          ref.read(aiAssistantShellProvider.notifier).toggleHistory();
        }
      },
      onRestoreConversation: (conversationId) async {
        await ref
            .read(aiAssistantControllerProvider.notifier)
            .restoreConversation(conversationId);
        if (!context.mounted) {
          return;
        }
        ref.read(aiAssistantShellProvider.notifier).clearBuildGuideContext();
        ref
            .read(aiAssistantShellProvider.notifier)
            .setHistoryTab(AiHistoryTab.active);
        if (!useTwoColumn) {
          ref.read(aiAssistantShellProvider.notifier).toggleHistory();
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AiL10n.restoredNotice.resolve(context))),
        );
      },
      onHistoryTabChanged: (tab) =>
          ref.read(aiAssistantShellProvider.notifier).setHistoryTab(tab),
    );

    if (useSidePanel) {
      final colors = AppThemeColors.of(context);
      return Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: GestureDetector(
              onTap: () => ref.read(aiAssistantShellProvider.notifier).close(),
              child: ColoredBox(
                color: colors.overlay.withValues(alpha: 0.28),
              ),
            ),
          ),
          PositionedDirectional(
            top: 0,
            bottom: 0,
            end: 0,
            width: panelWidth.toDouble(),
            child: Material(
              elevation: 16,
              color: MaterialsUiPalette.of(context).pageBackground,
              shadowColor: colors.shadow.withValues(alpha: 0.25),
              child: panel,
            ),
          ),
        ],
      );
    }

    return Material(
      color: MaterialsUiPalette.of(context).pageBackground,
      child: SafeArea(
        child: SizedBox.expand(child: panel),
      ),
    );
  }
}

class _AssistantPanel extends StatelessWidget {
  const _AssistantPanel({
    required this.isWide,
    required this.useTwoColumn,
    required this.shellState,
    required this.chatState,
    required this.inputController,
    required this.scrollController,
    required this.onClose,
    required this.onToggleHistory,
    required this.onToggleExpanded,
    required this.onNewChat,
    required this.onArchive,
    required this.onSend,
    required this.onSuggestedTap,
    required this.onRetry,
    required this.onScrollNotification,
    required this.onInputChanged,
    required this.onConversationSelected,
    required this.onRestoreConversation,
    required this.onHistoryTabChanged,
  });

  final bool isWide;
  final bool useTwoColumn;
  final AiAssistantShellState shellState;
  final AiChatState chatState;
  final TextEditingController inputController;
  final ScrollController scrollController;
  final VoidCallback onClose;
  final VoidCallback onToggleHistory;
  final VoidCallback onToggleExpanded;
  final VoidCallback onNewChat;
  final VoidCallback onArchive;
  final VoidCallback onSend;
  final ValueChanged<String> onSuggestedTap;
  final VoidCallback onRetry;
  final bool Function(ScrollNotification notification) onScrollNotification;
  final VoidCallback onInputChanged;
  final ValueChanged<String> onConversationSelected;
  final ValueChanged<String> onRestoreConversation;
  final ValueChanged<AiHistoryTab> onHistoryTabChanged;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final canSend = chatState.canSend;
    final isOverLimit = inputController.text.length > aiMaxMessageLength;
    final showHistoryOnly = !useTwoColumn && shellState.showHistory;

    return ColoredBox(
      color: palette.pageBackground,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AiAssistantHeader(
            isWide: isWide,
            showHistory: shellState.showHistory,
            canArchive: chatState.conversationId != null,
            onClose: onClose,
            onToggleHistory: onToggleHistory,
            onToggleExpanded: onToggleExpanded,
            onNewChat: chatState.isSending ? null : onNewChat,
            onArchive: chatState.isSending ? null : onArchive,
          ),
          if (!showHistoryOnly && MediaQuery.sizeOf(context).width >= 280)
            AiAssistantSuggestionChips(
              onCategoryTap: onSuggestedTap,
              onFilterTap: onToggleHistory,
            ),
          Expanded(
            child: showHistoryOnly
                ? AiHistoryPanel(
                    tab: shellState.historyTab,
                    selectedConversationId: chatState.conversationId,
                    onTabChanged: onHistoryTabChanged,
                    onConversationSelected: onConversationSelected,
                    onRestoreConversation: onRestoreConversation,
                  )
                : useTwoColumn
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          SizedBox(
                            width: _historyColumnWidth,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: palette.cardSurface,
                                border: BorderDirectional(
                                  end: BorderSide(
                                    color: palette.borderSubtle
                                        .withValues(alpha: 0.9),
                                  ),
                                ),
                              ),
                              child: AiHistoryPanel(
                                tab: shellState.historyTab,
                                selectedConversationId: chatState.conversationId,
                                onTabChanged: onHistoryTabChanged,
                                onConversationSelected: onConversationSelected,
                                onRestoreConversation: onRestoreConversation,
                                embedded: true,
                                onViewAll: onToggleExpanded,
                              ),
                            ),
                          ),
                          Expanded(
                            child: _buildConversationBody(
                              context,
                              palette,
                              canSend,
                              isOverLimit,
                            ),
                          ),
                        ],
                      )
                    : _buildConversationBody(
                        context,
                        palette,
                        canSend,
                        isOverLimit,
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildConversationBody(
    BuildContext context,
    MaterialsUiPalette palette,
    bool canSend,
    bool isOverLimit,
  ) {
    if (chatState.loadStatus == AiChatLoadStatus.loading &&
        chatState.messages.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              AiL10n.loading.resolve(context),
              style: AppTextStyles.body(context),
            ),
          ],
        ),
      );
    }

    if (chatState.disabledByProvider) {
      return _InlineStatus(
        icon: Icons.smart_toy_outlined,
        message: AiL10n.aiDisabled.resolve(context),
      );
    }

    final messages = chatState.messages;
    final showEmpty = messages.isEmpty && !chatState.isSending;

    return Column(
      children: [
        if (shellState.buildGuideContext != null)
          AiBuildGuideContextBanner(
            buildContext: shellState.buildGuideContext!,
          ),
        Expanded(
          child: NotificationListener<ScrollNotification>(
            onNotification: onScrollNotification,
            child: showEmpty
                ? AiChatEmptyState(onSuggestedQuestionTap: onSuggestedTap)
                : AiChatThread(
                    messages: messages,
                    scrollController: scrollController,
                    isSending: chatState.isSending,
                  ),
          ),
        ),
        if (chatState.sendError != null)
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.xs,
            ),
            child: _SendErrorBanner(
              error: chatState.sendError!,
              isSending: chatState.isSending,
              onRetry: isRetryableAiError(chatState.sendError!.code)
                  ? onRetry
                  : null,
            ),
          ),
        AiComposer(
          controller: inputController,
          canSend: canSend && !isOverLimit,
          isSending: chatState.isSending,
          isDisabled: chatState.disabledByProvider,
          isOverLimit: isOverLimit,
          compact: MediaQuery.sizeOf(context).width < _compactHeaderBreakpoint,
          maxContentWidth: useTwoColumn ? 560 : (isWide ? 420 : null),
          onChanged: (_) => onInputChanged(),
          onSend: onSend,
        ),
      ],
    );
  }
}

class AiAssistantHeader extends StatelessWidget {
  const AiAssistantHeader({
    super.key,
    required this.isWide,
    required this.showHistory,
    required this.canArchive,
    required this.onClose,
    required this.onToggleHistory,
    required this.onToggleExpanded,
    required this.onNewChat,
    required this.onArchive,
  });

  final bool isWide;
  final bool showHistory;
  final bool canArchive;
  final VoidCallback onClose;
  final VoidCallback onToggleHistory;
  final VoidCallback onToggleExpanded;
  final VoidCallback? onNewChat;
  final VoidCallback? onArchive;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final colors = AppThemeColors.of(context);
    final viewportWidth = MediaQuery.sizeOf(context).width;
    final isCompactHeader = viewportWidth < _compactHeaderBreakpoint;
    final isUltraNarrow = viewportWidth < 280;

    return Container(
      padding: EdgeInsetsDirectional.fromSTEB(
        isUltraNarrow ? AppSpacing.xs : AppSpacing.sm,
        isUltraNarrow ? AppSpacing.sm : AppSpacing.md,
        isUltraNarrow ? AppSpacing.xs : AppSpacing.sm,
        AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: palette.cardSurface.withValues(alpha: 0.92),
        border: Border(
          bottom: BorderSide(
            color: palette.borderSubtle.withValues(alpha: 0.82),
          ),
        ),
      ),
      child: Row(
        children: [
          IconButton(
            tooltip: MaterialLocalizations.of(context).closeButtonLabel,
            onPressed: onClose,
            icon: Icon(isWide ? Icons.close_rounded : Icons.arrow_back_rounded),
            visualDensity: isCompactHeader ? VisualDensity.compact : null,
            iconSize: isUltraNarrow ? 20 : 24,
            padding: isUltraNarrow ? EdgeInsets.zero : null,
            constraints: isUltraNarrow
                ? const BoxConstraints(minWidth: 36, minHeight: 36)
                : null,
          ),
          if (!isCompactHeader) ...[
            IconButton(
              tooltip: AiL10n.history.resolve(context),
              onPressed: onToggleHistory,
              icon: Icon(
                showHistory ? Icons.chat_outlined : Icons.history_rounded,
              ),
            ),
            IconButton(
              tooltip: AiL10n.newChat.resolve(context),
              onPressed: onNewChat,
              icon: const Icon(Icons.auto_awesome_outlined),
            ),
          ],
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Flexible(
                      child: Text(
                        AiL10n.title.resolve(context),
                        style: AppTextStyles.title(context).copyWith(
                          color: palette.textPrimary,
                          fontSize: isUltraNarrow
                              ? 13
                              : (isCompactHeader ? 15 : 17),
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                      ),
                    ),
                    if (!isUltraNarrow) ...[
                      const SizedBox(width: AppSpacing.xs),
                      Container(
                        width: 26,
                        height: 26,
                        decoration: BoxDecoration(
                          color: colors.primary,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          Icons.auto_awesome_rounded,
                          color: colors.textOnPrimary,
                          size: 14,
                        ),
                      ),
                    ],
                  ],
                ),
                if (!isUltraNarrow) ...[
                  const SizedBox(height: 2),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: colors.success,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        AiL10n.statusActive.resolve(context),
                        style: AppTextStyles.label(context).copyWith(
                          color: palette.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          if (isCompactHeader)
            PopupMenuButton<_AssistantHeaderAction>(
              tooltip: AiL10n.history.resolve(context),
              icon: Icon(
                Icons.more_vert_rounded,
                size: isUltraNarrow ? 20 : 24,
              ),
              padding: isUltraNarrow ? EdgeInsets.zero : const EdgeInsets.all(8),
              constraints: isUltraNarrow
                  ? const BoxConstraints(minWidth: 36, minHeight: 36)
                  : null,
              onSelected: (action) {
                switch (action) {
                  case _AssistantHeaderAction.newChat:
                    onNewChat?.call();
                  case _AssistantHeaderAction.history:
                    onToggleHistory();
                  case _AssistantHeaderAction.archive:
                    onArchive?.call();
                }
              },
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: _AssistantHeaderAction.newChat,
                  enabled: onNewChat != null,
                  child: Text(AiL10n.newChat.resolve(context)),
                ),
                PopupMenuItem(
                  value: _AssistantHeaderAction.history,
                  child: Text(AiL10n.history.resolve(context)),
                ),
                if (canArchive)
                  PopupMenuItem(
                    value: _AssistantHeaderAction.archive,
                    enabled: onArchive != null,
                    child: Text(AiL10n.archive.resolve(context)),
                  ),
              ],
            )
          else ...[
            if (isWide)
              IconButton(
                tooltip: shellExpandedTooltip(context, isWide: true),
                onPressed: onToggleExpanded,
                icon: const Icon(Icons.open_in_full_rounded),
              ),
            if (canArchive)
              IconButton(
                tooltip: AiL10n.archive.resolve(context),
                onPressed: onArchive,
                icon: const Icon(Icons.archive_outlined),
              ),
            if (isWide)
              IconButton(
                tooltip: MaterialLocalizations.of(context).closeButtonLabel,
                onPressed: onClose,
                icon: const Icon(Icons.close_rounded),
              ),
          ],
        ],
      ),
    );
  }

  String shellExpandedTooltip(BuildContext context, {required bool isWide}) {
    return AiL10n.expand.resolve(context);
  }
}

enum _AssistantHeaderAction { newChat, history, archive }

class _InlineStatus extends StatelessWidget {
  const _InlineStatus({required this.icon, required this.message});

  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Center(
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 36, color: palette.textMuted),
            const SizedBox(height: AppSpacing.md),
            Text(
              message,
              style: AppTextStyles.body(context).copyWith(
                color: palette.textSecondary,
                height: 1.45,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _SendErrorBanner extends StatelessWidget {
  const _SendErrorBanner({
    required this.error,
    required this.isSending,
    this.onRetry,
  });

  final ApiException error;
  final bool isSending;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final message = AiL10n.errorMessageForCode(context, error.code);

    return DecoratedBox(
      decoration: BoxDecoration(
        color: materialWarning.withValues(alpha: 0.08),
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: materialWarning.withValues(alpha: 0.35)),
      ),
      child: Padding(
        padding: const EdgeInsetsDirectional.all(AppSpacing.sm),
        child: Row(
          children: [
            Icon(Icons.error_outline, color: materialWarning, size: 18),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                message,
                style: AppTextStyles.body(context).copyWith(
                  color: palette.textPrimary,
                  fontSize: 13,
                ),
              ),
            ),
            if (onRetry != null)
              TextButton(
                onPressed: isSending ? null : onRetry,
                child: Text(AiL10n.retry.resolve(context)),
              ),
          ],
        ),
      ),
    );
  }
}

class AiBuildGuideContextBanner extends StatelessWidget {
  const AiBuildGuideContextBanner({super.key, required this.buildContext});

  final BuildGuideContext buildContext;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);
    final readiness = buildContext.materialReadiness;
    final currentStepLabel = buildContext.currentStep == null
        ? AiL10n.preparingMaterialsBanner(context)
        : AiL10n.currentStepBanner(
            context,
            buildContext.currentStep!.stepNumber,
            buildContext.currentStep!.title,
          );

    return Container(
      width: double.infinity,
      margin: const EdgeInsetsDirectional.fromSTEB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        0,
      ),
      padding: const EdgeInsetsDirectional.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: palette.cardSurfaceAlt,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: palette.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            buildContext.projectTitle,
            style: AppTextStyles.subtitle(context).copyWith(
              color: palette.textPrimary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            AiL10n.materialsReadyBanner(
              context,
              readiness.ready,
              readiness.total,
            ),
            style: AppTextStyles.body(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            currentStepLabel,
            style: AppTextStyles.label(context).copyWith(
              color: palette.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class AiEmbeddedAssistantChat extends ConsumerStatefulWidget {
  const AiEmbeddedAssistantChat({
    super.key,
    this.composerEnabled = true,
    this.showSuggestedQuestions = true,
    this.infoFooter,
    this.authoringMode = false,
    this.authoringProjectUpdatedAt,
    this.authoringDraftSnapshot,
  });

  final bool composerEnabled;
  final bool showSuggestedQuestions;
  final Widget? infoFooter;
  final bool authoringMode;
  final DateTime? authoringProjectUpdatedAt;
  final AuthoringDraftSnapshot? authoringDraftSnapshot;

  @override
  ConsumerState<AiEmbeddedAssistantChat> createState() =>
      _AiEmbeddedAssistantChatState();
}

class _AiEmbeddedAssistantChatState extends ConsumerState<AiEmbeddedAssistantChat> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  bool _shouldAutoScroll = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _applyComposerPrefill());
  }

  @override
  void didUpdateWidget(covariant AiEmbeddedAssistantChat oldWidget) {
    super.didUpdateWidget(oldWidget);
    _applyComposerPrefill();
  }

  void _applyComposerPrefill() {
    final prefill = ref.read(aiAssistantShellProvider).composerPrefill;
    if (prefill == null || prefill.isEmpty) {
      return;
    }
    if (_inputController.text.trim().isEmpty) {
      _inputController.text = prefill;
      _inputController.selection = TextSelection.collapsed(offset: prefill.length);
    }
    ref.read(aiAssistantShellProvider.notifier).clearComposerPrefill();
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _sendMessage({String? text}) async {
    final locale = resolveAiLocale(context);
    final message = text ?? _inputController.text;
    final trimmed = message.trim();
    if (trimmed.isEmpty) {
      return;
    }

    final chatState = ref.read(aiAssistantControllerProvider);
    final controller = ref.read(aiAssistantControllerProvider.notifier);

    if (widget.authoringMode && chatState.activeDiscussionTarget != null) {
      if (ref.read(aiAssistantControllerProvider.notifier).hasActiveSequentialAuthoring) {
        await controller.submitSequentialDiscussionComment(
          text: trimmed,
          locale: locale,
        );
      } else {
        await controller.submitDiscussionComment(
          text: trimmed,
          locale: locale,
        );
      }
      if (text == null && mounted) {
        _inputController.clear();
      }
    } else {
      await controller.sendMessage(
        text: trimmed,
        locale: locale,
        onAccepted: text == null ? _inputController.clear : null,
      );
    }

    if (!mounted) {
      return;
    }

    _shouldAutoScroll = true;
    _scrollToBottom();
  }

  void _scrollToBottom() {
    if (!_shouldAutoScroll) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
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

  @override
  Widget build(BuildContext context) {
    final shellState = ref.watch(aiAssistantShellProvider);
    final chatState = ref.watch(aiAssistantControllerProvider);
    final canSend = chatState.canSend;
    final isOverLimit = _inputController.text.length > aiMaxMessageLength;

    ref.listen(aiAssistantControllerProvider, (previous, next) {
      if ((next.messages.length) > (previous?.messages.length ?? 0)) {
        _scrollToBottom();
      }
    });

    if (chatState.loadStatus == AiChatLoadStatus.loading &&
        chatState.messages.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              widget.authoringMode
                  ? AiL10n.analyzingIdea.resolve(context)
                  : AiL10n.loading.resolve(context),
              style: AppTextStyles.body(context),
            ),
          ],
        ),
      );
    }

    if (widget.authoringMode && chatState.isBootstrapping) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              AiL10n.analyzingIdea.resolve(context),
              style: AppTextStyles.body(context),
            ),
          ],
        ),
      );
    }

    if (chatState.disabledByProvider) {
      return _InlineStatus(
        icon: Icons.smart_toy_outlined,
        message: AiL10n.aiDisabled.resolve(context),
      );
    }

    final messages = chatState.messages;
    final showEmpty = messages.isEmpty &&
        !chatState.isSending &&
        !chatState.isBootstrapping &&
        !chatState.isGeneratingProposal;

    return Column(
      children: [
        if (shellState.buildGuideContext != null)
          AiBuildGuideContextBanner(
            buildContext: shellState.buildGuideContext!,
          ),
        Expanded(
          child: NotificationListener<ScrollNotification>(
            onNotification: (notification) {
              if (notification is ScrollUpdateNotification &&
                  notification.metrics.maxScrollExtent > 0) {
                final distanceFromBottom = notification.metrics.maxScrollExtent -
                    notification.metrics.pixels;
                _shouldAutoScroll = distanceFromBottom < 96;
              }
              return false;
            },
            child: showEmpty
                ? (widget.showSuggestedQuestions
                    ? AiChatEmptyState(
                        onSuggestedQuestionTap: (question) =>
                            _sendMessage(text: question),
                      )
                    : const SizedBox.shrink())
                : AiChatThread(
                    messages: messages,
                    scrollController: _scrollController,
                    isSending: chatState.isSending || chatState.isBootstrapping,
                    authoringProjectUpdatedAt: widget.authoringProjectUpdatedAt,
                    authoringDraftSnapshot: widget.authoringDraftSnapshot,
                  ),
          ),
        ),
        if (chatState.sendError != null)
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.xs,
            ),
            child: _SendErrorBanner(
              error: chatState.sendError!,
              isSending: chatState.isSending ||
                  chatState.isBootstrapping ||
                  chatState.isGeneratingProposal ||
                  chatState.isSubmittingReview,
              onRetry: isRetryableAiError(chatState.sendError!.code)
                  ? () {
                      if (chatState.pendingSend != null) {
                        ref
                            .read(aiAssistantControllerProvider.notifier)
                            .retryPendingSend();
                        return;
                      }
                      if (widget.authoringMode) {
                        ref
                            .read(aiAssistantControllerProvider.notifier)
                            .retryAuthoringFlow();
                        return;
                      }
                    }
                  : null,
            ),
          ),
        if (widget.composerEnabled) ...[
          if (widget.authoringMode &&
              chatState.activeDiscussionTarget != null)
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.xs,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: InputChip(
                      label: Text(
                        AiL10n.authoringDiscussingTargetLabel(
                          chatState.activeDiscussionTarget!,
                        ).resolve(context),
                        textDirection: resolveContentTextDirection(
                          AiL10n.authoringDiscussingTargetLabel(
                            chatState.activeDiscussionTarget!,
                          ).resolve(context),
                        ),
                      ),
                      onDeleted: () => ref
                          .read(aiAssistantControllerProvider.notifier)
                          .clearDiscussionTarget(),
                    ),
                  ),
                ],
              ),
            ),
          AiComposer(
            controller: _inputController,
            canSend: canSend && !isOverLimit,
            isSending: chatState.isSending ||
                chatState.isBootstrapping ||
                chatState.isGeneratingProposal ||
                chatState.isSubmittingReview,
            isDisabled: chatState.disabledByProvider,
            isOverLimit: isOverLimit,
            showAccessoryActions: !widget.authoringMode,
            hintText: widget.authoringMode
                ? (chatState.activeDiscussionTarget != null
                    ? AiL10n.authoringDiscussComposerHint(
                        chatState.activeDiscussionTarget!,
                      ).resolve(context)
                    : AiL10n.authoringInputHint.resolve(context))
                : null,
            onChanged: (_) => setState(() {}),
            onSend: () => _sendMessage(),
          ),
        ] else if (widget.infoFooter != null)
          widget.infoFooter!,
      ],
    );
  }
}

class AiEmbeddedAuthoringAssistant extends ConsumerWidget {
  const AiEmbeddedAuthoringAssistant({
    super.key,
    this.projectUpdatedAt,
    this.draftSnapshot,
  });

  final DateTime? projectUpdatedAt;
  final AuthoringDraftSnapshot? draftSnapshot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workspaceState = ref.watch(authoringWorkspaceControllerProvider);
    final workspaceScope = ref.watch(authoringActiveWorkspaceProvider);
    final locale = resolveAiLocale(context);
    final useWorkspacePanel = workspaceScope != null ||
        workspaceState.isReady ||
        workspaceState.isLoading ||
        workspaceState.lifecycle == AuthoringWorkspaceLifecycle.failed ||
        workspaceState.hasLegacyWithoutSession;

    if (useWorkspacePanel) {
      return AiSequentialAuthoringPanel(
        locale: locale,
        projectUpdatedAt: projectUpdatedAt,
        draftSnapshot: draftSnapshot,
      );
    }

    return AiEmbeddedAssistantChat(
      composerEnabled: true,
      showSuggestedQuestions: false,
      authoringMode: true,
      authoringProjectUpdatedAt: projectUpdatedAt,
      authoringDraftSnapshot: draftSnapshot,
    );
  }
}

class AiProjectAuthoringSidePanel extends StatelessWidget {
  const AiProjectAuthoringSidePanel({
    super.key,
    required this.width,
    required this.onClose,
    this.projectUpdatedAt,
    this.draftSnapshot,
  });

  final double width;
  final VoidCallback onClose;
  final DateTime? projectUpdatedAt;
  final AuthoringDraftSnapshot? draftSnapshot;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Material(
      color: palette.cardSurface,
      child: Container(
        width: width,
        decoration: BoxDecoration(
          color: palette.cardSurface,
          borderRadius: AppRadius.lgAll,
          border: Border.all(color: palette.borderSubtle),
        ),
        margin: const EdgeInsetsDirectional.only(
          end: AppSpacing.md,
          bottom: AppSpacing.md,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.xs,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.auto_awesome_outlined,
                    size: 20,
                    color: palette.heroMid,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      const LocalizedText(
                        en: 'AI project assistant',
                        ar: 'مساعد مشروع الذكاء الاصطناعي',
                      ).resolve(context),
                      style: AppTextStyles.subtitle(context).copyWith(
                        color: palette.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  AppStatusBadge(
                    label: const LocalizedText(
                      en: 'Draft',
                      ar: 'مسودة',
                    ).resolve(context),
                    tone: AppStatusTone.neutral,
                  ),
                  IconButton(
                    tooltip: const LocalizedText(
                      en: 'Close',
                      ar: 'إغلاق',
                    ).resolve(context),
                    onPressed: onClose,
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: AiEmbeddedAuthoringAssistant(
                projectUpdatedAt: projectUpdatedAt,
                draftSnapshot: draftSnapshot,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AiBuildGuideSidePanel extends StatelessWidget {
  const AiBuildGuideSidePanel({
    super.key,
    required this.width,
    required this.onClose,
  });

  final double width;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final palette = MaterialsUiPalette.of(context);

    return Material(
      color: palette.cardSurface,
      child: Container(
        width: width,
        decoration: BoxDecoration(
          border: BorderDirectional(
            start: BorderSide(color: palette.borderSubtle),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.xs,
                AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      const LocalizedText(
                        en: 'Build assistant',
                        ar: 'مساعد البناء',
                      ).resolve(context),
                      style: AppTextStyles.subtitle(context).copyWith(
                        color: palette.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    tooltip: const LocalizedText(
                      en: 'Close',
                      ar: 'إغلاق',
                    ).resolve(context),
                    onPressed: onClose,
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            const Expanded(
              child: AiEmbeddedAssistantChat(),
            ),
          ],
        ),
      ),
    );
  }
}
