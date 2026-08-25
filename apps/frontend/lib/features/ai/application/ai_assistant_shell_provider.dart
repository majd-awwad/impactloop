import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../learning_hub/application/learning_hub_providers.dart';
import '../../learning_hub/domain/models/project_build.dart';
import 'ai_chat_controller.dart';

enum AiHistoryTab { active, archived }

class AiAssistantShellState {
  const AiAssistantShellState({
    this.isOpen = false,
    this.isExpanded = false,
    this.showHistory = false,
    this.historyTab = AiHistoryTab.active,
    this.buildGuideContext,
    this.composerPrefill,
  });

  final bool isOpen;
  final bool isExpanded;
  final bool showHistory;
  final AiHistoryTab historyTab;
  final BuildGuideContext? buildGuideContext;
  final String? composerPrefill;

  AiAssistantShellState copyWith({
    bool? isOpen,
    bool? isExpanded,
    bool? showHistory,
    AiHistoryTab? historyTab,
    BuildGuideContext? buildGuideContext,
    bool clearBuildGuideContext = false,
    String? composerPrefill,
    bool clearComposerPrefill = false,
  }) {
    return AiAssistantShellState(
      isOpen: isOpen ?? this.isOpen,
      isExpanded: isExpanded ?? this.isExpanded,
      showHistory: showHistory ?? this.showHistory,
      historyTab: historyTab ?? this.historyTab,
      buildGuideContext: clearBuildGuideContext
          ? null
          : buildGuideContext ?? this.buildGuideContext,
      composerPrefill:
          clearComposerPrefill ? null : composerPrefill ?? this.composerPrefill,
    );
  }
}

final aiAssistantShellProvider =
    NotifierProvider<AiAssistantShellNotifier, AiAssistantShellState>(
  AiAssistantShellNotifier.new,
);

class AiAssistantShellNotifier extends Notifier<AiAssistantShellState> {
  @override
  AiAssistantShellState build() => const AiAssistantShellState();

  void open({
    String? conversationId,
    BuildGuideContext? buildGuideContext,
    bool? clearBuildGuideContext,
    String? composerPrefill,
  }) {
    final shouldClearBuildGuideContext =
        clearBuildGuideContext ??
        (conversationId == null && buildGuideContext == null);

    state = state.copyWith(
      isOpen: true,
      showHistory: false,
      buildGuideContext: shouldClearBuildGuideContext
          ? null
          : (buildGuideContext ?? state.buildGuideContext),
      clearBuildGuideContext: shouldClearBuildGuideContext,
      composerPrefill: composerPrefill ?? state.composerPrefill,
    );

    // Build-guide surfaces can create conversations outside this shell, so
    // refresh both cached lists whenever the assistant is reopened.
    ref.invalidate(aiActiveConversationsProvider);
    ref.invalidate(aiArchivedConversationsProvider);

    if (conversationId != null && conversationId.isNotEmpty) {
      ref
          .read(aiAssistantControllerProvider.notifier)
          .openConversation(conversationId);
    }
  }

  void close() {
    state = const AiAssistantShellState();
  }

  void clearComposerPrefill() {
    state = state.copyWith(clearComposerPrefill: true);
  }

  void toggleHistory({AiHistoryTab? tab}) {
    final nextTab = tab ?? state.historyTab;
    final willShowHistory = !state.showHistory;
    state = state.copyWith(
      showHistory: willShowHistory,
      historyTab: nextTab,
    );
    if (willShowHistory) {
      ref.invalidate(
        nextTab == AiHistoryTab.active
            ? aiActiveConversationsProvider
            : aiArchivedConversationsProvider,
      );
    }
  }

  void setHistoryTab(AiHistoryTab tab) {
    state = state.copyWith(historyTab: tab, showHistory: true);
    ref.invalidate(
      tab == AiHistoryTab.active
          ? aiActiveConversationsProvider
          : aiArchivedConversationsProvider,
    );
  }

  void toggleExpanded() {
    state = state.copyWith(isExpanded: !state.isExpanded);
  }

  void clearBuildGuideContext() {
    state = state.copyWith(clearBuildGuideContext: true);
  }

  void syncBuildGuideContextFromBuild(ProjectBuild build) {
    final current = state.buildGuideContext;
    if (current == null || current.projectId != build.projectId) {
      return;
    }

    state = state.copyWith(
      buildGuideContext: BuildGuideContext.fromProjectBuild(build),
    );
  }

  Future<void> refreshBuildGuideContext() async {
    final current = state.buildGuideContext;
    if (current == null) {
      return;
    }

    final build = await ref
        .read(learningHubRepositoryProvider)
        .fetchMyBuild(current.projectId);
    if (build == null) {
      return;
    }

    syncBuildGuideContextFromBuild(build);
  }
}
